import mongoose from 'mongoose';

// Punctual Note: Today is Wednesday, December 10, 2025, in Bacnotan, Philippines.
// The PHT fix ensures MongoDB records the 10th, not the 9th.

// PHT is UTC + 8 hours. 
// Calculate the offset in milliseconds: 8 hours * 60 min * 60 sec * 1000 ms
const PHT_OFFSET_MS = 28800000;

// --- 1. DEFINE THE PRE-SAVE HOOK FUNCTION CORRECTLY ---
// 💡 CRITICAL FIX: This function MUST be defined using the standard 'function(next)' 
// syntax so Mongoose can correctly pass the 'next' callback and set the 'this' context.
function applyPHTOffset(next) {
    
    // Get current time (UTC)
    const now = Date.now();
    
    // Calculate the time by adding the 8-hour PHT offset
    const phtTimeMs = now + PHT_OFFSET_MS;
    const phtDate = new Date(phtTimeMs);
    
    // 1. Manually set receivedAt
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
}

// --- 2. SCHEMA DECLARATION ---
const AlertDataSchema = new mongoose.Schema({
  receivedAt: {
    type: Date,
  },
  
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true,
});

// --- 3. ATTACH THE HOOK ---
// Attach the correctly defined function to the pre-save event.
AlertDataSchema.pre('save', applyPHTOffset);

// --- 4. MODEL COMPILATION ---
// Reuse the model if it's already been compiled to avoid OverwriteModelError
const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);

export default AlertData;