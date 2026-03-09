// db.js
const mongoose = require("mongoose");
require("dotenv").config(); // make sure dotenv is loaded here too

const primaryMongoUri = process.env.MONGODB_URI;
const fallbackMongoUri = process.env.MONGODB_LOCAL_URI || process.env.LOCAL_MONGODB_URI;
const resolvedMongoUri = primaryMongoUri || fallbackMongoUri;

function formatMongoError(err) {
  if (!err) {
    return "Unknown MongoDB error";
  }

  if (err.code === "ENOTFOUND") {
    return [
      `DNS lookup failed for MongoDB host: ${err.hostname || "unknown host"}.`,
      "Replace MONGODB_URI with a valid Atlas URI or set MONGODB_LOCAL_URI=mongodb://127.0.0.1:27017/feelwise_db."
    ].join(" ");
  }

  return err.message || String(err);
}

const connectDB = async () => {
  if (!resolvedMongoUri) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI or MONGODB_LOCAL_URI.");
  }

  try {
    const conn = await mongoose.connect(resolvedMongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ MongoDB connection error:", formatMongoError(err));
    process.exit(1); // exit process with failure
  }
};

module.exports = connectDB;
