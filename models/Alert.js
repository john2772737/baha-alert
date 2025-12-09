import mongoose from 'mongoose';

// PHT is UTC + 8 hours. 
// 8 hours * 60 min * 60 sec * 1000 ms = 28,800,000 milliseconds
const PHT_OFFSET_MS = 28800000;

// Define the schema
const AlertDataSchema = new mongoose.Schema({
  // 1. receivedAt: The time the API received the data
  // We remove the default Date.now here because the pre-save hook will handle it.
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
    const phtTimeMs = now + PHT_OFFSET_MS;
    
    // 1. Handle receivedAt field (if it doesn't already exist/is not set)
    // We only set receivedAt if it's new/not manually provided in the request
    if (!this.receivedAt) {
        this.receivedAt = new Date(phtTimeMs);
    }
    
    // 2. Handle Mongoose timestamps (createdAt and updatedAt)
    // The timestamps: true option usually runs its own logic,
    // but we can manually overwrite the internal values here to ensure PHT offset is used.
    
    // Manually set createdAt (only runs on new documents)
    if (this.isNew) {
        this.createdAt = new Date(phtTimeMs);
    }

    // Manually set updatedAt (runs on new and updated documents)
    this.updatedAt = new Date(phtTimeMs);

    next();
});
// -----------------------------------------------------------

// Reuse the model if it's already been compiled
const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);

export default AlertData;