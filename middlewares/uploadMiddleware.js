const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads folder if it doesn't exist
const uploadsDir = 'uploads/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ storage });

module.exports = upload;
