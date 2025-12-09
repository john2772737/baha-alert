import mongoose from 'mongoose';

// PHT is UTC + 8 hours. 
// Calculate the offset in milliseconds: 8 hours * 60 min * 60 sec * 1000 ms
const PHT_OFFSET_MS = 28800000;

const AlertDataSchema = new mongoose.Schema({
  // 1. receivedAt: The time the API received the data (will be set by the hook)
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
// 💡 CORRECT SYNTAX: Use 'function (next)'
AlertDataSchema.pre('save', function(next) { 
    const now = Date.now();
    const PHT_OFFSET_MS = 28800000;
    const phtTimeMs = now + PHT_OFFSET_MS;
    const phtDate = new Date(phtTimeMs);
    
    // ... (Your time logic) ...
    if (!this.receivedAt) {
        this.receivedAt = phtDate;
    }
    if (this.isNew) {
        this.createdAt = phtDate;
    }
    this.updatedAt = phtDate;

    // Call next() to allow Mongoose to proceed with the save operation
    next(); 
});
// -----------------------------------------------------------
// -----------------------------------------------------------

// Reuse the model if it's already been compiled to avoid OverwriteModelError
// The model is named 'AlertData' based on your schema definition.
const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);

export default AlertData;