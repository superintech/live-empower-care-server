const axios = require('axios');

async function sendToWebhook(webhookUrl, data) {
  try {
    const response = await axios.post(webhookUrl, data);
    return response.data;
  } catch (error) {
    console.error('Error sending data to webhook:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { sendToWebhook };
