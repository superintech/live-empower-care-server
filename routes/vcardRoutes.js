const express = require('express');
const router = express.Router();
const vcardController = require('../controllers/vcardController');

router.post('/generate-vcf', vcardController.generateVCF);

module.exports = router;