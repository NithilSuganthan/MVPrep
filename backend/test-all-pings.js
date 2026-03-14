const https = require('https');
const BASE = 'https://mvprep.onrender.com';

async function test(path) {
  console.log(`Pinging ${BASE}${path}...`);
  return new Promise((resolve) => {
    https.get(`${BASE}${path}`, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Type:', res.headers['content-type']);
        console.log('Body Preview:', body.substring(0, 100).replace(/\n/g, ' '));
        console.log('---');
        resolve();
      });
    }).on('error', e => {
      console.error('Error:', e);
      resolve();
    });
  });
}

async function run() {
  await test('/ping');
  await test('/api/ping');
}

run();
