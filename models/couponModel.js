import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
  couponName: { type: String, required: true },

  type: {
    type: String,
    enum: [
      "MIN_PURCHASE",   // always available above amount
      "ONE_TIME",       // user one-time
      "FIRST_ORDER",    // first-time user
      "FESTIVAL"        // seasonal
    ],
    required: true
  },

discountType: {
  type: String,
  enum: ["FLAT", "PERCENT"],
  default: "FLAT"
},

offerPrice: {
  type: Number,
  required: true
},

minimumPrice: {
  type: Number,
  required: true
},

  maxDiscount: Number,      // optional for percent coupons

  expireOn: { type: Date, required: true},
  isList: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true },

  usedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],

  createdAt: { type: Date, default: Date.now }
});


const Coupon = mongoose.model("Coupon", couponSchema);
export default Coupon;
