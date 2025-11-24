import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';

/**
 * Vercel Serverless Function to handle incoming sensor data (POST) or retrieve 
 * filtered alerts (GET) at the /api endpoint.
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
      // NOTE: Ensure the 'Alert' model structure matches the expected document shape.
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
  
  // --- 🔎 Handle GET Request (GET from DB, supports time filtering) ---
  else if (req.method === 'GET') {
    const { startDate, endDate } = req.query;
    let dateFilter = {};

    // 2. Construct the date filter if parameters are provided
    if (startDate || endDate) {
      dateFilter = { 'payload.receivedAt': {} };
      
      if (startDate) {
        // Find documents greater than or equal to the start date
        dateFilter['payload.receivedAt']['$gte'] = new Date(startDate);
      }
      if (endDate) {
        // Find documents less than or equal to the end date
        dateFilter['payload.receivedAt']['$lte'] = new Date(endDate);
      }
      
      // Basic validation: ensure dates are valid before proceeding
      if (startDate && isNaN(dateFilter['payload.receivedAt']['$gte'])) {
         return res.status(400).json({ success: false, message: 'Invalid startDate format.' });
      }
      if (endDate && isNaN(dateFilter['payload.receivedAt']['$lte'])) {
         return res.status(400).json({ success: false, message: 'Invalid endDate format.' });
      }
    }

    try {
      // 3. Retrieve documents from the Alert collection using the constructed filter
      const alerts = await Alert.find(dateFilter)
        // Sort results by the timestamp field inside the payload, in ascending order
        .sort({ 'payload.receivedAt': 1 }) 
        .exec();

      // 4. Send a successful response with the data
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