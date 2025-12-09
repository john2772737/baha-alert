import mongoose from 'mongoose';

// PHT is UTC + 8 hours. 
// 8 hours * 60 min * 60 sec * 1000 ms = 28,800,000 milliseconds
const PHT_OFFSET_MS = 28800000;

// Define the schema
const AlertRecipientSchema = new mongoose.Schema({
  // 1. User Identifier (Primary Key)
  userEmail: {
    type: String,
    required: [true, 'User email is required to identify the recipient.'],
    unique: true,
    trim: true,
    lowercase: true,
  },

  // 2. Alert Phone Number
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required for alerts.'],
    validate: {
      validator: function(v) {
        // Simple E.164 format check (e.g., +639171234567)
        return /\+[1-9]\d{1,14}/.test(v); 
      },
      message: props => `${props.value} is not a valid E.164 phone number format (+CountryCodeNumber).`
    },
  },
  
  // 3. Timestamp (Note: Using default Date.now but will be modified by the pre-save hook)
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  
  // NOTE: If you also want a 'createdAt' field, use the Mongoose built-in timestamps:
  // timestamps: { createdAt: 'createdAt', updatedAt: false },
});

// --- PRE-SAVE HOOK TO APPLY PHT OFFSET ---
AlertRecipientSchema.pre('save', function(next) {
    // Check if the document is new OR if the updatedAt field has been modified
    if (this.isNew || this.isModified('updatedAt')) {
        // Calculate the current UTC time (Date.now()) and add the PHT offset
        const phtTimeMs = Date.now() + PHT_OFFSET_MS;
        
        // Set the updatedAt field to the new, PHT-adjusted time
        this.updatedAt = new Date(phtTimeMs);
    }
    next();
});
// ----------------------------------------


// Create the model and export it (using existing check to prevent redefinition)
const AlertRecipient = mongoose.models.AlertRecipient || mongoose.model('AlertRecipient', AlertRecipientSchema);

export default AlertRecipient;