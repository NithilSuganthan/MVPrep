const { sendEmail } = require('./src/email');
require('dotenv').config();

async function testEmail() {
  console.log('Testing email delivery to:', process.env.GMAIL_USER);
  const success = await sendEmail(
    process.env.GMAIL_USER, 
    'MVPrep - SMTP Test', 
    '<h1>SMTP Test Successful!</h1><p>If you are reading this, the email delivery system is working correctly.</p>'
  );
  
  if (success) {
    console.log('✅ Email delivered successfully!');
  } else {
    console.log('❌ Email delivery failed.');
  }
}

testEmail();
