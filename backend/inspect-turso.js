const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkDB() {
  try {
    const users = await db.execute("SELECT id, email FROM users");
    console.log("Users:", users.rows);

    for (let u of users.rows) {
        console.log(`\n--- User ${u.id} (${u.email}) ---`);
        const subjects = await db.execute({sql: "SELECT * FROM subjects WHERE user_id = ?", args: [u.id]});
        console.log("Subjects count:", subjects.rows.length);
        
        const settings = await db.execute({sql: "SELECT * FROM settings WHERE user_id = ?", args: [u.id]});
        console.log("Settings:", settings.rows);
    }
  } catch(e) {
    console.error("DB Check Failed:", e);
  }
}

checkDB();
