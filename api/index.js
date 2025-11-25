import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';

export default async function handler(req, res) {
  await dbConnect();

  // --- 💾 POST: Save Data ---
  if (req.method === 'POST') {
    if (!req.body) return res.status(400).json({ success: false, message: 'No data payload.' });

    try {
      const newAlert = await Alert.create({ payload: req.body });
      return res.status(201).json({ success: true, message: 'Logged.', documentId: newAlert._id });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }

  // --- 🔍 GET: Fetch Data ---
  } else if (req.method === 'GET') {
    try {
        // 1. 📅 HISTORY MODE: Get 7-Day Daily Averages
        if (req.query.history === 'true') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const historyData = await Alert.aggregate([
                { 
                    // Filter for documents from the last 7 days
                    $match: { createdAt: { $gte: sevenDaysAgo } } 
                },
                {
                    // Group by Date (YYYY-MM-DD)
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        avgPressure: { $avg: "$payload.pressure" },
                        // Note: Ensure these match your DB payload keys (rain, soil, etc.)
                        avgRain: { $avg: "$payload.rain" }, 
                        avgSoil: { $avg: "$payload.soil" },
                        avgWaterDistance: { $avg: "$payload.waterDistanceCM" }
                    }
                },
                { $sort: { _id: 1 } } // Sort by date ascending (Oldest to Newest)
            ]);

            return res.status(200).json({ success: true, data: historyData });
        }
        
        // 3. ⚡ DEFAULT MODE: Get Latest Single Alert
        else {
            const latestAlert = await Alert.findOne({}).sort({ createdAt: -1 }).exec();
            if (!latestAlert) return res.status(404).json({ success: false, message: 'No data found.' });
            return res.status(200).json({ success: true, data: latestAlert });
        }

    } catch (error) {
      console.error('Database Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
}