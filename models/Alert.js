import mongoose from 'mongoose';

// PHT is UTC + 8 hours. 
// Calculate the offset in milliseconds: 8 hours * 60 min * 60 sec * 1000 ms
const PHT_OFFSET_MS = 28800000;

const AlertDataSchema = new mongoose.Schema({
  // 1. receivedAt: The time the API received the data
  receivedAt: {
    type: Date,
  },
  
  // 2. payload: JSON object from the ESP32
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  // Option to add standard Mongoose timestamps (createdAt and updatedAt)
  timestamps: true,
});

// --- PRE-SAVE HOOK TO APPLY PHT OFFSET TO ALL TIMESTAMPS ---
AlertDataSchema.pre('save', function(next) {
    const now = Date.now();
    
    // Calculate the time by adding the 8-hour offset
    const phtTimeMs = now + PHT_OFFSET_MS;
    
    // 1. Manually set receivedAt (only if it wasn't already provided by the request body)
    if (!this.receivedAt) {
        this.receivedAt = new Date(phtTimeMs);
    }
    
    // 2. Manually set createdAt (only runs on new documents)
    // Overwrite the timestamp field created by Mongoose
    if (this.isNew) {
        this.createdAt = new Date(phtTimeMs);
    }

    // 3. Manually set updatedAt (runs on new and updated documents)
    // Overwrite the timestamp field created by Mongoose
    this.updatedAt = new Date(phtTimeMs);

    next();
});
// -----------------------------------------------------------

// Reuse the model if it's already been compiled
const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);

export default AlertData;