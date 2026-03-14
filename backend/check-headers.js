const https = require('https');
const BASE = 'https://mvprep.onrender.com';

async function check(path) {
  console.log(`Checking ${BASE}${path}...`);
  return new Promise((resolve) => {
    https.get(`${BASE}${path}`, (res) => {
      console.log('Status:', res.statusCode);
      console.log('Headers:', JSON.stringify(res.headers, null, 2));
      resolve();
    }).on('error', e => {
      console.error('Error:', e);
      resolve();
    });
  });
}

check('/api/ping');
