import mongoose from 'mongoose';

// Define the schema for the sensor data payload
const PayloadSchema = new mongoose.Schema({
    pressure: { type: Number, required: true },
    rain: { type: Number, required: true },
    waterLevel: { type: Number, required: true },
    soil: { type: Number, required: true },
    // Use Date type and default to the server's time for reliable sorting
    receivedAt: { type: Date, default: Date.now }, 
}, { _id: false }); // No need for an extra ID on the sub-document

// Define the main Alert schema
const AlertSchema = new mongoose.Schema({
    payload: {
        type: PayloadSchema,
        required: true,
    },
    // Mongoose adds 'createdAt' and 'updatedAt' automatically 
    // if 'timestamps: true' is used, which is good practice.
}, { timestamps: true });

// Check if the model already exists to prevent re-creation in Next.js hot reload
export default mongoose.models.Alert || mongoose.model('Alert', AlertSchema);