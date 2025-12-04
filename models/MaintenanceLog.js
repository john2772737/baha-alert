import mongoose from 'mongoose';

const MaintenanceLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
  },
  sensor: {
    type: String, 
    required: true,
  },
  command: {
    type: String, 
    required: true,
  },
  status: {
    type: String, 
    default: "PENDING" // Options: PENDING, FETCHED, COMPLETED
  },
  // ⭐ NEW FIELD: Stores the sensor reading
  value: {
    type: String, 
    default: null
  },
  deviceMode: {
    type: String,
    default: "MAINTENANCE"
  }
});

export default mongoose.models.MaintenanceLog || mongoose.model('MaintenanceLog', MaintenanceLogSchema);