import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const currentPool = new Pool({ connectionString: process.env.DATABASE_URL });
const oldPool = new Pool({ connectionString: process.env.OLD_DB });

async function migrateRecipes() {
  const currentClient = await currentPool.connect();

  try {
    console.log('Starting migration...');

    // 1. Fetch source data from old database
    const { rows: oldRecipes } = await oldPool.query(`
      SELECT id, name, category, created_at, deleted_at, image_url, description, details, updated_at
      FROM recipes
    `);

    const { rows: oldNutrition } = await oldPool.query(`
      SELECT recipe_id, calories, protein_grams, carbs_grams, fat_grams, created_at, updated_at, deleted_at
      FROM nutrition
    `);

    // 2. Fetch existing data from target database into memory
    const { rows: existingTargetRecipes } = await currentClient.query(`
      SELECT id, name FROM recipes
    `);

    const { rows: existingTargetNutrition } = await currentClient.query(`
      SELECT recipe_id FROM nutrition
    `);

    // Build lookup structures for fast checking without N+1 queries
    const targetRecipeByName = new Map(
      existingTargetRecipes.map((r) => [r.name.toLowerCase().trim(), r.id])
    );
    const targetNutritionByRecipeId = new Set(
      existingTargetNutrition.map((n) => n.recipe_id)
    );
    const nutritionMap = new Map(oldNutrition.map((n) => [n.recipe_id, n]));
    const oldToNewRecipeIdMap = new Map();

    console.log(
      `Loaded ${oldRecipes.length} old recipes and ${existingTargetRecipes.length} existing target recipes.`
    );

    await currentClient.query('BEGIN');

    let migratedRecipes = 0;
    let skippedRecipes = 0;
    let migratedNutrition = 0;

    // 3. Process recipes and nutrition in transaction
    for (const oldRecipe of oldRecipes) {
      const normalizedName = oldRecipe.name.toLowerCase().trim();
      let newRecipeId = targetRecipeByName.get(normalizedName);

      if (newRecipeId) {
        skippedRecipes++;
      } else {
        const insertRecipeRes = await currentClient.query(
          `INSERT INTO recipes (name, description, instructions, category, image_url, servings, difficulty, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id`,
          [
            oldRecipe.name,
            oldRecipe.description || null,
            oldRecipe.details || null,
            oldRecipe.category || 'general',
            oldRecipe.image_url || null,
            1,
            'medium',
            oldRecipe.created_at,
            oldRecipe.updated_at,
            oldRecipe.deleted_at || null,
          ]
        );

        newRecipeId = insertRecipeRes.rows[0].id;
        targetRecipeByName.set(normalizedName, newRecipeId);
        migratedRecipes++;
      }

      oldToNewRecipeIdMap.set(oldRecipe.id, newRecipeId);

      // Process matching nutrition entry
      const nut = nutritionMap.get(oldRecipe.id);
      if (nut && !targetNutritionByRecipeId.has(newRecipeId)) {
        await currentClient.query(
          `INSERT INTO nutrition (recipe_id, calories, protein_grams, carbs_grams, fat_grams, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            newRecipeId,
            nut.calories || 0,
            nut.protein_grams || 0,
            nut.carbs_grams || 0,
            nut.fat_grams || 0,
            nut.created_at,
            nut.updated_at,
            nut.deleted_at || null,
          ]
        );

        targetNutritionByRecipeId.add(newRecipeId);
        migratedNutrition++;
      }
    }

    await currentClient.query('COMMIT');

    console.log(`Migration Complete!
    - Recipes Inserted: ${migratedRecipes}
    - Recipes Skipped: ${skippedRecipes}
    - Nutrition Inserted: ${migratedNutrition}`);
  } catch (error) {
    await currentClient.query('ROLLBACK');
    console.error('Migration failed, rolled back changes:', error);
  } finally {
    currentClient.release();
    await oldPool.end();
    await currentPool.end();
  }
}

migrateRecipes();
