import dbConnect from "../../lib/dbConnect"
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';

export default async function handler(req, res) {
  await dbConnect();

  // ⭐ FIX 1: Handle CORS Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // ---------------------------------------------------------
  // 💾 POST METHOD: SAVE DATA
  // ---------------------------------------------------------
  if (req.method === 'POST') {
    if (!req.body) return res.status(400).json({ success: false, message: 'No payload.' });

    try {
      // 1. Maintenance Queue
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

      // 2. Maintenance Result (From ESP32)
      if (req.body.type === 'MAINTENANCE_RESULT') {
          const updatedLog = await MaintenanceLog.findOneAndUpdate(
              { status: 'FETCHED' }, 
              { status: 'COMPLETED', value: req.body.val, timestamp: new Date() },
              { sort: { timestamp: -1 }, new: true } 
          );
          
          // Safety fallback if no FETCHED task found
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

        // ⭐ 2. NEW: UI Polling (Get Result for a specific sensor)
        if (req.query.latest_result === 'true') {
            const result = await MaintenanceLog.findOne({
                sensor: req.query.sensor,
                status: 'COMPLETED', // Only get finished tests
                value: { $ne: null } // Ensure value exists
            }).sort({ timestamp: -1 }); // Get newest

            return res.status(200).json({ 
                success: true, 
                value: result ? result.value : 'Waiting...' 
            });
        }

        // 3. Default: Latest Alert
        const latestAlert = await Alert.findOne({}).sort({ createdAt: -1 }).exec();
        return res.status(200).json({ success: true, data: latestAlert });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } 
  
  // ---------------------------------------------------------
  // ❌ ERROR HANDLER
  // ---------------------------------------------------------
  else {
    console.log("Blocked Method:", req.method); 
    return res.status(405).json({ 
        success: false, 
        message: `Method not allowed. Server received: ${req.method}` 
    });
  }
}