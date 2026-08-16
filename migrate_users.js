// script to migrate users into our current db from old db.
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Current database connection
const currentPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Old database connection
const oldPool = new Pool({
  connectionString: process.env.OLD_DB,
});

async function migrateUsers() {
  try {
    console.log('Starting user migration...');

    // Connect to old database
    await oldPool.connect();
    console.log('Connected to old database');

    // Connect to current database
    await currentPool.connect();
    console.log('Connected to current database');

    // Fetch users from old database
    const oldUsersResult = await oldPool.query(`
      SELECT email, first_name, last_name, created_at, country_id, role
      FROM users
    `);

    const oldUsers = oldUsersResult.rows;
    console.log(`Found ${oldUsers.length} users in old database`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const user of oldUsers) {
      // Check if user already exists in current database
      const existingUser = await currentPool.query(
        'SELECT id FROM users WHERE email = $1',
        [user.email]
      );

      if (existingUser.rows.length > 0) {
        console.log(`Skipping ${user.email} - already exists`);
        skippedCount++;
        continue;
      }

      // Handle null last_name - replace with empty string
      const lastName = user.last_name || '';

      // Insert user with migration=true and empty password_hash
      await currentPool.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, created_at, country_id, role, migration)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user.email, '', user.first_name, lastName, user.created_at, user.country_id, user.role, true]
      );

      migratedCount++;
      console.log(`Migrated ${user.email}`);
    }

    console.log(`Migration complete. Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await oldPool.end();
    await currentPool.end();
  }
}

migrateUsers();