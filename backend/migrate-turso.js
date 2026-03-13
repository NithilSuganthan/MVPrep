const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
  console.log("Adding missing columns to chapters table...");
  
  try {
    await db.execute("ALTER TABLE chapters ADD COLUMN notes TEXT DEFAULT ''");
    console.log("✅ Added 'notes' column");
  } catch(e) {
    if (e.message.includes('duplicate column')) {
      console.log("⏩ 'notes' column already exists");
    } else {
      console.error("Error adding notes:", e.message);
    }
  }

  try {
    await db.execute("ALTER TABLE chapters ADD COLUMN frequency TEXT DEFAULT 'Frequent'");
    console.log("✅ Added 'frequency' column");
  } catch(e) {
    if (e.message.includes('duplicate column')) {
      console.log("⏩ 'frequency' column already exists");
    } else {
      console.error("Error adding frequency:", e.message);
    }
  }

  // Verify
  const cols = await db.execute("PRAGMA table_info(chapters)");
  console.log("\nChapters table columns:");
  cols.rows.forEach(c => console.log(`  ${c.name} (${c.type})`));
  
  console.log("\n✅ Migration complete!");
  process.exit(0);
}
migrate();
