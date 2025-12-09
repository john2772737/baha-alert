import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';
import AlertRecipientModel from '../models/AlertRecipient'; 
import nodemailer from 'nodemailer';

// --- Nodemailer Client Initialization (GMAIL_USER and GMAIL_PASS must be set in Vercel) ---
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

const transporter = (GMAIL_USER && GMAIL_PASS) ? nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
    },
}) : null;
// ------------------------------------

export default async function handler(req, res) {
  await dbConnect(); 

  if (req.method === 'OPTIONS') {
    return res.status(200).end(); 
  }

  // ---------------------------------------------------------
  // 💾 POST METHOD: SAVE DATA / SEND ALERTS
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

      // 🚫 REMOVED: 3. UPDATE ALERT RECIPIENT LOGIC HAS BEEN REMOVED.
      
      // 4. SEND GMAIL ALERT (Email Logic)
      if (req.body.type === 'SEND_ALERT_EMAIL') {
          if (!transporter) {
              return res.status(500).json({ success: false, error: 'Email transporter not initialized (check GMAIL_USER/PASS).' });
          }

          const { userEmail, alertMessage } = req.body;

          if (!userEmail || !alertMessage) {
              return res.status(400).json({ success: false, message: 'Missing userEmail or alertMessage.' });
          }
          
          const mailOptions = {
              from: GMAIL_USER,
              to: userEmail,
              subject: `CRITICAL BAHA ALERT: Action Required`,
              text: alertMessage,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-left: 5px solid #ff4d4d;">
                    <h3 style="color: #ff4d4d;">CRITICAL BAHA ALERT</h3>
                    <p style="font-size: 16px;">${alertMessage}</p>
                    <p>Please check the Baha Dashboard immediately for the latest sensor readings and conditions.</p>
                    <hr style="border: 0; border-top: 1px solid #eee;">
                    <p style="font-size: 12px; color: #888;">This is an automated notification. Do not reply.</p>
                </div>
              `
          };
          
          const info = await transporter.sendMail(mailOptions);

          return res.status(200).json({ 
              success: true, 
              message: 'Email alert sent successfully.', 
              messageId: info.messageId
          });
      }


      // 5. Normal Data (Auto Mode)
      const newAlert = await Alert.create({ payload: req.body });
      return res.status(201).json({ success: true, message: 'Data Logged', id: newAlert._id });

    } catch (error) {
      console.error("API POST Error:", error);
      return res.status(400).json({ success: false, error: error.message });
    }
  } 
  
  // ---------------------------------------------------------
  // 🔍 GET METHOD: FETCH DATA
  // ---------------------------------------------------------
  else if (req.method === 'GET') {
    try {
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

        // 5. CHART: 7-DAY HISTORY (Daily Averages)
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
  // 🗑️ DELETE METHOD: CLEANUP
  // ---------------------------------------------------------
  else if (req.method === 'DELETE') {
      try {
          let deleteFilter = {};
          let message = "Cleanup successful.";

          if (req.query.date) {
              const dateString = req.query.date;
              const targetDate = new Date(dateString);

              if (isNaN(targetDate)) {
                  return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD." });
              }

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
          else if (req.query.badpressure === 'true') {
              deleteFilter = { "payload.pressure": -1 };
              message = "Removed all broken pressure (-1) records.";
          }
          else {
              return res.status(400).json({ success: false, message: "Missing specific delete query (e.g., ?date=YYYY-MM-DD, ?lastsunday=true, or ?badpressure=true)." });
          }

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