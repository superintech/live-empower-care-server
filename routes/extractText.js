const express = require("express");
const multer = require("multer");
const fs = require("fs");
const OpenAI = require("openai");
const csv = require('csv-parser');
const path = require('path');
const mammoth = require('mammoth'); 
const pdf = require('pdf-parse'); 
const router = express.Router();

// Configure multer for different file types
const upload = multer({ 
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/plain', 'image/jpeg', 'image/png', 'image/jpg', 
                         'application/pdf', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'text/csv'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDF, DOC, DOCX, TXT, and CSV files are allowed.'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 
  }
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Store medication data in memory
let medicationDataCamera = [];
let medicationDataFile = [];

// Auto-load saved CSVs on server start
const cameraCsvPath = path.join(__dirname, "../uploads", "medications_camera.csv");
const fileCsvPath = path.join(__dirname, "../uploads", "medications_file.csv");

if (fs.existsSync(cameraCsvPath)) {
  fs.createReadStream(cameraCsvPath)
    .pipe(csv())
    .on("data", (row) => medicationDataCamera.push(row))
    .on("end", () => console.log(`✅ Loaded ${medicationDataCamera.length} camera medications`));
}

if (fs.existsSync(fileCsvPath)) {
  fs.createReadStream(fileCsvPath)
    .pipe(csv())
    .on("data", (row) => medicationDataFile.push(row))
    .on("end", () => console.log(`✅ Loaded ${medicationDataFile.length} file medications`));
}

// Helper function to extract text from different file types
async function extractTextFromFile(filePath, mimetype) {
  try {
    switch (mimetype) {
      case 'text/plain':
        return fs.readFileSync(filePath, 'utf8');
      
      case 'application/pdf':
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(pdfBuffer);
        return pdfData.text;
      
      case 'application/msword':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        const docBuffer = fs.readFileSync(filePath);
        const docResult = await mammoth.extractRawText({ buffer: docBuffer });
        return docResult.value;
      
      default:
        throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw error;
  }
}

// CSV Upload Route
router.post("/upload-csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const uploadType = req.body.type || "file"; 
    const csvFilePath = req.file.path;
    const tempData = [];

    console.log(`📤 Processing CSV for uploadType: "${uploadType}"...`);

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on("data", (row) => tempData.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    if (uploadType === "camera") {
      const permanentPath = path.join(__dirname, "../uploads", "medications_camera.csv");
      fs.renameSync(csvFilePath, permanentPath);
      medicationDataCamera = tempData;
      console.log(`✅ Camera CSV loaded: ${tempData.length} records`);
    } else {
      const permanentPath = path.join(__dirname, "../uploads", "medications_file.csv");
      fs.renameSync(csvFilePath, permanentPath);
      medicationDataFile = tempData; 
      console.log(`✅ File CSV loaded: ${tempData.length} records`);
    }

    res.json({
      success: true,
      message: `CSV uploaded successfully for ${uploadType}.`,
      recordCount: tempData.length,
      uploadType: uploadType
    });
  } catch (error) {
    console.error("❌ Upload CSV error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 🔥 MAIN EXTRACTION ROUTE - FIXED VERSION
router.post("/extract-text", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const filePath = req.file.path;
    const mimetype = req.file.mimetype;
    const type = req.body.type?.trim() || "file";

    console.log(`🔍 Extract-text called with type: "${type}"`);
    console.log(`📊 Current data sizes - Camera: ${medicationDataCamera.length}, File: ${medicationDataFile.length}`);

    const currentData = type === "camera" ? medicationDataCamera : medicationDataFile;

    if (!currentData || currentData.length === 0) {
      return res.status(400).json({
        success: false,
        error: `No medication data loaded for ${type}. Upload CSV first.`,
      });
    }

    let parsedData = { medications: [], pharmacyDetails: {} };
    let extractedText = "";

    // 🖼️ SPECIAL HANDLING FOR IMAGES - SINGLE VISION CALL
    if (mimetype.startsWith('image/')) {
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');

      // ✅ FIXED: Single comprehensive vision call with correct format
      const visionResponse = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this prescription/medication image and extract:

1. **All medication names** (brand names, generic names, drug names)
   - Examples: Paracetamol, Amoxicillin, Crocin, Oxycodone, etc.
   - Include medications from pill bottles, labels, or prescriptions
   - Do NOT include dosages (500mg, 2 tablets, etc.)

2. **Pharmacy details** (if visible):
   - Pharmacy name
   - Address
   - City
   - ZIP/Postal code
   - Phone number

Return ONLY valid JSON in this exact format:
{
  "medications": ["Drug1", "Drug2", "Drug3"],
  "pharmacyDetails": {
    "name": "Pharmacy Name",
    "address": "Street Address",
    "city": "City",
    "zip": "12345",
    "phone": "+91-1234567890"
  }
}

If any field is not found, use empty string "". Do not include any explanatory text, only JSON.`
              },
              {
                type: "image_url", // ✅ Correct property name
                image_url: {
                  url: `data:${mimetype};base64,${base64Image}`,
                  detail: "high" // ✅ Better image analysis
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1 // Lower temperature for more consistent extraction
      });

      let rawContent = visionResponse.choices[0].message.content?.trim() || "";
      console.log("🔍 Vision API Raw Response:", rawContent);

      // Parse JSON response
      try {
        // Remove markdown code blocks if present
        rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');

        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
          console.log("✅ Image: JSON parsed successfully");
          console.log("📋 Extracted medications:", parsedData.medications);
        } else {
          console.warn("⚠️ No JSON found in response");
          parsedData = {
            medications: [],
            pharmacyDetails: { name: "", address: "", city: "", zip: "", phone: "" }
          };
        }
      } catch (e) {
        console.error("⚠️ Image: JSON parse error:", e);
        console.error("Raw content:", rawContent);
        parsedData = {
          medications: [],
          pharmacyDetails: { name: "", address: "", city: "", zip: "", phone: "" }
        };
      }

      extractedText = rawContent;
      fs.unlinkSync(filePath);

    } else {
      // 📄 FOR PDF, DOC, TXT FILES - Extract text first
      extractedText = await extractTextFromFile(filePath, mimetype);
      fs.unlinkSync(filePath);

      if (!extractedText || extractedText.trim() === "") {
        return res.json({
          success: true,
          extractedText: "No text extracted",
          matchesFound: 0,
          unmatchedMedications: [],
          pharmacyDetails: {}
        });
      }

      // Then send to GPT for structured extraction
      const extractionPrompt = `Analyze this medical document text and extract:

1. **All medication names** (brand names, generic names, drug names)
   - Examples: Paracetamol, Amoxicillin, Crocin, etc.
   - Do NOT include dosages (500mg, 2 tablets, etc.)

2. **Pharmacy details** (if present):
   - Pharmacy name
   - Address
   - City
   - ZIP/Postal code
   - Phone number

Return ONLY valid JSON in this exact format:
{
  "medications": ["Drug1", "Drug2"],
  "pharmacyDetails": {
    "name": "",
    "address": "",
    "city": "",
    "zip": "",
    "phone": ""
  }
}

If any field is not found, use empty string "".

TEXT:
${extractedText}`;

      const structuredResponse = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: extractionPrompt }],
        temperature: 0.1,
        max_tokens: 800,
      });

      let rawContent = structuredResponse.choices[0].message.content?.trim() || "";

      try {
        rawContent = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
          console.log("✅ Document: JSON parsed successfully");
        }
      } catch (e) {
        console.error("⚠️ Document: JSON parse error:", e);
        parsedData = {
          medications: [],
          pharmacyDetails: { name: "", address: "", city: "", zip: "", phone: "" }
        };
      }
    }

    // 4️⃣ Medication search in CSV database
    const medicationList = (parsedData.medications || [])
      .map((m) => m.replace(/^\s*\d+[\.\)]\s*/g, "").trim())
      .filter((m) => m.length > 2);

    console.log("🔍 Searching for medications:", medicationList);

    const allResults = [];
    const unmatchedMedications = [];

    for (const med of medicationList) {
      const { matches, matchType } = searchSingleMedicationForType(med, currentData);
      if (matches.length > 0) {
        allResults.push({ query: med, matches, matchType });
      } else {
        unmatchedMedications.push(med);
      }
    }

    // 5️⃣ Final structured output
    res.json({
      success: true,
      type,
      extractedText: extractedText.substring(0, 500), // Limit for response size
      matchesFound: allResults.length,
      unmatchedMedications,
      detailedResults: allResults,
      pharmacyDetails: parsedData.pharmacyDetails || {}
    });

  } catch (err) {
    console.error("❌ Extract error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Medication search helper
function searchSingleMedicationForType(query, dataset) {
  const term = query.toLowerCase().trim();
  let matches = [];
  let matchType = "";

  matches = dataset.filter((d) => d.Brand?.toLowerCase() === term);
  if (matches.length) matchType = "Brand (Exact)";
  else if ((matches = dataset.filter((d) => d.Brand?.toLowerCase().includes(term))).length)
    matchType = "Brand (Partial)";
  else if ((matches = dataset.filter((d) => d.Generic?.toLowerCase() === term)).length)
    matchType = "Generic (Exact)";
  else if ((matches = dataset.filter((d) => d.Generic?.toLowerCase().includes(term))).length)
    matchType = "Generic (Partial)";
  else if ((matches = dataset.filter((d) => d.Class?.toLowerCase().includes(term))).length)
    matchType = "Class";

  return { matches: matches.slice(0, 5), matchType };
}

module.exports = router;