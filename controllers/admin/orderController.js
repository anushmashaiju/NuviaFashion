import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import MESSAGES from "../../utils/messages.js";
import STATUS from "../../utils/statusCodes.js";
import { processWalletRefund } from "../../utils/walletRefund.js";


// ADMIN — LIST ALL ORDERS
const getOrdersPage = async (req, res) => {
  try {
    let { page = 1, search = "", sort = "-createdAt", status = "" } = req.query;
    page = parseInt(page);
    const limit = 10;
    const skip = (page - 1) * limit;
    let filter = {};

    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { mobile: { $regex: search, $options: "i" } },
        ]
      }).select("_id");

      const userIds = users.map(u => u._id);

      filter.$or = [
        { orderID: { $regex: search, $options: "i" } },
        { orderStatus: { $regex: search, $options: "i" } },
        { user_id: { $in: userIds } }
      ];
    }

    if (status) filter.orderStatus = status;

    let sortOption = { createdAt: -1 };
    switch (sort) {
      case "createdAt":
        sortOption = { createdAt: 1 };
        break;
      case "-totalPrice":
        sortOption = { totalPrice: -1 };
        break;
      case "totalPrice":
        sortOption = { totalPrice: 1 };
        break;
    }

    const totalOrders = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate("user_id")
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    res.status(STATUS.SUCCESS).render("admin/orders", {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      search,
      sort,
      statusFilter: status,
      admin: req.session.admin,
    });

  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// UPDATE ORDER STATUS 
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findById(req.params.id);
    
if (!order) {
  return res.status(STATUS.NOT_FOUND).render("partials/errorPage", {
    statusCode: STATUS.NOT_FOUND,
    message: MESSAGES.ORDER_NOT_FOUND,
    redirectPath: "/admin/return-requests",
    admin: req.session.admin
  });
}



    if (!order.statusTimeline) order.statusTimeline = {};
    const now = new Date();

    switch (status) {
      case "Order Placed":
        if (!order.statusTimeline.orderPlaced) order.statusTimeline.orderPlaced = now;
        break;

      case "Processing":
        if (!order.statusTimeline.processing) order.statusTimeline.processing = now;
        break;

      case "Shipped":
        if (!order.statusTimeline.shipped) order.statusTimeline.shipped = now;
        break;

      case "Reached Nearest Hub":
        if (!order.statusTimeline.reachedHub) order.statusTimeline.reachedHub = now;
        break;

      case "Out for Delivery":
        if (!order.statusTimeline.outForDelivery) order.statusTimeline.outForDelivery = now;
        break;

      case "Delivered":
        if (!order.statusTimeline.delivered) {
          order.statusTimeline.delivered = now;
          order.deliveredAt = now;

          if (order.paymentMethod === "COD" && order.paymentStatus === "pending") {
            order.paymentStatus = "success";
          }
        }
        break;

      case "Cancelled":
        if (!order.statusTimeline.cancelled) order.statusTimeline.cancelled = now;

        for (let item of order.items) {
          if (item.productId) {
            await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
          }
        }
        break;

      default:
        break;
    }

    order.orderStatus = status;
    await order.save();

    res.status(STATUS.SUCCESS).redirect(`/admin/orders/${order._id}`);
  } catch (err) {
    console.error("Update Order Status Error:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// VIEW SINGLE ORDER
const viewSingleOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user_id")
      .populate("items.productId")
      .populate("shippingAddressId");

    
if (!order) {
  return res.status(STATUS.NOT_FOUND).render("partials/errorPage", {
    statusCode: STATUS.NOT_FOUND,
    message: MESSAGES.ORDER_NOT_FOUND,
    redirectPath: "/admin/return-requests",
    admin: req.session.admin
  });
}


    const purchasedDate = order.createdAt;
    const approxStart = new Date(purchasedDate);
    const approxEnd = new Date(purchasedDate);

    approxStart.setDate(approxStart.getDate() + 3);
    approxEnd.setDate(approxEnd.getDate() + 7);

    res.status(STATUS.SUCCESS).render("admin/orderDetailAdmin", {
      order,
      purchasedDate,
      approxStart,
      approxEnd,
      admin: req.session.admin,
    });

  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// ADMIN APPROVES RETURN
const approveReturn = async (req, res) => {
  try {
    const { orderID } = req.params;

    const order = await Order.findOne({ orderID });
    if (!order) return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Order not found" });

    if (order.orderStatus !== "Return Requested")
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "No return request for this order" });

    order.orderStatus = "Returned";
    order.returnApprovedAt = new Date();
    await order.save();

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }

    res.status(STATUS.SUCCESS).json({ success: true, message: "Return approved" });
  } catch (err) {
    console.error("Approve Return Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

// getReturnRequests
const getReturnRequests = async (req, res) => {
  try {
    const orders = await Order.find({ orderStatus: "Return Requested" })
      .populate("user_id")
      .populate("items.productId")
      .populate("shippingAddressId");

    res.status(STATUS.SUCCESS).render("admin/returnRequests", { orders });
  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).send("Server Error");
  }
};

// GET SINGLE RETURN REQUEST
const getSingleReturnRequest = async (req, res) => {
  try {
    const { orderID } = req.params;

    const order = await Order.findOne({ orderID })
      .populate("user_id")
      .populate("items.productId")
      .populate("shippingAddressId");

   
if (!order) {
  return res.status(STATUS.NOT_FOUND).render("partials/errorPage", {
    statusCode: STATUS.NOT_FOUND,
    message: MESSAGES.ORDER_NOT_FOUND,
    redirectPath: "/admin/return-requests",
    admin: req.session.admin
  });
}


    res.status(STATUS.SUCCESS).render("admin/returnRequestDetail", { order });
  } catch (err) {
    console.error("Get Single Return Request Error:", err);
    res.status(STATUS.SERVER_ERROR).send("Server Error");
  }
};

//APPROVE RETURN
const approveReturnRequest = async (req, res) => {
  try {
    const { orderID } = req.params;
    const { restock } = req.body;

    const order = await Order.findOne({ orderID });
    if (!order)
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Order not found" });

    if (order.orderStatus !== "Return Requested")
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Invalid return request" });

    order.orderStatus = "Returned";
    order.returnApprovedAt = new Date();
    order.restocked = restock;

    if (restock === true) {
      await Promise.all(
        order.items.map(item =>
          Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          })
        )
      );
    }

    if (
      order.returnType === "REFUND" &&
      !order.refundProcessed &&
      ["COD", "Razorpay", "Wallet"].includes(order.paymentMethod)
    ) {
      await processWalletRefund({ order });
    }

    await order.save();

    return res.json({
      success: true,
      message: restock
        ? "Return approved and product restocked"
        : "Return approved without restocking (damaged item)"
    });

  } catch (err) {
    console.error("Approve Return Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

// REJECT RETURN
const rejectReturnRequest = async (req, res) => {
  console.log("Reject return called", req.params, req.body);
  try {
    const { orderID } = req.params;
    const { reason } = req.body;

    const order = await Order.findOne({ orderID });
    if (!order) {
      console.log("");
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Order not found" });
    }

    order.orderStatus = "Return Rejected";
    order.returnRejectedAt = new Date();
    order.returnReason = reason || "No reason provided";
    await order.save();

    res.status(STATUS.SUCCESS).json({ success: true, message: "Return rejected" });
  } catch (err) {
    console.error("Reject Return Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: "Server error" });
  }
};

// CANCEL ORDER
const adminCancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(STATUS.NOT_FOUND).send(MESSAGES.ORDER_NOT_FOUND);

    if (!order.refundProcessed) {
      await processWalletRefund(order, "Refund for cancelled order");
    }

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      });
    }

    order.orderStatus = "Cancelled";
    await order.save();

    res.redirect("/admin/orders");
  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// ADMIN APPROVES SINGLE ITEM RETURN
