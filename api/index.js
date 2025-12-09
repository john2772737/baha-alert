import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';
import MaintenanceLog from '../models/MaintenanceLog';
import AlertRecipientModel from '../models/AlertRecipient'; 
import twilio from 'twilio'; // ⭐ Import the Twilio SDK

// --- Twilio Client Initialization ---
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client once globally (if credentials are set)
const twilioClient = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN 
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null;
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

      // 3. UPDATE ALERT RECIPIENT (UPSERT Logic)
      if (req.body.type === 'UPDATE_RECIPIENT') {
          const { userEmail, phoneNumber } = req.body;

          if (!userEmail || !phoneNumber) {
              return res.status(400).json({ success: false, message: 'Missing userEmail or phoneNumber.' });
          }

          const updatedRecipient = await AlertRecipientModel.findOneAndUpdate(
              { userEmail: userEmail },
              { phoneNumber: phoneNumber, updatedAt: new Date() },
              { new: true, upsert: true, runValidators: true }
          );
          
          return res.status(200).json({ 
              success: true, 
              message: 'Alert recipient saved successfully.',
              recipient: updatedRecipient.phoneNumber 
          });
      }
      
      // ⭐ 4. NEW LOGIC: SEND TWILIO SMS ALERT
      if (req.body.type === 'SEND_ALERT_SMS') {
          if (!twilioClient) {
              return res.status(500).json({ success: false, error: 'Twilio client not initialized (check environment variables).' });
          }

          const { userEmail, alertMessage } = req.body;

          if (!userEmail || !alertMessage) {
              return res.status(400).json({ success: false, message: 'Missing userEmail or alertMessage.' });
          }
          
          // A. Fetch the recipient number from the database
          const recipientDoc = await AlertRecipientModel.findOne({ userEmail: userEmail });
          
          if (!recipientDoc || !recipientDoc.phoneNumber) {
              return res.status(404).json({ success: false, message: `Alert recipient not found for ${userEmail}.` });
          }

          const recipientNumber = recipientDoc.phoneNumber;
          
          // B. Send the SMS via Twilio
          const messageResponse = await twilioClient.messages.create({
              body: alertMessage,
              to: recipientNumber,
              from: TWILIO_PHONE_NUMBER,
          });

          return res.status(200).json({ 
              success: true, 
              message: 'SMS alert sent successfully.', 
              sid: messageResponse.sid 
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

        // 3. GET RECIPIENT PHONE NUMBER
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