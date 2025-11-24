import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';

/**
 * Vercel Serverless Function to handle incoming sensor data (POST) or retrieve 
 * filtered alerts/latest reading (GET) at the /api endpoint.
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
  
  // --- 🔎 Handle GET Request (Prioritizes SINGLE LATEST reading for live feed) ---
  else if (req.method === 'GET') {
    const { startDate, endDate } = req.query;
    
    // Determine if this is a request for a time-filtered array or just the single latest reading
    const isHistoricalQuery = startDate || endDate;

    try {
      if (isHistoricalQuery) {
        // --- LOGIC FOR HISTORICAL DATA (ARRAY RESPONSE) ---
        let dateFilter = {};
        dateFilter = { 'payload.receivedAt': {} };
        
        if (startDate) {
          dateFilter['payload.receivedAt']['$gte'] = new Date(startDate);
        }
        if (endDate) {
          dateFilter['payload.receivedAt']['$lte'] = new Date(endDate);
        }
        
        // Basic validation: ensure dates are valid before proceeding
        if (startDate && isNaN(dateFilter['payload.receivedAt']['$gte'])) {
           return res.status(400).json({ success: false, message: 'Invalid startDate format.' });
        }
        if (endDate && isNaN(dateFilter['payload.receivedAt']['$lte'])) {
           return res.status(400).json({ success: false, message: 'Invalid endDate format.' });
        }
        
        const alerts = await Alert.find(dateFilter)
          // Sort ascending for chronological display
          .sort({ 'payload.receivedAt': 1 }) 
          .exec();

        // Send array response for historical query (expected by a potential chart component)
        return res.status(200).json({
          success: true,
          data: alerts,
          count: alerts.length,
        });
        
      } else {
        // --- LOGIC FOR LIVE DATA (SINGLE OBJECT RESPONSE) ---
        const latestReading = await Alert.findOne()
          .sort({ 'payload.receivedAt': -1 }) // Sort descending to get the freshest document
          .limit(1)
          .exec();
        
        if (!latestReading) {
            // Return initial data structure if the database is empty
            return res.status(200).json({ 
                pressure: 1012.0, rain: 0.0, waterLevel: 65.0, soil: 60.0 
            });
        }
        
        // Return the sensor data fields directly as a single JSON object. 
        // This is MANDATORY for the React app's 1s polling to work correctly.
        return res.status(200).json({
            pressure: latestReading.payload.pressure,
            rain: latestReading.payload.rain,
            waterLevel: latestReading.payload.waterLevel,
            soil: latestReading.payload.soil,
        });
      }

    } catch (error) {
      console.error('Database retrieval failed:', error);
      
      // Send a general error response
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