#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { google } from 'googleapis';

async function main() {
  const [,, pptxPathArg, titleArg] = process.argv;
  const pptxPath = pptxPathArg ? path.resolve(pptxPathArg) : null;
  const title = titleArg || 'Majin Slides';
  if (!pptxPath || !fs.existsSync(pptxPath)) {
    console.error('PPTX path not found:', pptxPath);
    process.exit(1);
  }

  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    console.error('GOOGLE_SERVICE_ACCOUNT_JSON is not set.');
    process.exit(1);
  }
  let creds;
  try { creds = JSON.parse(saJson); } catch (e) {
    console.error('Invalid GOOGLE_SERVICE_ACCOUNT_JSON:', e.message);
    process.exit(1);
  }

  const folderId = process.env.GDRIVE_FOLDER_ID || '';
  const shareEmail = process.env.GDRIVE_SHARE_EMAIL || '';

  const auth = new google.auth.JWT(
    creds.client_email,
    null,
    creds.private_key,
    [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/presentations',
    ],
    // creds.subject // uncomment if using domain-wide delegation
  );

  const drive = google.drive({ version: 'v3', auth });

  console.log('Uploading and converting PPTX to Google Slides...');
  const res = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.presentation',
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      body: fs.createReadStream(pptxPath),
    },
    fields: 'id,name',
  });

  const fileId = res.data.id;
  const url = `https://docs.google.com/presentation/d/${fileId}/edit`;
  console.log('Created Slides:', url);

  if (shareEmail) {
    try {
      await drive.permissions.create({
        fileId,
        requestBody: { type: 'user', role: 'writer', emailAddress: shareEmail },
        sendNotificationEmail: false,
      });
      console.log('Granted writer permission to:', shareEmail);
    } catch (e) {
      console.warn('Permission grant failed:', e.message);
    }
  }

  fs.writeFileSync('.gslides-url', url);
}

main().catch((e) => {
  console.error('Upload failed:', e);
  process.exit(1);
});

