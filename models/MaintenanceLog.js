// models/MaintenanceLog.js
import mongoose from 'mongoose';

const MaintenanceLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  sensor: {
    type: String, // e.g., "rain", "soil"
    required: true,
  },
  command: {
    type: String, // The Arduino Character: 'R', 'S', 'P', 'U'
    required: true,
  },
  status: {
    type: String, 
    default: "PENDING" // ESP32 will look for this status
  },
  deviceMode: {
    type: String,
    default: "MAINTENANCE"
  }
});

// Prevent recompilation error in Next.js
export default mongoose.models.MaintenanceLog || mongoose.model('MaintenanceLog', MaintenanceLogSchema);