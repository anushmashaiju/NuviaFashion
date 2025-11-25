import Order from "../../models/orderModel.js";
import Product from "../../models/productModel.js";

// ADMIN — LIST ALL ORDERS 

export const getOrdersPage = async (req, res) => {
  try {
    let { page = 1, search = "", sort = "-createdAt", status = "" } = req.query;

    page = parseInt(page);
    const limit = 10;
    const skip = (page - 1) * limit;

    let filter = {};

    if (search) {
      filter.$or = [
        { orderID: { $regex: search, $options: "i" } },
        { orderStatus: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filter.orderStatus = status;
    }

    const totalOrders = await Order.countDocuments(filter);

    const orders = await Order.find(filter)
      .populate("user_id") 
      .sort(sort)
      .skip(skip)
      .limit(limit);

    res.render("admin/orders", {
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
    res.status(500).send("Server Error");
  }
};


// UPDATE ORDER STATUS + TIMELINE SAVE

export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send("Order not found");

    if (!order.statusTimeline) {
      order.statusTimeline = {};
    }

    const now = new Date();

    if (status === "Pending") {
      order.statusTimeline.orderPlaced = now;
      order.statusTimeline.processing = now;
    }

    if (status === "Shipped") {
      order.statusTimeline.shipped = now;
    }

    if (status === "Out for Delivery") {
      order.statusTimeline.outForDelivery = now;
    }

    if (status === "Delivered") {
      order.statusTimeline.delivered = now;
      order.deliveryDate = now;
    }

    order.orderStatus = status;
    await order.save();

    res.redirect("/admin/orders");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// VIEW SINGLE ORDER

export const viewSingleOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("user_id")
      .populate("items.productId")
      .populate("shippingAddressId");

    if (!order) return res.status(404).send("Order not found");

    const purchasedDate = order.createdAt;

    const approxStart = new Date(purchasedDate);
    const approxEnd = new Date(purchasedDate);

    approxStart.setDate(approxStart.getDate() + 3);
    approxEnd.setDate(approxEnd.getDate() + 7);

    res.render("admin/orderDetailAdmin", {
      order,
      purchasedDate,
      approxStart,
      approxEnd,
      admin: req.session.admin,
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// CANCEL ORDER

export const adminCancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).send("Order not found");

    if (order.orderStatus !== "Cancelled") {
      for (let item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: item.quantity }
        });
      }
    }

    order.orderStatus = "Cancelled";
    await order.save();

    res.redirect("/admin/orders");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
