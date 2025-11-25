import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";
import pdf from "html-pdf";
import ejs from "ejs";
import path from "path";

// LIST ORDERS
export const listOrders = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalOrders = await Order.countDocuments({ user_id: userId });
    const orders = await Order.find({ user_id: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);

    res.render("user/orderList", {
      activePage: "My Orders",
      orders,
      currentPage: page,
      totalPages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// ORDER DETAILS
export const getOrderDetail = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const order = await Order.findOne({
      orderID: req.params.id,
      user_id: userId,
    }).populate("shippingAddressId");

    if (!order) return res.status(404).send("Order not found");

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

res.render("user/orderdetail", {
  activePage: "My Orders",
  order,
  items: order.items,
  approxStart,
  approxEnd,
  deliveryMessage,
});

  } catch (err) {
    console.error("Get Order Detail Error:", err);
    res.status(500).send("Server Error");
  }
};

// CANCEL ORDER
export const cancelOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderID: req.params.id, user_id: userId });
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    if (order.orderStatus === "Cancelled")
      return res.status(400).json({
        success: false,
        message: "Order is already cancelled",
      });

    order.orderStatus = "Cancelled";
    order.cancelReason = reason || null;
    await order.save();

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
      });
    }

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (err) {
    console.error("Cancel Order Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// RETURN ORDER
export const returnOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: "Return reason is required" });

    const order = await Order.findOne({ orderID: req.params.id });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.orderStatus !== "Delivered") {
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
    }

    order.orderStatus = "Returned";       
    order.returnReason = reason;           
    await order.save();

    for (let item of order.items) {
      await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
    }

    res.json({ success: true, message: "Order returned successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// CANCEL SPECIFIC PRODUCT
export const cancelProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    const userId = req.session.user.id;

    const order = await Order.findOne({ orderID: req.params.id, user_id: userId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.orderStatus === "Cancelled")
      return res.status(400).json({ success: false, message: "Order already cancelled" });

    const itemIndex = order.items.findIndex(
      (i) => i.productId.toString() === productId
    );

    if (itemIndex === -1)
      return res.status(404).json({
        success: false,
        message: "Product not found in order",
      });

    const item = order.items[itemIndex];

    await Product.findByIdAndUpdate(productId, {
      $inc: { stock: item.quantity },
    });

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

    res.json({ success: true, message: "Product cancelled successfully", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// SEARCH ORDERS
export const searchOrders = async (req, res) => {
  try {
    const query = req.params.query;
    const userId = req.session.user.id;

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

    const orders = await Order.find({
      user_id: userId,
      $or: orConditions,
    }).sort({ createdAt: -1 });

    res.render("user/orderList", {
      activePage: "My Orders",
      orders,
      currentPage: 1,
      totalPages: 1,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// DOWNLOAD INVOICE
export const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findOne({ orderID: req.params.id }).populate(
      "shippingAddressId"
    );

    if (!order) return res.status(404).send("Order not found");

    ejs.renderFile(
      path.join("views", "user", "invoice.ejs"),
      { order, items: order.items },
      (err, html) => {
        if (err) return res.status(500).send(err.message);

        pdf.create(html).toStream((err, stream) => {
          if (err) return res.status(500).send(err.message);

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=${order.orderID}.pdf`
          );

          stream.pipe(res);
        });
      }
    );
  } catch (err) {
    res.status(500).send("Server Error");
  }
};
