require('dotenv').config();
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const { db } = require('./database'); // Assuming database is exported like this

// Setting up the Nodemailer transporter.
// Use SMTP pooling to reuse connections for faster delivery.
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  pool: true,   // Enable pooling
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.GMAIL_USER || 'your.email@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password',
  },
  connectionTimeout: 10000, 
  greetingTimeout: 5000,
  socketTimeout: 15000,
});

// Helper function to send an email
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"MVPrep" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully: ' + info.messageId + ' to ' + to);
    return true;
  } catch (error) {
    console.error('❌ Email delivery failed:', {
      error: error.message,
      code: error.code,
      command: error.command,
      address: to
    });
    return false;
  }
};

const startEmailCrons = () => {
  // Cron schedule: Runs every day at 8:00 AM (server time).
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily morning study reminder cron job...');
    try {
      const usersRes = await db.execute('SELECT id, email FROM users');
      const users = usersRes.rows;
      
      // Batch processing to avoid overwhelming SMTP
      const batchSize = 10;
      for (let i = 0; i < users.length; i += batchSize) {
        const batch = users.slice(i, i + batchSize);
        await Promise.all(batch.map(async (user) => {
          const incompleteChaptersRes = await db.execute({
            sql: `
              SELECT c.name, s.name as subject_name 
              FROM chapters c
              JOIN subjects s ON c.subject_id = s.id
              WHERE s.user_id = ? AND c.status != 'Done' AND c.priority = 'A'
              LIMIT 3
            `,
            args: [user.id]
          });
          const incompleteChapters = incompleteChaptersRes.rows;
          
          let htmlContent = `
            <h2 style="color: #4CAF50;">Good Morning, CA Aspirant! 🌅</h2>
            <p>It's time to get ahead of the curve. Your 1.5-Day Revision is crucial.</p>
          `;

          if (incompleteChapters.length > 0) {
            htmlContent += `<p><strong>Don't forget to focus on these high-priority (Category A) chapters today:</strong></p><ul>`;
            incompleteChapters.forEach(ch => {
              htmlContent += `<li>${ch.subject_name}: ${ch.name}</li>`;
            });
            htmlContent += `</ul>`;
          } else {
            htmlContent += `<p>You are doing amazing! You've tackled the biggest hurdles. Keep revising the remaining B & C priority sections.</p>`;
          }

          htmlContent += `<br><p>Stay focused, and maybe run a Pomodoro session in the Architect app!</p>`;

          return sendEmail(user.email, 'Daily Revision Reminder - ABC Architect', htmlContent);
        }));
      }
    } catch (e) {
      console.error("Cron Job Error:", e);
    }
  });

  console.log("Email Notification Cron Jobs started.");
};

module.exports = { transporter, sendEmail, startEmailCrons };