const approveItemReturn = async (req, res) => {
  try {
    const { orderID, productId } = req.params;
    const { restock } = req.body;

    const order = await Order.findOne({ orderID }).populate("items.productId");
    
if (!order) {
  return res.status(STATUS.NOT_FOUND).render("partials/errorPage", {
    statusCode: STATUS.NOT_FOUND,
    message: MESSAGES.ORDER_NOT_FOUND,
    redirectPath: "/admin/return-requests",
    admin: req.session.admin
  });
}


    const item = order.items.find(
      i => i.productId._id.toString() === productId
    );

    if (!item || item.returnStatus !== "Requested")
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "Return not requested or already processed"
      });

    item.returnStatus = "Approved";
    item.isReturned = true;
    item.returnRequested = false;
    item.returnApprovedAt = new Date();

    if (restock === true) {
      await Product.findByIdAndUpdate(item.productId._id, {
        $inc: { stock: item.quantity }
      });
    }

    if (item.returnType === "REFUND" && !item.refundProcessed) {
      await processWalletRefund({
        userId: order.user_id,
        order,
        item,
        description: `Refund for returned item: ${item.productName}`
      });
    }

    const activeItems = order.items.filter(
      i => !i.isCancelled && !i.isReturned
    );

    const pendingReturns = order.items.some(
      i => i.returnStatus === "Requested"
    );

    if (activeItems.length === 0) {
      order.orderStatus = "Returned";
      order.returnApprovedAt = new Date();
    } else if (pendingReturns) {
      order.orderStatus = "Return Requested";
    } else {
      order.orderStatus = "Delivered";
    }

    order.hasReturnRequest = pendingReturns;

    await order.save();

    return res.json({
      success: true,
      message: restock
        ? "Item return approved and restocked"
        : "Item return approved"
    });

  } catch (err) {
    console.error("Approve Item Return Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: "Server error"
    });
  }
};

export {
  getOrdersPage,
  updateOrderStatus,
  viewSingleOrder,
  approveReturn,
  getReturnRequests,
  getSingleReturnRequest,
  approveReturnRequest,
  rejectReturnRequest,
  adminCancelOrder,
  approveItemReturn
};
