// adminModel.js
const pool = require("../config/db");

const findAdminByEmail = async (email) => {
  const result = await pool.query("SELECT * FROM admins WHERE email = $1", [email]);
  return result.rows[0]; 
};

const updateAdminPassword = async (email, password) => {
  return await pool.query("UPDATE admins SET password = $1 WHERE email = $2", [password, email]);
};

const createAdmin = async (email, hashedPassword) => {
  const result = await pool.query(
    "INSERT INTO admins (email, password) VALUES ($1, $2) RETURNING *",
    [email, hashedPassword]
  );
  return result.rows[0];
};

module.exports = {
  findAdminByEmail,
  updateAdminPassword,
  createAdmin,
};