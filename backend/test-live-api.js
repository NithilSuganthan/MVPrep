/**
 * Test level change directly against LIVE Render API
 * Registers a fresh user, then changes their level
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

async function test() {
  const testEmail = `live_test_${Date.now()}@example.com`;
  
  console.log('1. Registering fresh test user:', testEmail);
  const regRes = await request('POST', '/api/register', {
    email: testEmail,
    password: 'test12345',
    name: 'TestUser',
    level: 'foundation'
  });
  console.log('Register:', regRes.status, regRes.body.substring(0, 200));
  
  if (regRes.status !== 200) {
    console.log('Registration failed. Aborting.');
    return;
  }
  
  const { token } = JSON.parse(regRes.body);
  console.log('Got token:', token.substring(0, 30) + '...');
  
  console.log('\n2. GET /api/dashboard...');
  const dashRes = await request('GET', '/api/dashboard', null, token);
  console.log('Dashboard:', dashRes.status, dashRes.body.substring(0, 300));
  
  console.log('\n3. GET /api/settings...');
  const getSettingsRes = await request('GET', '/api/settings', null, token);
  console.log('Settings:', getSettingsRes.status, getSettingsRes.body.substring(0, 300));
  
  console.log('\n4. PUT /api/settings (change to inter)...');
  const putRes = await request('PUT', '/api/settings', {
    student_name: 'TestUser',
    exam_date: '',
    theme: 'dark',
    level: 'inter'
  }, token);
  console.log('Level Change:', putRes.status, putRes.body);

  console.log('\n5. GET /api/dashboard after level change...');
  const dashRes2 = await request('GET', '/api/dashboard', null, token);
  console.log('Dashboard:', dashRes2.status, dashRes2.body.substring(0, 300));
}

test().catch(e => console.error('Error:', e));
