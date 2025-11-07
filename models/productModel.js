import mongoose from "mongoose";

// Sub-schema for product variants
const variantSchema = new mongoose.Schema({
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  sku: { type: String, trim: true },
  stock: { type: Number, default: 0 },
  image: { type: String, trim: true },
});

// Product schema
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category", 
      required: true,
    },
    brand: { type: String, trim: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    finalPrice: { type: Number },
    description: { type: String, trim: true },
    images: [{ type: String, trim: true }],
    variants: [variantSchema],
    coupons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Coupon" }],
   reviews: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // fixed
        userName: String,
        rating: Number,
        comment: String,
        date: { type: Date, default: Date.now },
      },
    ],
    // flags
    isDeleted: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    isListed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
