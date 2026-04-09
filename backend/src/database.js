const { createClient } = require('@libsql/client');
const path = require('path');
require('dotenv').config();

const isProd = process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN;

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${path.join(__dirname, '..', 'revision_architect.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function initDB() {
  // Initialize tables
  const schema = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      webauthn_user_id TEXT UNIQUE,
      current_challenge TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS passkeys (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      webauthn_user_id TEXT NOT NULL,
      public_key BLOB NOT NULL,
      counter INTEGER NOT NULL,
      device_type TEXT NOT NULL,
      backed_up BOOLEAN NOT NULL,
      transports TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      total_marks INTEGER NOT NULL DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      marks INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL CHECK(priority IN ('A', 'B', 'C')) DEFAULT 'C',
      status TEXT NOT NULL CHECK(status IN ('Not Started', 'Revising', 'Done')) DEFAULT 'Not Started',
      sort_order INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      frequency TEXT DEFAULT 'Frequent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS revision_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      hours_available REAL NOT NULL,
      plan_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS settings (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS admins (
      email TEXT PRIMARY KEY
    );`,
    `CREATE TABLE IF NOT EXISTS study_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_date TEXT NOT NULL,
      activity_type TEXT NOT NULL DEFAULT 'chapter_update',
      count INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      session_id INTEGER,
      role TEXT NOT NULL CHECK(role IN ('user', 'model')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS template_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL CHECK(level IN ('foundation', 'inter', 'final')),
      name TEXT NOT NULL,
      total_marks INTEGER NOT NULL DEFAULT 100,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS template_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_subject_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      marks INTEGER NOT NULL DEFAULT 0,
      priority TEXT NOT NULL CHECK(priority IN ('A', 'B', 'C')) DEFAULT 'C',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_subject_id) REFERENCES template_subjects(id) ON DELETE CASCADE
    );`
  ];

  for (const query of schema) {
    await db.execute(query);
  }

  // Study activity index
  await db.execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_study_activity_unique ON study_activity(user_id, activity_date, activity_type);`);

  // Seed default admins
  const adminRes = await db.execute('SELECT COUNT(*) as count FROM admins');
  if (adminRes.rows[0].count === 0) {
    const defaultAdmins = ['nithilsuganthan@gmail.com'];
    if (process.env.GMAIL_USER) defaultAdmins.push(process.env.GMAIL_USER);
    for (const email of defaultAdmins) {
      await db.execute({ sql: 'INSERT OR IGNORE INTO admins (email) VALUES (?)', args: [email] });
    }
  }

  // Migrate / Seed Template data
  const templateCountRes = await db.execute('SELECT COUNT(*) as count FROM template_subjects');
  if (templateCountRes.rows[0].count === 0) {
    console.log("Seeding global template subjects and chapters...");
    
    const foundation = [
      { name: 'Accounting (Paper 1)', marks: 100, chapters: [{ name: 'Accounting Standards', marks: 16, priority: 'A' }, { name: 'Company Accounts', marks: 16, priority: 'A' }, { name: 'Partnership Accounts', marks: 12, priority: 'A' }, { name: 'Hire Purchase & Instalment', marks: 8, priority: 'B' }, { name: 'Investment Accounts', marks: 8, priority: 'B' }, { name: 'Insurance Claims', marks: 8, priority: 'B' }, { name: 'Departmental & Branch', marks: 8, priority: 'C' }] },
      { name: 'Business Law (Paper 2)', marks: 100, chapters: [{ name: 'Indian Contract Act', marks: 20, priority: 'A' }, { name: 'Sale of Goods Act', marks: 15, priority: 'A' }, { name: 'Indian Partnership Act', marks: 15, priority: 'A' }, { name: 'Companies Act', marks: 15, priority: 'B' }, { name: 'LLP Act', marks: 10, priority: 'C' }] },
      { name: 'Quantitative Aptitude (Paper 3)', marks: 100, chapters: [{ name: 'Math: Time Value of Money', marks: 15, priority: 'A' }, { name: 'Stats: Central Tendency', marks: 15, priority: 'A' }, { name: 'Logical Reasoning', marks: 20, priority: 'A' }, { name: 'Math: Ratio & Proportion', marks: 8, priority: 'B' }, { name: 'Stats: Correlation & Regression', marks: 10, priority: 'B' }] },
      { name: 'Business Economics (Paper 4)', marks: 100, chapters: [{ name: 'Theory of Demand and Supply', marks: 20, priority: 'A' }, { name: 'Price Determination in Markets', marks: 20, priority: 'A' }, { name: 'Business Cycles', marks: 15, priority: 'B' }, { name: 'National Income', marks: 15, priority: 'B' }] }
    ];

    const inter = [
      { name: 'Adv. Accounting (Paper 1)', marks: 100, chapters: [{ name: 'Accounting Standards', marks: 25, priority: 'A' }, { name: 'Company Accounts & Schedule III', marks: 20, priority: 'A' }, { name: 'Consolidated Fin. Statements', marks: 15, priority: 'A' }, { name: 'Amalgamation & Reconstruction', marks: 15, priority: 'B' }, { name: 'Branch Accounting', marks: 10, priority: 'B' }] },
      { name: 'Corporate & Other Laws (Paper 2)', marks: 100, chapters: [{ name: 'Company Law: Incorporation & Prospectus', marks: 20, priority: 'A' }, { name: 'Company Law: Share Capital', marks: 15, priority: 'A' }, { name: 'Company Law: Management & Admin', marks: 15, priority: 'A' }, { name: 'Other Laws: General Clauses Act', marks: 10, priority: 'B' }, { name: 'Other Laws: Interpretation of Statutes', marks: 10, priority: 'C' }] },
      { name: 'Taxation (Paper 3)', marks: 100, chapters: [{ name: 'DT: PGBP', marks: 15, priority: 'A' }, { name: 'DT: Capital Gains', marks: 10, priority: 'A' }, { name: 'DT: Total Income Computation', marks: 15, priority: 'A' }, { name: 'IDT: Supply under GST', marks: 10, priority: 'B' }, { name: 'IDT: Input Tax Credit', marks: 15, priority: 'A' }] },
      { name: 'Cost & Mgmt Accounting (Paper 4)', marks: 100, chapters: [{ name: 'Material & Labour Cost', marks: 15, priority: 'B' }, { name: 'Overheads & ABC', marks: 15, priority: 'A' }, { name: 'Standard Costing', marks: 15, priority: 'A' }, { name: 'Marginal Costing', marks: 15, priority: 'A' }, { name: 'Budgetary Control', marks: 10, priority: 'B' }] },
      { name: 'Auditing & Ethics (Paper 5)', marks: 100, chapters: [{ name: 'Risk Assessment & Internal Control', marks: 15, priority: 'A' }, { name: 'Audit Evidence & Documentation', marks: 15, priority: 'A' }, { name: 'Company Audit', marks: 20, priority: 'A' }, { name: 'Audit Report', marks: 10, priority: 'B' }, { name: 'Professional Ethics', marks: 15, priority: 'B' }] },
      { name: 'FM & SM (Paper 6)', marks: 100, chapters: [{ name: 'FM: Cost of Capital & Cap Structure', marks: 15, priority: 'A' }, { name: 'FM: Capital Budgeting', marks: 15, priority: 'A' }, { name: 'FM: Working Capital Mgmt', marks: 10, priority: 'B' }, { name: 'SM: Strategic Analysis', marks: 15, priority: 'B' }, { name: 'SM: Strategy Implementation', marks: 15, priority: 'C' }] }
    ];

    const final = [
      { name: 'Financial Reporting (Paper 1)', marks: 100, chapters: [{ name: 'Ind AS: Asset Based Standards', marks: 20, priority: 'A' }, { name: 'Ind AS: Consolidation', marks: 20, priority: 'A' }, { name: 'Ind AS: Business Combinations', marks: 15, priority: 'A' }, { name: 'Ind AS: Financial Instruments', marks: 20, priority: 'A' }, { name: 'Ind AS: Revenue (115) & Leases (116)', marks: 15, priority: 'A' }] },
      { name: 'Adv. Financial Mgmt (Paper 2)', marks: 100, chapters: [{ name: 'Forex Risk Management', marks: 20, priority: 'A' }, { name: 'Derivatives Analysis & Valuation', marks: 20, priority: 'A' }, { name: 'Portfolio Management', marks: 15, priority: 'A' }, { name: 'Mergers & Acquisitions', marks: 15, priority: 'B' }, { name: 'Mutual Funds', marks: 10, priority: 'C' }] },
      { name: 'Adv. Auditing & Ethics (Paper 3)', marks: 100, chapters: [{ name: 'Professional Ethics', marks: 20, priority: 'A' }, { name: 'Standards on Auditing', marks: 25, priority: 'A' }, { name: 'Audit of NBFCs/Banks', marks: 15, priority: 'B' }, { name: 'Internal & Operational Audit', marks: 10, priority: 'C' }, { name: 'Due Diligence & Investigation', marks: 10, priority: 'B' }] },
      { name: 'Direct Tax Laws (Paper 4)', marks: 100, chapters: [{ name: 'Total Income Computation', marks: 20, priority: 'A' }, { name: 'Assessment Procedures', marks: 15, priority: 'A' }, { name: 'Appeals & Revision', marks: 10, priority: 'B' }, { name: 'International Tax: Transfer Pricing', marks: 15, priority: 'A' }, { name: 'International Tax: DTAA', marks: 10, priority: 'B' }] },
      { name: 'Indirect Tax Laws (Paper 5)', marks: 100, chapters: [{ name: 'GST: Value of Supply', marks: 15, priority: 'A' }, { name: 'GST: Input Tax Credit', marks: 15, priority: 'A' }, { name: 'GST: Exemptions & RCM', marks: 15, priority: 'B' }, { name: 'GST: Assessment & Appeals', marks: 10, priority: 'B' }, { name: 'Customs: Valuation', marks: 15, priority: 'A' }, { name: 'Foreign Trade Policy', marks: 5, priority: 'C' }] },
      { name: 'IBS Case Study (Paper 6)', marks: 100, chapters: [{ name: 'Multi-disciplinary Case Study 1', marks: 25, priority: 'A' }, { name: 'Multi-disciplinary Case Study 2', marks: 25, priority: 'A' }, { name: 'Multi-disciplinary Case Study 3', marks: 25, priority: 'B' }, { name: 'Multi-disciplinary Case Study 4', marks: 25, priority: 'C' }] }
    ];

    const seedLevel = async (lvl, subjects) => {
      let subOrder = 0;
      for (const sub of subjects) {
        const res = await db.execute({
          sql: 'INSERT INTO template_subjects (level, name, total_marks, sort_order) VALUES (?, ?, ?, ?)',
          args: [lvl, sub.name, sub.marks, subOrder++]
        });
        const tmpSubId = Number(res.lastInsertRowid);
        
        let chOrder = 0;
        for (const ch of sub.chapters) {
          await db.execute({
            sql: 'INSERT INTO template_chapters (template_subject_id, name, marks, priority, sort_order) VALUES (?, ?, ?, ?, ?)',
            args: [tmpSubId, ch.name, ch.marks, ch.priority, chOrder++]
          });
        }
      }
    };

    await seedLevel('foundation', foundation);
    await seedLevel('inter', inter);
    await seedLevel('final', final);
  }
}

// Function to seed sample CA data for a specific user from templates
async function seedDataForUser(userId, level = 'foundation', resetSettings = true) {
  const subjectsRes = await db.execute({
    sql: 'SELECT * FROM template_subjects WHERE level = ? ORDER BY sort_order ASC',
    args: [level]
  });

  for (const sub of subjectsRes.rows) {
    const subRes = await db.execute({
      sql: 'INSERT INTO subjects (user_id, name, total_marks) VALUES (?, ?, ?)',
      args: [userId, sub.name, sub.total_marks]
    });
    const newSubjectId = Number(subRes.lastInsertRowid);
    
    const chaptersRes = await db.execute({
      sql: 'SELECT * FROM template_chapters WHERE template_subject_id = ? ORDER BY sort_order ASC',
      args: [sub.id]
    });

    for (let i = 0; i < chaptersRes.rows.length; i++) {
      const ch = chaptersRes.rows[i];
      await db.execute({
        sql: 'INSERT INTO chapters (subject_id, name, marks, priority, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        args: [newSubjectId, ch.name, ch.marks, ch.priority, 'Not Started', i]
      });
    }
  }

  if (resetSettings) {
    const settings = [
      [userId, 'student_name', 'CA Aspirant'],
      [userId, 'exam_date', ''],
      [userId, 'theme', 'dark'],
      [userId, 'level', level],
      [userId, 'pomodoros_completed', '0']
    ];
    for (const [uid, key, val] of settings) {
      await db.execute({
        sql: "INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)",
        args: [uid, key, val]
      });
    }
  }
}

module.exports = { db, initDB, seedDataForUser };
