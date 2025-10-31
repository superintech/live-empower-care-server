const bcrypt = require("bcrypt");
const { findAdminByEmail, createAdmin } = require("../models/adminModel");
const messages = require("../utils/messages");

const loginAdmin = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: messages.EMAIL_INVALID });

  try {
    const admin = await findAdminByEmail(email);
    if (!admin)
      return res.status(400).json({ message: messages.EMAIL_INVALID });

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch)
      return res.status(401).json({ message: messages.PASSWORD_INVALID });

    req.session.adminId = admin.id;

    res.status(200).json({
      message: 'Login successful',
      admin: { id: admin.id, email: admin.email }
    });
  } catch (err) {
    res.status(500).json({ message: 'Login error', error: err.message });
  }
};

const registerAdmin = async (req, res) => {

  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required" });

  try {
    const existingAdmin = await findAdminByEmail(email);
    if (existingAdmin)
      return res.status(409).json({ message: "Admin already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await createAdmin(email, hashedPassword);

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error registering admin", error: err.message });
  }
};

module.exports = {
  loginAdmin, 
  registerAdmin,
};
