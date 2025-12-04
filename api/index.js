import dbConnect from '../../lib/dbConnect';
import Alert from '../../models/Alert';
import MaintenanceLog from '../../models/MaintenanceLog';

export default async function handler(req, res) {
  await dbConnect();

  // ---------------------------------------------------------
  // 💾 POST METHOD: SAVE DATA
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    if (!req.body) return res.status(400).json({ success: false, message: 'No payload.' });

    try {
      // --- SCENARIO 1: QUEUE MAINTENANCE COMMAND (From Web UI) ---
      // User clicks a button -> Save command to DB as 'PENDING'
      if (req.body.type === 'MAINTENANCE_TEST') {
          const maintenanceEntry = await MaintenanceLog.create({
              sensor: req.body.sensor,
              command: req.body.command, // 'R', 'S', 'U', 'P'
              status: 'PENDING',
              timestamp: req.body.timestamp || new Date(),
              deviceMode: 'MAINTENANCE'
          });
          return res.status(201).json({ success: true, message: 'Command Queued', data: maintenanceEntry });
      }

      // --- SCENARIO 2: SAVE TEST RESULT (From ESP32) ---
      // Arduino executed command -> ESP32 sends result -> Update DB entry
      if (req.body.type === 'MAINTENANCE_RESULT') {
          // Find the task that is currently in progress (FETCHED) and mark it COMPLETED
          const updatedLog = await MaintenanceLog.findOneAndUpdate(
              { status: 'FETCHED' }, 
              { 
                  status: 'COMPLETED',
                  value: req.body.val, // Save the reading (e.g., "961.00")
                  timestamp: new Date() 
              },
              { sort: { timestamp: -1 }, new: true } 
          );
          
          if (updatedLog) {
             return res.status(200).json({ success: true, message: 'Result Saved', data: updatedLog });
          } else {
             // Fallback: If no task was found (e.g. timeout), log as a new completed entry
             const newLog = await MaintenanceLog.create({
                 sensor: req.body.sensor || 'unknown',
                 command: 'RESULT',
                 status: 'COMPLETED',
                 value: req.body.val,
                 deviceMode: 'MAINTENANCE'
             });
             return res.status(201).json({ success: true, message: 'Result Logged (Fallback)', data: newLog });
          }
      }

      // --- SCENARIO 3: NORMAL SENSOR DATA (Auto Mode) ---
      // Regular logging from ESP32
      const newAlert = await Alert.create({ payload: req.body });
      return res.status(201).json({ success: true, message: 'Data Logged', documentId: newAlert._id });

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
        // --- 1. ESP32 POLLING (Check for Commands) ---
        // ESP32 asks: "Do you have work for me?"
        if (req.query.maintenance === 'true') {
            // Find oldest PENDING command and immediately mark it FETCHED
            // This prevents the ESP32 from executing the same command twice
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

        // --- 2. DASHBOARD: TODAY'S LOGS (Sampled) ---
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
        
        // --- 3. DASHBOARD: HISTORY (7 Days) ---
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
        
        // --- 4. DEFAULT: LATEST ALERT (Live View) ---
        else {
            const latestAlert = await Alert.findOne({}).sort({ createdAt: -1 }).exec();
            if (!latestAlert) return res.status(404).json({ success: false, message: 'No data found.' });
            return res.status(200).json({ success: true, data: latestAlert });
        }

    } catch (error) {
      console.error("API GET Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } else {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
}