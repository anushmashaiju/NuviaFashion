import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import STATUS from "../../utils/statusCodes.js";

const normalizeOrder = (order) => {
  let debit = 0;
  let credit = 0;

  const refundedStatuses = [
    "Cancelled",
    "Returned",
    "Return Approved"
  ];

  const isRefunded = refundedStatuses.includes(order.orderStatus);

  if (isRefunded) {
    credit = order.refundAmount || order.totalPrice || 0;
  } else if (order.paymentStatus === "success") {
    debit = order.totalPrice || 0;
  }

  return {
    ...order.toObject(),
    debit,
    credit,
    net: debit - credit
  };
};

// Get admin dashboard
const getAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({
      role: "user",
      isDeleted: false
    });

    const orderQuery = {
      paymentStatus: { $in: ["success", "failed"] }
    };
    const totalOrders = await Order.countDocuments(orderQuery);
    const successfulOrders = await Order.find(orderQuery);

    const grandTotal = {
      totalAmount: successfulOrders.reduce(
        (a, o) => a + o.subtotal,
        0
      ),

      totalDiscount: successfulOrders.reduce(
        (a, o) => a + (o.couponDiscount || 0),
        0
      ),

      totalTax: successfulOrders.reduce(
        (a, o) => a + (o.tax || 0),
        0
      ),

      deliveryCharge: successfulOrders.reduce(
        (a, o) => a + (o.deliveryCharge || 0),
        0
      ),

      finalAmount: successfulOrders.reduce(
        (a, o) => a + o.totalPrice,
        0
      )
    };

    const allOrders = await Order.find({
      paymentStatus: { $in: ["success", "failed"] }
    });

    const normalizedOrders = allOrders.map(normalizeOrder);

    const totalRevenue = normalizedOrders.reduce(
      (sum, o) => sum + o.net,
      0
    );
    const monthlyRevenue = Array(12).fill(0);

    successfulOrders.forEach(order => {
      const month = new Date(order.createdAt).getMonth();
      const monthlyRevenue = Array(12).fill(0);

      normalizedOrders.forEach(order => {
        const month = new Date(order.createdAt).getMonth();
        monthlyRevenue[month] += order.net;
      });

    });

    const statusCounts = {
      Delivered: 0,
      Pending: 0,
      Cancelled: 0
    };


    allOrders.forEach(order => {
      if (order.orderStatus === "Delivered") {
        statusCounts.Delivered++;
      } else if (order.orderStatus === "Cancelled") {
        statusCounts.Cancelled++;
      } else {
        statusCounts.Pending++;
      }
    });

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      admin: req.session.user,
      totalUsers,
      totalOrders,
      grandTotal,
      totalRevenue,
      monthlyRevenue,
      statusCounts
    });

  } catch (error) {
    console.error("Dashboard Error:", error);
    res.redirect("/error");
  }
};


//revenue status
const getRevenueStats = async (req, res) => {
  try {
    const { filter } = req.query;

    let groupStage = {};
    let sortStage = {};

    if (filter === "yearly") {
      groupStage = {
        _id: { year: { $year: "$createdAt" } },
        revenue: { $sum: "$net" }
      };
      sortStage = { "_id.year": 1 };
    }

    if (filter === "monthly") {
      groupStage = {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        revenue: { $sum: "$net" }
      };
      sortStage = { "_id.year": 1, "_id.month": 1 };
    }

    if (filter === "weekly") {
      groupStage = {
        _id: { week: { $isoWeek: "$createdAt" } },
        revenue: { $sum: "$net" }
      };
      sortStage = { "_id.week": 1 };
    }

    const data = await Order.aggregate([
      {
        $match: {
          paymentStatus: { $in: ["success", "failed"] }
        }
      },

      {
        $addFields: {
          debit: {
            $cond: [
              {
                $and: [
                  { $eq: ["$paymentStatus", "success"] },
                  { $not: [{ $in: ["$orderStatus", ["Cancelled", "Returned", "Return Approved"]] }] }
                ]
              },
              "$totalPrice",
              0
            ]
          },

          credit: {
            $cond: [
              { $in: ["$orderStatus", ["Cancelled", "Returned", "Return Approved"]] },
              { $ifNull: ["$refundAmount", "$totalPrice"] },
              0
            ]
          }
        }
      },

      {
        $addFields: {
          net: { $subtract: ["$debit", "$credit"] }
        }
      },

      { $group: groupStage },
      { $sort: sortStage }
    ]);

    res.json({ success: true, data });

  } catch (err) {
    res.status(STATUS.SERVER_ERROR).json({ success: false });
  }
};


const getBestSellingCategories = async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $match: { paymentStatus: "success", orderStatus: { $ne: "Cancelled" } } },

      { $unwind: "$items" },

      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },

      {
        $lookup: {
          from: "categories",
          localField: "product.category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },

      {
        $group: {
          _id: "$category._id",
          categoryName: { $first: "$category.categoryName" },
          totalSold: { $sum: "$items.quantity" }
        }
      },

      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    res.json(data);
  } catch (err) {
    res.status(STATUS.SERVER_ERROR).json({ success: false });
  }
};


const getBestSellingBrands = async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $match: { paymentStatus: "success", orderStatus: { $ne: "Cancelled" } } },

      { $unwind: "$items" },

      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product"
        }
      },
      { $unwind: "$product" },

      {
        $group: {
          _id: "$product.brand",
          totalSold: { $sum: "$items.quantity" }
        }
      },

      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    res.json(data);
  } catch (err) {
    res.status(STATUS.SERVER_ERROR).json({ success: false });
  }
};

const getBestSellingProducts = async (req, res) => {
  try {
    const data = await Order.aggregate([
      { $match: { paymentStatus: "success", orderStatus: { $ne: "Cancelled" } } },

      { $unwind: "$items" },

      {
        $group: {
          _id: "$items.productId",
          productName: { $first: "$items.productName" },
          totalSold: { $sum: "$items.quantity" }
        }
      },

      { $sort: { totalSold: -1 } },

      { $limit: 10 }
    ]);

    res.json(data);
  } catch (err) {
    res.status(STATUS.SERVER_ERROR).json({ success: false });
  }
};

const getLedger = async (req, res) => {
  const orders = await Order.find({
    paymentStatus: { $in: ["success", "failed"] }
  }).sort({ createdAt: 1 });

  const ledger = orders.map(o => {
    const normalized = normalizeOrder(o);

    return {
      date: o.createdAt,
      orderID: o.orderID,
      debit: normalized.debit,
      credit: normalized.credit,
      net: normalized.net
    };
  });

  res.render("admin/ledger", { ledger });
};

export {
  getAdminDashboard,
  getRevenueStats,

  getBestSellingCategories,
  getBestSellingBrands,
  getBestSellingProducts,

  getLedger
};
