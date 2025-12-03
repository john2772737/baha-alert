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
        
        // 1. 📈 TODAY'S SAMPLED LOGS (New Feature)
        if (req.query.today === 'true') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const todayData = await Alert.aggregate([
                { 
                    // Filter: Only include documents created since the start of today
                    $match: { createdAt: { $gte: startOfDay } } 
                },
                {
                    // Group: Create composite key to sample data every 10 minutes
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" },
                            hour: { $hour: "$createdAt" },
                            // Calculate 10-minute bucket: (minute / 10) -> floor -> * 10
                            minute: { 
                                $multiply: [
                                    { $floor: { $divide: [{ $minute: "$createdAt" }, 10] } }, 
                                    10
                                ] 
                            }
                        },
                        // Average sensor readings within the 10-minute window
                        avgPressure: { $avg: "$payload.pressure" },
                        avgRain: { $avg: "$payload.rain" }, 
                        avgSoil: { $avg: "$payload.soil" },
                        avgWaterDistance: { $avg: "$payload.waterDistanceCM" },
                        // Capture the first timestamp for plotting/labeling
                        timestamp: { $min: "$createdAt" }
                    }
                },
                { $sort: { timestamp: 1 } }, // Sort by time ascending
                {
                    // Project the results into a cleaner structure
                    $project: {
                        _id: 0,
                        timestamp: 1,
                        avgPressure: 1,
                        avgRain: 1,
                        avgSoil: 1,
                        avgWaterDistance: 1,
                    }
                }
            ]);

            return res.status(200).json({ success: true, data: todayData });
        }
        
        // 2. 📅 HISTORY MODE: Get 7-Day Daily Averages (Existing Feature)
        else if (req.query.history === 'true') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const historyData = await Alert.aggregate([
                { 
                    $match: { createdAt: { $gte: sevenDaysAgo } } 
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        avgPressure: { $avg: "$payload.pressure" },
                        avgRain: { $avg: "$payload.rain" }, 
                        avgSoil: { $avg: "$payload.soil" },
                        avgWaterDistance: { $avg: "$payload.waterDistanceCM" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            return res.status(200).json({ success: true, data: historyData });
        }
        
        // 3. ⚡ DEFAULT MODE: Get Latest Single Alert (Existing Feature)
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