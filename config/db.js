import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Connect to MongoDB (the URL comes from your .env file)
   await mongoose.connect(process.env.MONGO_URI);

    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1); // Stop the app if connection fails
  }
};

export default connectDB;
