import mongoose from "mongoose";

const orderedItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant", default: null },
    quantity: { type: Number, required: true },
    sku: { type: String, required: true },
    productName: { type: String, required: true },
    color: { type: String, default: null },
    size: { type: String, default: null },
    basePrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    finalPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    image: { type: String, required: true },
    rating: { type: Number, default: null },
    isReturned: { type: Boolean, default: false },
    returnReason: { type: String, default: null },
  },
  { _id: false } 
);

const orderSchema = new mongoose.Schema(
  {
    orderID: { type: String, unique: true, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "TransactionHistory", default: null },
    couponApplied: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    shippingAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: true },

    items: [orderedItemSchema],

    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    couponDiscount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },

    orderStatus: {
      type: String,
      enum: [
        "Pending",
        "Order Placed",
        "Processing",
        "Shipped",
        "Reached Nearest Hub",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Returned",
      ],
      default: "Order Placed",
    },

    statusTimeline: {
      orderPlaced: { type: Date },
      processing: { type: Date },
      shipped: { type: Date },
      reachedHub: { type: Date },
      outForDelivery: { type: Date },
      delivered: { type: Date },
      returned: { type: Date }, // new: tracks full order return
    },

    paymentMethod: { type: String, enum: ["COD", "Razorpay", "Wallet"], required: true },
    paymentStatus: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    cancelReason: { type: String, default: null },
    returnReason: { type: String, default: null },
    orderDate: { type: Date, default: Date.now },
    deliveryDate: { type: Date, default: null },
  },
  { timestamps: true }
);


const Order = mongoose.model("Order", orderSchema);
export default Order;
