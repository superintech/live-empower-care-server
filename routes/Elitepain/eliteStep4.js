const express = require('express');
const router = express.Router();
const { sendToWebhook } = require('../../services/webhookService');

router.post('/send-step4-data', async (req, res) => {
  const formData = req.body;

  try {
   
    await sendToWebhook("https://services.leadconnectorhq.com/hooks/BrSB6sIEb8JdgVUP6skV/webhook-trigger/98202e07-c80b-445f-80c1-1562e32381b3", formData);

    res.status(200).json({ success: true, message: "All step data sent to webhook." });
  } catch (error) {
    console.error("Webhook Route Error:", error);
    res.status(500).json({ success: false, message: "Failed to send data to webhook." });
  }
});

module.exports = router;
