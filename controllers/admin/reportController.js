import Order from "../../models/orderModel.js";
import pdf from "html-pdf";
import excelJS from "exceljs";
import ejs from "ejs";
import path from "path";
import STATUS from "../../utils/statusCodes.js";

//  GET SALES REPORT PAGE
// GET SALES REPORT PAGE
export const getSalesReport = async (req, res) => {
  try {
    const { filter, fromDate, toDate, page = 1 } = req.query;
    const limit = 10;

    let query = {};

    // Filters
    if (filter === "daily") {
      query.createdAt = {
        $gte: new Date(new Date().setHours(0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59)),
      };
    } else if (filter === "weekly") {
      const now = new Date();
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      const lastDay = new Date(now.setDate(firstDay.getDate() + 6));
      query.createdAt = { $gte: firstDay, $lte: lastDay };
    } else if (filter === "monthly") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      query.createdAt = { $gte: firstDay, $lte: lastDay };
    }

    if (fromDate && toDate) {
      query.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59)),
      };
    }

    // Fetch current page orders
    const orders = await Order.find(query)
      .populate("user_id", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalOrders = await Order.countDocuments(query);

    // Page Totals (current page)
const summary = {
  totalOrderCount: totalOrders,
  totalAmount: orders.reduce((a, o) => a + o.totalPrice, 0),
  totalDiscount: orders.reduce(
    (a, o) => a + ((o.discount || 0) + (o.couponDiscount || 0)),
    0
  ),
  deliveryCharge: orders.reduce((a, o) => a + (o.deliveryCharge || 0), 0),
  finalAmount: orders.reduce(
    (a, o) =>
      a + (o.totalPrice - ((o.discount || 0) + (o.couponDiscount || 0)) + (o.deliveryCharge || 0)),
    0
  ),
};

// Grand Totals (all matching orders)
const allOrders = await Order.find(query);
const grandTotal = {
  totalAmount: allOrders.reduce((a, o) => a + o.totalPrice, 0),
  totalDiscount: allOrders.reduce(
    (a, o) => a + ((o.discount || 0) + (o.couponDiscount || 0)),
    0
  ),
  deliveryCharge: allOrders.reduce((a, o) => a + (o.deliveryCharge || 0), 0),
  finalAmount: allOrders.reduce(
    (a, o) =>
      a + (o.totalPrice - ((o.discount || 0) + (o.couponDiscount || 0)) + (o.deliveryCharge || 0)),
    0
  ),
};

    return res.status(STATUS.SUCCESS).render("admin/salesReport", {
      orders,
      summary,      // page totals
      grandTotal,   // full totals
      filters: req.query,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalOrders / limit),
      },
    });
  } catch (error) {
    console.error("Sales Report Error:", error);
    return res.status(STATUS.SERVER_ERROR).send("Internal Server Error");
  }
};

//  DOWNLOAD PDF 
export const downloadSalesReportPDF = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const query = {};
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59);
      query.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(query).populate("user_id", "name");

    // Grand Totals
    const grandTotal = {
      totalOrders: orders.length, // total order count
      totalAmount: orders.reduce((a, o) => a + o.totalPrice, 0),
      totalDiscount: orders.reduce((a, o) => a + ((o.discount || 0) + (o.couponDiscount || 0)), 0),
      deliveryCharge: orders.reduce((a, o) => a + (o.deliveryCharge || 0), 0),
      finalAmount: orders.reduce(
        (a, o) =>
          a + (o.totalPrice - ((o.discount || 0) + (o.couponDiscount || 0)) + (o.deliveryCharge || 0)),
        0
      ),
    };

    const filePath = path.join(
      process.cwd(),
      "views",
      "admin",
      "pdfSalesReport.ejs"
    );

    const html = await ejs.renderFile(filePath, { orders, grandTotal });

    const options = { format: "A4" };
    pdf.create(html, options).toStream((err, stream) => {
      if (err)
        return res
          .status(STATUS.SERVER_ERROR)
          .send("PDF Generation Error");

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=sales-report.pdf"
      );
      stream.pipe(res);
    });
  } catch (error) {
    console.error(error);
    return res.status(STATUS.SERVER_ERROR).send("PDF Download Failed");
  }
};

//  DOWNLOAD EXCEL
export const downloadSalesReportExcel = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const query = {};
    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59);
      query.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(query).populate("user_id", "name");

    const workbook = new excelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    sheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Total", key: "total", width: 15 },
      { header: "Discount", key: "discount", width: 15 },
      { header: "Delivery Charge", key: "deliveryCharge", width: 18 },
      { header: "Final Amount", key: "final", width: 18 },
    ];

    orders.forEach((order) => {
      const discount = (order.discount || 0) + (order.couponDiscount || 0);
      const deliveryCharge = order.deliveryCharge || 0;
      const finalAmount = order.totalPrice - discount + deliveryCharge;

      sheet.addRow({
        date: order.createdAt.toLocaleDateString(),
        orderId: order.orderID,
        customer: order.user_id?.name || "N/A",
        total: order.totalPrice.toFixed(2),
        discount: discount.toFixed(2),
        deliveryCharge: deliveryCharge.toFixed(2),
        final: finalAmount.toFixed(2),
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=sales-report.xlsx"
    );

    await workbook.xlsx.write(res);
    return res.status(STATUS.SUCCESS).end();
  } catch (error) {
    console.error(error);
    return res.status(STATUS.SERVER_ERROR).send("Excel Download Failed");
  }
};
