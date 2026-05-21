require('dotenv').config();
const nodemailer = require('nodemailer');

const EMAIL_USER = (process.env.EMAIL_USER || '').trim();
const EMAIL_APP_PASSWORD = (process.env.EMAIL_APP_PASSWORD || '').trim();

console.log("User:", EMAIL_USER);
console.log("Pass:", EMAIL_APP_PASSWORD);

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_APP_PASSWORD
  }
});

const mailOptions = {
  from: `"SmartLab Monitor" <${EMAIL_USER}>`,
  to: EMAIL_USER, // sending to itself for test
  subject: `SmartLab Test Email`,
  text: 'This is a test email'
};

emailTransporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error("ERROR:", error);
  } else {
    console.log("Email sent: " + info.response);
  }
});
