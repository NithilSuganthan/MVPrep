const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  const emails = [
    'nithilsuganthan@gmail.com',
    'nithilsuganthan123@gmail.com',
    'nithilsuganthan1214@gmail.com',
    'maithreyev@gmail.com'
  ];
  for (const email of emails) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO admins (email) VALUES (?)', args: [email] });
    console.log(`✅ ${email} → admin`);
  }
  
  const admins = await db.execute("SELECT * FROM admins");
  console.log("\nAll admins now:", admins.rows.map(a => a.email));
  process.exit(0);
}
run();
