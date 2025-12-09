import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';
// Assuming you have defined the Mongoose model for recipients:
import AlertRecipientModel from '../models/AlertRecipient'; 
// NOTE: I'm using AlertRecipientModel to avoid conflict with component names

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

      // 2. Maintenance Result
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

      // ⭐ 3. NEW LOGIC: UPDATE ALERT RECIPIENT
      if (req.body.type === 'UPDATE_RECIPIENT') {
          const { userEmail, phoneNumber } = req.body;

          if (!userEmail || !phoneNumber) {
              return res.status(400).json({ success: false, message: 'Missing userEmail or phoneNumber.' });
          }

          // Mongoose UPSERT: Update if userEmail exists, insert if it doesn't.
          const updatedRecipient = await AlertRecipientModel.findOneAndUpdate(
              { userEmail: userEmail },
              { phoneNumber: phoneNumber, updatedAt: new Date() },
              { new: true, upsert: true, runValidators: true } // key options
          );
          
          return res.status(200).json({ 
              success: true, 
              message: 'Alert recipient saved successfully.',
              recipient: updatedRecipient.phoneNumber 
          });
      }

      // 4. Normal Data (Auto Mode)
      const newAlert = await Alert.create({ payload: req.body });
      return res.status(201).json({ success: true, message: 'Data Logged', id: newAlert._id });

    } catch (error) {
      console.error("API POST Error:", error);
      // Mongoose validation errors will fall here
      return res.status(400).json({ success: false, error: error.message });
    }
  } 
  
  // ---------------------------------------------------------
  // 🔍 GET METHOD: FETCH DATA (UNTOUCHED)
  // ---------------------------------------------------------
  else if (req.method === 'GET') {
    try {
        // ... (existing GET logic remains here) ...
        
        // 1. ESP32 Polling
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

        // ⭐ 3. NEW LOGIC: GET RECIPIENT PHONE NUMBER
        if (req.query.recipient_email) {
            const recipient = await AlertRecipientModel.findOne({ userEmail: req.query.recipient_email });
            if (recipient) {
                return res.status(200).json({ success: true, phoneNumber: recipient.phoneNumber });
            } else {
                return res.status(200).json({ success: true, phoneNumber: null });
            }
        }
        
        // 4. PDF REPORT: TODAY'S LOGS (10-minute samples)
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

        // 5. CHART: 7-DAY HISTORY (Daily Averages) -- ⭐ RESTORED
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

        // 6. Default: Latest Alert (Live Dashboard)
        const latestAlert = await Alert.findOne({}).sort({ createdAt: -1 }).exec();
        return res.status(200).json({ success: true, data: latestAlert });

    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  } 
  
  // ---------------------------------------------------------
  // 🗑️ NEW DELETE METHOD: CLEANUP (UNTOUCHED)
  // ---------------------------------------------------------
  else if (req.method === 'DELETE') {
      try {
          let deleteFilter = {};
          let message = "Cleanup successful.";

          // ⭐ LOGIC 1: DELETE BY SPECIFIC DATE (e.g., ?date=2025-12-07)
          if (req.query.date) {
              const dateString = req.query.date;
              const targetDate = new Date(dateString);

              if (isNaN(targetDate)) {
                  return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD." });
              }

              // Set start of day and start of next day for exact 24-hour range
              targetDate.setHours(0, 0, 0, 0);
              const nextDay = new Date(targetDate);
              nextDay.setDate(targetDate.getDate() + 1);

              deleteFilter = {
                  createdAt: { 
                      $gte: targetDate, 
                      $lt: nextDay      
                  }
              };
              message = `Deleted all sensor data logged on ${targetDate.toLocaleDateString()}.`;
          }
          // ⭐ LOGIC 2: DELETE BY LAST SUNDAY (Kept for backward compatibility)
          else if (req.query.lastsunday === 'true') {
              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() - (targetDate.getDay() + 7) % 7); 
              targetDate.setHours(0, 0, 0, 0);

              const nextDay = new Date(targetDate);
              nextDay.setDate(targetDate.getDate() + 1);

              deleteFilter = {
                  createdAt: { 
                      $gte: targetDate,
                      $lt: nextDay
                  }
              };
              message = `Deleted all sensor data logged on the last Sunday (${targetDate.toLocaleDateString()}).`;
          } 
          // ⭐ LOGIC 3: DELETE BROKEN PRESSURE RECORDS
          else if (req.query.badpressure === 'true') {
              deleteFilter = { "payload.pressure": -1 };
              message = "Removed all broken pressure (-1) records.";
          }
          // Default: Missing specific action
          else {
              return res.status(400).json({ success: false, message: "Missing specific delete query (e.g., ?date=YYYY-MM-DD, ?lastsunday=true, or ?badpressure=true)." });
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