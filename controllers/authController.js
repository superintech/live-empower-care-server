const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { sendOTPEmail } = require("../utils/mailer");
const { findAdminByEmail, updateAdminPassword } = require("../models/adminModel");
const otpStorage = require("../utils/otpStorage");

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: "Email is required" });
  }

  try {
    // ✅ Check if admin with given email exists
    const admin = await findAdminByEmail(email);
    if (!admin) {
      return res.status(404).json({ success: false, message: "Email addresses do not match. Please recheck" });
    }

    // ✅ Generate and store OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    otpStorage[email] = { otp, expiry: Date.now() + 10 * 60 * 1000, verified: false };

    // ✅ Send email
    await sendOTPEmail(email, otp, false);
    res.json({ success: true, message: "OTP sent to your email" });

  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send OTP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.verifyOTP = (req, res) => {
  const { email, otp } = req.body;

  if (!otpStorage[email])
    return res.status(400).json({ success: false, message: "No OTP found for this email" });

  const { otp: storedOtp, expiry } = otpStorage[email];

  if (storedOtp === otp && expiry > Date.now()) {
    // ✅ Mark OTP as verified and generate reset token
    otpStorage[email].verified = true;
    const resetToken = crypto.randomBytes(32).toString('hex');
    otpStorage[email].resetToken = resetToken;
    
    return res.json({ 
      success: true, 
      message: "OTP verified successfully",
      resetToken: resetToken // ✅ Send token to frontend
    });
  }

  const message = storedOtp !== otp ? "Invalid OTP" : "OTP has expired";
  return res.status(400).json({ success: false, message });
};

exports.resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body; // ✅ Use resetToken instead of email

  if (!resetToken || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Reset token and new password are required",
    });
  }

  // ✅ Find email by resetToken
  let userEmail = null;
  for (const [email, data] of Object.entries(otpStorage)) {
    if (data.resetToken === resetToken && data.verified && data.expiry > Date.now()) {
      userEmail = email;
      break;
    }
  }

  if (!userEmail) {
    return res.status(400).json({
      success: false,
      message: "Invalid or expired reset token. Please verify OTP again.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await updateAdminPassword(userEmail, hashedPassword);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // ✅ Clean up OTP storage after successful password reset
    delete otpStorage[userEmail];

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

exports.resendOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  const otp = crypto.randomInt(100000, 999999).toString();
  otpStorage[email] = { otp, expiry: Date.now() + 10 * 60 * 1000, verified: false }; // ✅ Reset verified flag

  try {
    await sendOTPEmail(email, otp, true);
    res.json({ success: true, message: "OTP resent successfully" });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to resend OTP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

exports.resetPasswordWithOld = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const email = req.headers["user-email"];

  if (!email || !oldPassword || !newPassword)
    return res.status(400).json({ message: "Email, old password, and new password are required" });

  try {
    const admin = await findAdminByEmail(email);
    if (!admin) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, admin.password);
    if (!isMatch) return res.status(400).json({ message: "Old password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await updateAdminPassword(email, hashedPassword);
    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error updating password:", error);
    res.status(500).json({ message: "Failed to update password" });
  }
};