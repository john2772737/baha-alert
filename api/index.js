import dbConnect from '../../lib/dbConnect';
import Alert from '../../models/Alert';

/**
 * Handles POST to log new sensor data and GET to fetch the latest reading.
 * Endpoint: /api/data
 */
export default async function handler(req, res) {
  // 1. Connect to the database
  await dbConnect(); 

  // --- 💾 Handle POST Request (SAVE to DB) ---
  if (req.method === 'POST') {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'No data payload provided.' });
    }

    try {
      // 💡 FIX: Ensure a reliable server-side timestamp for sorting in the GET request.
      const postPayload = req.body;
      if (!postPayload.receivedAt) {
          postPayload.receivedAt = new Date();
      }
      
      const newAlert = await Alert.create({
        payload: postPayload,
      });

      return res.status(201).json({
        success: true,
        message: 'Data logged successfully.',
        documentId: newAlert._id,
      });

    } catch (error) {
      console.error('Database save failed:', error);
      
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error while logging data.',
        error: error.message
      });
    }
  } 
  
  // --- 🔎 Handle GET Request (Latest Reading) ---
  else if (req.method === 'GET') {
    try {
        // Fetch the single latest document
        const latestReading = await Alert.findOne()
          .sort({ 'payload.receivedAt': -1 }) 
          .limit(1)
          .exec();
        
        const defaultData = { 
            pressure: 1012.0, rain: 0.0, waterLevel: 65.0, soil: 60.0 
        };
        
        const responseData = latestReading 
            ? {
                pressure: latestReading.payload.pressure,
                rain: latestReading.payload.rain,
                waterLevel: latestReading.payload.waterLevel,
                soil: latestReading.payload.soil,
              }
            : defaultData;
        
        // Always return 200 OK with the final data structure
        return res.status(200).json(responseData);

    } catch (error) {
      console.error('Database retrieval failed:', error);
      
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