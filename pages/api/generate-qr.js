// pages/api/generate-qr.js
import * as admin from 'firebase-admin';

// Initialize Firebase Admin (Server-Side)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    // 1. Verify the user requesting the token is actually logged in
    const { idToken } = req.body;
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // 2. Generate a Custom Token for this UID (Valid for 1 hour)
    const customToken = await admin.auth().createCustomToken(uid);

    // 3. Send it back to the client
    res.status(200).json({ token: customToken });
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(401).json({ error: 'Unauthorized request' });
  }
}