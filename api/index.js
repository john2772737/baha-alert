import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert'; // Ensure this model is correctly defined

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

  // --- 🔍 Handle GET Request (FETCH ONLY THE LATEST or AGGREGATE AVERAGE) ---
  } else if (req.method === 'GET') {
    try {
        // Check for a specific query parameter to request aggregation
        if (req.query.aggregate === 'true') {

            // IMPORTANT: Adjust '$payload.temperature' and '$payload.humidity'
            // to match the actual paths of the numerical fields you want to average
            const averageData = await Alert.aggregate([
                {
                    // 1. Group all documents into a single group
                    $group: {
                        _id: null, 
                        // Example Averages:
                        avgTemperature: { $avg: '$payload.temperature' },
                        avgHumidity: { $avg: '$payload.humidity' },
                        // Add more fields to average here...
                    }
                },
                // 2. Remove the _id field and select only the necessary fields
                {
                    $project: {
                        _id: 0,
                        avgTemperature: 1,
                        avgHumidity: 1,
                    }
                }
            ]);

            // MongoDB aggregation returns an array
            if (averageData.length === 0) {
                 return res.status(404).json({ success: false, message: 'No data found to aggregate.' });
            }

            return res.status(200).json({
                success: true,
                type: 'aggregate',
                data: averageData[0] // Return the single result object
            });

        } else {
            // --- Default GET Logic: Fetch Only the Latest Alert ---
            const latestAlert = await Alert.findOne({})
                // Sort by creation date in descending order (-1) to get the newest
                .sort({ createdAt: -1 }) 
                .exec();

            // Check if a document was actually found
            if (!latestAlert) {
                return res.status(404).json({ success: false, message: 'No data found.' });
            }

            // Return the single latest document
            return res.status(200).json({
                success: true,
                type: 'latest',
                data: latestAlert
            });
        }

    } catch (error) {
      console.error('Database fetch/aggregation failed:', error);

      // Return a 500 status on database error
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error while fetching data.',
        error: error.message
      });
    }

  // --- ❌ Handle Other Methods (e.g., PUT, DELETE) ---
  } else {
    // If the request method is not POST or GET, return 405 Method Not Allowed
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
}