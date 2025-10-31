const express = require("express");
const router = express.Router();
const { loginAdmin, registerAdmin } = require("../controllers/adminController");

router.post("/admin-login", loginAdmin);
router.post('/register', registerAdmin);

router.get('/admin-session-check', (req, res) => {
  if (req.session.adminId) {
    res.json({ loggedIn: true, adminId: req.session.adminId });
  } else {
    res.json({ loggedIn: false });
  }
});

router.post('/admin-logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }

    res.clearCookie('connect.sid', { 
      path: '/',       
      httpOnly: true,
      sameSite: 'lax',
      secure: false     
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  });
});


module.exports = router;