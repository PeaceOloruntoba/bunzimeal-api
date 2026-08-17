import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const currentPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const oldPool = new Pool({
  connectionString: process.env.OLD_DB,
});

// Safely handles string decimals like "340.00" without crashing
const toFloat = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  const num = Number(val);
  return Number.isNaN(num) ? 0 : num;
};

async function migrateRecipes() {
  try {
    console.log('Fetching recipes from old database...');

    const oldRecipesResult = await oldPool.query(`
      SELECT id, name, category, created_at, deleted_at, image_url, description, details, updated_at
      FROM recipes
    `);

    const oldRecipes = oldRecipesResult.rows;
    console.log(`Found ${oldRecipes.length} recipes in old database.\n`);

    const recipeIdMap = new Map();
    let migratedRecipesCount = 0;
    let skippedRecipesCount = 0;
    let migratedNutritionCount = 0;

    console.log('--- MIGRATING RECIPES ---');
    for (let i = 0; i < oldRecipes.length; i++) {
      const oldRecipe = oldRecipes[i];
      const progress = `[${i + 1}/${oldRecipes.length}]`;

      // Check if exists
      const existingRecipe = await currentPool.query(
        'SELECT id FROM recipes WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))',
        [oldRecipe.name]
      );

      if (existingRecipe.rows.length > 0) {
        const existingId = existingRecipe.rows[0].id;
        recipeIdMap.set(oldRecipe.id, existingId);
        skippedRecipesCount++;
        console.log(`${progress} Skipped: "${oldRecipe.name}" (already exists with ID ${existingId})`);
        continue;
      }

      // Insert recipe
      const newRecipeResult = await currentPool.query(
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

      const newRecipeId = newRecipeResult.rows[0].id;
      recipeIdMap.set(oldRecipe.id, newRecipeId);
      migratedRecipesCount++;
      console.log(`${progress} Migrated: "${oldRecipe.name}" (old ID: ${oldRecipe.id} -> new ID: ${newRecipeId})`);
    }

    console.log(`\nRecipe phase complete: ${migratedRecipesCount} inserted, ${skippedRecipesCount} skipped.\n`);

    console.log('--- MIGRATING NUTRITION ---');
    const oldNutritionResult = await oldPool.query(`
      SELECT id, recipe_id, calories, protein_grams, carbs_grams, fat_grams, created_at, updated_at, deleted_at
      FROM nutrition
    `);

    const oldNutrition = oldNutritionResult.rows;
    console.log(`Found ${oldNutrition.length} nutrition rows in old database.\n`);

    for (let i = 0; i < oldNutrition.length; i++) {
      const oldNut = oldNutrition[i];
      const progress = `[${i + 1}/${oldNutrition.length}]`;
      const newRecipeId = recipeIdMap.get(oldNut.recipe_id);

      if (!newRecipeId) {
        console.log(`${progress} Skipped nutrition for old recipe_id ${oldNut.recipe_id} (recipe not found in map)`);
        continue;
      }

      const existingNutrition = await currentPool.query(
        'SELECT id FROM nutrition WHERE recipe_id = $1',
        [newRecipeId]
      );

      if (existingNutrition.rows.length > 0) {
        console.log(`${progress} Skipped nutrition for target recipe_id ${newRecipeId} (already exists)`);
        continue;
      }

      await currentPool.query(
        `INSERT INTO nutrition (recipe_id, calories, protein_grams, carbs_grams, fat_grams, created_at, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newRecipeId,
          toFloat(oldNut.calories),
          toFloat(oldNut.protein_grams),
          toFloat(oldNut.carbs_grams),
          toFloat(oldNut.fat_grams),
          oldNut.created_at,
          oldNut.updated_at,
          oldNut.deleted_at || null,
        ]
      );

      migratedNutritionCount++;
      console.log(`${progress} Migrated nutrition for target recipe_id ${newRecipeId}`);
    }

    console.log(`\n========================================`);
    console.log(`MIGRATION FINISHED SUCCESSFULY`);
    console.log(`Recipes: ${migratedRecipesCount} inserted, ${skippedRecipesCount} skipped`);
    console.log(`Nutrition: ${migratedNutritionCount} inserted`);
    console.log(`========================================`);

  } catch (error) {
    console.error('\nMigration encountered an error:', error);
  } finally {
    await oldPool.end();
    await currentPool.end();
    process.exit(0);
  }
}

migrateRecipes();
