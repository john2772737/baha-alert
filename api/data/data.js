import dbConnect from '../../lib/dbConnect';
import Alert from '../../models/Alert';

/**
 * Vercel Serverless Function to handle incoming sensor data.
 * This endpoint corresponds to the '/api/data' URL configured on the ESP32.
 */
export default async function handler(req, res) {
  // 1. Only allow the POST method, as the ESP32 is sending data.
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Ensure the request body is present
  if (!req.body) {
    return res.status(400).json({ success: false, message: 'No data payload provided.' });
  }

  try {
    // 2. Connect to the database (This calls dbConnect and reuses the cached connection)
    await dbConnect(); 

    // 3. Create a new document using the incoming JSON payload as the value for the 'payload' field.
    // The Alert model, which uses mongoose.Schema.Types.Mixed, handles the flexible sensor JSON.
    const newAlert = await Alert.create({
      payload: req.body,
    });

    // 4. Send a successful response back to the ESP32
    return res.status(201).json({
      success: true,
      message: 'Data logged successfully.',
      documentId: newAlert._id,
    });

  } catch (error) {
    console.error('Database save failed:', error);
    
    // 5. Send an error response
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error while logging data.',
      error: error.message
    });
  }
}