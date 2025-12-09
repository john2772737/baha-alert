import mongoose from 'mongoose';

const AlertDataSchema = new mongoose.Schema({
  // Automatically store the time the API received the data
  receivedAt: {
    type: Date,
    default: Date.now,
  },
  // 'payload' holds the JSON object sent directly from the ESP32.
  // Using Mixed allows it to store different structures (sensor data, config, etc.).
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  // Option to add standard Mongoose timestamps
  timestamps: true,
});

// Reuse the model if it's already been compiled to avoid OverwriteModelError
const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);

export default AlertData;