const express = require('express');
const router = express.Router();
const thankYouController = require('../controllers/medicationController');

router.post('/medication', thankYouController.saveThankYouPage);
router.get('/medication/:pageName', thankYouController.getThankYouPage);
router.get('/medication', thankYouController.getAllThankYouPages);
router.delete('/medication/:pageName', thankYouController.deleteThankYouPage);

module.exports = router;
