import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';

// --- CONFIG ---
const ALERT_COLLECTION_NAME = 'Alert'; // Assuming this maps to your 'alertdatas' collection

// --- HELPER FUNCTION: Sanitize Sensor Input ---
const sanitizePayload = (payload) => {
    // We expect pressure, rain, soil, waterDistanceCM to be numbers.
    // If a sensor is broken, it sends -1. We change this to null before saving.
    const sanitizedPressure = (payload.pressure && payload.pressure < 0) ? null : payload.pressure;
    const sanitizedRain = (payload.rain && payload.rain < 0) ? null : payload.rain;
    const sanitizedSoil = (payload.soil && payload.soil < 0) ? null : payload.soil;
    const sanitizedWater = (payload.waterDistanceCM && payload.waterDistanceCM < 0) ? null : payload.waterDistanceCM;

    return {
        ...payload,
        pressure: sanitizedPressure,
        rain: sanitizedRain,
        soil: sanitizedSoil,
        waterDistanceCM: sanitizedWater,
    };
};


export default async function handler(req, res) {
  await dbConnect();

  // ⭐ Handle CORS Preflight (Always include this for web API calls)
  if (req.method === 'OPTIONS') {
    return res.status(200).end(); 
  }

  // =========================================================
  // 💾 POST METHOD: SAVE DATA
  // =========================================================
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
          // Logic for updating the log... (assuming this part is okay)
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

      // 3. Normal Data (Auto Mode) - ⭐ SANITIZE INPUT BEFORE SAVING
      const sanitizedPayload = sanitizePayload(req.body);
      
      // Assuming 'Alert' model schema already has 'payload' field correctly defined
      const newAlert = await Alert.create({ payload: sanitizedPayload }); 
      
      return res.status(201).json({ success: true, message: 'Data Logged', id: newAlert._id });

    } catch (error) {
      console.error("API POST Error:", error);
      return res.status(500).json({ success: false, error: error.message });
    }
  } 
  
  // =========================================================
  // 🔍 GET METHOD: FETCH DATA (Unchanged)
  // =========================================================
  else if (req.method === 'GET') {
    try {
        // ... (GET logic remains the same) ...
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
                        // We use the aggregation framework to safely average the pressure
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

  // =========================================================
  // 🗑️ NEW DELETE METHOD: CLEANUP
  // =========================================================
  else if (req.method === 'DELETE') {
    // Note: You might want to add a secret key/admin check here!
    
    try {
        const deleteFilter = { "payload.pressure": -1 };
        
        // Use the model derived from your 'Alert' schema/collection
        const result = await Alert.deleteMany(deleteFilter);

        return res.status(200).json({
            success: true,
            message: `Cleanup successful. Removed ${result.deletedCount} bad pressure records.`,
            deletedCount: result.deletedCount,
        });

    } catch (error) {
        console.error("API DELETE Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
  }
  
  // =========================================================
  // 🛑 METHOD NOT ALLOWED
  // =========================================================
  else {
    return res.status(405).json({ success: false, message: `Method not allowed.` });
  }
}