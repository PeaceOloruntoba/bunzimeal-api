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

    // Fetch all old recipes and nutrition in batch
    const { rows: oldRecipes } = await oldPool.query(`
      SELECT id, name, category, created_at, deleted_at, image_url, description, details, updated_at
      FROM recipes
    `);

    const { rows: oldNutrition } = await oldPool.query(`
      SELECT recipe_id, calories, protein_grams, carbs_grams, fat_grams, created_at, updated_at, deleted_at
      FROM nutrition
    `);

    console.log(`Loaded ${oldRecipes.length} recipes and ${oldNutrition.length} nutrition rows from source.`);

    // Group nutrition by old recipe_id for faster lookup
    const nutritionMap = new Map(oldNutrition.map(n => [n.recipe_id, n]));
    const recipeIdMap = new Map();

    await currentClient.query('BEGIN');

    let migratedRecipes = 0;
    let skippedRecipes = 0;
    let migratedNutrition = 0;

    for (const oldRecipe of oldRecipes) {
      // Upsert recipe by name (Requires a UNIQUE constraint on recipes.name)
      const res = await currentClient.query(
        `INSERT INTO recipes (name, description, instructions, category, image_url, servings, difficulty, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (name) DO UPDATE SET updated_at = EXCLUDED.updated_at
         RETURNING id, (xmin = 0) AS is_inserted`,
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

      const newRecipeId = res.rows[0].id;
      recipeIdMap.set(oldRecipe.id, newRecipeId);

      if (res.rows[0].is_inserted) {
        migratedRecipes++;
      } else {
        skippedRecipes++;
      }

      // Migrate corresponding nutrition data
      const nut = nutritionMap.get(oldRecipe.id);
      if (nut) {
        await currentClient.query(
          `INSERT INTO nutrition (recipe_id, calories, protein_grams, carbs_grams, fat_grams, created_at, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (recipe_id) DO NOTHING`,
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
        migratedNutrition++;
      }
    }

    await currentClient.query('COMMIT');
    console.log(`Migration Complete! Recipes: ${migratedRecipes} inserted, ${skippedRecipes} skipped. Nutrition: ${migratedNutrition} processed.`);
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
