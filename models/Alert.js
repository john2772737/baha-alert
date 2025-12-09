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
AlertDataSchema.pre('save', function(next) {
    const now = Date.now();
    
    // 💡 CRITICAL FIX: Calculate the time by adding the 8-hour offset to the current UTC time
    const phtTimeMs = now + PHT_OFFSET_MS;
    const phtDate = new Date(phtTimeMs);
    
    // 1. Manually set receivedAt (only if it wasn't already provided by the request body)
    if (!this.receivedAt) {
        this.receivedAt = phtDate;
    }
    
    // 2. Manually set createdAt (overwrites Mongoose default, only runs on new documents)
    // This ensures the recorded date is Wednesday, not Tuesday.
    if (this.isNew) {
        this.createdAt = phtDate;
    }

    // 3. Manually set updatedAt (overwrites Mongoose default, runs on new and updated documents)
    this.updatedAt = phtDate;

    next();
});
// -----------------------------------------------------------

// Reuse the model if it's already been compiled to avoid OverwriteModelError
// The model is named 'AlertData' based on your schema definition.
const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);

export default AlertData;