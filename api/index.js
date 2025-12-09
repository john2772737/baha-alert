import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';

export default async function handler(req, res) {
  await dbConnect();

  // ⭐ FIX 1: Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); 
  }

  // ---------------------------------------------------------
  // 💾 POST METHOD: SAVE DATA
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    if (!req.body) return res.status(400).json({ success: false, message: 'No payload.' });

    try {
      // 1. Maintenance Queue (Web UI -> Database)
      if (req.body.type === 'MAINTENANCE_TEST') {
          const maintenanceEntry = await MaintenanceLog.create({
              sensor: req.body.sensor,
              command: req.body.command,
              status: 'PENDING',
              timestamp: req.body.timestamp || new Date(),
              deviceMode: 'MAINTENANCE'
          });
          return res.status(201).json({ success: true, data: maintenanceEntry });
      }

      // 2. Maintenance Result (ESP32 -> Database)
      if (req.body.type === 'MAINTENANCE_RESULT') {
          const updatedLog = await MaintenanceLog.findOneAndUpdate(
              { status: 'FETCHED' }, 
              { status: 'COMPLETED', value: req.body.val, timestamp: new Date() },
              { sort: { timestamp: -1 }, new: true } 
          );
          
          if (!updatedLog) {
             await MaintenanceLog.create({
                 sensor: req.body.sensor || 'unknown',
                 command: 'RESULT',
                 status: 'COMPLETED',
                 value: req.body.val,
                 deviceMode: 'MAINTENANCE'
             });
          }
          return res.status(200).json({ success: true, message: 'Result Saved' });
      }

      // 3. Normal Data (Auto Mode)
      const newAlert = await Alert.create({ payload: req.body });
      return res.status(201).json({ success: true, message: 'Data Logged', id: newAlert._id });

    } catch (error) {
      console.error("API POST Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } 
  
  // ---------------------------------------------------------
  // 🔍 GET METHOD: FETCH DATA
  // ---------------------------------------------------------
  else if (req.method === 'GET') {
    try {
        // 1. ESP32 Polling (Give Commands)
        if (req.query.maintenance === 'true') {
            const pendingCmd = await MaintenanceLog.findOneAndUpdate(
                { status: 'PENDING' },
                { $set: { status: 'FETCHED' } }, 
                { sort: { timestamp: 1 }, new: true }
            );
            if (pendingCmd) return res.status(200).json({ success: true, hasCommand: true, command: pendingCmd.command });
            else return res.status(200).json({ success: true, hasCommand: false });
        }

        // 2. UI Polling (Live Test Results)
        if (req.query.latest_result === 'true') {
            const result = await MaintenanceLog.findOne({
                sensor: req.query.sensor,
                status: 'COMPLETED',
                value: { $ne: null }
            }).sort({ timestamp: -1 });

            return res.status(200).json({ 
                success: true, 
                value: result ? result.value : 'Waiting...' 
            });
        }

        // 3. PDF REPORT: TODAY'S LOGS (10-minute samples)
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

        // 4. CHART: 7-DAY HISTORY (Daily Averages) -- ⭐ RESTORED
        if (req.query.history === 'true') {
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

        // 5. Default: Latest Alert (Live Dashboard)
        const latestAlert = await Alert.findOne({}).sort({ createdAt: -1 }).exec();
        return res.status(200).json({ success: true, data: latestAlert });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } 
  
  // ---------------------------------------------------------
  // 🗑️ NEW DELETE METHOD: CLEANUP (Added for Sunday Deletion)
  // ---------------------------------------------------------
  else if (req.method === 'DELETE') {
      try {
          let deleteFilter = {};
          let message = "Cleanup successful.";

          // ⭐ LOGIC TO DELETE SUNDAY DATA
          if (req.query.date === 'sunday') {
              // 1. Calculate the date range for the last Sunday
              const targetDate = new Date();
              // Adjust targetDate to the last Sunday (day 0)
              targetDate.setDate(targetDate.getDate() - (targetDate.getDay() + 7) % 7); 
              targetDate.setHours(0, 0, 0, 0);

              const nextDay = new Date(targetDate);
              nextDay.setDate(targetDate.getDate() + 1);

              deleteFilter = {
                  createdAt: { 
                      $gte: targetDate, // Sunday 00:00:00
                      $lt: nextDay      // Monday 00:00:00
                  }
              };
              message = `Deleted all sensor data logged on the last Sunday (${targetDate.toLocaleDateString()}).`;
          } 
          // Default cleanup (e.g., deleting bad pressure records)
          else if (req.query.badpressure === 'true') {
              deleteFilter = { "payload.pressure": -1 };
              message = "Removed all broken pressure (-1) records.";
          }
          // Default: No specific action
          else {
              return res.status(400).json({ success: false, message: "Missing specific delete query (e.g., ?date=sunday or ?badpressure=true)." });
          }

          // Execute deletion
          const result = await Alert.deleteMany(deleteFilter);

          return res.status(200).json({
              success: true,
              message: message,
              deletedCount: result.deletedCount,
          });

      } catch (error) {
          console.error("API DELETE Error:", error);
          return res.status(500).json({ success: false, error: error.message });
      }
  }
  
  // ---------------------------------------------------------
  // 🛑 METHOD NOT ALLOWED
  // ---------------------------------------------------------
  else {
    return res.status(405).json({ success: false, message: `Method not allowed.` });
  }
}