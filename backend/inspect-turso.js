const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const users = await db.execute("SELECT id, email FROM users");
  console.log("=== USERS IN TURSO (after migration) ===");
  for (const u of users.rows) {
    console.log(`  ID ${u.id}: ${u.email}`);
  }
  const admins = await db.execute("SELECT * FROM admins");
  console.log("\n=== ADMINS ===");
  admins.rows.forEach(a => console.log(`  ${a.email}`));
  process.exit(0);
}
run();
