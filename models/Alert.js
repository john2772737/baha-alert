import mongoose from 'mongoose';

// PHT is UTC + 8 hours. 
// Calculate the offset in milliseconds: 8 hours * 60 min * 60 sec * 1000 ms
const PHT_OFFSET_MS = 28800000;

// --- 1. SCHEMA DECLARATION ---
const AlertDataSchema = new mongoose.Schema({
  // 'receivedAt' is now handled by the hook
  receivedAt: {
    type: Date,
  },
  
  // 'payload' holds the JSON object sent directly from the ESP32.
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  // Option to add standard Mongoose timestamps (createdAt and updatedAt)
  timestamps: true,
});

// --- 2. ATTACH THE PRE-SAVE HOOK ---
// This must be done immediately after the schema is defined and BEFORE the model is compiled.
AlertDataSchema.pre('save', function(next) {
    // 💡 IMPORTANT: Use a standard function declaration (function(next)) 
    // to correctly bind 'this' (the document) and receive 'next'.
    
    const now = Date.now();
    
    // Calculate the time by adding the 8-hour PHT offset
    const phtTimeMs = now + PHT_OFFSET_MS;
    const phtDate = new Date(phtTimeMs);
    
    // 1. Manually set receivedAt (only if it wasn't already provided by the request body)
    if (!this.receivedAt) {
        this.receivedAt = phtDate;
    }
    
    // 2. Manually set createdAt (only runs on new documents)
    if (this.isNew) {
        this.createdAt = phtDate;
    }

    // 3. Manually set updatedAt (runs on new and updated documents)
    this.updatedAt = phtDate;

    // Call next() to allow Mongoose to proceed with the save operation
    next(); 
});
// -----------------------------------------------------------

// --- 3. MODEL COMPILATION ---
// Reuse the model if it's already been compiled to avoid OverwriteModelError
const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);

export default AlertData;