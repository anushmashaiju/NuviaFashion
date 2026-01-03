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
    isReturned: { type: Boolean, default: false },
    returnReason: { type: String, default: null },
    isCancelled: { type: Boolean, default: false },
    cancelReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },

  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderID: { type: String, unique: true, required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "TransactionHistory", default: null },
    couponApplied: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    shippingAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address", required: false },
    items: [orderedItemSchema],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    couponName: { type: String, default: null },
    couponDiscount: { type: Number, default: 0 },
    couponOfferPrice: { type: Number,default: 0},

  couponMinimumPrice: {type: Number, default: 0},
    deliveryCharge: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    walletUsed: { type: Number, default: 0 },
   orderStatus: {
  type: String,
  enum: [
    "Payment Pending",
    "Order Placed",
    "Processing",
    "Shipped",
    "Out for Delivery",
    "Delivered",
    "Cancelled",
    "Return Requested",
    "Return Approved",
    "Returned",
    "Return Rejected",
    "Failed",
    "Confirmed"
  ],
  default: "Payment Pending"
},

    statusTimeline: {
      orderPlaced: { type: Date },
      processing: { type: Date },
      shipped: { type: Date },
      reachedHub: { type: Date },
      outForDelivery: { type: Date },
      delivered: { type: Date },
      returned: { type: Date },
      failed:{ type: Date }
    },

    paymentMethod: { type: String, enum: ["COD", "Razorpay", "Wallet"], required: true },
    paymentStatus: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    razorpayOrderId: { type: String, default: null },
razorpayPaymentId: { type: String, default: null },

    isCancelled: { type: Boolean, default: false },
    cancelReason: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
failedAt: { type: Date, default: null },
restocked: {type: Boolean,default: null},
    returnReason: { type: String, default: null },
    returnRequestedAt: { type: Date, default: null },
    returnApprovedAt: { type: Date, default: null },
    refundProcessed: { type: Boolean, default: false },
    returnType: { type: String, enum: ["REFUND", "REPLACEMENT"], default: null },
    orderDate: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null }
  },

  { timestamps: true }
);

orderSchema.index(
  { failedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 2 } 
);


const Order = mongoose.model("Order", orderSchema);
export default Order;
