const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const crypto = require('crypto');
const { db, seedDataForUser, initDB } = require('./src/database');
const { startEmailCrons, sendEmail, verifyTransporter } = require('./src/email');

const JWT_SECRET = process.env.JWT_SECRET || 'ca-revision-architect-secret';
const app = express();
const PORT = process.env.PORT || 3001;

// WebAuthn Relying Party config — set these in env for production
const rpID = process.env.RP_ID || 'localhost';
const expectedOrigin = process.env.EXPECTED_ORIGIN || `http://localhost:${PORT}`;

// Helper to reliably get local ISO date (YYYY-MM-DD)
const getLocalISODate = (d = new Date()) => {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0')
  ].join('-');
};

// Initialize DB and start server
async function bootstrap() {
  try {
    console.log('☁️ Initializing Cloud Database...');
    await initDB();
    console.log('✅ Database connected & schema ready.');

    app.listen(PORT, async () => {
      console.log(`🚀 MVPrep Server running on port ${PORT}`);
      
      // Verify SMTP Transporter
      const smtpCheck = await verifyTransporter();
      if (smtpCheck.success) {
        console.log('✅ SMTP Transporter: Verified & Ready');
      } else {
        console.warn('⚠️ SMTP Transporter Error:', smtpCheck.error);
        console.warn('Emails may not be delivered. Check GMAIL_APP_PASSWORD env var.');
      }

      console.log('📅 Starting Study Reminder crons...');
      startEmailCrons();
    });
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err);
    process.exit(1);
  }
}

// ==================== MIDDLEWARE ====================
const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173']
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // permissive for now
    }
  },
  credentials: true
}));
app.use(express.json());

// ==================== KEEP-AWAKE PING ====================
app.get('/api/ping', (req, res) => {
  res.json({ status: 'awake', time: Date.now() });
});

// ==================== AUTHENTICATION ====================

// ==================== AUTHENTICATION ====================

app.post('/api/register', async (req, res) => {
  try {
    const { email, password, name, level = 'foundation' } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existingUserRes = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email]
    });
    if (existingUserRes.rows[0]) return res.status(400).json({ error: 'Email already registered' });

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await db.execute({
      sql: 'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      args: [email, passwordHash]
    });
    const userId = Number(result.lastInsertRowid);

    // Seed mock data & settings for new user
    await seedDataForUser(userId, level);
    if (name) {
      await db.execute({
        sql: "INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, 'student_name', ?)",
        args: [userId, name]
      });
    }

    const token = jwt.sign({ id: userId, email }, JWT_SECRET);

    // Send Welcome Email Notification in background
    const htmlContent = `
      <h2 style="color: #4CAF50;">Welcome to MVPrep! 🏛️</h2>
      <p>Hello ${name || 'Aspirant'},</p>
      <p>Your account was successfully registered! You can now start optimizing your revision plan.</p>
      <br>
      <p>Best of luck with your CA exams! 💪</p>
    `;
    sendEmail(email, 'Welcome to MVPrep', htmlContent).catch(e => console.error('Background Email Error:', e));

    res.json({ success: true, token, user: { id: userId, email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE email = ?',
      args: [email]
    });
    const user = userRes.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);

    // Send Login Notification asynchronously
    const htmlContent = `
      <h2 style="color: #2196F3;">Login Alert 🔐</h2>
      <p>Your MVPrep account was just accessed.</p>
      <p>If this was you, you can safely ignore this email. Ready to hit the books?</p>
    `;
    sendEmail(user.email, 'Security Alert: New Login', htmlContent);

    res.json({ success: true, token, user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware to protect routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token.' });
    req.user = user;
    next();
  });
};

// Helper to get subjects filtered by CA Inter strategy
const _getFilteredSubjects = async (userId) => {
  const levelRes = await db.execute({
    sql: "SELECT value FROM settings WHERE key = 'level' AND user_id = ?",
    args: [userId]
  });
  const level = levelRes.rows[0] ? levelRes.rows[0].value : 'foundation';

  const subjectsRes = await db.execute({
    sql: 'SELECT * FROM subjects WHERE user_id = ? ORDER BY id',
    args: [userId]
  });
  let subjects = subjectsRes.rows;

  let interStrategy = 'both';
  if (level === 'inter') {
    const stratRes = await db.execute({
      sql: "SELECT value FROM settings WHERE key = 'ca_inter_strategy' AND user_id = ?",
      args: [userId]
    });
    if (stratRes.rows[0]) interStrategy = stratRes.rows[0].value;
    
    if (interStrategy !== 'both') {
      subjects = subjects.filter(sub => {
        const name = sub.name.toLowerCase();
        // Group 1: Paper 1, 2, 3 — Group 2: Paper 4, 5, 6
        const paperMatch = name.match(/paper\s*(\d)/);
        if (!paperMatch) return true; // keep non-standard subjects
        const paperNum = parseInt(paperMatch[1]);
        if (interStrategy === 'group_1') return paperNum <= 3;
        if (interStrategy === 'group_2') return paperNum >= 4;
        return true;
      });
    }
  }

  return { level, interStrategy, subjects };
};

// ==================== WEB-AUTHN PASSKEYS ====================

