const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const users = await db.execute("SELECT id, email FROM users");
  console.log("=== ALL USERS ===");
  for (const u of users.rows) {
    const subs = await db.execute({sql: "SELECT COUNT(*) as c FROM subjects WHERE user_id = ?", args: [u.id]});
    console.log(`  User ${u.id}: ${u.email} | Subjects: ${subs.rows[0].c}`);
  }

  const admins = await db.execute("SELECT * FROM admins");
  console.log("\n=== ADMINS ===");
  admins.rows.forEach(a => console.log(`  ${a.email}`));
  process.exit(0);
}
run();
