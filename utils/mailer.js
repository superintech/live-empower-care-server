const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  },
  tls: {
    rejectUnauthorized: false 
  }
});

exports.sendOTPEmail = async (email, otp, isResend) => {
  const subject = isResend ? 'Resend: Your OTP Code' : 'Your OTP Code';
  
  const mailOptions = {
    from: '"ePain Support" <no-reply@epain.com>',
    to: email,
    subject: subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Your OTP Code</h2>
        <p style="font-size: 16px;">Your OTP code is:</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="color: #666;">This code will expire in 10 minutes.</p>
        <p style="color: #666; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Detailed email error:', error);
    throw error;
  }
};