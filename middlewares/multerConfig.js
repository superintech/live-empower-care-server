const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["audio/webm", "audio/mp3", "audio/wav"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only MP3 or WAV files are allowed"));
  }
};

// ✅ Correct export: this is a multer instance
module.exports = multer({ storage, fileFilter });
