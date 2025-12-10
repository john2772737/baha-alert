import mongoose from 'mongoose';

// 1. Get the connection string from Vercel's environment variables
const MONGODB_URI = process.env.MY_MONGO_URI || process.env.MY_MONGO_URI;


if (!MONGODB_URI) {
  // CRITICAL: Log this error if the environment variable is missing in Vercel
  console.error("CRITICAL ERROR: MONGODB_URI environment variable is not defined.");
  throw new Error('Please define the MONGODB_URI environment variable inside Vercel settings.');
}

// Use a global variable to cache the connection promise.
// In serverless environments, this prevents opening a new connection on every request.
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    // Return cached connection if already established
    return cached.conn; 
  }

  if (!cached.promise) {
    // Configuration options for Mongoose in a serverless environment
    const opts = {
      bufferCommands: false, // Disables buffering to prevent hanging connections
    };

    // Attempt to establish connection
    cached.promise = mongoose.connect(MONGODB_URI, opts)
      .then((mongoose) => {
        console.log("MongoDB connection established successfully.");
        return mongoose;
      })
      .catch((error) => {
        // Log the specific database error for diagnosis
        console.error("MONGODB CONNECTION FAILED:", error);
        cached.promise = null; // Clear promise so next invocation retries
        throw error; // Re-throw to signal function failure
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    throw e;
  }

  return cached.conn;
}

export default dbConnect;