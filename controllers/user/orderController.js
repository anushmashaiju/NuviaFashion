import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import Coupon from "../../models/couponModel.js";
import pdf from "html-pdf";
import ejs from "ejs";
import path from "path";
import MESSAGES from "../../utils/messages.js";
import STATUS from "../../utils/statusCodes.js";
import crypto from "crypto";
import { razorpayInstance } from "../../config/razorpay.js";
import Cart from "../../models/cartModel.js";
import { processWalletRefund } from "../../utils/walletRefund.js";

// LIST ORDERS
export const listOrders = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // Fetch all orders for the user
  const twoDaysAgo = new Date();
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

const filterCondition = {
  user_id: userId,
  $or: [
    { paymentStatus: { $ne: "failed" } },
    {
      paymentStatus: "failed",
      createdAt: { $gte: twoDaysAgo }
    }
  ]
};


    const totalOrders = await Order.countDocuments(filterCondition);

    const orders = await Order.find(filterCondition)
      .sort({ createdAt: -1 }) // newest first
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(200).render("user/orderList", {
      activePage: "My Orders",
      orders,
      currentPage: page,
      totalPages
    });

  } catch (err) {
    console.error("List Orders Error:", err);
    return res.status(500).send("Server Error");
  }
};


// ORDER DETAILS
export const getOrderDetail = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const order = await Order.findOne({
      orderID: req.params.id,
      user_id: userId,
    }).populate("shippingAddressId");

    if (!order) return res.status(STATUS.NOT_FOUND).send(MESSAGES.ORDER_NOT_FOUND);

    const minDays = 3;
    const maxDays = 7;

    const approxStart = new Date(order.createdAt);
    approxStart.setDate(approxStart.getDate() + minDays);

    const approxEnd = new Date(order.createdAt);
    approxEnd.setDate(approxEnd.getDate() + maxDays);

    let deliveryMessage = "";
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (order.orderStatus === "Out for Delivery") deliveryMessage = "Arriving Today";
    else if (approxStart.toDateString() === tomorrow.toDateString()) deliveryMessage = "Arriving Tomorrow";
    else deliveryMessage = `Arriving between ${approxStart.toDateString()} - ${approxEnd.toDateString()}`;

    res.status(STATUS.SUCCESS).render("user/orderdetail", {
      activePage: "My Orders",
      order,
      items: order.items,
      approxStart,
      approxEnd,
      deliveryMessage,
    });
  } catch (err) {
    console.error("Get Order Detail Error:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// CANCEL ORDER
export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Login required" });

    const order = await Order.findOne({ orderID: req.params.id, user_id: userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.orderStatus === "Cancelled")
      return res.status(400).json({ success: false, message: "Order already cancelled" });

    // Only refund if order was paid
// Only refund if order was paid
if (order.paymentStatus === "success") {
  const refundAmount = Number((order.subtotal + order.tax + order.deliveryCharge).toFixed(2));
  await processWalletRefund({
    userId: order.user_id,
    amount: refundAmount,
    description: "Refund for cancelled order (coupon excluded)"
  });
}



    order.orderStatus = "Cancelled";
    order.cancelReason = reason || null;
    await order.save();

    // Restore stock
    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }

    res.status(200).json({ success: true, message: "Order cancelled and refunded to wallet" });

  } catch (err) {
    console.error("Cancel Order Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// CANCEL SPECIFIC PRODUCT
export const cancelProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    const userId = req.session.user?.id;

    const order = await Order.findOne({
      orderID: req.params.id,
      user_id: userId
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    if (item.isCancelled) {
      return res.status(400).json({ success: false, message: "Item already cancelled" });
    }

    /* ================= REFUND LOGIC ================= */

/* ================= REFUND LOGIC ================= */
const GST_RATE = 0.18;


const calculateTaxFromItems = (items) => {
  return Number(
    items.reduce((sum, item) => {
      return sum + (item.finalPrice * GST_RATE);
    }, 0).toFixed(2)
  );
};

if (order.paymentStatus === "success") {
  const itemTax = Number((item.finalPrice * GST_RATE).toFixed(2));
  const refundAmount = Number((item.finalPrice + itemTax).toFixed(2));

  if (refundAmount > 0) {
    await processWalletRefund({
      userId: order.user_id,
      amount: refundAmount,
      description: `Refund for cancelled item: ${item.productName}`
    });
  }
}

    /* ================= UPDATE ITEM ================= */

    item.isCancelled = true;
    item.cancelReason = reason || null;
    item.cancelledAt = new Date();

    /* ================= RESTORE STOCK ================= */

    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: item.quantity }
    });

    /* ================= RECALCULATE ORDER ================= */

   const activeItems = order.items.filter(
  i => !i.isCancelled && !i.isReturned
);

// Recalculate subtotal
order.subtotal = activeItems.reduce((sum, i) => sum + i.finalPrice, 0);

// Recalculate tax ONLY from active items
order.tax = calculateTaxFromItems(activeItems);

// Coupon applies only if items exist
const couponDiscount = activeItems.length > 0 ? order.couponDiscount : 0;
const deliveryCharge = activeItems.length > 0 ? order.deliveryCharge : 0;

order.totalPrice =
  order.subtotal +
  order.tax +
  deliveryCharge -
  couponDiscount;

if (activeItems.length === 0) {
  order.orderStatus = "Cancelled";
}

    await order.save();

    return res.json({ success: true, order });

  } catch (err) {
    console.error("Cancel Product Error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// SEARCH ORDERS
export const searchOrders = async (req, res) => {
  try {
    const query = req.params.query;
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const orConditions = [
      { orderID: { $regex: query, $options: "i" } },
      { orderStatus: { $regex: query, $options: "i" } },
      { "items.productName": { $regex: query, $options: "i" } },
    ];

    const dateQuery = new Date(query);
    if (!isNaN(dateQuery.getTime())) {
      orConditions.push({
        createdAt: {
          $gte: new Date(dateQuery.setHours(0, 0, 0, 0)),
          $lte: new Date(dateQuery.setHours(23, 59, 59, 999)),
        },
      });
    }

    const orders = await Order.find({ user_id: userId, $or: orConditions }).sort({ createdAt: -1 });

    res.status(STATUS.SUCCESS).render("user/orderList", { activePage: "My Orders", orders, currentPage: 1, totalPages: 1 });
  } catch (err) {
    console.error("Search Orders Error:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// DOWNLOAD INVOICE
export const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findOne({ orderID: req.params.id }).populate("shippingAddressId");
    if (!order) return res.status(STATUS.NOT_FOUND).send(MESSAGES.ORDER_NOT_FOUND);

    ejs.renderFile(path.join("views", "user", "invoice.ejs"), { order, items: order.items }, (err, html) => {
      if (err) return res.status(STATUS.SERVER_ERROR).send(err.message);

      pdf.create(html).toStream((err, stream) => {
        if (err) return res.status(STATUS.SERVER_ERROR).send(err.message);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=${order.orderID}.pdf`);
        stream.pipe(res);
      });
    });
  } catch (err) {
    console.error("Download Invoice Error:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// RETURN REQUEST (USER SIDE)
export const requestReturn = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId)
      return res.status(STATUS.UNAUTHORIZED).json({ success: false, message: "Login required" });

 const { reason, returnType } = req.body;
    if (!reason)
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Reason required" });

    const order = await Order.findOne({
      orderID: req.params.id,
      user_id: userId
    });

    if (!order)
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Order not found" });

    if (order.orderStatus !== "Delivered")
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Only delivered orders can be returned" });

    order.orderStatus = "Return Requested";
    order.returnReason = reason;
    order.returnRequestedAt = new Date();
order.returnType = returnType || "REFUND";
    await order.save();

    res.status(STATUS.SUCCESS).json({ success: true, message: "Return request submitted to admin" });

  } catch (err) {
    console.error("Return Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};
