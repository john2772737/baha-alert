// lib/dbConnect.js (Example using Mongoose)
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

// Use a global variable to cache the connection promise
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn; // Return cached connection
  }
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;