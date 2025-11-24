import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';

export default async function handler(req, res) {
  // 1. Connect to the database for all operations
  await dbConnect(); 

  // --- 💾 Handle POST Request (SAVE to DB) ---
  if (req.method === 'POST') {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'No data payload provided.' });
    }

    try {
      const newAlert = await Alert.create({
        payload: req.body,
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
  
  // --- 🔎 Handle GET Request (SINGLE LATEST reading for live feed) ---
  else if (req.method === 'GET') {
    try {
        // Fetch the single latest document
        const latestReading = await Alert.findOne()
          .sort({ 'payload.receivedAt': -1 }) 
          .limit(1)
          .exec();
        
        // Define the default/empty state data structure
        const defaultData = { 
            pressure: 1012.0, rain: 0.0, waterLevel: 65.0, soil: 60.0 
        };
        
        // If a reading is found, use its payload; otherwise, use the default structure
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