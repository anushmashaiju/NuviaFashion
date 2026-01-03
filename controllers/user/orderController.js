import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import pdf from "html-pdf";
import ejs from "ejs";
import path from "path";
import MESSAGES from "../../utils/messages.js";
import STATUS from "../../utils/statusCodes.js";
import { processWalletRefund } from "../../utils/walletRefund.js";
import Coupon from "../../models/couponModel.js";

// LIST ORDERS
export const listOrders = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;
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
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    return res.status(STATUS.SUCCESS).render("user/orderList", {
      activePage: "My Orders",
      orders,
      currentPage: page,
      totalPages
    });

  } catch (err) {    
    console.error("List Orders Error:", err);

    return res.status(STATUS.SERVER_ERROR).send("Server Error");
  }
};

// ORDER DETAILS
export const getOrderDetail = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const order = await Order.findOne({
  $or: [
    { orderID: req.params.id },
    { razorpayOrderId: req.params.id }
  ],
  user_id: userId
}).populate("shippingAddressId");

    if (!order)
      return res.status(STATUS.NOT_FOUND).send(MESSAGES.ORDER_NOT_FOUND);

if (
  order.paymentStatus === "failed" &&
  !req.originalUrl.includes("/payment/failed")
) {
  return res.redirect(`/payment/failed/${order.razorpayOrderId}`);
}
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

    if (order.orderStatus === "Out for Delivery") {
      deliveryMessage = "Arriving Today";
    } else if (approxStart.toDateString() === tomorrow.toDateString()) {
      deliveryMessage = "Arriving Tomorrow";
    } else {
      deliveryMessage = `Arriving between ${approxStart.toDateString()} - ${approxEnd.toDateString()}`;
    }

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
    if (!userId) return res.status(STATUS.UNAUTHORIZED).json({ success: false, message: "Login required" });

    const order = await Order.findOne({ orderID: req.params.id, user_id: userId });
    if (!order) return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Order not found" });

    if (order.orderStatus === "Cancelled")
      return res.status(SERVER.BAD_REQUEST).json({ success: false, message: "Order already cancelled" });

if (order.paymentStatus === "success") {
  const refundAmount = Number((order.totalPrice).toFixed(2));
  await processWalletRefund({
    userId: order.user_id,
    amount: refundAmount,
    description: "Refund for cancelled order"
  });
}
    order.orderStatus = "Cancelled";
    order.cancelReason = reason || null;
    await order.save();

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }

    res.status(STATUS.SUCCESS).json({ success: true, message: "Order cancelled and refunded to wallet" });

  } catch (err) {
    console.error("Cancel Order Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: "Server error" });
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

    if (!order)
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Order not found" });

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item)
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Item not found" });

    if (item.isCancelled)
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Item already cancelled" });

    /* =====================================================
       🔒 COUPON MINIMUM PURCHASE VALIDATION (FIXED & STRICT)
    ===================================================== */
    if (
      order.couponApplied &&
      order.couponDiscount > 0 &&
      order.couponMinimumPrice > 0
    ) {
      const activeItems = order.items.filter(
        i => !i.isCancelled && !i.isReturned
      );

      // Only block partial cancellation
      if (activeItems.length > 1) {
      const remainingSubtotal =
  order.subtotal - (item.finalPrice * item.quantity);


        if (remainingSubtotal < order.couponMinimumPrice) {
          return res.status(STATUS.BAD_REQUEST).json({
            success: false,
            message: `This item cannot be cancelled because the remaining order value (₹${remainingSubtotal}) is below the minimum purchase amount (₹${order.couponMinimumPrice}) required for the applied coupon.`
          });
        }
      }
    }

    /* =======================
       REFUND ELIGIBILITY
    ======================= */
    const isOnlinePaid = ["Razorpay", "Wallet"].includes(order.paymentMethod);
    const isCODDelivered =
      order.paymentMethod === "COD" && order.orderStatus === "Delivered";

    const allowRefund = isOnlinePaid || isCODDelivered;

    const activeItemsBefore = order.items.filter(
      i => !i.isCancelled && !i.isReturned
    );

    const isOnlyItem = activeItemsBefore.length === 1;

    let refundAmount = 0;

    if (allowRefund) {
      const itemSubtotal = item.finalPrice * item.quantity;
      const itemTax = itemSubtotal * 0.18;

      refundAmount = isOnlyItem ? order.totalPrice : itemSubtotal + itemTax;
      refundAmount = Number(refundAmount.toFixed(2));

      if (refundAmount > 0) {
        await processWalletRefund({
          userId: order.user_id,
          amount: refundAmount,
          description: isOnlyItem
            ? `Refund for cancelled order ${order.orderID}`
            : `Refund for cancelled item: ${item.productName}`
        });
      }
    }

    /* =======================
       CANCEL ITEM & RESTOCK
    ======================= */
    item.isCancelled = true;
    item.cancelReason = reason || null;
    item.cancelledAt = new Date();

    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: item.quantity }
    });

    /* =======================
       RECALCULATE ORDER TOTAL
    ======================= */
    const activeItemsAfter = order.items.filter(
      i => !i.isCancelled && !i.isReturned
    );

    if (activeItemsAfter.length === 0) {
      order.orderStatus = "Cancelled";
      order.subtotal = 0;
      order.tax = 0;
      order.deliveryCharge = 0;
      order.totalPrice = 0;
    } else {
      order.subtotal = activeItemsAfter.reduce(
        (sum, i) => sum + i.finalPrice * i.quantity,
        0
      );

      order.tax = Number((order.subtotal * 0.18).toFixed(2));

      order.totalPrice =
        order.subtotal +
        order.tax +
        order.deliveryCharge -
        (order.couponDiscount || 0);
    }

    await order.save();

    return res.json({ success: true, order });

  } catch (err) {
    console.error("Cancel Product Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: "Server error"
    });
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
const twoDaysAgo = new Date();
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

const orders = await Order.find({
  user_id: userId,
  $and: [
    {
      $or: [
        { paymentStatus: { $ne: "failed" } },
        { paymentStatus: "failed", createdAt: { $gte: twoDaysAgo } }
      ]
    },
    { $or: orConditions }
  ]
});


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
