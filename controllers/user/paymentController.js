import crypto from "crypto";
import Wallet from "../../models/walletModel.js";
import Product from "../../models/productModel.js";
import Cart from "../../models/cartModel.js";
import Order from "../../models/orderModel.js";
import { razorpayInstance } from "../../config/razorpay.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";
import Coupon from "../../models/couponModel.js";
import Address from "../../models/addressModel.js";
import { calculateDeliveryCharge } from "../../utils/charges.js";

const buildCouponSnapshot = (summary) => {
  if (!summary || !summary.appliedCouponId) return {};

  return {
    couponApplied: summary.appliedCouponId, 
    couponName: summary.couponName || null,
    couponDiscount: Number(summary.couponDiscount || 0),
    couponOfferPrice: Number(summary.couponOfferPrice || 0),
    couponMinimumPrice: Number(summary.couponMinimumPrice || 0)
  };
};


const clearCartAfterOrder = async (userId, isBuyNow) => {
  if (isBuyNow) return;

await Cart.updateOne(
  { userId },
  { $unset: { items: "" } }
);

};

// PAYMENT GATEWAY PAGE
 const getPaymentPage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) return res.redirect("/login");
    const items = req.session.orderItems;
    const summary = req.session.orderSummary;

    if (!items || !summary) {
      req.flash("error", "Checkout session expired");
      return res.redirect("/checkout");
    }

    const walletDoc = await Wallet.findOne({ userId });
    const walletBalance = walletDoc ? walletDoc.balance : 0;

    return res.render("user/paymentGateway", {
      activePage: "Checkout",
      summary,
      items,
      user: {
        ...req.session.user,
        wallet: walletBalance
      }
    });

  } catch (err) {
    console.error("Render Payment Page Error:", err);
    req.flash("error", "Unable to proceed to payment");
    return res.redirect("/checkout");
  }
};


//PLACE ORDER
 const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.session.user?.id;
    if (!userId)
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.USER_NOT_LOGGED_IN
      });

    const { selectedAddress, paymentMethod, useWallet } = req.body;
    if (!selectedAddress || !paymentMethod)
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ADDRESS_REQUIRED
      });

    const summary = req.session.orderSummary;
    if (!summary)
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.INVALID_INPUT
      });

    const address = await Address.findById(selectedAddress);
    if (!address)
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ADDRESS_NOT_FOUND
      });

    let items = [];
    if (req.session.buyNow) {
      const b = req.session.buyNow;
      items.push({
        productId: b.productId,
        quantity: b.quantity || 1,
        basePrice: b.basePrice,
        discount: b.discount || 0,
        finalPrice: b.price,
        subtotal: parseFloat((b.price * (b.quantity || 1)).toFixed(2)),
        sku: b.sku,
        productName: b.name,
        color: b.color,
        size: b.size,
        image: b.image || "",
        deliveryCharge: 0
      });
    } else {
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0)
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.CART_EMPTY
        });

      items = cart.items.map(i => {
        const p = i.productId;
        const basePrice = i.variantId
          ? p.variants.id(i.variantId)?.price
          : p.price;
        const finalPrice = i.price;
        const discountAmount = basePrice - finalPrice;

        return {
          productId: p._id,
          variantId: i.variantId || null,
          quantity: i.quantity,
          basePrice,
          discount: parseFloat(discountAmount.toFixed(2)),
          finalPrice,
          subtotal: parseFloat((finalPrice * i.quantity).toFixed(2)),
          sku: p.sku || `SKU-${p._id.toString().slice(-6)}`,
          productName: p.name,
          color: null,
          size: null,
          image: p.images?.[0] || "",
          deliveryCharge: p.deliveryCharge || 0
        };
      });
    }

    const subtotal = parseFloat(summary.subtotal.toFixed(2));
    const tax = parseFloat(summary.tax.toFixed(2));
    const couponDiscount = parseFloat(summary.couponDiscount || 0);
    const products = items.map(i => ({ deliveryCharge: i.deliveryCharge || 0 }));
const deliveryCharge = Number(summary.deliveryCharge || 0);

    let totalAmount = subtotal + tax - couponDiscount + deliveryCharge;
