const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
  await db.execute({ sql: 'INSERT OR IGNORE INTO admins (email) VALUES (?)', args: ['nithilsuganthan@gmail.com'] });
  console.log("Done! nithilsuganthan@gmail.com is now admin.");
  process.exit(0);
}
run();
