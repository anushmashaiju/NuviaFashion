import crypto from "crypto";
import Wallet from "../../models/walletModel.js";
import Product from "../../models/productModel.js";
import Cart from "../../models/cartModel.js";
import Order from "../../models/orderModel.js";
import { razorpayInstance } from "../../config/razorpay.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

// CREATE RAZORPAY ORDER
export const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res
        .status(STATUS.UNAUTHORIZED)
        .json({ success: false, message: MESSAGES.LOGIN_REQUIRED });
    }

    const { selectedAddress: addressId, useWallet } = req.body;

   const summary = req.session.orderSummary;
if (!summary) {
  return res.status(400).json({ success: false, message: "Invalid order" });
}

// ✅ FORCE delivery charge into session
summary.deliveryCharge = Number(req.body.deliveryCharge) || 0;

// ✅ REBUILD final amount FROM SCRATCH
let finalAmount =
  Number(summary.subtotal) +
  Number(summary.tax) +
  Number(summary.deliveryCharge) -
  Number(summary.couponDiscount || 0);

// Safety check
if (finalAmount <= 0) finalAmount = 1;

// WALLET DEDUCTION
let walletUsed = 0;
if (req.body.useWallet) {
  const wallet = await Wallet.findOne({ userId });
  walletUsed = Math.min(wallet?.balance || 0, finalAmount);
  finalAmount -= walletUsed;

  await Wallet.updateOne(
    { userId },
    { $inc: { balance: -walletUsed } }
  );
}

// ✅ UPDATE SESSION (MOST IMPORTANT)
summary.walletUsed = walletUsed;
summary.finalAmount = finalAmount;

req.session.orderSummary = summary;
await req.session.save();


    /* -------------------------------------------------
       ✅ RAZORPAY ORDER
    -------------------------------------------------- */

const amountInPaise = Math.round(finalAmount * 100);

const razorpayOrder = await razorpayInstance.orders.create({
  amount: amountInPaise,
  currency: "INR",
  receipt: "rcpt_" + Date.now(),
  notes: {
    userId,
    addressId,
    deliveryCharge: summary.deliveryCharge
  }
});


    return res.status(STATUS.CREATED).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order: razorpayOrder
    });

  } catch (err) {
    console.error("Create Razorpay Order Error:", err);
    return res
      .status(STATUS.SERVER_ERROR)
      .json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};


// VERIFY PAYMENT
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ success: false, redirect: "/payment/failed" });

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const userId = req.session.user?.id;
    const summary = req.session.orderSummary || {};

    // ------------------------------
    // ❗ FAILED PAYMENT → SAVE ORDER
    // ------------------------------
    if (expectedSignature !== razorpay_signature) {

      let items = [];

      if (req.session.buyNow) {
        const b = req.session.buyNow;
        items.push({
          productId: b.productId,
          variantId: b.variantId || null,
          quantity: b.quantity,
          sku: b.sku,
          productName: b.productName,
          color: b.color || null,
          size: b.size || null,
          basePrice: b.basePrice,
          discount: b.discount || 0,
          finalPrice: b.price,
          subtotal: b.price * b.quantity,
          image: b.image
        });
      }

      await Order.create({
        orderID: "ORD-" + Date.now(),
        user_id: userId,
        shippingAddressId: summary.addressId || null,

        items: items,

        subtotal: summary.subtotal || 0,
        tax: summary.tax || 0,
        couponApplied: summary.couponId || null,
        couponName: summary.couponName || null,
        couponDiscount: summary.couponDiscount || 0,
        walletUsed: summary.walletUsed || 0,
        deliveryCharge: summary.deliveryCharge || 0,
        totalPrice: summary.finalAmount || 0,

        paymentMethod: "Razorpay",
        paymentStatus: "failed",
        orderStatus: "Failed",

        statusTimeline: {
          orderPlaced: new Date()
        }
      });

      req.session.buyNow = null;
      await req.session.save();

      return res.status(400).json({
        success: false,
        redirect: "/payment/failed"
      });
    }

    // ------------------------------
    // ✔ SUCCESS PAYMENT → CREATE ORDER
    // ------------------------------
    const razorpayOrder = await razorpayInstance.orders.fetch(razorpay_order_id);
    const addressId = razorpayOrder.notes.addressId;

    if (!userId) {
      return res.status(401).json({ success: false, redirect: "/payment/failed" });
    }

    const order = await createOrderAfterPayment(req, userId, addressId);

    return res.status(200).json({
      success: true,
      redirect: `/order-success/${order.orderID}`
    });

  } catch (err) {
    console.error("Payment Verification Error:", err);

    req.session.buyNow = null;
    await req.session.save();

    return res.status(500).json({
      success: false,
      redirect: "/payment/failed"
    });
  }
};

// CREATE ORDER AFTER PAYMENT
const createOrderAfterPayment = async (req, userId, addressId) => {
  const summary = req.session.orderSummary;
  if (!summary) throw new Error("Order summary missing");

  let items = [];

  // ---------------- BUY NOW ----------------
  if (req.session.buyNow) {
    const b = req.session.buyNow;
    const product = await Product.findById(b.productId);

    items.push({
      productId: product._id,
      productName: product.name,
      quantity: b.quantity,
      basePrice: b.basePrice,
      finalPrice: b.price,
      subtotal: b.price * b.quantity,
      discount: b.discount || 0,
      sku: b.sku,
      image: b.image,
      color: b.color,
      size: b.size,
      isVariant: b.isVariant
    });

    await Product.findByIdAndUpdate(b.productId, { $inc: { stock: -b.quantity } });

    delete req.session.buyNow;
    await req.session.save();
  }

  // ---------------- CART ----------------
  else {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) throw new Error("Cart not found");

    items = cart.items.map(i => {
      const p = i.productId;
      const discountPercentage = p.activeOffer?.percentage || 0;
      const finalPrice = Number((p.price - (p.price * discountPercentage) / 100).toFixed(2));
      const subtotal = Number((finalPrice * i.quantity).toFixed(2));

      return {
        productId: p._id,
        productName: p.name,
        quantity: i.quantity,
        basePrice: p.price,
        finalPrice,
        subtotal,
        discount: Number(((p.price * discountPercentage) / 100).toFixed(2)),
        sku: p.sku,
        image: p.images?.[0] || "",
        color: p.color,
        size: p.size,
        isVariant: false
      };
    });

    for (let i of cart.items)
      await Product.findByIdAndUpdate(i.productId._id, {
        $inc: { stock: -i.quantity }
      });

    await Cart.updateOne({ userId }, { items: [] });
  }

  // ---------------- CREATE ORDER ----------------
  const order = new Order({
    orderID: "ORD" + Date.now(),
    user_id: userId,
    shippingAddressId: addressId,

    items,

    subtotal: summary.subtotal,
    tax: summary.tax,
    deliveryCharge: summary.deliveryCharge || 0,

    couponApplied: summary.couponId || null,
    couponName: summary.couponName || null,
    couponDiscount: summary.couponDiscount || 0,

    walletUsed: summary.walletUsed || 0,

    totalPrice: summary.finalAmount,

    paymentMethod: "Razorpay",
    paymentStatus: "success",

    statusTimeline: { orderPlaced: new Date() }
  });

  await order.save();
  return order;
};
