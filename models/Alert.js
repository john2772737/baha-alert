import mongoose from 'mongoose';
const PHT_OFFSET_MS = 28800000;

const AlertDataSchema = new mongoose.Schema({
  // 1. We remove 'receivedAt' here and rely on 'createdAt'
  // for the time the server received the data (now corrected to PHT).
  
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
}, {
  timestamps: true, // This automatically creates and maintains createdAt and updatedAt
});

AlertDataSchema.pre('save', function(next) {
    const now = Date.now();
    const phtTimeMs = now + PHT_OFFSET_MS;
    const phtDate = new Date(phtTimeMs);
    
    // Mongoose handles 'isNew' checks internally for timestamps: true.
    // We overwrite the internal value calculated by Mongoose for BOTH
    // createdAt and updatedAt with the PHT-corrected time.
    
    // Only set createdAt on new documents
    if (this.isNew) {
        this.createdAt = phtDate;
    }
    
    // Set updatedAt on all saves
    this.updatedAt = phtDate;

    next();
});

const AlertData = mongoose.models.AlertData || mongoose.model('AlertData', AlertDataSchema);
export default AlertData;