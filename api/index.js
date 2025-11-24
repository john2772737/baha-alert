import dbConnect from '../../lib/dbConnect';
import Alert from '../../models/Alert';

/**
 * Vercel Serverless Function to handle incoming sensor data at the /api endpoint.
 * NOTE: The vercel.json file enforces that this function is only accessible via POST requests.
 */
export default async function handler(req, res) {
  // Although vercel.json enforces the POST method, we check it here for local development and clarity.
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Ensure the request body is present
  if (!req.body) {
    return res.status(400).json({ success: false, message: 'No data payload provided.' });
  }

  try {
    // 1. Connect to the database (This calls dbConnect and reuses the cached connection)
    await dbConnect(); 

    // 2. Create a new document using the incoming JSON payload as the value for the 'payload' field.
    const newAlert = await Alert.create({
      payload: req.body,
    });

    // 3. Send a successful response back to the ESP32
    return res.status(201).json({
      success: true,
      message: 'Data logged successfully.',
      documentId: newAlert._id,
    });

  } catch (error) {
    console.error('Database save failed:', error);
    
    // 4. Send an error response
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error while logging data.',
      error: error.message
    });
  }
}