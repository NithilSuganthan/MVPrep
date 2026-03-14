const https = require('https');
const BASE = 'https://mvprep.onrender.com';

async function ping() {
  console.log('Pinging LIVE API...');
  return new Promise((resolve) => {
    https.get(`${BASE}/api/ping`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Headers:', res.headers['content-type']);
        console.log('Body:', body);
        resolve();
      });
    }).on('error', e => {
      console.error('Error:', e);
      resolve();
    });
  });
}

ping();
