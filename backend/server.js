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

// Initialize DB and start server
async function bootstrap() {
  try {
    console.log('☁️ Initializing Cloud Database...');
    await initDB();
    console.log('✅ Database connected & schema ready.');

    app.listen(PORT, () => {
      console.log(`🚀 MVPrep Server running on port ${PORT}`);
      console.log('📅 Starting Study Reminder crons...');
      startEmailCrons();
    });
  } catch (err) {
    console.error('❌ Database Initialization Failed:', err);
    process.exit(1);
  }
}

bootstrap();

app.use(cors());
app.use(express.json());

app.get('/api/ping', (req, res) => res.json({ pong: true, time: new Date().toISOString() }));

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../frontend/dist')));

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
    const subjectsRes = await db.execute({
      sql: 'SELECT id, name FROM subjects WHERE user_id = ? ORDER BY id',
      args: [req.user.id]
    });
    const subjects = subjectsRes.rows;

    const data = await Promise.all(subjects.map(async sub => {
      const chaptersRes = await db.execute({
        sql: 'SELECT id, name, notes FROM chapters WHERE subject_id = ? ORDER BY sort_order',
        args: [sub.id]
      });
      return { ...sub, chapters: chaptersRes.rows };
    }));

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SUBJECTS ====================

app.get('/api/subjects', authenticateToken, async (req, res) => {
  try {
    const subjectsRes = await db.execute({
      sql: 'SELECT * FROM subjects WHERE user_id = ? ORDER BY id',
      args: [req.user.id]
    });
    const subjects = subjectsRes.rows;

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
    const subjectRes = await db.execute({
      sql: 'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      args: [req.params.id, req.user.id]
    });
    const subject = subjectRes.rows[0];
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

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
      const today = new Date().toISOString().split('T')[0];
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
    const subjectsRes = await db.execute({
      sql: 'SELECT * FROM subjects WHERE user_id = ?',
      args: [req.user.id]
    });
    const subjects = subjectsRes.rows;

    const allChaptersRes = await db.execute({
      sql: `
        SELECT c.* FROM chapters c
        JOIN subjects s ON c.subject_id = s.id
        WHERE s.user_id = ?
      `,
      args: [req.user.id]
    });
    const allChapters = allChaptersRes.rows;

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
    
    // Smart Revision Order (high priority, unrevised, ordered by priority & marks)
    const smartRevisionOrderRes = await db.execute({
      sql: `
        SELECT c.*, s.name as subject_name FROM chapters c
        JOIN subjects s ON c.subject_id = s.id
        WHERE s.user_id = ? AND c.status != 'Done'
        ORDER BY 
          CASE c.priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 END,
          CASE c.frequency WHEN 'Very Frequent' THEN 1 WHEN 'Frequent' THEN 2 ELSE 3 END,
          c.marks DESC
        LIMIT 5
      `,
      args: [req.user.id]
    });
    const smartRevisionOrder = smartRevisionOrderRes.rows;

    // High Risk Chapters (A priority with high marks, not started)
    const highRiskChaptersRes = await db.execute({
      sql: `
        SELECT c.*, s.name as subject_name FROM chapters c
        JOIN subjects s ON c.subject_id = s.id
        WHERE s.user_id = ? AND c.status = 'Not Started' AND c.priority = 'A' AND c.marks >= 8
        ORDER BY c.marks DESC
        LIMIT 5
      `,
      args: [req.user.id]
    });
    const highRiskChapters = highRiskChaptersRes.rows;

    // ====== ENHANCED SCORE PREDICTOR ======
    // Per-subject score prediction with pass/fail analysis
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

      // Prediction: Done chapters = 85% retention, Revising = 50% retention
      const predictedScore = Math.round(subDoneMarks * 0.85 + subRevisingMarks * 0.50);
      const maxPossible = sub.total_marks;
      const passingMarks = Math.ceil(maxPossible * 0.40); // CA pass = 40%
      const isPassing = predictedScore >= passingMarks;
      const pct = maxPossible > 0 ? Math.round((predictedScore / maxPossible) * 100) : 0;
      
      // Priority focus score (how well A categories are covered)
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

    const levelDataRes = await db.execute({
      sql: "SELECT value FROM settings WHERE key = 'level' AND user_id = ?",
      args: [req.user.id]
    });
    const level = levelDataRes.rows[0] ? levelDataRes.rows[0].value : 'foundation';

    res.json({
      level,
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
    const today = new Date().toISOString().split('T')[0];
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

app.get('/api/activity', authenticateToken, async (req, res) => {
  try {
    // Get last 365 days of activity
    const activitiesRes = await db.execute({
      sql: `
        SELECT activity_date, SUM(count) as total_count
        FROM study_activity
        WHERE user_id = ? AND activity_date >= date('now', '-365 days')
        GROUP BY activity_date
        ORDER BY activity_date ASC
      `,
      args: [req.user.id]
    });
    const activities = activitiesRes.rows;

    // Calculate current streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check backwards from today for current streak
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      const found = activities.find(a => a.activity_date === dateStr);
      if (found) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Calculate longest streak
    const dateSet = new Set(activities.map(a => a.activity_date));
    const allDates = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      allDates.push(d.toISOString().split('T')[0]);
    }
    allDates.forEach(d => {
      if (dateSet.has(d)) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    });

    const totalActiveDays = activities.length;
    const totalActions = activities.reduce((sum, a) => sum + a.total_count, 0);

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

    const subjectRes = await db.execute({
      sql: 'SELECT * FROM subjects WHERE id = ? AND user_id = ?',
      args: [subject_id, req.user.id]
    });
    const subject = subjectRes.rows[0];
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

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
    const plansRes = await db.execute({
      sql: `
        SELECT rp.*, s.name as subject_name 
        FROM revision_plans rp 
        JOIN subjects s ON rp.subject_id = s.id 
        WHERE rp.user_id = ?
        ORDER BY rp.created_at DESC
      `,
      args: [req.user.id]
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

    let successCount = 0;
    // Process in background
    for (const t of targets) {
       sendEmail(t.email, subject, htmlContent).catch(e => console.error('Admin Notify Background Error:', e));
    }
    
    res.json({ success: true, message: `Notification broadcast started for ${targets.length} users.` });
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

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