summary.finalAmount = parseFloat(totalAmount.toFixed(2));
req.session.orderSummary = summary;
await req.session.save();

    if (paymentMethod === "COD" && totalAmount > 1000) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "COD not allowed for orders above ₹1000"
      });
    }

    let walletUsed = 0;
    if (useWallet) {
      const walletDoc = await Wallet.findOne({ userId });
      const walletBalance = walletDoc ? walletDoc.balance : 0;

      if (walletBalance > 0) {
        walletUsed = Math.min(walletBalance, totalAmount);
        totalAmount -= walletUsed;
      }
    }

    const orderID = "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    if (paymentMethod === "Razorpay") {
      req.session.orderItems = items;
      await req.session.save();

      return res.status(STATUS.OK).json({
        success: true,
        message: "Proceed to payment"
      });
    }

const newOrder = new Order({
  user_id: userId,
  shippingAddressId: selectedAddress,
  items,
  subtotal: round2(summary.subtotal),
  tax: round2(summary.tax),
  deliveryCharge: round2(summary.deliveryCharge),
  ...buildCouponSnapshot(summary), 
  walletUsed: round2(walletUsed),
  totalPrice: round2(summary.finalAmount),
  orderID,
  paymentMethod,
  orderStatus:
    paymentMethod === "COD" || useWallet ? "Processing" : "Order Placed",
  paymentStatus:
    paymentMethod === "COD" || useWallet ? "success" : "pending",
  statusTimeline: { orderPlaced: new Date() }
});

    await newOrder.save();

    if (useWallet && walletUsed > 0) {
      await Wallet.updateOne(
        { userId },
        {
          $inc: { balance: -walletUsed },
          $push: {
            transactions: {
              type: "DEBIT",
              amount: walletUsed,
              description: "Used for order payment"
            }
          }
        }
      );
    }

    if (summary.appliedCouponId) {
      await Coupon.findByIdAndUpdate(summary.appliedCouponId, {
        $addToSet: { usedBy: userId }
      });
    }

for (let i of items) {
  if (i.variantId) {
    await Product.updateOne(
      { _id: i.productId, "variants._id": i.variantId },
      { $inc: { "variants.$.stock": -i.quantity } }
    );
  } else {
    await Product.updateOne(
      { _id: i.productId },
      { $inc: { stock: -i.quantity } }
    );
  }
}
await clearCartAfterOrder(userId, req.session.buyNow);

req.session.buyNow = null;
req.session.orderSummary = null;
await req.session.save();

return res.status(STATUS.CREATED).json({
  success: true,
  orderId: orderID
});

  } catch (err) {
    console.error("Place Order Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: err.message
    });
  }
};

//PLACE COD ORDER
 const placeCODOrder = placeOrder;



const createRazorpayOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id || req.session.user?._id;
    if (!userId)
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.LOGIN_REQUIRED
      });

    const addressId = req.body.selectedAddress;

    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ADDRESS_NOT_FOUND
      });
    }

    const sessionItems = req.session.orderItems;
    const summary = req.session.orderSummary;

    if (!sessionItems || !summary) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.CHECKOUT_SESSION_EXPIRED
      });
    }
    const items = sessionItems.map((item, index) => {
      if (!item.productName) {
        throw new Error(
          `Invalid checkout data: productName missing at item index ${index}`
        );
      }

      return {
        productId: item.productId,
        variantId: item.variantId || null,
        quantity: item.quantity,
        basePrice: Number(item.basePrice),
        discount: Number(item.discount || 0),
        finalPrice: Number(item.finalPrice),
        subtotal: Number(item.subtotal),
        sku: item.sku,
        productName: item.productName, 
        color: item.color || null,
        size: item.size || null,
        image: item.image || "",
        deliveryCharge: Number(item.deliveryCharge || 0)
      };
    });
    let finalAmount =
      Number(summary.subtotal) +
      Number(summary.tax) +
      Number(summary.deliveryCharge || 0) -
      Number(summary.couponDiscount || 0);

    if (finalAmount <= 0) finalAmount = 1;

    const razorpayOrder = await razorpayInstance.orders.create({
      amount: Math.round(finalAmount * 100),
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
      notes: { userId, addressId }
    });

    const orderID = "ORD-" + Date.now();

    await Order.create({
      orderID,
      user_id: userId,
      razorpayOrderId: razorpayOrder.id,
      shippingAddressId: addressId,
      items, 
      subtotal: Number(summary.subtotal),
      tax: Number(summary.tax),
      ...buildCouponSnapshot(summary),
      deliveryCharge: Number(summary.deliveryCharge || 0),
      totalPrice: Number(finalAmount),
      paymentMethod: "Razorpay",
      paymentStatus: "pending",
      orderStatus: "Payment Pending"
    });

    return res.status(STATUS.CREATED).json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      order: razorpayOrder
    });

  } catch (err) {
    console.error("Create Razorpay Order Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: err.message || MESSAGES.SERVER_ERROR
    });
  }
};

