import Order from "../../models/orderModel.js";
import pdf from "html-pdf";
import excelJS from "exceljs";
import ejs from "ejs";
import path from "path";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

const normalizeOrder = (order) => {
  let debit = 0;
  let credit = 0;

  if (order.paymentStatus === "success") {
    debit = order.totalPrice || 0;
  }

  const itemRefundTotal = (order.items || []).reduce(
    (sum, item) => sum + (item.refundAmount || 0),
    0
  );

  const orderRefund = order.refundAmount || 0;

  credit = Number(Math.max(itemRefundTotal, orderRefund).toFixed(2));

  return {
    ...order.toObject(),
    debit: Number(debit.toFixed(2)),
    credit,
    net: Number((debit - credit).toFixed(2))
  };
};

// GET SALES REPORT PAGE
const getSalesReport = async (req, res) => {
  try {
    const { filter, fromDate, toDate, page = 1 } = req.query;
    const limit = 50;

    const query = {
      paymentStatus: { $in: ["success", "failed"] }
    };

    if (filter === "daily") {
      query.createdAt = {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lte: new Date(new Date().setHours(23, 59, 59, 999)),
      };
    }

    if (filter === "weekly") {
      const now = new Date();
      const firstDay = new Date(now.setDate(now.getDate() - now.getDay()));
      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 6);
      query.createdAt = { $gte: firstDay, $lte: lastDay };
    }

    if (filter === "monthly") {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      query.createdAt = { $gte: firstDay, $lte: lastDay };
    }

    if (fromDate && toDate) {
      query.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)),
      };
    }

    const rawOrders = await Order.find(query)
      .populate("user_id", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const orders = rawOrders.map(normalizeOrder);

    const totalOrders = await Order.countDocuments(query);

    const summary = {
      totalOrderCount: totalOrders,

      subtotal: orders.reduce((a, o) => a + (o.subtotal || 0), 0),
      totalDiscount: orders.reduce((a, o) => a + (o.couponDiscount || 0), 0),
      totalTax: orders.reduce((a, o) => a + (o.tax || 0), 0),
      deliveryCharge: orders.reduce((a, o) => a + (o.deliveryCharge || 0), 0),

      totalDebit: orders.reduce((a, o) => a + o.debit, 0),
      totalCredit: orders.reduce((a, o) => a + o.credit, 0),

      netRevenue: orders.reduce((a, o) => a + o.net, 0),
      totalRefundedToWallet: orders.reduce((a, o) => a + (o.refundAmount || 0), 0)
    };

    const allRawOrders = await Order.find(query);
    const allOrders = allRawOrders.map(normalizeOrder);

    const grandTotal = {
      subtotal: allOrders.reduce((a, o) => a + (o.subtotal || 0), 0),
      totalDiscount: allOrders.reduce((a, o) => a + (o.couponDiscount || 0), 0),
      totalTax: allOrders.reduce((a, o) => a + (o.tax || 0), 0),
      deliveryCharge: allOrders.reduce((a, o) => a + (o.deliveryCharge || 0), 0),

      totalDebit: allOrders.reduce((a, o) => a + o.debit, 0),
      totalCredit: allOrders.reduce((a, o) => a + o.credit, 0),

      netRevenue: allOrders.reduce((a, o) => a + o.net, 0),
      totalRefundedToWallet: allOrders.reduce(
        (a, o) => a + (o.refundAmount || 0),
        0
      )
    };

    return res.status(STATUS.SUCCESS).render("admin/salesReport", {
      orders,
      summary,
      grandTotal,
      filters: req.query,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalOrders / limit),
      },
    });

  } catch (error) {
    console.error("Sales Report Error:", error);
    return res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

const downloadSalesReportPDF = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const query = { paymentStatus: { $in: ["success", "failed"] } };
    if (fromDate && toDate) {
      query.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999))
      };
    }

    const allRawOrders = await Order.find(query).populate("user_id", "name");
    const allOrders = allRawOrders.map(normalizeOrder);

    const grandTotal = {
      totalOrders: allOrders.length,
      subtotal: allOrders.reduce((a, o) => a + (o.subtotal || 0), 0),
      totalDiscount: allOrders.reduce((a, o) => a + (o.couponDiscount || 0), 0),
      totalTax: allOrders.reduce((a, o) => a + (o.tax || 0), 0),
      deliveryCharge: allOrders.reduce((a, o) => a + (o.deliveryCharge || 0), 0),
      totalDebit: allOrders.reduce((a, o) => a + o.debit, 0),
      totalCredit: allOrders.reduce((a, o) => a + o.credit, 0),
      netRevenue: allOrders.reduce((a, o) => a + o.net, 0),
      totalRefundedToWallet: allOrders.reduce((a, o) => a + (o.refundAmount || 0), 0)
    };

    const filePath = path.join(process.cwd(), "views", "admin", "pdfSalesReport.ejs");
    const html = await ejs.renderFile(filePath, { orders: allOrders, grandTotal });

    pdf.create(html, { format: "A4" }).toStream((err, stream) => {
      if (err) return res.status(STATUS.SERVER_ERROR).send(MESSAGES.PDF_GENERATION_ERROR);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=sales-report.pdf");
      stream.pipe(res);
    });

  } catch (error) {
    console.error(error);
    return res.status(STATUS.SERVER_ERROR).send(MESSAGES.PDF_DOWNLOAD_FAILED);
  }
};

// DOWNLOAD EXCEL
const downloadSalesReportExcel = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const query = {
      paymentStatus: { $in: ["success", "failed"] }
    };

    if (fromDate && toDate) {
      query.createdAt = {
        $gte: new Date(fromDate),
        $lte: new Date(new Date(toDate).setHours(23, 59, 59, 999))
      };
    }

    const rawOrders = await Order.find(query).populate("user_id", "name");
    const orders = rawOrders.map(normalizeOrder);

    const workbook = new excelJS.Workbook();
    const sheet = workbook.addWorksheet("Sales Report");

    sheet.columns = [
      { header: "Date", key: "date", width: 15 },
      { header: "Order ID", key: "orderId", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Debit", key: "debit", width: 15 },
      { header: "Credit", key: "credit", width: 15 },
      { header: "Net Revenue", key: "net", width: 18 },
      { header: "Status", key: "status", width: 18 }
    ];

    orders.forEach(order => {
      sheet.addRow({
        date: new Date(order.createdAt).toLocaleDateString(),
        orderId: order.orderID,
        customer: order.user_id?.name || "N/A",
        debit: Number(order.debit || 0).toFixed(2),
        credit: Number(order.credit || 0).toFixed(2),
        net: order.net.toFixed(2),
        status: order.orderStatus
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
    res.end();

  } catch (error) {
    console.error(error);
    return res.status(STATUS.SERVER_ERROR).send(MESSAGES.EXCEL_DOWNLOAD_FAILED);
  }
};

export {
  normalizeOrder,
  getSalesReport,
  downloadSalesReportPDF,
  downloadSalesReportExcel
};
