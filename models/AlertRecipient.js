import mongoose from 'mongoose';

// Define the schema
const AlertRecipientSchema = new mongoose.Schema({
  // 1. User Identifier (Primary Key)
  userEmail: {
    type: String,
    required: [true, 'User email is required to identify the recipient.'],
    unique: true, // Ensures only one alert number per email
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
  
  // 3. Timestamp
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Create the model and export it (using existing check to prevent redefinition)
const AlertRecipient = mongoose.models.AlertRecipient || mongoose.model('AlertRecipient', AlertRecipientSchema);

export default AlertRecipient;