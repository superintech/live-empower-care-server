const express = require('express');
const router = express.Router();
const upload = require('../../middlewares/uploadMiddleware');
const { uploadToDrive, getOrCreateFolder } = require('../../services/driveService');
const { sendToWebhook } = require('../../services/webhookService');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const path = require('path');
const { GOOGLE_DRIVE_FOLDER_ID } = require('../../config/eliteGoogleDrive');
const compressionService = require('../../services/compressionService');

router.post('/upload-patient-form', upload.any(), async (req, res) => {
  console.log('📝 Upload request received');

  try {
    if (!fs.existsSync('uploads')) fs.mkdirSync('uploads', { recursive: true });

    const pdfFile = req.files.find(f => f.fieldname === 'pdf');
    const painDiagramFile = req.files.find(f => f.fieldname === 'painDiagramPdf');

    if (!pdfFile || !painDiagramFile) {
      return res.status(400).json({
        message: 'Both PDF and pain diagram are required.',
        received: {
          pdf: !!pdfFile,
          painDiagram: !!painDiagramFile
        }
      });
    }

    const firstName = req.body.firstname?.trim();
    const lastName = req.body.lastname?.trim();
    const email = req.body.email?.trim();
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        message: 'First name, last name, and email are required.',
        received: { firstName: !!firstName, lastName: !!lastName, email: !!email }
      });
    }

    console.log(`👤 Processing form for: ${firstName} ${lastName}`);

    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const timestamp = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${now.getFullYear()}_${pad(now.getHours() % 12 || 12)}-${pad(now.getMinutes())}${now.getHours() >= 12 ? 'PM' : 'AM'}`;

    const pdfOriginalName = `Original_Form_${firstName}_${lastName}_${timestamp}.pdf`;
    const painDiagramName = `Pain_Diagram_${firstName}_${lastName}_${timestamp}.pdf`;
    const mergedName = `Merged_Patient_Form_${firstName}_${lastName}_${timestamp}.pdf`;

    // Merge PDFs
    console.log('🔄 Merging PDFs');
    const mergedPdf = await PDFDocument.create();
    const origBytes = fs.readFileSync(pdfFile.path);
    const origPdf = await PDFDocument.load(origBytes);
    (await mergedPdf.copyPages(origPdf, origPdf.getPageIndices())).forEach(p => mergedPdf.addPage(p));

    const painBytes = fs.readFileSync(painDiagramFile.path);
    const painPdf = await PDFDocument.load(painBytes);
    (await mergedPdf.copyPages(painPdf, painPdf.getPageIndices())).forEach(p => mergedPdf.addPage(p));

    const mergedPdfBytes = await mergedPdf.save();
    const mergedPath = path.join('uploads', mergedName);
    fs.writeFileSync(mergedPath, mergedPdfBytes);
    console.log('✅ Merge complete');

    // Compress
    console.log('🔄 Compressing PDFs');
    const compressedOriginalPath = path.join('uploads', `Compressed_${pdfOriginalName}`);
    const compressedPainPath = path.join('uploads', `Compressed_${painDiagramName}`);
    const compressedMergedPath = path.join('uploads', `Compressed_${mergedName}`);

    await Promise.all([
      compressionService.compressPDF(pdfFile.path, compressedOriginalPath, { quality: 'screen', imageQuality: 0.3 }),
      compressionService.compressPDF(painDiagramFile.path, compressedPainPath, { quality: 'screen', imageQuality: 0.3 }),
      compressionService.compressPDF(mergedPath, compressedMergedPath, { quality: 'screen', imageQuality: 0.3 })
    ]);
    console.log('✅ Compression done');

    // Upload PDFs to Drive
    console.log('🔄 Uploading PDFs to Drive');
    const userFolderId = await getOrCreateFolder(`${firstName} ${lastName}`, GOOGLE_DRIVE_FOLDER_ID);
    const imagesFolderId = await getOrCreateFolder('Images', userFolderId);

    const [originalDrive, painDrive, mergedDrive] = await Promise.all([
      uploadToDrive(compressedOriginalPath, `Compressed_${pdfOriginalName}`, userFolderId),
      uploadToDrive(compressedPainPath, `Compressed_${painDiagramName}`, userFolderId),
      uploadToDrive(compressedMergedPath, `Compressed_${mergedName}`, userFolderId)
    ]);

    // ✅ Handle Dynamic Images Upload
    console.log('🔄 Uploading dynamic images to Drive');
    const imageFiles = req.files.filter(f =>
      f.fieldname !== 'pdf' && f.fieldname !== 'painDiagramPdf'
    );

    const uploadedImagesByField = {};
    for (const file of imageFiles) {
      const subFolderId = await getOrCreateFolder(file.fieldname.replace(/_/g, ' '), imagesFolderId);
      const uploadedFile = await uploadToDrive(file.path, file.originalname, subFolderId);

      if (!uploadedImagesByField[file.fieldname]) uploadedImagesByField[file.fieldname] = [];
      uploadedImagesByField[file.fieldname].push(uploadedFile);
    }

    console.log('✅ Images uploaded by field name');

    // 🔥 Flatten URLs for GHL
    const flattenedImages = Object.fromEntries(
      Object.entries(uploadedImagesByField).map(([field, arr]) => [
        field,
        arr.map(f => f.webViewLink).join(', ') // 🔥 Convert array to comma-separated string
      ])
    );

    // ✅ Webhook send
    if (process.env.WEBHOOK_URL) {
      const webhookData = {
        formData: req.body,
        files: {
          originalPdf: { fileName: originalDrive.name, fileId: originalDrive.id, fileUrl: originalDrive.webViewLink },
          painDiagramPdf: { fileName: painDrive.name, fileId: painDrive.id, fileUrl: painDrive.webViewLink },
          mergedPdf: { fileName: mergedDrive.name, fileId: mergedDrive.id, fileUrl: mergedDrive.webViewLink },
          images: flattenedImages // 🔥 Send flattened URLs
        },
        timestamp: new Date().toISOString(),
        platform: process.platform,
        compressionUsed: true
      };

      try {
        await sendToWebhook(process.env.WEBHOOK_URL, webhookData);
        console.log('✅ Webhook sent successfully');
      } catch (err) {
        console.error('❌ Webhook failed:', err.message);
      }
    }

    // Cleanup
    [...req.files.map(f => f.path), mergedPath, compressedOriginalPath, compressedPainPath, compressedMergedPath]
      .forEach(fp => { if (fs.existsSync(fp)) fs.unlinkSync(fp); });

    res.status(200).json({
      success: true,
      message: 'All files uploaded and processed successfully',
      files: {
        originalPdfUrl: originalDrive.webViewLink,
        painDiagramPdfUrl: painDrive.webViewLink,
        mergedPdfUrl: mergedDrive.webViewLink,
        images: flattenedImages // 🔥 Return flattened URLs
      }
    });

  } catch (err) {
    console.error('❌ Critical error in upload route:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;