app.post('/api/passkeys/generate-registration', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.execute({
      sql: 'SELECT id, email, webauthn_user_id FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const user = userRes.rows[0];
    let webAuthnUserId = user.webauthn_user_id;
    
    // If user has no webauthn_user_id, generate one and update DB
    if (!webAuthnUserId) {
      webAuthnUserId = crypto.randomUUID();
      await db.execute({
        sql: 'UPDATE users SET webauthn_user_id = ? WHERE id = ?',
        args: [webAuthnUserId, req.user.id]
      });
    }

    const userPasskeysRes = await db.execute({
      sql: 'SELECT id, public_key FROM passkeys WHERE user_id = ?',
      args: [req.user.id]
    });
    const userPasskeys = userPasskeysRes.rows;
    
    const options = generateRegistrationOptions({
      rpName: 'MVPrep',
      rpID,
      userID: new Uint8Array(Buffer.from(webAuthnUserId)),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: userPasskeys.map(pk => ({
        id: pk.id, // Assuming pk.id is base64url string, but SWA takes string
        type: 'public-key',
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    await db.execute({
      sql: 'UPDATE users SET current_challenge = ? WHERE id = ?',
      args: [options.challenge, req.user.id]
    });
    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/passkeys/verify-registration', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.execute({
      sql: 'SELECT id, email, webauthn_user_id, current_challenge FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const user = userRes.rows[0];
    const expectedChallenge = user.current_challenge;

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      });
    } catch (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    if (verification.verified && verification.registrationInfo) {
      const { credentialPublicKey, credentialID, counter, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

      const transports = JSON.stringify(req.body.response.transports || []);
      const credIdBase64Url = Buffer.from(credentialID).toString('base64url');

      await db.execute({
        sql: `
          INSERT INTO passkeys (id, user_id, webauthn_user_id, public_key, counter, device_type, backed_up, transports)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          credIdBase64Url,
          user.id,
          user.webauthn_user_id,
          Buffer.from(credentialPublicKey),
          counter,
          credentialDeviceType,
          credentialBackedUp ? 1 : 0,
          transports
        ]
      });

      // Clear challenge
      await db.execute({
        sql: 'UPDATE users SET current_challenge = NULL WHERE id = ?',
        args: [user.id]
      });

      return res.json({ success: true, verified: true });
    }
    return res.status(400).json({ error: 'Failed to verify passkey' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/passkeys/generate-authentication', (req, res) => {
  try {
    // Generate auth options for ANY user (discoverable)
    const options = generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
    });

    // Store challenge somewhere global since we don't know the user yet
    // Hacky for MVP: We just insert into a temp challenge or memory.
    global.passkeyChallenge = options.challenge;

    res.json(options);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/passkeys/verify-authentication', async (req, res) => {
  try {
    const expectedChallenge = global.passkeyChallenge;
    const credIdBase64Url = req.body.id;

    const authPasskeyRes = await db.execute({
      sql: 'SELECT * FROM passkeys WHERE id = ?',
      args: [credIdBase64Url]
    });
    const authPasskey = authPasskeyRes.rows[0];
    if (!authPasskey) return res.status(400).json({ error: 'Passkey not found on system.' });

    const userRes = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [authPasskey.user_id]
    });
    const user = userRes.rows[0];
    if (!user) return res.status(400).json({ error: 'User bound to passkey not found.' });

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: req.body,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: Buffer.from(authPasskey.id, 'base64url'),
          credentialPublicKey: authPasskey.public_key,
          counter: authPasskey.counter,
          transports: authPasskey.transports ? JSON.parse(authPasskey.transports) : [],
        },
      });
    } catch (error) {
      console.error(error);
      return res.status(400).json({ error: error.message });
    }

    if (verification.verified) {
      // Update counter
      await db.execute({
        sql: 'UPDATE passkeys SET counter = ? WHERE id = ?',
        args: [verification.authenticationInfo.newCounter, authPasskey.id]
      });

      // Login success
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);

      // Send Login Notification via Passkey
      const htmlContent = `
        <h2 style="color: #2196F3;">Login Alert 🔐</h2>
        <p>Your MVPrep account was just accessed using a Passkey.</p>
        <p>If this was you, you can safely ignore this email.</p>
      `;
      sendEmail(user.email, 'Security Alert: New Passkey Login', htmlContent);

      return res.json({ success: true, verified: true, token, user: { id: user.id, email: user.email } });
    }

    return res.status(400).json({ error: 'Failed to authenticate passkey.' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== NOTES ====================

app.get('/api/notes', authenticateToken, async (req, res) => {
  try {
    const { subjects } = await _getFilteredSubjects(req.user.id);
    
    const data = await Promise.all(subjects.map(async sub => {
      const chaptersRes = await db.execute({
        sql: 'SELECT id, name, notes FROM chapters WHERE subject_id = ? ORDER BY sort_order',
        args: [sub.id]
      });
      return { id: sub.id, name: sub.name, chapters: chaptersRes.rows };
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SUBJECTS ====================

app.get('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const { subjects } = await _getFilteredSubjects(req.user.id);

    const enriched = await Promise.all(subjects.map(async sub => {
      const chaptersRes = await db.execute({
        sql: 'SELECT * FROM chapters WHERE subject_id = ? ORDER BY sort_order',
        args: [sub.id]
      });
      const chapters = chaptersRes.rows;

      const marksCovered = chapters
        .filter(ch => ch.status === 'Done')
        .reduce((sum, ch) => sum + ch.marks, 0);
      const marksRevising = chapters
        .filter(ch => ch.status === 'Revising')
        .reduce((sum, ch) => sum + ch.marks, 0);

      const aChapters = chapters.filter(ch => ch.priority === 'A');
      const bChapters = chapters.filter(ch => ch.priority === 'B');
      const cChapters = chapters.filter(ch => ch.priority === 'C');

      return {
        ...sub,
        chapters,
        marksCovered,
        marksRevising,
        totalChapters: chapters.length,
        completedChapters: chapters.filter(ch => ch.status === 'Done').length,
        confidenceScore: sub.total_marks > 0 ? Math.round((marksCovered / sub.total_marks) * 100) : 0,
        stats: {
          A: {
            total: aChapters.reduce((s, c) => s + c.marks, 0),
            covered: aChapters.filter(c => c.status === 'Done').reduce((s, c) => s + c.marks, 0),
            count: aChapters.length,
            done: aChapters.filter(c => c.status === 'Done').length,
          },
          B: {
            total: bChapters.reduce((s, c) => s + c.marks, 0),
            covered: bChapters.filter(c => c.status === 'Done').reduce((s, c) => s + c.marks, 0),
            count: bChapters.length,
            done: bChapters.filter(c => c.status === 'Done').length,
          },
          C: {
            total: cChapters.reduce((s, c) => s + c.marks, 0),
            covered: cChapters.filter(c => c.status === 'Done').reduce((s, c) => s + c.marks, 0),
            count: cChapters.length,
            done: cChapters.filter(c => c.status === 'Done').length,
          },
        }
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const { subjects } = await _getFilteredSubjects(req.user.id);
    const subject = subjects.find(s => s.id === parseInt(req.params.id));
    
    if (!subject) return res.status(404).json({ error: 'Subject not found in current strategy' });

    const chaptersRes = await db.execute({
      sql: 'SELECT * FROM chapters WHERE subject_id = ? ORDER BY sort_order',
      args: [req.params.id]
    });
    res.json({ ...subject, chapters: chaptersRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const { name, total_marks } = req.body;
    const result = await db.execute({
      sql: 'INSERT INTO subjects (user_id, name, total_marks) VALUES (?, ?, ?)',
      args: [req.user.id, name, total_marks || 100]
    });

    const today = getLocalISODate();
    await db.execute({
      sql: `
        INSERT INTO study_activity (user_id, activity_date, activity_type, count)
        VALUES (?, ?, 'chapter_update', 1)
        ON CONFLICT(user_id, activity_date, activity_type) DO UPDATE SET count = count + 1
      `,
      args: [req.user.id, today]
    });

    res.json({ id: Number(result.lastInsertRowid), name, total_marks: total_marks || 100 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subjects/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM subjects WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const { name, total_marks } = req.body;

    // Ensure subject belongs to user
    const subjectRes = await db.execute({
      sql: 'SELECT id FROM subjects WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user.id]
    });
    if (!subjectRes.rows[0]) return res.status(404).json({ error: 'Subject not found' });

    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (total_marks !== undefined) { updates.push('total_marks = ?'); values.push(total_marks); }

    if (updates.length > 0) {
      values.push(req.params.id);
      await db.execute({
        sql: `UPDATE subjects SET ${updates.join(', ')} WHERE id = ?`,
        args: values
      });
    }

    const updatedRes = await db.execute({
      sql: 'SELECT * FROM subjects WHERE id = ?',
      args: [req.params.id]
    });
    res.json(updatedRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CHAPTERS ====================

app.patch('/api/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const { status, priority, marks, name, sort_order, notes, frequency } = req.body;
    
    // Ensure the chapter belongs to the user
    const chapterRes = await db.execute({
      sql: 'SELECT c.id FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE c.id = ? AND s.user_id = ?',
      args: [req.params.id, req.user.id]
    });
    const chapter = chapterRes.rows[0];
    if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

    const updates = [];
    const values = [];

    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (marks !== undefined) { updates.push('marks = ?'); values.push(marks); }
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (frequency !== undefined) { updates.push('frequency = ?'); values.push(frequency); }

    if (updates.length > 0) {
      values.push(req.params.id);
      await db.execute({
        sql: `UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`,
        args: values
      });

      // Log study activity for heatmap
      const today = getLocalISODate();
      await db.execute({
        sql: `
          INSERT INTO study_activity (user_id, activity_date, activity_type, count)
          VALUES (?, ?, 'chapter_update', 1)
          ON CONFLICT(user_id, activity_date, activity_type) DO UPDATE SET count = count + 1
        `,
        args: [req.user.id, today]
      });
    }

    const updatedRes = await db.execute({
      sql: 'SELECT * FROM chapters WHERE id = ?',
      args: [req.params.id]
    });
    res.json(updatedRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chapters', authenticateToken, async (req, res) => {
  try {
    const { subject_id, name, marks, priority, status, notes, frequency } = req.body;
    
    // Ensure subject belongs to user
    const subjectRes = await db.execute({
      sql: 'SELECT id FROM subjects WHERE id = ? AND user_id = ?',
      args: [subject_id, req.user.id]
    });
    if (!subjectRes.rows[0]) return res.status(404).json({ error: 'Subject not found' });

    const maxOrderRes = await db.execute({
      sql: 'SELECT MAX(sort_order) as max_order FROM chapters WHERE subject_id = ?',
      args: [subject_id]
    });
    const sort_order = (maxOrderRes.rows[0]?.max_order || 0) + 1;

    const result = await db.execute({
      sql: 'INSERT INTO chapters (subject_id, name, marks, priority, status, sort_order, notes, frequency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      args: [subject_id, name, marks || 0, priority || 'C', status || 'Not Started', sort_order, notes || '', frequency || 'Frequent']
    });

    const today = getLocalISODate();
    await db.execute({
      sql: `
        INSERT INTO study_activity (user_id, activity_date, activity_type, count)
        VALUES (?, ?, 'chapter_update', 1)
        ON CONFLICT(user_id, activity_date, activity_type) DO UPDATE SET count = count + 1
      `,
      args: [req.user.id, today]
    });

    const chapterRes = await db.execute({
      sql: 'SELECT * FROM chapters WHERE id = ?',
      args: [result.lastInsertRowid]
    });
    res.json(chapterRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const { level, interStrategy, subjects } = await _getFilteredSubjects(req.user.id);
    const subjectIds = subjects.map(s => s.id);

    const allChaptersRes = await db.execute({
      sql: `
        SELECT c.* FROM chapters c
        JOIN subjects s ON c.subject_id = s.id
        WHERE s.user_id = ?
      `,
      args: [req.user.id]
    });
    // Filter chapters to only included subjects
    const allChapters = allChaptersRes.rows.filter(ch => subjectIds.includes(ch.subject_id));

    const pomodoroDataRes = await db.execute({
      sql: "SELECT value FROM settings WHERE key = 'pomodoros_completed' AND user_id = ?",
      args: [req.user.id]
    });
    const pomodoroData = pomodoroDataRes.rows[0];
    let totalPomodoros = pomodoroData ? parseInt(pomodoroData.value) : 0;

    let totalMarks = 0;
    let marksCovered = 0;
    let aTotal = 0, aCovered = 0;
    let bTotal = 0, bCovered = 0;
    let cTotal = 0, cCovered = 0;

    subjects.forEach(sub => totalMarks += sub.total_marks);

    allChapters.forEach(ch => {
      if (ch.priority === 'A') { aTotal += ch.marks; if (ch.status === 'Done') aCovered += ch.marks; }
      if (ch.priority === 'B') { bTotal += ch.marks; if (ch.status === 'Done') bCovered += ch.marks; }
      if (ch.priority === 'C') { cTotal += ch.marks; if (ch.status === 'Done') cCovered += ch.marks; }
      if (ch.status === 'Done') marksCovered += ch.marks;
    });

    const confidenceScore = totalMarks > 0 ? Math.round((marksCovered / totalMarks) * 100) : 0;
    
    // Smart Revision Order — filter by active subjects
    const smartRevisionOrderRes = await db.execute({
      sql: `
        SELECT c.*, s.name as subject_name FROM chapters c
        JOIN subjects s ON c.subject_id = s.id
        WHERE s.user_id = ? AND c.status != 'Done'
        ORDER BY 
          CASE c.priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 END,
          CASE c.frequency WHEN 'Very Frequent' THEN 1 WHEN 'Frequent' THEN 2 ELSE 3 END,
          c.marks DESC
        LIMIT 15
      `,
      args: [req.user.id]
    });
    const smartRevisionOrder = smartRevisionOrderRes.rows
      .filter(ch => subjectIds.includes(ch.subject_id))
      .slice(0, 5);

    // High Risk Chapters — filter by active subjects
    const highRiskChaptersRes = await db.execute({
      sql: `
        SELECT c.*, s.name as subject_name FROM chapters c
        JOIN subjects s ON c.subject_id = s.id
        WHERE s.user_id = ? AND c.status = 'Not Started' AND c.priority = 'A' AND c.marks >= 8
        ORDER BY c.marks DESC
        LIMIT 15
      `,
      args: [req.user.id]
    });
    const highRiskChapters = highRiskChaptersRes.rows
      .filter(ch => subjectIds.includes(ch.subject_id))
      .slice(0, 5);

    // ====== ENHANCED SCORE PREDICTOR ======
    const subjectPredictions = subjects.map(sub => {
      const subChapters = allChapters.filter(c => c.subject_id === sub.id);
      let subDoneMarks = 0, subRevisingMarks = 0, subTotalChapterMarks = 0;
      let subADone = 0, subATotal = 0, subBDone = 0, subBTotal = 0;
      
      subChapters.forEach(ch => {
        subTotalChapterMarks += ch.marks;
        if (ch.status === 'Done') subDoneMarks += ch.marks;
        if (ch.status === 'Revising') subRevisingMarks += ch.marks;
        if (ch.priority === 'A') { subATotal += ch.marks; if (ch.status === 'Done') subADone += ch.marks; }
        if (ch.priority === 'B') { subBTotal += ch.marks; if (ch.status === 'Done') subBDone += ch.marks; }
      });

      const predictedScore = Math.round(subDoneMarks * 0.85 + subRevisingMarks * 0.50);
      const maxPossible = sub.total_marks;
      const passingMarks = Math.ceil(maxPossible * 0.40);
      const isPassing = predictedScore >= passingMarks;
      const pct = maxPossible > 0 ? Math.round((predictedScore / maxPossible) * 100) : 0;
      const priorityFocus = subATotal > 0 ? Math.round((subADone / subATotal) * 100) : 100;

      return {
        id: sub.id,
        name: sub.name,
        totalMarks: maxPossible,
        predictedScore,
        passingMarks,
        isPassing,
        pct,
        priorityFocus,
        doneChapters: subChapters.filter(c => c.status === 'Done').length,
        totalChapters: subChapters.length,
        grade: pct >= 60 ? 'A' : pct >= 50 ? 'B' : pct >= 40 ? 'C' : 'F'
      };
    });

    const overallPredictedMin = subjectPredictions.reduce((s, p) => s + Math.floor(p.predictedScore * 0.9), 0);
    const overallPredictedMax = subjectPredictions.reduce((s, p) => s + Math.ceil(p.predictedScore * 1.05), 0);
    const passingSubjects = subjectPredictions.filter(p => p.isPassing).length;
    const allPassing = passingSubjects === subjectPredictions.length;

    res.json({
      level,
      interStrategy,
      totalMarks,
      marksCovered,
      remaining: Math.max(0, totalMarks - marksCovered),
      confidenceScore,
      expectedScore: { min: overallPredictedMin, max: overallPredictedMax },
      subjectPredictions,
      passingSubjects,
      totalSubjectCount: subjects.length,
      allPassing,
      smartRevisionOrder,
      highRiskChapters,
      totalChapters: allChapters.length,
      completedChapters: allChapters.filter(c => c.status === 'Done').length,
      revisingChapters: allChapters.filter(c => c.status === 'Revising').length,
      subjectCount: subjects.length,
      breakdown: {
        A: { total: aTotal, covered: aCovered },
        B: { total: bTotal, covered: bCovered },
        C: { total: cTotal, covered: cCovered },
      },
      totalPomodoros
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pomodoro', authenticateToken, async (req, res) => {
  try {
    const countRes = await db.execute({
      sql: "SELECT value FROM settings WHERE key = 'pomodoros_completed' AND user_id = ?",
      args: [req.user.id]
    });
    const count = countRes.rows[0];
    let updatedCount = count ? parseInt(count.value) + 1 : 1;
    
    await db.execute({
      sql: "INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, 'pomodoros_completed', ?)",
      args: [req.user.id, String(updatedCount)]
    });

    // Log pomodoro activity for heatmap
    const today = getLocalISODate();
    await db.execute({
      sql: `
        INSERT INTO study_activity (user_id, activity_date, activity_type, count)
        VALUES (?, ?, 'pomodoro', 1)
        ON CONFLICT(user_id, activity_date, activity_type) DO UPDATE SET count = count + 1
      `,
      args: [req.user.id, today]
    });
    
    res.json({ success: true, pomodoros_completed: updatedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== STUDY ACTIVITY HEATMAP ====================

app.post('/api/focus-time', authenticateToken, async (req, res) => {
  try {
    const { focusSeconds = 0, restSeconds = 0 } = req.body;
    const today = getLocalISODate();

    if (focusSeconds > 0) {
      await db.execute({
        sql: `
          INSERT INTO study_activity (user_id, activity_date, activity_type, count)
          VALUES (?, ?, 'focus_seconds', ?)
          ON CONFLICT(user_id, activity_date, activity_type) DO UPDATE SET count = count + ?
        `,
        args: [req.user.id, today, focusSeconds, focusSeconds]
      });
    }

    if (restSeconds > 0) {
      await db.execute({
        sql: `
          INSERT INTO study_activity (user_id, activity_date, activity_type, count)
          VALUES (?, ?, 'rest_seconds', ?)
          ON CONFLICT(user_id, activity_date, activity_type) DO UPDATE SET count = count + ?
        `,
        args: [req.user.id, today, restSeconds, restSeconds]
      });
    }

    // Get updated totals for today
    const focusRes = await db.execute({
      sql: "SELECT count FROM study_activity WHERE user_id = ? AND activity_date = ? AND activity_type = 'focus_seconds'",
      args: [req.user.id, today]
    });
    const restRes = await db.execute({
      sql: "SELECT count FROM study_activity WHERE user_id = ? AND activity_date = ? AND activity_type = 'rest_seconds'",
      args: [req.user.id, today]
    });

    res.json({
      success: true,
      focusSecondsToday: focusRes.rows[0]?.count || 0,
      restSecondsToday: restRes.rows[0]?.count || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/activity', authenticateToken, async (req, res) => {
  try {
    // Get last 365 days of activity, grouping regular activity vs focus/rest
    const activitiesRes = await db.execute({
      sql: `
        SELECT 
          activity_date, 
          SUM(CASE WHEN activity_type NOT IN ('focus_seconds', 'rest_seconds') THEN count ELSE 0 END) as total_count,
          SUM(CASE WHEN activity_type = 'focus_seconds' THEN count ELSE 0 END) as focus_seconds,
          SUM(CASE WHEN activity_type = 'rest_seconds' THEN count ELSE 0 END) as rest_seconds
        FROM study_activity
        WHERE user_id = ? AND activity_date >= date('now', 'localtime', '-365 days')
        GROUP BY activity_date
        ORDER BY activity_date ASC
      `,
      args: [req.user.id]
    });
    const activities = activitiesRes.rows;

    // Calculate current streak based on days with REGULAR activity or FOCUS time
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter to days that actually have study inputs
    const activeDates = activities.filter(a => a.total_count > 0 || a.focus_seconds > 0);
    const dateSet = new Set(activeDates.map(a => a.activity_date));

    // Check backwards from today for current streak
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = getLocalISODate(checkDate);
      if (dateSet.has(dateStr)) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    const allDates = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      allDates.push(getLocalISODate(d));
    }
    allDates.forEach(d => {
      if (dateSet.has(d)) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    });

    const totalActiveDays = activeDates.length;
    const totalActions = activeDates.reduce((sum, a) => sum + a.total_count, 0);

    res.json({
      activities,
      currentStreak,
      longestStreak,
      totalActiveDays,
      totalActions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== REVISION PLANNER ====================

app.post('/api/revision-plan', authenticateToken, async (req, res) => {
  try {
    const { subject_id, hours_available, study_speed = 'normal', include_c = true } = req.body;

    const { level, interStrategy, subjects } = await _getFilteredSubjects(req.user.id);
    const subject = subjects.find(s => s.id === parseInt(subject_id));
    if (!subject) return res.status(404).json({ error: 'Subject not found in current strategy' });

    let speedMult = 1.0;
    if (study_speed === 'fast') speedMult = 0.8;
    if (study_speed === 'slow') speedMult = 1.25;

    let query = `SELECT * FROM chapters WHERE subject_id = ? AND status != 'Done'`;
    if (!include_c) query += ` AND priority != 'C'`;
    query += ` ORDER BY CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 END, marks DESC`;

    const chaptersRes = await db.execute({
      sql: query,
      args: [subject_id]
    });
    const chapters = chaptersRes.rows;
    const totalHours = parseFloat(hours_available) || 12;
    const totalChapterMarks = chapters.reduce((s, c) => s + c.marks, 0);

    const slots = [];
    const slotLabels = [];

    if (totalHours <= 4) slotLabels.push('Session 1', 'Session 2');
    else if (totalHours <= 8) slotLabels.push('Day 1 Morning', 'Day 1 Afternoon', 'Day 1 Evening');
    else if (totalHours <= 12) slotLabels.push('Day 1 Morning', 'Day 1 Afternoon', 'Day 1 Evening', 'Day 2 Morning');
    else slotLabels.push('Day 1 Morning', 'Day 1 Afternoon', 'Day 1 Evening', 'Day 2 Morning', 'Day 2 Afternoon');

    const hoursPerSlot = totalHours / slotLabels.length;
    let currentSlot = 0;
    let currentSlotLoad = 0;
    const maxLoadPerSlot = (totalChapterMarks / slotLabels.length) * (1 / speedMult); 

    slotLabels.forEach(() => slots.push([]));

    chapters.forEach(ch => {
      if (currentSlot < slots.length) {
        slots[currentSlot].push({
          id: ch.id, name: ch.name, marks: ch.marks, priority: ch.priority, status: ch.status,
          estimatedMinutes: Math.round((ch.marks / totalChapterMarks) * totalHours * 60 * speedMult),
        });
        currentSlotLoad += ch.marks;

        if (currentSlotLoad >= maxLoadPerSlot && currentSlot < slots.length - 1) {
          currentSlot++;
          currentSlotLoad = 0;
        }
      }
    });

    const plan = slotLabels.map((label, i) => ({
      slot: label, hours: Math.round(hoursPerSlot * 10) / 10, chapters: slots[i],
      totalMarks: slots[i].reduce((s, c) => s + c.marks, 0),
    }));

    const result = await db.execute({
      sql: 'INSERT INTO revision_plans (user_id, subject_id, hours_available, plan_data) VALUES (?, ?, ?, ?)',
      args: [req.user.id, subject_id, totalHours, JSON.stringify(plan)]
    });

    res.json({ id: Number(result.lastInsertRowid), subject: subject.name, hoursAvailable: totalHours, plan, totalUnrevisedMarks: totalChapterMarks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/revision-plans', authenticateToken, async (req, res) => {
  try {
    const { subjects } = await _getFilteredSubjects(req.user.id);
    const subjectIds = subjects.map(s => s.id);

    if (subjectIds.length === 0) return res.json([]);

    const placeholders = subjectIds.map(() => '?').join(',');
    const plansRes = await db.execute({
      sql: `
        SELECT rp.*, s.name as subject_name 
        FROM revision_plans rp 
        JOIN subjects s ON rp.subject_id = s.id 
        WHERE rp.user_id = ? AND rp.subject_id IN (${placeholders})
        ORDER BY rp.created_at DESC
      `,
      args: [req.user.id, ...subjectIds]
    });
    const plans = plansRes.rows;

    res.json(plans.map(p => ({ ...p, plan_data: JSON.parse(p.plan_data) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SETTINGS ====================

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settingsRes = await db.execute({
      sql: 'SELECT * FROM settings WHERE user_id = ?',
      args: [req.user.id]
    });
    const settings = settingsRes.rows;
    const obj = {};
    settings.forEach(s => { obj[s.key] = s.value; });
    
    // Add User Details to settings output safely
    const userRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const user = userRes.rows[0];
    if (user) obj.user_email = user.email;

    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const oldLevelDataRes = await db.execute({
      sql: "SELECT value FROM settings WHERE key = 'level' AND user_id = ?",
      args: [req.user.id]
    });
    const oldLevelData = oldLevelDataRes.rows[0];
    let oldLevel = oldLevelData ? oldLevelData.value : null;

    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      if (key !== 'user_email') {
        await db.execute({
          sql: 'INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, ?, ?)',
          args: [req.user.id, key, String(value)]
        });
      }
    }

    if (req.body.level && req.body.level !== oldLevel) {
      // User changed their CA level!
      // Delete their old subjects (which cascades deleting chapters and plans)
      await db.execute({
        sql: 'DELETE FROM subjects WHERE user_id = ?',
        args: [req.user.id]
      });
      
      // Reseed the database with the new level's chapters without overriding their personal settings
      await seedDataForUser(req.user.id, req.body.level, false);
    }

    res.json({ success: true, reseeded: req.body.level !== oldLevel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== NOTIFICATIONS ====================

app.post('/api/notify-test', authenticateToken, async (req, res) => {
  try {
    const userRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    let htmlContent = `
      <h2 style="color: #4CAF50;">Test Notification 🔔</h2>
      <p>This is a manual test notification triggered directly from your MVPrep app.</p>
      <br>
      <p>Your Gmail notification system is correctly bound and working perfectly!</p>
    `;

    // Fire and forget (it will respond instantly to user)
    sendEmail(user.email, 'MVPrep - Setup Success!', htmlContent)
      .then(success => {
        if (!success) console.error('Background Test Email Failed for', user.email);
      })
      .catch(e => console.error('Background Test Email Exception:', e));
    
    res.json({ success: true, message: 'Test email has been queued and should arrive shortly.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ADMIN PANEL ====================
const _isAdmin = async (email) => {
  const found = await db.execute({
    sql: 'SELECT email FROM admins WHERE email = ?',
    args: [email]
  });
  return !!found.rows[0];
}

// List admin emails
app.get('/api/admin/admins', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });
    const adminsRes = await db.execute('SELECT email FROM admins');
    res.json(adminsRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SMTP Status Health Check
app.get('/api/admin/smtp-status', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });
    
    const status = await verifyTransporter();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add admin
app.post('/api/admin/admins', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });
    
    await db.execute({
      sql: 'INSERT OR IGNORE INTO admins (email) VALUES (?)',
      args: [email.trim().toLowerCase()]
    });

    // Send Welcome Email Notification in background
    const htmlContent = `
      <h2 style="color: #4CAF50;">Admin Access Granted 🛡️</h2>
      <p>Hello!</p>
      <p>You have been designated as an Administrator on <b>MVPrep</b>.</p>
      <p>You can now manage students, analytics, and update the CA syllabus templates directly from the cloud dashboard.</p>
    `;
    sendEmail(email.trim().toLowerCase(), 'MVPrep - Admin Access Granted', htmlContent).catch(e => console.error('Admin Email Error:', e));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Remove admin
app.delete('/api/admin/admins/:email', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });
    const countRes = await db.execute('SELECT COUNT(*) as count FROM admins');
    const count = countRes.rows[0].count;
    if (count <= 1) return res.status(400).json({ error: 'Cannot remove the last admin' });
    await db.execute({
      sql: 'DELETE FROM admins WHERE email = ?',
      args: [decodeURIComponent(req.params.email)]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Platform-wide analytics
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });

    const totalUsers = (await db.execute('SELECT COUNT(*) as count FROM users')).rows[0].count;
    const totalSubjects = (await db.execute('SELECT COUNT(*) as count FROM subjects')).rows[0].count;
    const totalChapters = (await db.execute('SELECT COUNT(*) as count FROM chapters')).rows[0].count;
    const doneChapters = (await db.execute("SELECT COUNT(*) as count FROM chapters WHERE status = 'Done'")).rows[0].count;
    const revisingChapters = (await db.execute("SELECT COUNT(*) as count FROM chapters WHERE status = 'Revising'")).rows[0].count;
    const notStartedChapters = (await db.execute("SELECT COUNT(*) as count FROM chapters WHERE status = 'Not Started'")).rows[0].count;

    // Level distribution
    const levelDistRes = await db.execute(`
      SELECT s.value as level, COUNT(*) as count FROM settings s 
      WHERE s.key = 'level' GROUP BY s.value
    `);
    const levelDist = levelDistRes.rows;

    // Recent signups (last 7 days)
    const recentSignups = (await db.execute(`
      SELECT COUNT(*) as count FROM users 
      WHERE created_at >= datetime('now', '-7 days')
    `)).rows[0].count;

    res.json({
      totalUsers: Number(totalUsers),
      totalSubjects: Number(totalSubjects),
      totalChapters: Number(totalChapters),
      doneChapters: Number(doneChapters),
      revisingChapters: Number(revisingChapters),
      notStartedChapters: Number(notStartedChapters),
      levelDistribution: levelDist,
      recentSignups: Number(recentSignups),
      serverUptime: Math.floor(process.uptime())
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enhanced users list with level + progress
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });

    const usersRes = await db.execute('SELECT id, email, created_at FROM users');
    const users = usersRes.rows;

    const enriched = await Promise.all(users.map(async u => {
      const levelDataRes = await db.execute({
        sql: "SELECT value FROM settings WHERE key = 'level' AND user_id = ?",
        args: [u.id]
      });
      const nameDataRes = await db.execute({
        sql: "SELECT value FROM settings WHERE key = 'student_name' AND user_id = ?",
        args: [u.id]
      });
      const subjectsCount = (await db.execute({
        sql: 'SELECT COUNT(*) as count FROM subjects WHERE user_id = ?',
        args: [u.id]
      })).rows[0].count;
      const totalChapters = (await db.execute({
        sql: 'SELECT COUNT(*) as count FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE s.user_id = ?',
        args: [u.id]
      })).rows[0].count;
      const doneChapters = (await db.execute({
        sql: "SELECT COUNT(*) as count FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE s.user_id = ? AND c.status = 'Done'",
        args: [u.id]
      })).rows[0].count;
      const totalMarks = (await db.execute({
        sql: 'SELECT COALESCE(SUM(c.marks),0) as total FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE s.user_id = ?',
        args: [u.id]
      })).rows[0].total;
      const doneMarks = (await db.execute({
        sql: "SELECT COALESCE(SUM(c.marks),0) as total FROM chapters c JOIN subjects s ON c.subject_id = s.id WHERE s.user_id = ? AND c.status = 'Done'",
        args: [u.id]
      })).rows[0].total;

      return {
        ...u,
        name: nameDataRes.rows[0]?.value || 'Unknown',
        level: levelDataRes.rows[0]?.value || 'foundation',
        subjects_count: Number(subjectsCount),
        total_chapters: Number(totalChapters),
        done_chapters: Number(doneChapters),
        progress: totalMarks > 0 ? Math.round((Number(doneMarks) / Number(totalMarks)) * 100) : 0
      };
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detailed user view
app.get('/api/admin/users/:id/details', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });

    const userRes = await db.execute({
      sql: 'SELECT id, email, created_at FROM users WHERE id = ?',
      args: [req.params.id]
    });
    const user = userRes.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    const settingsRes = await db.execute({
      sql: 'SELECT * FROM settings WHERE user_id = ?',
      args: [user.id]
    });
    const settings = settingsRes.rows;
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.key] = s.value; });

    const subjectsRes = await db.execute({
      sql: 'SELECT * FROM subjects WHERE user_id = ?',
      args: [user.id]
    });
    const subjects = subjectsRes.rows;
    const subjectsWithChapters = await Promise.all(subjects.map(async sub => {
      const chaptersRes = await db.execute({
        sql: 'SELECT * FROM chapters WHERE subject_id = ? ORDER BY sort_order',
        args: [sub.id]
      });
      const chapters = chaptersRes.rows;
      const doneMarks = chapters.filter(c => c.status === 'Done').reduce((sum, c) => sum + c.marks, 0);
      return {
        ...sub,
        chapters,
        done_marks: doneMarks,
        progress: sub.total_marks > 0 ? Math.round((doneMarks / sub.total_marks) * 100) : 0
      };
    }));

    res.json({
      ...user,
      settings: settingsObj,
      subjects: subjectsWithChapters
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin change user level
app.put('/api/admin/users/:id/level', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });

    const { level } = req.body;
    if (!['foundation', 'inter', 'final'].includes(level)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    const targetUserRes = await db.execute({
      sql: 'SELECT id FROM users WHERE id = ?',
      args: [req.params.id]
    });
    if (!targetUserRes.rows[0]) return res.status(404).json({ error: 'User not found' });

    // Update level setting
    await db.execute({
      sql: "INSERT OR REPLACE INTO settings (user_id, key, value) VALUES (?, 'level', ?)",
      args: [req.params.id, level]
    });
    // Wipe and reseed
    await db.execute({
      sql: 'DELETE FROM subjects WHERE user_id = ?',
      args: [req.params.id]
    });
    await seedDataForUser(parseInt(req.params.id), level, false);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Broadcast notifications
app.post('/api/admin/notify', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });

    const { targetUserId, subject, htmlContent } = req.body;
    
    let targets = [];
    if (targetUserId === 'all') {
      const targetsRes = await db.execute('SELECT email FROM users');
      targets = targetsRes.rows;
    } else {
      const uRes = await db.execute({
        sql: 'SELECT email FROM users WHERE id = ?',
        args: [targetUserId]
      });
      if (uRes.rows[0]) targets.push(uRes.rows[0]);
    }

    // Process in background
    for (const t of targets) {
       sendEmail(t.email, subject, htmlContent).catch(e => console.error('Admin Notify Background Error:', e));
    }
    
    res.json({ success: true, sentCount: targets.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });
    if(req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'Cannot delete yourself' });

    await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [req.params.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ADMIN SYLLABUS TEMPLATES ====================

// Fetch grouped templates
app.get('/api/admin/templates', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({
      sql: 'SELECT email FROM users WHERE id = ?',
      args: [req.user.id]
    });
    const adminUser = adminUserRes.rows[0];
    if (!(await _isAdmin(adminUser.email))) return res.status(403).json({ error: 'Unauthorised' });

    const subjectsRes = await db.execute('SELECT * FROM template_subjects ORDER BY level DESC, sort_order ASC');
    const chaptersRes = await db.execute('SELECT * FROM template_chapters ORDER BY sort_order ASC');

    const subjectsWithChapters = subjectsRes.rows.map(sub => {
      return {
        ...sub,
        chapters: chaptersRes.rows.filter(ch => ch.template_subject_id === sub.id)
      };
    });

    const grouped = {
      foundation: subjectsWithChapters.filter(s => s.level === 'foundation'),
      inter: subjectsWithChapters.filter(s => s.level === 'inter'),
      final: subjectsWithChapters.filter(s => s.level === 'final'),
    };

    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Template Subject
app.post('/api/admin/templates/subjects', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [req.user.id] });
    if (!(await _isAdmin(adminUserRes.rows[0].email))) return res.status(403).json({ error: 'Unauthorised' });

    const { level, name, total_marks } = req.body;
    const orderRes = await db.execute({
      sql: 'SELECT MAX(sort_order) as o FROM template_subjects WHERE level = ?',
      args: [level]
    });
    const sort_order = (orderRes.rows[0]?.o || 0) + 1;

    const resDb = await db.execute({
      sql: 'INSERT INTO template_subjects (level, name, total_marks, sort_order) VALUES (?, ?, ?, ?)',
      args: [level, name, total_marks, sort_order]
    });
    
    res.json({ id: Number(resDb.lastInsertRowid), level, name, total_marks, sort_order, chapters: [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Template Subject
app.put('/api/admin/templates/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [req.user.id] });
    if (!(await _isAdmin(adminUserRes.rows[0].email))) return res.status(403).json({ error: 'Unauthorised' });

    const { name, total_marks, sort_order } = req.body;
    
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (total_marks !== undefined) { updates.push('total_marks = ?'); values.push(total_marks); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length > 0) {
      values.push(req.params.id);
      await db.execute({
        sql: `UPDATE template_subjects SET ${updates.join(', ')} WHERE id = ?`,
        args: values
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Template Subject
app.delete('/api/admin/templates/subjects/:id', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [req.user.id] });
    if (!(await _isAdmin(adminUserRes.rows[0].email))) return res.status(403).json({ error: 'Unauthorised' });

    await db.execute({ sql: 'DELETE FROM template_subjects WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create Template Chapter
app.post('/api/admin/templates/chapters', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [req.user.id] });
    if (!(await _isAdmin(adminUserRes.rows[0].email))) return res.status(403).json({ error: 'Unauthorised' });

    const { template_subject_id, name, marks, priority } = req.body;
    const orderRes = await db.execute({
      sql: 'SELECT MAX(sort_order) as o FROM template_chapters WHERE template_subject_id = ?',
      args: [template_subject_id]
    });
    const sort_order = (orderRes.rows[0]?.o || 0) + 1;

    const resDb = await db.execute({
      sql: 'INSERT INTO template_chapters (template_subject_id, name, marks, priority, sort_order) VALUES (?, ?, ?, ?, ?)',
      args: [template_subject_id, name, marks || 0, priority || 'C', sort_order]
    });
    
    res.json({ id: Number(resDb.lastInsertRowid), template_subject_id, name, marks, priority, sort_order });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Template Chapter
app.put('/api/admin/templates/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [req.user.id] });
    if (!(await _isAdmin(adminUserRes.rows[0].email))) return res.status(403).json({ error: 'Unauthorised' });

    const { name, marks, priority, sort_order } = req.body;
    
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (marks !== undefined) { updates.push('marks = ?'); values.push(marks); }
    if (priority !== undefined) { updates.push('priority = ?'); values.push(priority); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

    if (updates.length > 0) {
      values.push(req.params.id);
      await db.execute({
        sql: `UPDATE template_chapters SET ${updates.join(', ')} WHERE id = ?`,
        args: values
      });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Template Chapter
app.delete('/api/admin/templates/chapters/:id', authenticateToken, async (req, res) => {
  try {
    const adminUserRes = await db.execute({ sql: 'SELECT email FROM users WHERE id = ?', args: [req.user.id] });
    if (!(await _isAdmin(adminUserRes.rows[0].email))) return res.status(403).json({ error: 'Unauthorised' });

    await db.execute({ sql: 'DELETE FROM template_chapters WHERE id = ?', args: [req.params.id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== AI ASSISTANT (CHATS) ====================
let groqClient = null;
try {
  const Groq = require('groq-sdk');
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
} catch (e) {
  console.log('Skipping groq-sdk init, not installed or missing key.');
}

app.get('/api/chat-sessions', authenticateToken, async (req, res) => {
  try {
    const sessionsRes = await db.execute({
      sql: 'SELECT id, title, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC',
      args: [req.user.id]
    });
    res.json(sessionsRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chats/:sessionId', authenticateToken, async (req, res) => {
  try {
    const chatsRes = await db.execute({
      sql: 'SELECT id, role, content, created_at FROM chats WHERE user_id = ? AND session_id = ? ORDER BY id ASC',
      args: [req.user.id, req.params.sessionId]
    });
    res.json(chatsRes.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/chat-sessions/:id', authenticateToken, async (req, res) => {
  try {
    await db.execute({
      sql: 'DELETE FROM chat_sessions WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user.id]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats', authenticateToken, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    let activeSessionId = sessionId;

    // Create session if it doesn't exist
    if (!activeSessionId) {
      let tempTitle = message.substring(0, 30) + '...';
      try {
        if (groqClient) {
          const titleCompletion = await groqClient.chat.completions.create({
            messages: [
              { role: 'system', content: 'You are a helpful assistant. Provide a brief 3-5 word title for the following conversation starter. Do not include quotes or any other text.' },
              { role: 'user', content: message }
            ],
            model: 'llama-3.3-70b-versatile',
          });
          tempTitle = titleCompletion.choices[0]?.message?.content?.trim() || tempTitle;
        }
      } catch (e) { console.error('Title gen failed:', e); }

      const sessionRes = await db.execute({
        sql: 'INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)',
        args: [req.user.id, tempTitle.replace(/["']/g, '')]
      });
      activeSessionId = Number(sessionRes.lastInsertRowid);
    } else {
      // Update session timestamp
      await db.execute({
        sql: 'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [activeSessionId]
      });
    }

    // Save user message
    const userMsgRes = await db.execute({
      sql: 'INSERT INTO chats (user_id, session_id, role, content) VALUES (?, ?, ?, ?)',
      args: [req.user.id, activeSessionId, 'user', message]
    });
    const userMsgId = Number(userMsgRes.lastInsertRowid);

    // Provide a mocked response if Groq is not configured
    if (!groqClient) {
      const fallbackReply = "Hello! I am your AI Assistant. Please configure your GROQ_API_KEY in the .env file to enable smart CA guidance!";
      await db.execute({
        sql: 'INSERT INTO chats (user_id, session_id, role, content) VALUES (?, ?, ?, ?)',
        args: [req.user.id, activeSessionId, 'model', fallbackReply]
      });
      return res.json({ id: userMsgId, reply: fallbackReply, sessionId: activeSessionId });
    }

    // Fetch prior msgs for context in this session
    const histRes = await db.execute({
      sql: 'SELECT role, content FROM chats WHERE user_id = ? AND session_id = ? ORDER BY id DESC LIMIT 20',
      args: [req.user.id, activeSessionId]
    });
    const messagesContext = histRes.rows.reverse().map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Fetch user settings to personalize the system prompt
    const settingsRes = await db.execute({
      sql: 'SELECT key, value FROM settings WHERE user_id = ?',
      args: [req.user.id]
    });
    const settings = {};
    settingsRes.rows.forEach(r => { settings[r.key] = r.value; });
    const userName = settings.student_name || 'the student';
    const userLevel = settings.level ? `CA ${settings.level}` : 'CA';

    // Add systemic instructions
    messagesContext.unshift({
      role: 'system',
      content: `You are an expert AI assistant for a CA (Chartered Accountant) preparation tool called MVPrep. You are currently assisting ${userName}, who is studying for the ${userLevel} exams. Always tailor your advice specifically to their level. Your goal is to help CA students with all types of work regarding CA. Help them with calculations, teach concepts in simple words, provide study roadmaps, analyze their progress if provided, and act similarly to Claude or ChatGPT to guide them to success in their CA exams.`
    });

    const completion = await groqClient.chat.completions.create({
      messages: messagesContext,
      model: 'llama-3.3-70b-versatile',
    });
    
    const reply = completion.choices[0]?.message?.content || "Sorry, I couldn't process that.";

    // Save AI message
    await db.execute({
      sql: 'INSERT INTO chats (user_id, session_id, role, content) VALUES (?, ?, ?, ?)',
      args: [req.user.id, activeSessionId, 'model', reply]
    });

    res.json({ id: userMsgId, reply, sessionId: activeSessionId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== FRONTEND SERVING ====================

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get(/^\/(.*)/, (req, res) => {
  const indexPath = path.join(__dirname, '../frontend/dist/index.html');
  console.log(`Fallback routing for: ${req.url} -> serving ${indexPath}`);
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Error sending index.html:', err);
      res.status(500).send("Static file serving error: " + err.message);
    }
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 UNHANDLED ERROR:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Initialize DB and start server - CALL AT THE VERY END
bootstrap();
