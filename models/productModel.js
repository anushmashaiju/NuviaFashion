import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  sku: { type: String, trim: true },
  stock: { type: Number, default: 0 },
  image: { type: String, trim: true },
});

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
    color: { type: String, trim: true },
    size: { type: String, trim: true },
    sku: { type: String, trim: true },
    stock: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },
    images: [{ type: String, trim: true }],
    variants: [variantSchema],

    coupons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Coupon" }],
    reviews: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        userName: String,
        rating: Number,
        comment: String,
        date: { type: Date, default: Date.now },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    isListed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
