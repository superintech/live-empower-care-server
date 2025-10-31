const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');

const SCOPES = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../config/google-service-account.json'),
  scopes: SCOPES
});

const drive = google.drive({ version: 'v3', auth });

// Helper to find or create a folder IN SHARED DRIVE
async function getOrCreateFolder(folderName, parentFolderId) {
  const response = await drive.files.list({
    q: `'${parentFolderId}' in parents and name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
    supportsAllDrives: true, // ✅ Added for Shared Drive support
    includeItemsFromAllDrives: true, // ✅ Added for Shared Drive support
    corpora: 'allDrives' // ✅ Added for Shared Drive support
  });

  const folder = response.data.files[0];
  if (folder) {
    return folder.id;
  }

  const folderMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const folderCreation = await drive.files.create({
    resource: folderMetadata,
    fields: 'id',
    supportsAllDrives: true, // ✅ Added for Shared Drive support
    supportsTeamDrives: true // ✅ Added for legacy support
  });

  return folderCreation.data.id;
}

// Main function to upload file into Shared Drive folder
async function uploadToDrive(filePath, fileName, folderId) {
  try {
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };

    const media = {
      mimeType: 'application/pdf',
      body: fs.createReadStream(filePath)
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id, webViewLink',
      supportsAllDrives: true, // ✅ Added for Shared Drive support
      supportsTeamDrives: true // ✅ Added for legacy support
    });

    // Make file publicly readable
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      },
      supportsAllDrives: true, // ✅ Added for Shared Drive support
      supportsTeamDrives: true // ✅ Added for legacy support
    });

    return {
      id: file.data.id,
      webViewLink: file.data.webViewLink
    };
  } catch (error) {
    console.error('Error uploading to Google Drive:', error.response?.data || error.message);
    throw error;
  }
}

module.exports = { uploadToDrive, getOrCreateFolder };