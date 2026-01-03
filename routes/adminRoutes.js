import express from "express";
import {
  getAdminLoginPage,
  adminLogin,
  getAllUsers,
  toggleUserStatus,
  adminLogout,
  getAdminForgotPassword,
  postAdminForgotPassword,
  getAdminForgotOtpPage,
  verifyAdminForgotOtp,
  resendAdminForgotOtp,
  getAdminResetPasswordPage,
  resetAdminPassword,
} from "../controllers/admin/adminController.js";

import {
  getCategories,
  addCategory,
  editCategory,
  deleteCategory,
  toggleCategory,
  getEditCategoryPage,
  getAddCategoryPage,
} from "../controllers/admin/categoryController.js";

import {
  showAllProducts,
  updateProduct,
  deleteProduct,
  toggleBlockProduct,
  toggleListProduct,
  getAddProductPage,
  getEditProductPage,
  addProduct,
} from "../controllers/admin/productController.js";

import {
  uploadSingleImage,
  processCategoryImage,
  uploadProductImages,
  processProductImages,
  processProductImagesForEdit,
} from "../utils/imageHelper.js";
import { validateProduct } from "../middlewares/categoryProductMiddleware.js";
import { isAdmin, setCurrentPath } from "../middlewares/isAdmin.js";
import {
  adminCancelOrder,
  approveReturn,
  approveReturnRequest,
  getOrdersPage,
  getReturnRequests,
  getSingleReturnRequest,
  rejectReturnRequest,
  updateOrderStatus,
  viewSingleOrder
} from "../controllers/admin/orderController.js";
import {
  createCoupon,
  deleteCoupon,
  getCouponListPage,
  updateCoupon
} from "../controllers/admin/couponController.js";
import {
  downloadSalesReportExcel,
  downloadSalesReportPDF,
  getSalesReport
} from "../controllers/admin/reportController.js";
import {
  getAdminDashboard,
  getBestSellingBrands,
  getBestSellingCategories,
  getBestSellingProducts,
  getLedger,
  getRevenueStats
} from "../controllers/admin/dashboardController.js";

const router = express.Router();

// Admin Authentication (Login & Forgot Password)
router.get("/login", getAdminLoginPage);
router.post("/login", adminLogin);
router.get("/logout", adminLogout);

// Forgot Password Flow
router.get("/forgot-password", getAdminForgotPassword);
router.post("/forgot-password", postAdminForgotPassword);
router.get("/verify-forgot-otp", getAdminForgotOtpPage);
router.post("/verify-forgot-otp", verifyAdminForgotOtp);
router.get("/resend-forgot-otp", resendAdminForgotOtp);
router.get("/reset-password", getAdminResetPasswordPage);
router.post("/reset-password", resetAdminPassword);

router.use(isAdmin);
router.use(setCurrentPath);

// Dashboard
router.get("/dashboard", getAdminDashboard);
router.get("/revenue-stats", getRevenueStats);
router.get("/best-selling-products", getBestSellingProducts);
router.get("/best-selling-categories", getBestSellingCategories);
router.get("/best-selling-brands", getBestSellingBrands);
router.get("/ledger", getLedger);

// Users
router.get("/users", getAllUsers);
router.get("/user/:id/toggle", toggleUserStatus);

// Categories
router.get("/categories", getCategories);
router.get("/categories/add", getAddCategoryPage);
router.post("/categories/add", uploadSingleImage, processCategoryImage, addCategory);
router.get("/categories/edit/:id", getEditCategoryPage);
router.post("/categories/edit/:id", uploadSingleImage, processCategoryImage, editCategory);
router.delete("/categories/delete/:id", deleteCategory);
router.post("/categories/toggle/:id", toggleCategory);

// Products
router.get("/products", showAllProducts);
router.get("/products/add", getAddProductPage);
router.post("/products/add", uploadProductImages, processProductImages, validateProduct, addProduct);
router.get("/products/edit/:id", getEditProductPage);
router.post("/products/edit/:id", uploadProductImages, processProductImagesForEdit, validateProduct, updateProduct);
router.get("/products/delete/:id", deleteProduct);
router.get("/products/:id/toggle-block", toggleBlockProduct);
router.get("/products/:id/toggle-list", toggleListProduct);

// Orders
router.get("/orders", getOrdersPage);
router.get("/orders/:id", viewSingleOrder);
router.post("/orders/update-status/:id", updateOrderStatus);
router.get("/orders/cancel/:id", adminCancelOrder);
router.post("/orders/approve-return/:id", approveReturn);

//Return
router.get("/return-requests", getReturnRequests);
router.get("/return-requests/:orderID", getSingleReturnRequest);
router.post("/return-requests/approve/:orderID", approveReturnRequest);
router.post("/return-requests/reject/:orderID", rejectReturnRequest);

//coupon
router.get("/coupons", getCouponListPage);
router.post("/coupons/create", createCoupon);
router.put("/coupons/update/:id", updateCoupon);
router.delete("/coupons/delete/:id", deleteCoupon);

// Sales Report 
router.get("/salesReport", getSalesReport);
router.get("/salesReport/download/pdf", downloadSalesReportPDF);
router.get("/salesReport/download/excel", downloadSalesReportExcel);

export default router;