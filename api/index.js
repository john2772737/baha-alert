// pages/api/index.js
import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog'; // Import the new model

export default async function handler(req, res) {
  await dbConnect();

  // --- 💾 POST: Save Data ---
  if (req.method === 'POST') {
    if (!req.body) return res.status(400).json({ success: false, message: 'No data payload.' });

    try {
      // ⭐ INTERCEPT MAINTENANCE TESTS
      // If the frontend sends type: 'MAINTENANCE_TEST', save to the Log collection.
      if (req.body.type === 'MAINTENANCE_TEST') {
          const maintenanceEntry = await MaintenanceLog.create({
              sensor: req.body.sensor,
              command: req.body.command, // Save the 'R', 'U', etc.
              status: 'PENDING',         // Mark as pending for ESP32
              timestamp: req.body.timestamp || new Date(),
              deviceMode: 'MAINTENANCE'
          });
          return res.status(201).json({ success: true, message: 'Command Queued', data: maintenanceEntry });
      }

      // ⭐ DEFAULT LOGIC (Normal Sensor Data)
      const newAlert = await Alert.create({ payload: req.body });
      return res.status(201).json({ success: true, message: 'Logged.', documentId: newAlert._id });

    } catch (error) {
      console.error("Save Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }

  // --- 🔍 GET: Fetch Data ---
  } else if (req.method === 'GET') {
    try {
        // 1. TODAY'S SAMPLED LOGS
        if (req.query.today === 'true') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);

            const todayData = await Alert.aggregate([
                { $match: { createdAt: { $gte: startOfDay } } },
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                            day: { $dayOfMonth: "$createdAt" },
                            hour: { $hour: "$createdAt" },
                            minute: { $multiply: [{ $floor: { $divide: [{ $minute: "$createdAt" }, 10] } }, 10] }
                        },
                        avgPressure: { $avg: "$payload.pressure" },
                        avgRain: { $avg: "$payload.rain" }, 
                        avgSoil: { $avg: "$payload.soil" },
                        avgWaterDistance: { $avg: "$payload.waterDistanceCM" },
                        timestamp: { $min: "$createdAt" }
                    }
                },
                { $sort: { timestamp: 1 } },
                { $project: { _id: 0, timestamp: 1, avgPressure: 1, avgRain: 1, avgSoil: 1, avgWaterDistance: 1 } }
            ]);
            return res.status(200).json({ success: true, data: todayData });
        }
        
        // 2. HISTORY MODE
        else if (req.query.history === 'true') {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const historyData = await Alert.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
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
        
        // 3. DEFAULT MODE (Latest Alert)
        else {
            const latestAlert = await Alert.findOne({}).sort({ createdAt: -1 }).exec();
            if (!latestAlert) return res.status(404).json({ success: false, message: 'No data found.' });
            return res.status(200).json({ success: true, data: latestAlert });
        }

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
}