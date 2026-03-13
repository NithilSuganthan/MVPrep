const { db, initDB, seedDataForUser } = require('./src/database');

async function run() {
    try {
        console.log("Initializing DB...");
        await initDB();
        console.log("DB initialized.");
        console.log("Attempting to insert a user...");
        const res = await db.execute("INSERT INTO users (email, password_hash) VALUES ('test_user_turso@example.com', 'hash') RETURNING id");
        const userId = Number(res.rows[0].id);
        console.log("Created user ID:", userId);
        console.log("Seeding data for user...");
        await seedDataForUser(userId, 'foundation');
        console.log("Data seeded successfully!");
        process.exit(0);
    } catch(e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
run();
