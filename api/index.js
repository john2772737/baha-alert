import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';

/**
 * Vercel Serverless Function to handle incoming sensor data (POST) or retrieve 
 * all alerts (GET) at the /api endpoint.
 */
export default async function handler(req, res) {
  // 1. Connect to the database for all operations
  await dbConnect(); 

  // --- 💾 Handle POST Request (SAVE to DB) ---
  if (req.method === 'POST') {
    // Ensure the request body is present
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'No data payload provided.' });
    }

    try {
      // Create a new document using the incoming JSON payload as the value for the 'payload' field.
      const newAlert = await Alert.create({
        payload: req.body,
      });

      // Send a successful response back 
      return res.status(201).json({
        success: true,
        message: 'Data logged successfully.',
        documentId: newAlert._id,
      });

    } catch (error) {
      console.error('Database save failed:', error);
      
      // Send an error response
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error while logging data.',
        error: error.message
      });
    }
  } 
  
  // --- 🔎 Handle GET Request (GET from DB) ---
  else if (req.method === 'GET') {
    try {
      // Retrieve all documents from the Alert collection
      const alerts = await Alert.find({}); 

      // Send a successful response with the data
      return res.status(200).json({
        success: true,
        data: alerts,
        count: alerts.length,
      });

    } catch (error) {
      console.error('Database retrieval failed:', error);
      
      // Send an error response
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error while retrieving data.',
        error: error.message
      });
    }
  }

  // --- 🚫 Handle Unsupported Methods ---
  else {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}