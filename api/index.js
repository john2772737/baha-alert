import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';

export default async function handler(req, res) {
  await dbConnect();

  // ---------------------------------------------------------
  // 💾 POST: SAVE DATA (From Web UI or Sensors)
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    if (!req.body) return res.status(400).json({ success: false, message: 'No payload.' });

    try {
      // SCENARIO A: User clicked a Test Button (Queue a Command)
      if (req.body.type === 'MAINTENANCE_TEST') {
          const maintenanceEntry = await MaintenanceLog.create({
              sensor: req.body.sensor,
              command: req.body.command, // 'R', 'S', etc.
              status: 'PENDING',
              timestamp: req.body.timestamp || new Date(),
              deviceMode: 'MAINTENANCE'
          });
          return res.status(201).json({ success: true, data: maintenanceEntry });
      }

      // SCENARIO B: Normal Sensor Data (From ESP32)
      const newAlert = await Alert.create({ payload: req.body });
      return res.status(201).json({ success: true, documentId: newAlert._id });

    } catch (error) {
      console.error("API Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } 
  
  // ---------------------------------------------------------
  // 🔍 GET: FETCH DATA (For Dashboard or ESP32 Polling)
  // ---------------------------------------------------------
  else if (req.method === 'GET') {
    try {
        // ⭐ ESP32 POLLING ENDPOINT
        if (req.query.maintenance === 'true') {
            // Find the oldest PENDING command and mark it FETCHED immediately
            const pendingCmd = await MaintenanceLog.findOneAndUpdate(
                { status: 'PENDING' },
                { $set: { status: 'FETCHED' } }, 
                { sort: { timestamp: 1 }, new: true }
            );

            if (pendingCmd) {
                return res.status(200).json({ 
                    success: true, 
                    hasCommand: true, 
                    command: pendingCmd.command // Returns 'R', 'S', etc.
                });
            } else {
                return res.status(200).json({ success: true, hasCommand: false });
            }
        }

        // 1. TODAY'S LOGS (Sampled)
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
        
        // 2. HISTORY MODE (7 Days)
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
        
        // 3. DEFAULT (Latest Alert)
        else {
            const latestAlert = await Alert.findOne({}).sort({ createdAt: -1 }).exec();
            if (!latestAlert) return res.status(404).json({ success: false, message: 'No data.' });
            return res.status(200).json({ success: true, data: latestAlert });
        }

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
}