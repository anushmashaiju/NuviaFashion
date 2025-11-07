import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// ✅ Generate OTP (4 digits)
export function generateOtp() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ✅ Send OTP via Email
export async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: 'Verify Your Account',
      html: `<p>Your OTP is: <b>${otp}</b></p>`,
    });
    return info.accepted.length > 0;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}
