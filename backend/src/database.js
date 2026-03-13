const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'revision_architect.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    webauthn_user_id TEXT UNIQUE,
    current_challenge TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS passkeys (
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
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    total_marks INTEGER NOT NULL DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    marks INTEGER NOT NULL DEFAULT 0,
    priority TEXT NOT NULL CHECK(priority IN ('A', 'B', 'C')) DEFAULT 'C',
    status TEXT NOT NULL CHECK(status IN ('Not Started', 'Revising', 'Done')) DEFAULT 'Not Started',
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS revision_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    subject_id INTEGER NOT NULL,
    hours_available REAL NOT NULL,
    plan_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admins (
    email TEXT PRIMARY KEY
  );

  CREATE TABLE IF NOT EXISTS study_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_date TEXT NOT NULL,
    activity_type TEXT NOT NULL DEFAULT 'chapter_update',
    count INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_study_activity_unique 
    ON study_activity(user_id, activity_date, activity_type);
`);

// Seed default admins if table is empty
const adminCount = db.prepare('SELECT COUNT(*) as count FROM admins').get().count;
if (adminCount === 0) {
  const insertAdmin = db.prepare('INSERT OR IGNORE INTO admins (email) VALUES (?)');
  insertAdmin.run('nithilsuganthan@gmail.com');
  if (process.env.GMAIL_USER) insertAdmin.run(process.env.GMAIL_USER);
}

// Function to seed sample CA data for a specific user
const seedDataForUser = (userId, level = 'foundation', resetSettings = true) => {
  const insertSubject = db.prepare('INSERT INTO subjects (user_id, name, total_marks) VALUES (?, ?, ?)');
  const insertChapter = db.prepare('INSERT INTO chapters (subject_id, name, marks, priority, status, sort_order) VALUES (?, ?, ?, ?, ?, ?)');

  const seedTx = db.transaction(() => {
    let subjectsData = [];

    if (level === 'foundation') {
      subjectsData = [
        {
          name: 'Accounting (Paper 1)', marks: 100,
          chapters: [
            { name: 'Accounting Standards', marks: 16, priority: 'A', status: 'Done' },
            { name: 'Company Accounts', marks: 16, priority: 'A', status: 'Revising' },
            { name: 'Partnership Accounts', marks: 12, priority: 'A', status: 'Not Started' },
            { name: 'Hire Purchase & Instalment', marks: 8, priority: 'B', status: 'Not Started' },
            { name: 'Investment Accounts', marks: 8, priority: 'B', status: 'Not Started' },
            { name: 'Insurance Claims', marks: 8, priority: 'B', status: 'Not Started' },
            { name: 'Departmental & Branch', marks: 8, priority: 'C', status: 'Not Started' }
          ]
        },
        {
          name: 'Business Law (Paper 2)', marks: 100,
          chapters: [
            { name: 'Indian Contract Act', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Sale of Goods Act', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Indian Partnership Act', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Companies Act', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'LLP Act', marks: 10, priority: 'C', status: 'Not Started' }
          ]
        },
        {
          name: 'Quantitative Aptitude (Paper 3)', marks: 100,
          chapters: [
            { name: 'Math: Time Value of Money', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Stats: Central Tendency', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Logical Reasoning', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Math: Ratio & Proportion', marks: 8, priority: 'B', status: 'Not Started' },
            { name: 'Stats: Correlation & Regression', marks: 10, priority: 'B', status: 'Not Started' }
          ]
        },
        {
          name: 'Business Economics (Paper 4)', marks: 100,
          chapters: [
            { name: 'Theory of Demand and Supply', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Price Determination in Markets', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Business Cycles', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'National Income', marks: 15, priority: 'B', status: 'Not Started' }
          ]
        }
      ];
    } else if (level === 'inter') {
      subjectsData = [
        {
          name: 'Adv. Accounting (Paper 1)', marks: 100,
          chapters: [
            { name: 'Accounting Standards', marks: 25, priority: 'A', status: 'Done' },
            { name: 'Company Accounts & Schedule III', marks: 20, priority: 'A', status: 'Revising' },
            { name: 'Consolidated Fin. Statements', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Amalgamation & Reconstruction', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'Branch Accounting', marks: 10, priority: 'B', status: 'Not Started' }
          ]
        },
        {
          name: 'Corporate & Other Laws (Paper 2)', marks: 100,
          chapters: [
            { name: 'Company Law: Incorporation & Prospectus', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Company Law: Share Capital', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Company Law: Management & Admin', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Other Laws: General Clauses Act', marks: 10, priority: 'B', status: 'Not Started' },
            { name: 'Other Laws: Interpretation of Statutes', marks: 10, priority: 'C', status: 'Not Started' }
          ]
        },
        {
          name: 'Taxation (Paper 3)', marks: 100,
          chapters: [
            { name: 'DT: PGBP', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'DT: Capital Gains', marks: 10, priority: 'A', status: 'Not Started' },
            { name: 'DT: Total Income Computation', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'IDT: Supply under GST', marks: 10, priority: 'B', status: 'Not Started' },
            { name: 'IDT: Input Tax Credit', marks: 15, priority: 'A', status: 'Not Started' }
          ]
        },
        {
          name: 'Cost & Mgmt Accounting (Paper 4)', marks: 100,
          chapters: [
            { name: 'Material & Labour Cost', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'Overheads & ABC', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Standard Costing', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Marginal Costing', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Budgetary Control', marks: 10, priority: 'B', status: 'Not Started' }
          ]
        },
        {
          name: 'Auditing & Ethics (Paper 5)', marks: 100,
          chapters: [
            { name: 'Risk Assessment & Internal Control', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Audit Evidence & Documentation', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Company Audit', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Audit Report', marks: 10, priority: 'B', status: 'Not Started' },
            { name: 'Professional Ethics', marks: 15, priority: 'B', status: 'Not Started' }
          ]
        },
        {
          name: 'FM & SM (Paper 6)', marks: 100,
          chapters: [
            { name: 'FM: Cost of Capital & Cap Structure', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'FM: Capital Budgeting', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'FM: Working Capital Mgmt', marks: 10, priority: 'B', status: 'Not Started' },
            { name: 'SM: Strategic Analysis', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'SM: Strategy Implementation', marks: 15, priority: 'C', status: 'Not Started' }
          ]
        }
      ];
    } else if (level === 'final') {
      subjectsData = [
        {
          name: 'Financial Reporting (Paper 1)', marks: 100,
          chapters: [
            { name: 'Ind AS: Asset Based Standards', marks: 20, priority: 'A', status: 'Revising' },
            { name: 'Ind AS: Consolidation', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Ind AS: Business Combinations', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Ind AS: Financial Instruments', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Ind AS: Revenue (115) & Leases (116)', marks: 15, priority: 'A', status: 'Not Started' }
          ]
        },
        {
          name: 'Adv. Financial Mgmt (Paper 2)', marks: 100,
          chapters: [
            { name: 'Forex Risk Management', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Derivatives Analysis & Valuation', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Portfolio Management', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Mergers & Acquisitions', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'Mutual Funds', marks: 10, priority: 'C', status: 'Not Started' }
          ]
        },
        {
          name: 'Adv. Auditing & Ethics (Paper 3)', marks: 100,
          chapters: [
            { name: 'Professional Ethics', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Standards on Auditing', marks: 25, priority: 'A', status: 'Not Started' },
            { name: 'Audit of NBFCs/Banks', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'Internal & Operational Audit', marks: 10, priority: 'C', status: 'Not Started' },
            { name: 'Due Diligence & Investigation', marks: 10, priority: 'B', status: 'Not Started' }
          ]
        },
        {
          name: 'Direct Tax Laws (Paper 4)', marks: 100,
          chapters: [
            { name: 'Total Income Computation', marks: 20, priority: 'A', status: 'Not Started' },
            { name: 'Assessment Procedures', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Appeals & Revision', marks: 10, priority: 'B', status: 'Not Started' },
            { name: 'International Tax: Transfer Pricing', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'International Tax: DTAA', marks: 10, priority: 'B', status: 'Not Started' }
          ]
        },
        {
          name: 'Indirect Tax Laws (Paper 5)', marks: 100,
          chapters: [
            { name: 'GST: Value of Supply', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'GST: Input Tax Credit', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'GST: Exemptions & RCM', marks: 15, priority: 'B', status: 'Not Started' },
            { name: 'GST: Assessment & Appeals', marks: 10, priority: 'B', status: 'Not Started' },
            { name: 'Customs: Valuation', marks: 15, priority: 'A', status: 'Not Started' },
            { name: 'Foreign Trade Policy', marks: 5, priority: 'C', status: 'Not Started' }
          ]
        },
        {
          name: 'IBS Case Study (Paper 6)', marks: 100,
          chapters: [
            { name: 'Multi-disciplinary Case Study 1', marks: 25, priority: 'A', status: 'Not Started' },
            { name: 'Multi-disciplinary Case Study 2', marks: 25, priority: 'A', status: 'Not Started' },
            { name: 'Multi-disciplinary Case Study 3', marks: 25, priority: 'B', status: 'Not Started' },
            { name: 'Multi-disciplinary Case Study 4', marks: 25, priority: 'C', status: 'Not Started' }
          ]
        }
      ];
    }

    // Insert all subjects and their chapters
    subjectsData.forEach(sub => {
      const insertedSub = insertSubject.run(userId, sub.name, sub.marks);
      sub.chapters.forEach((ch, index) => {
        insertChapter.run(insertedSub.lastInsertRowid, ch.name, ch.marks, ch.priority, ch.status, index);
      });
    });

    if (resetSettings) {
      const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (user_id, key, value) VALUES (?, ?, ?)");
      insertSetting.run(userId, 'student_name', 'CA Aspirant');
      insertSetting.run(userId, 'exam_date', '');
      insertSetting.run(userId, 'theme', 'dark');
      insertSetting.run(userId, 'level', level);
      insertSetting.run(userId, 'pomodoros_completed', '0');
    }
  });

  seedTx();
};

module.exports = { db, seedDataForUser };
