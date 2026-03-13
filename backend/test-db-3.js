const { db, initDB, seedDataForUser } = require('./src/database');

async function run() {
    try {
        console.log("Initializing DB...");
        await initDB();
        console.log("DB initialized.");
        console.log("Attempting to insert a user...");
        const res = await db.execute("INSERT INTO users (email, password_hash) VALUES ('test_user_turso_2@example.com', 'hash') RETURNING id");
        const userId = Number(res.rows[0].id);
        console.log("Created user ID:", userId);
        console.log("Seeding data for user...");
        await seedDataForUser(userId, 'foundation');
        console.log("Data seeded successfully!");
        
        // Verify subjects were created
        const subjectsRes = await db.execute({sql: 'SELECT COUNT(*) as count FROM subjects WHERE user_id = ?', args: [userId]});
        console.log("Subjects count:", subjectsRes.rows[0].count);
        process.exit(0);
    } catch(e) {
        console.error("Test failed:", e);
        process.exit(1);
    }
}
run();
