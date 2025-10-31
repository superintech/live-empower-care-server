const messages = require("../utils/messages");

const errorHandler = (err, req, res, next) => {
  console.error("ERROR:", err.message);

  res.status(500).json({
    success: false,
    message: err.message || messages.ERROR_UPLOAD,
  });
};

module.exports = errorHandler;