//REDUCE STOCK
const reduceStockAfterPayment = async (req, userId) => {
  const items = req.session.orderItems;

  if (!items || items.length === 0) {
    throw new Error("Order items missing for stock reduction");
  }

  for (let i of items) {
    if (i.variantId) {
      await Product.updateOne(
        { _id: i.productId, "variants._id": i.variantId },
        { $inc: { "variants.$.stock": -i.quantity } }
      );
    } else {
      await Product.updateOne(
        { _id: i.productId },
        { $inc: { stock: -i.quantity } }
      );
    }
  }

  if (!req.session.buyNow) {
    await Cart.updateOne({ userId }, { $set: { items: [] } });
  }

  delete req.session.orderItems;
};

/// VERIFY PAYMENT
 const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
  await Order.findOneAndUpdate(
    { razorpayOrderId: razorpay_order_id },
    {
      paymentStatus: "failed",
      orderStatus: "Failed",
      failedAt: new Date()
    }
  );

  return res.status(STATUS.BAD_REQUEST).json({
    success: false,
    redirect: `/payment/failed/${razorpay_order_id || ""}`
  });
}
    const userId = req.session.user?.id || req.session.paymentUserId;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        redirect: "/login"
      });
    }
    const summary = req.session.orderSummary;
    if (!summary) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        redirect: "/cart"
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {

  await Order.findOneAndUpdate(
  { razorpayOrderId: razorpay_order_id },
  {
    paymentStatus: "failed",
    orderStatus: "Failed",
    razorpayPaymentId: razorpay_payment_id || null,
    failedAt: new Date(), 
    statusTimeline: {
      failed: new Date()
    }
  }
);
      if (summary.walletUsed > 0) {
        await Wallet.updateOne(
          { userId },
          {
            $inc: { balance: summary.walletUsed },
            $push: {
              transactions: {
                type: "CREDIT",
                amount: summary.walletUsed,
                description: "Wallet refund – payment failed"
              }
            }
          }
        );
      }
      req.session.buyNow = null;
      req.session.orderSummary = null;
      req.session.paymentUserId = null;
      await req.session.save();

      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        redirect: `/payment/failed/${razorpay_order_id}`
      });
    }

    const razorpayOrder = await razorpayInstance.orders.fetch(
      razorpay_order_id
    );

    const addressId = razorpayOrder.notes.addressId;

 const order = await Order.findOneAndUpdate(
  { razorpayOrderId: razorpay_order_id },
  {
    paymentStatus: "success",
    orderStatus: "Order Placed",
    razorpayPaymentId: razorpay_payment_id,
    statusTimeline: { orderPlaced: new Date() }
  },
  { new: true } 
);

    if (summary.appliedCouponId) {
      await Coupon.findByIdAndUpdate(summary.appliedCouponId, {
        $addToSet: { usedBy: userId }
      });
    }
    await reduceStockAfterPayment(req, userId);

req.session.buyNow = null;
req.session.orderSummary = null;
req.session.paymentUserId = null;
await req.session.save();

