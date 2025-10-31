const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const adminLogin = require('./routes/auth');
const sessionMiddleware = require("./config/session");
const moduleName = require('./routes/module');
const forgotPassword = require('./routes/forgotPassword');
const EliteStep1 = require('./routes/Elitepain/eliteStep1');
const eliteStep4 = require('./routes/Elitepain/eliteStep4');
const eliteFinalSubmit = require('./routes/Elitepain/eliteFinalSubmit')
const thankyouPage = require('./routes/thankYouRoutes');
const extractText = require('./routes/extractText');
const vCard = require('./routes/vcardRoutes');
// const medicationPage = require('./routes/medicationRoutes');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
     'http://localhost:3002',
    'https://empower-care-form-client-v1vgs.kinsta.page',
    'https://empower-care-form-admin-5yrel.kinsta.page',
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

dotenv.config();

app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' })); 


// session 
app.use(sessionMiddleware);

// Routes
app.use('/api', adminLogin);
app.use('/api/modules', moduleName);
app.use('/api/auth', forgotPassword);
app.use('/api', EliteStep1);
app.use('/api', eliteStep4);
app.use('/api/drive', eliteFinalSubmit);
app.use('/api', thankyouPage)
app.use('/api', vCard)
app.use('/api', extractText);
// app.use('/api', medicationPage)

// Error handler (optional)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));