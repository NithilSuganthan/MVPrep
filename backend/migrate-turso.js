/**
 * Migration Script: Local SQLite → Turso Cloud
 * Reads all data from revision_architect.db and inserts into Turso.
 */
const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

// Source: Local SQLite file
const localDb = createClient({
  url: `file:${path.join(__dirname, 'revision_architect.db')}`,
});

// Destination: Turso Cloud
const tursoDb = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const TABLES = ['users', 'passkeys', 'subjects', 'chapters', 'settings', 'admins', 'study_activity', 'revision_plans'];

async function migrate() {
  console.log('🚀 Starting migration: Local SQLite → Turso Cloud\n');

  // Step 1: Clear existing Turso data (in reverse dependency order)
  console.log('🗑️  Clearing existing Turso data...');
  const clearOrder = ['revision_plans', 'study_activity', 'chapters', 'subjects', 'settings', 'passkeys', 'admins', 'users'];
  for (const table of clearOrder) {
    try {
      await tursoDb.execute(`DELETE FROM ${table}`);
      console.log(`   Cleared: ${table}`);
    } catch (e) {
      console.log(`   Skip (doesn't exist): ${table}`);
    }
  }

  // Step 2: Migrate each table
  console.log('\n📦 Migrating data...\n');

  for (const table of TABLES) {
    try {
      const result = await localDb.execute(`SELECT * FROM ${table}`);
      const rows = result.rows;

      if (rows.length === 0) {
        console.log(`   ${table}: 0 rows (empty)`);
        continue;
      }

      // Get column names from first row
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

      let inserted = 0;
      for (const row of rows) {
        const values = columns.map(col => row[col]);
        try {
          await tursoDb.execute({ sql, args: values });
          inserted++;
        } catch (e) {
          console.error(`   ⚠️  Error inserting into ${table}:`, e.message);
        }
      }
      console.log(`   ✅ ${table}: ${inserted}/${rows.length} rows migrated`);
    } catch (e) {
      console.log(`   ⏩ ${table}: skipped (${e.message})`);
    }
  }

  // Step 3: Verify
  console.log('\n📊 Verification:\n');
  for (const table of TABLES) {
    try {
      const local = await localDb.execute(`SELECT COUNT(*) as c FROM ${table}`);
      const turso = await tursoDb.execute(`SELECT COUNT(*) as c FROM ${table}`);
      const localCount = local.rows[0].c;
      const tursoCount = turso.rows[0].c;
      const match = localCount === tursoCount ? '✅' : '❌';
      console.log(`   ${match} ${table}: Local=${localCount} → Turso=${tursoCount}`);
    } catch (e) {
      console.log(`   ⏩ ${table}: couldn't verify`);
    }
  }

  console.log('\n🎉 Migration complete!');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
