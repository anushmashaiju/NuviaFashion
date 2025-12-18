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

// LIST ORDERS
export const listOrders = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    // Fetch all orders for the user
    const filterCondition = { user_id: userId };

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
    if (!userId) return res.status(STATUS.UNAUTHORIZED).json({ success: false, message: MESSAGES.USER_NOT_LOGGED_IN });

    const order = await Order.findOne({ orderID: req.params.id, user_id: userId });
    if (!order) return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.ORDER_NOT_FOUND });

    if (order.orderStatus === "Cancelled")
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.ORDER_CANCELLED });

    order.orderStatus = "Cancelled";
    order.cancelReason = reason || null;
    await order.save();

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }

    res.status(STATUS.SUCCESS).json({ success: true, message: MESSAGES.ORDER_CANCELLED });
  } catch (err) {
    console.error("Cancel Order Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};

// CANCEL SPECIFIC PRODUCT
export const cancelProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).json({ success: false, message: MESSAGES.USER_NOT_LOGGED_IN });

    const order = await Order.findOne({ orderID: req.params.id, user_id: userId });
    if (!order) return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.ORDER_NOT_FOUND });

    const itemIndex = order.items.findIndex(i => i.productId.toString() === productId);
    if (itemIndex === -1) return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.PRODUCT_NOT_FOUND });

    const item = order.items[itemIndex];
    await Product.findByIdAndUpdate(productId, { $inc: { stock: item.quantity } });

    order.items.splice(itemIndex, 1);

    order.subtotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
    order.totalPrice =
      order.subtotal -
      (order.discount || 0) -
      (order.couponDiscount || 0) +
      (order.tax || 0) +
      (order.deliveryCharge || 0);

    if (order.items.length === 0) {
      order.orderStatus = "Cancelled";
      order.cancelReason = reason || null;
      order.totalPrice = 0;
      order.subtotal = 0;
    }

    await order.save();
    res.status(STATUS.SUCCESS).json({ success: true, message: MESSAGES.ORDER_CANCELLED, order });
  } catch (err) {
    console.error("Cancel Product Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
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

    const { reason } = req.body;
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

    await order.save();

    res.status(STATUS.SUCCESS).json({ success: true, message: "Return request submitted to admin" });

  } catch (err) {
    console.error("Return Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};
