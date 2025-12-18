import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    categoryName: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true, default: "" },
    thumbnail: { type: String, required: true },
    isListed: { type: Boolean, default: true },
    categoryOffer: {
      percentage: { type: Number, min: 0, max: 100, default: 0 },
      startDate: { type: Date },
      endDate: { type: Date },
      isActive: { type: Boolean, default: false }
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "lastUpdated" } }
);

export default mongoose.model("Category", categorySchema);