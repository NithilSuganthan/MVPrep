const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkDB() {
  try {
    const users = await db.execute("SELECT id, email FROM users");
    const out = [];
    for (let u of users.rows) {
        const subjects = await db.execute({sql: "SELECT * FROM subjects WHERE user_id = ?", args: [u.id]});
        const chapters = await db.execute({sql: "SELECT count(*) as count FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE s.user_id = ?", args: [u.id]});
        const settings = await db.execute({sql: "SELECT * FROM settings WHERE user_id = ?", args: [u.id]});
        out.push({user: u, subjectsCount: subjects.rows.length, chaptersCount: chapters.rows[0].count, settings: settings.rows});
    }
    console.log(JSON.stringify(out, null, 2));
  } catch(e) {
    console.error("DB Check Failed:", e);
  }
}
checkDB();
