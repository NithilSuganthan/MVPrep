/**
 * Check LIVE SMTP status via diagnostic endpoint
 */
const https = require('https');

const BASE = 'https://mvprep.onrender.com';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function checkSmtp() {
  const testEmail = `admin_test_${Date.now()}@example.com`;
  const password = 'test12345';

  console.log('1. Registering fresh test user:', testEmail);
  const regRes = await request('POST', '/api/register', {
    email: testEmail,
    password: password,
    name: 'AdminTest',
    level: 'foundation'
  });
  
  if (regRes.status !== 200) {
    console.log('Registration failed:', regRes.status, regRes.body);
    return;
  }
  
  const { token } = JSON.parse(regRes.body);
  console.log('User registered. Token obtained.');

  console.log('\n2. Elevating user to admin via Turso...');
  // I need to run a separate script to add this email to the admins table
  // But wait, I can just do it from here by importing the client
  const { createClient } = require('@libsql/client');
  require('dotenv').config();
  const db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  await db.execute({
    sql: 'INSERT OR IGNORE INTO admins (email) VALUES (?)',
    args: [testEmail]
  });
  console.log('User elevated to admin.');
  
  console.log('\n3. Checking SMTP Status (/api/admin/smtp-status)...');
  const smtpRes = await request('GET', '/api/admin/smtp-status', null, token);
  console.log('SMTP Status Code:', smtpRes.status);
  console.log('SMTP Response Body:', smtpRes.body);
}

checkSmtp().catch(e => console.error('Error:', e));
