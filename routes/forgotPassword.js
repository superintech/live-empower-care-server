const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-otp", authController.verifyOTP);
router.post("/reset-password", authController.resetPassword);
router.post("/resend-otp", authController.resendOTP);
router.post("/reset-password-setting", authController.resetPasswordWithOld);

module.exports = router;