return res.status(STATUS.SUCCESS).json({
  success: true,
  redirect: `/order-success/${order.orderID}`
});

  } catch (err) {
    console.error("Verify Payment Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

const round2 = (value) => Number((value || 0).toFixed(2));

// WALLET PAYMENT
 const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user?._id;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.LOGIN_REQUIRED
      });
    }

    const { selectedAddress } = req.body;

    const summary = req.session.orderSummary;
    if (!summary) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.INVALID_INPUT
      });

    }
    summary.deliveryCharge = round2(summary.deliveryCharge || 0);

    let finalAmount =
      round2(summary.subtotal) +
      round2(summary.tax) +
      summary.deliveryCharge -
      round2(summary.couponDiscount || 0);

    if (finalAmount <= 0) finalAmount = 1;

    summary.finalAmount = finalAmount;
    req.session.orderSummary = summary;
    await req.session.save();

    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < finalAmount) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message:  MESSAGES.INSUFFICIENT_WALLET_BALANCE
      });
    }

    wallet.balance = round2(wallet.balance - finalAmount);
    wallet.transactions.push({
      type: "DEBIT",
      amount: round2(finalAmount),
      description: "Order payment via Wallet"
    });
    await wallet.save();


    const sessionItems = req.session.orderItems;
    if (!sessionItems || sessionItems.length === 0) {
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.ORDER_ITEMS_MISSING});
    }

    const orderItems = sessionItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      basePrice: round2(item.basePrice),
      discount: round2(item.discount || 0),
      finalPrice: round2(item.finalPrice),
      subtotal: round2(item.subtotal),
      sku: item.sku,
      productName: item.productName,
      color: item.color || null,
      size: item.size || null,
      image: item.image || "",
      deliveryCharge: round2(item.deliveryCharge || 0)
    }));

    const order = await Order.create({
      orderID: "ORD" + Date.now(),
      user_id: userId,
      shippingAddressId: selectedAddress,
      items: orderItems,
      subtotal: round2(summary.subtotal),
      tax: round2(summary.tax),
      deliveryCharge: round2(summary.deliveryCharge || 0),
   ...buildCouponSnapshot(summary),
      walletUsed: round2(summary.finalAmount),
      totalPrice: round2(summary.finalAmount),
      paymentMethod: "Wallet",
      paymentStatus: "success",
      orderStatus: "Order Placed",
      statusTimeline: {
        orderPlaced: new Date()
      }
    });
    if (summary.appliedCouponId) {
      await Coupon.findByIdAndUpdate(summary.appliedCouponId, {
        $addToSet: { usedBy: userId }
      });
    }

    if (!req.session.buyNow) {
      await Cart.updateOne({ userId }, { $set: { items: [] } });
    }

    delete req.session.orderItems;
    delete req.session.orderSummary;
    delete req.session.buyNow;

    await req.session.save();

    res.json({ success: true, orderId: order.orderID });

  } catch (err) {
    console.error("Wallet Payment Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR});
  }

};

// ORDER SUCCESS PAGE
 const orderSuccessPage = async (req, res) => {
  try {
    const id = req.params.id;

    const order = await Order.findOne({ orderID: id })
      .populate("items.productId")
      .populate("user_id")
      .populate("shippingAddressId");

    if (!order) {
      return res.status(STATUS.NOT_FOUND).send(MESSAGES.ORDER_NOT_FOUND);
    }
    res.status(STATUS.SUCCESS).render("user/orderSuccess", { order, activePage: "" });
  } catch (error) {
    console.error("Order Success Page Error:", error);
    res.status(STATUS.SERVER_ERROR).send("Server Error");
  }
};

// FAILED ORDER PAYMENT
const paymentFailedPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const order = await Order.findOne({
      razorpayOrderId: req.params.id,
      user_id: userId
    })
      .populate("items.productId")
      .populate("shippingAddressId");

    if (order && order.paymentStatus === "pending") {
      order.paymentStatus = "failed";
      order.orderStatus = "Failed";
      order.failedAt = new Date();
      order.statusTimeline = {
        ...order.statusTimeline,
        failed: new Date()
      };
      await order.save();
    }

    if (!order) {
      return res.status(STATUS.NOT_FOUND).render("user/paymentFailed", {
        order: null,
        message: MESSAGES.PAYMENT_FAILED_ORDER_NOT_FOUND
      });
    }

    res.render("user/paymentFailed", {
      order,
      activePage: "My Orders"
    });

  } catch (err) {
    console.error("Payment Failed Page Error:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

export {
  getPaymentPage,
  placeOrder,
  placeCODOrder,
  createRazorpayOrder,
  verifyPayment,
  walletPayment,
  orderSuccessPage,
  paymentFailedPage
};
