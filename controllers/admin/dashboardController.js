import User from "../../models/userModel.js";
import Order from "../../models/orderModel.js";
import STATUS from "../../utils/statusCodes.js";


// Get admin dashboard
export const getAdminDashboard = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({
      role: "user",
      isDeleted: false
    });

    const orderQuery = {
      paymentStatus: "success",
      orderStatus: { $ne: "Cancelled" }
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

    const totalRevenue = grandTotal.finalAmount;

    const monthlyRevenue = Array(12).fill(0);

    successfulOrders.forEach(order => {
      const month = new Date(order.createdAt).getMonth();
      monthlyRevenue[month] += order.totalPrice;
    });

    const statusCounts = {
      Delivered: 0,
      Pending: 0,
      Cancelled: 0
    };

    const allOrders = await Order.find({});

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
export const getRevenueStats = async (req, res) => {
  try {
    const { filter } = req.query;

    let groupStage = {};
    let sortStage = {};

    if (filter === "yearly") {
      groupStage = {
        _id: { year: { $year: "$createdAt" } },
        revenue: { $sum: "$netRevenue" }
      };
      sortStage = { "_id.year": 1 };
    }

    if (filter === "monthly") {
      groupStage = {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        revenue: { $sum: "$netRevenue" }
      };
      sortStage = { "_id.year": 1, "_id.month": 1 };
    }

    if (filter === "weekly") {
      groupStage = {
        _id: { week: { $isoWeek: "$createdAt" } },

        revenue: { $sum: "$netRevenue" }
      };
      sortStage = { "_id.week": 1 };
    }

    const data = await Order.aggregate([
     { $match: { paymentStatus: "success", orderStatus: { $ne: "Cancelled" } } },

      {
        $addFields: {
          netRevenue: {
            $subtract: [
              "$totalPrice",
              { $add: ["$couponDiscount", "$walletUsed"] }
            ]
          }
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

export const getBestSellingCategories = async (req, res) => {
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


export const getBestSellingBrands = async (req, res) => {
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

export const getBestSellingProducts = async (req, res) => {
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

export const getLedger = async (req, res) => {
  const orders = await Order.find({ paymentStatus: "success" })
    .sort({ createdAt: 1 });

  const ledger = orders.map(o => {
    const itemDiscount = o.items.reduce(
      (sum, i) => sum + (i.discount || 0),
      0
    );

    return {
      date: o.createdAt,
      orderID: o.orderID,
      credit: o.totalPrice,
      debit: itemDiscount + (o.couponDiscount || 0),
      net: o.totalPrice
    };
  });

  res.render("admin/ledger", { ledger });
};
