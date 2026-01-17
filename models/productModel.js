import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  color: { type: String, trim: true },
  size: { type: String, trim: true },
  sku: { type: String, trim: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  finalPrice: { type: Number },
  image: { type: String, trim: true },
});

const productOfferSchema = new mongoose.Schema({
  percentage: { type: Number, min: 0, max: 100, default: 0 },
  startDate: { type: Date },
  endDate: { type: Date },
  isActive: { type: Boolean, default: false },
});

const activeOfferSchema = new mongoose.Schema({
  type: { type: String, enum: ["product", "category", null], default: null },
  percentage: { type: Number, default: 0 },
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
    finalPrice: { type: Number },
    deliveryCharge: { type: Number, default: 0 },
    description: { type: String, trim: true },
    color: { type: String, trim: true },
    size: { type: String, trim: true },
    sku: { type: String, trim: true },
    stock: { type: Number, default: 0 },
    totalStock: { type: Number, default: 0 },
    images: [{ type: String, trim: true }],
    variants: [variantSchema],
    productOffer: productOfferSchema,
    activeOffer: activeOfferSchema,
    coupons: [{ type: mongoose.Schema.Types.ObjectId, ref: "Coupon" }],

    isDeleted: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Product", productSchema);
