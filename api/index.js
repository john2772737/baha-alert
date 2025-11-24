import dbConnect from '../lib/dbConnect';
import Alert from '../models/Alert';

export default async function handler(req, res) {
  // 1. Connect to the database for all operations
  await dbConnect();

  // --- 💾 Handle POST Request (SAVE to DB) ---
  if (req.method === 'POST') {
    if (!req.body) {
      return res.status(400).json({ success: false, message: 'No data payload provided.' });
    }

    try {
      const newAlert = await Alert.create({
        payload: req.body,
      });

      return res.status(201).json({
        success: true,
        message: 'Data logged successfully.',
        documentId: newAlert._id,
      });

    } catch (error) {
      console.error('Database save failed:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal Server Error while logging data.',
        error: error.message
      });
    }

  // --- 🔍 Handle GET Request (FETCH ONLY THE LATEST) ---
  } else if (req.method === 'GET') {
    try {
      // Find the single document that matches the criteria:
      const latestAlert = await Alert.findOne({})
        // Sorts the documents by the 'createdAt' timestamp in descending order (-1)
        // This places the newest document at the top of the search result.
        .sort({ createdAt: -1 })
        // Executes the query.
        .exec();

      // Check if a document was actually found
      if (!latestAlert) {
        return res.status(404).json({ success: false, message: 'No data found.' });
      }

      // Return the single latest document
      return res.status(200).json({
        success: true,
        data: latestAlert
      });

    } catch (error) {
      console.error('Database fetch failed:', error);

      // Return a 500 status on database error
      return res.status(500).json({
        success: false,
        message: 'Internal Server Error while fetching data.',
        error: error.message
      });
    }

  // --- ❌ Handle Other Methods (e.g., PUT, DELETE) ---
  } else {
    // If the request method is not POST or GET, return 405 Method Not Allowed
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }
}