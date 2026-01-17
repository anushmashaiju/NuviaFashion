import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import pdf from "html-pdf";
import ejs from "ejs";
import path from "path";
import MESSAGES from "../../utils/messages.js";
import STATUS from "../../utils/statusCodes.js";
import { processWalletRefund } from "../../utils/walletRefund.js";
import Coupon from "../../models/couponModel.js";

const getCouponEligibleSubtotal = (order, productIdToExclude) => {
  return order.items
    .filter(i =>
      !i.isCancelled &&
      !i.isReturned &&
      i.productId.toString() !== productIdToExclude
    )
    .reduce((sum, i) => sum + (i.finalPrice * i.quantity), 0);
};

// LIST ORDERS
const listOrders = async (req, res) => {
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

    return res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// ORDER DETAILS
const getOrderDetail = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");
    const { orderID } = req.params;

    const order = await Order.findOne({
      $or: [
        { orderID: orderID },
        { razorpayOrderId: orderID }
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
const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.LOGIN_REQUIRED
      });
    }
 const { orderID } = req.params;

    const order = await Order.findOne({
      orderID,
      user_id: userId
    });

    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER_NOT_FOUND
      });
    }

    if (order.orderStatus === "Cancelled") {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ORDER_ALREADY_CANCELLED
      });
    }

  const refundable =
  order.paymentMethod !== "COD" ||
  (order.paymentMethod === "COD" && order.orderStatus === "Delivered");

if (refundable) {
  for (const item of order.items) {
    if (item.refundProcessed || item.isCancelled) continue;

    item.isCancelled = true;

    await processWalletRefund({
      userId: order.user_id,
      order,
      item,
      description: `Refund for cancelled order ${order.orderID}`
    });
  }
}

    order.orderStatus = "Cancelled";
    order.cancelReason = reason || null;
    await order.save();

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }

    return res.status(STATUS.SUCCESS).json({
      success: true,
      message: MESSAGES.ORDER_CANCELLED
    });

  } catch (err) {
    console.error("Cancel Order Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

// CANCEL SPECIFIC PRODUCT
const cancelProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.LOGIN_REQUIRED
      });
    }
 const { orderID } = req.params;
    const order = await Order.findOne({
      orderID,
      user_id: userId
    });

    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER_NOT_FOUND
      });
    }

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.PRODUCT_NOT_IN_ORDER
      });
    }

    if (item.isCancelled) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PRODUCT_ALREADY_CANCELLED
      });
    }

    if (item.isReturned) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PRODUCT_ALREADY_RETURNED
      });
    }

    if (order.couponApplied && order.couponMinimumPrice > 0) {
      const activeItems = order.items.filter(
        i => !i.isCancelled && !i.isReturned
      );

      if (activeItems.length === 1) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON_ITEM_CANCEL_NOT_ALLOWED
        });
      }

      const remainingSubtotal = getCouponEligibleSubtotal(order, productId);

      if (remainingSubtotal < order.couponMinimumPrice) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON_MINIMUM_NOT_MET(remainingSubtotal, order.couponMinimumPrice)
        });
      }
    }

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
      const itemTax = Number((itemSubtotal * 0.18).toFixed(2));

      refundAmount = itemSubtotal + itemTax;

      if (refundAmount > 0) {
      await processWalletRefund({
  userId: order.user_id,
  order,
  item,
  description: isOnlyItem
    ? `Refund for cancelled order ${order.orderID}`
    : `Refund for cancelled item: ${item.productName}`
});

      }
    }

    item.isCancelled = true;
    item.cancelReason = reason || null;
    item.cancelledAt = new Date();

    await Product.findByIdAndUpdate(item.productId, {
      $inc: { stock: item.quantity }
    });

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

      order.totalPrice = Math.max(
        order.subtotal +
        order.tax +
        order.deliveryCharge -
        (order.couponDiscount || 0),
        0
      );
    }

    await order.save();

    return res.json({ success: true, order });

  } catch (err) {
    console.error("Cancel Product Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

// SEARCH ORDERS
const searchOrders = async (req, res) => {
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
const downloadInvoice = async (req, res) => {
  try {
    const { orderID } = req.params;

const order = await Order.findOne({ orderID })
  .populate("shippingAddressId");

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

// RETURN REQUEST
const requestReturn = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.LOGIN_REQUIRED
      });
    }

    const { reason, returnType } = req.body;
    if (!reason) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.RETURN_REASON_REQUIRED
      });
    }
const { orderID } = req.params;

const order = await Order.findOne({
  orderID,
  user_id: userId
});


    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER_NOT_FOUND
      });
    }

    if (!["Delivered", "Return Requested"].includes(order.orderStatus))
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ONLY_DELIVERED_CAN_RETURN
      });

    order.hasReturnRequest = true;
    order.orderStatus = "Return Requested";
    order.returnReason = reason;
    order.returnRequestedAt = new Date();
    order.returnType = returnType || "REFUND";

    order.items.forEach(item => {
      if (!item.isCancelled) {
        item.returnRequested = true;
        item.returnStatus = "Requested";
        item.returnReason = reason;
        item.returnRequestedAt = new Date();
      }
    });

    await order.save();

    return res.status(STATUS.SUCCESS).json({
      success: true,
      message: MESSAGES.RETURN_REQUEST_SUCCESS
    });

  } catch (err) {
    console.error("Return Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

const requestItemReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, reason, returnType } = req.body;

    const userId = req.session.user?._id || req.session.user?.id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.LOGIN_REQUIRED
      });
    }

    if (!productId) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.INVALID_ITEM
      });
    }

 const { orderID } = req.params;

const order = await Order.findOne({
  orderID,
  user_id: userId
});


    if (!order) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.ORDER_NOT_FOUND
      });
    }

    const item = order.items.find(
      i => i.productId.toString() === productId
    );

    if (!item) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.INVALID_ITEM
      });
    }

    if (item.returnRequested || item.isReturned) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.ITEM_RETURN_REQUEST_SUCCESS
      });
    }

    if (order.couponApplied && order.couponMinimumPrice > 0) {
      const remainingSubtotal = getCouponEligibleSubtotal(order, productId);

      if (remainingSubtotal < order.couponMinimumPrice) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.COUPON_MINIMUM_NOT_MET_FOR_RETURN(
            remainingSubtotal,
            order.couponMinimumPrice)
        });
      }
    }

    item.returnRequested = true;
    item.returnRequestedAt = new Date();
    item.returnReason = reason;
    item.returnType = returnType || "REFUND";
    item.returnStatus = "Requested";

    order.hasReturnRequest = true;
    order.orderStatus = "Return Requested";

    await order.save();

    return res.status(STATUS.SUCCESS).json({
      success: true,
      message: MESSAGES.ITEM_RETURN_REQUEST_SUCCESS
    });
  } catch (err) {
    console.error("Request Item Return Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

export {
  getCouponEligibleSubtotal,
  listOrders,
  getOrderDetail,
  cancelOrder,
  cancelProduct,
  searchOrders,
  downloadInvoice,
  requestReturn,
  requestItemReturn
};
