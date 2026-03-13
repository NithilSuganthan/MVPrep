const { createClient } = require('@libsql/client');
require('dotenv').config();

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function run() {
    try {
        console.log("Checking tables in Turso:", process.env.TURSO_DATABASE_URL);
        const res = await db.execute("SELECT name FROM sqlite_schema WHERE type='table'");
        console.log("Tables:", res.rows);
        process.exit(0);
    } catch(e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
run();
