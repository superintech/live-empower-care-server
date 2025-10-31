const express = require('express');
const router = express.Router();
const thankYouController = require('../controllers/thankYouController');

router.post('/thank-you', thankYouController.saveThankYouPage);
router.get('/thank-you/:pageName', thankYouController.getThankYouPage);
router.get('/thank-you', thankYouController.getAllThankYouPages);
router.delete('/thank-you/:pageName', thankYouController.deleteThankYouPage);

module.exports = router;
