const express = require('express');
const router = express.Router();
const { sendToWebhook } = require('../../services/webhookService');

router.post('/send-to-webhook', async (req, res) => {
  const { firstname, lastname, email, phone,postalcode } = req.body;

  try {
    // Then send to actual webhook
    await sendToWebhook("https://services.leadconnectorhq.com/hooks/BrSB6sIEb8JdgVUP6skV/webhook-trigger/f381d20d-6e48-494e-a23b-032de39584e2", {
      firstname,
      lastname,
      email,
      phone,
      postalcode
    });

    res.status(200).json({ success: true, message: "Data saved and sent to webhook." });
  } catch (error) {
    console.error("Webhook Route Error:", error);
    res.status(500).json({ success: false, message: "Error in saving or sending webhook." });
  }
});

module.exports = router;
