import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';
import AlertRecipientModel from '../models/AlertRecipient'; 
import nodemailer from 'nodemailer';
import admin from 'firebase-admin'; 

// --- Nodemailer Client Initialization ---
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

const transporter = (GMAIL_USER && GMAIL_PASS) ? nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
    },
}) : null;

// --- Firebase Admin Initialization ---
// Initialize Firebase Admin only if it hasn't been initialized and credentials exist
if (!admin.apps.length && process.env.FIREBASE_ADMIN_CREDENTIALS) {
    try {
        const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS);
        admin.initializeApp({
            credential: admin.credential.cert(credentials),
        });
    } catch (error) {
        console.error("Firebase Admin Initialization Failed:", error);
    }
}
// ------------------------------------

export default async function handler(req, res) {
  // Ensure database connection is active
  await dbConnect(); 

  // Handle CORS Preflight
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

      // ⭐ 4. SEND GMAIL ALERT (Send to ALL Registered Users)
      if (req.body.type === 'SEND_ALERT_EMAIL') {
          if (!transporter) {
              return res.status(500).json({ success: false, error: 'Email transporter not initialized (check GMAIL_USER/PASS).' });
          }
          if (!admin.apps.length) {
              return res.status(500).json({ success: false, error: 'Firebase Admin not initialized (check FIREBASE_ADMIN_CREDENTIALS).' });
          }

          const { alertMessage, alertStatus } = req.body; 
          let usersToEmail = [];

          if (!alertMessage || !alertStatus) {
              return res.status(400).json({ success: false, message: 'Missing required alert data.' });
          }

          // --- 1. Fetch All User Emails from Firebase Authentication ---
          try {
              let nextPageToken = undefined;
              do {
                  const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
                  listUsersResult.users.forEach(userRecord => {
                      // CRITICAL: Only add emails that exist 
                      if (userRecord.email) {
                          usersToEmail.push(userRecord.email);
                      }
                  });
                  nextPageToken = listUsersResult.pageToken;
              } while (nextPageToken);
          } catch (error) {
              console.error("Error fetching Firebase users:", error);
              return res.status(500).json({ success: false, error: 'Failed to fetch user list from Firebase.' });
          }
          
          // --- 2. Dynamic Email UI Logic ---
          let colorHex = '#22c55e'; // Default: Emerald (STABLE/RECOVERY)
          let severityText = 'BAHA NOTICE';
          let subjectPrefix = 'BAHA NOTICE';

          switch (alertStatus) {
              case 'ADVISORY': colorHex = '#facc15'; severityText = 'ADVISORY'; subjectPrefix = 'BAHA ADVISORY'; break;
              case 'WARNING': colorHex = '#f97316'; severityText = 'WARNING'; subjectPrefix = 'BAHA WARNING'; break;
              case 'CRITICAL':
              case 'EMERGENCY': colorHex = '#ef4444'; severityText = alertStatus.toUpperCase(); subjectPrefix = 'CRITICAL BAHA ALERT'; break;
              case 'STABLE': colorHex = '#22c55e'; severityText = 'RECOVERY NOTICE'; subjectPrefix = 'BAHA RECOVERY'; break;
              default: break;
          }

          // --- 3. Prepare and Send Emails ---
          const mailPromises = usersToEmail.map(recipientEmail => {
              const mailOptions = {
                  from: GMAIL_USER,
                  to: recipientEmail, // Send to current user in the map
                  subject: `${subjectPrefix}: Action Required`, 
                  text: alertMessage,
                  html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-left: 5px solid ${colorHex};">
                        <h3 style="color: ${colorHex};">${severityText}</h3>
                        <p style="font-size: 16px;">${alertMessage}</p>
                        <p>Please check the Baha Dashboard immediately for the latest sensor readings and conditions.</p>
                        <hr style="border: 0; border-top: 1px solid #eee;">
                        <p style="font-size: 12px; color: #888;">This is an automated notification. Do not reply.</p>
                    </div>
                  `
              };
              return transporter.sendMail(mailOptions);
          });

          // Wait for all emails to be sent (Promise.allSettled allows some to fail without stopping others)
          await Promise.allSettled(mailPromises);

          return res.status(200).json({ 
              success: true, 
              message: `Alert sent successfully to ${usersToEmail.length} registered users.`,
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
  // 🔍 GET METHOD: FETCH DATA (UPDATED FOR DATE FILTERING)
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
        
        // 4. PDF REPORT: DAILY LOGS (10-minute samples)
        if (req.query.today === 'true') {
            
            let targetDate;

            // Check if a specific date is provided (YYYY-MM-DD format)
            if (req.query.date) {
                targetDate = new Date(req.query.date);
                // Validate date input
                if (isNaN(targetDate)) {
                    return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD." });
                }
            } else {
                // Default to today if no date parameter is provided
                targetDate = new Date();
            }

            // Set times for the start and end of the target day
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);
            

            const todayData = await Alert.aggregate([
                { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } }, // Use $gte and $lte for date range
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