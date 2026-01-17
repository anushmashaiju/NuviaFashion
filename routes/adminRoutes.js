import express from "express";
import { isAdmin, setCurrentPath } from "../middlewares/isAdmin.js";
import { validateProduct } from "../middlewares/categoryProductMiddleware.js";

import {
  uploadSingleImage, processCategoryImage, uploadProductImages,
  processProductImages, processProductImagesForEdit
}
  from "../utils/imageHelper.js";
import {
  getAdminLoginPage, adminLogin, adminLogout, getAdminForgotPassword,
  postAdminForgotPassword, getAdminForgotOtpPage, verifyAdminForgotOtp, resendAdminForgotOtp,
  getAdminResetPasswordPage, resetAdminPassword, getAllUsers, toggleUserStatus
}
  from "../controllers/admin/adminController.js";
import {
  getCategories, getAddCategoryPage, getEditCategoryPage,
  addCategory, editCategory, deleteCategory, toggleCategory
}
  from "../controllers/admin/categoryController.js";
import {
  showAllProducts, getAddProductPage, getEditProductPage,
  addProduct, updateProduct, deleteProduct, blockProduct
}
  from "../controllers/admin/productController.js";
import {
  getOrdersPage, viewSingleOrder, updateOrderStatus, adminCancelOrder,
  getReturnRequests, getSingleReturnRequest, approveReturnRequest,
  rejectReturnRequest, approveItemReturn
}
  from "../controllers/admin/orderController.js";
import { getCouponListPage, createCoupon, updateCoupon, deleteCoupon }
  from "../controllers/admin/couponController.js";
import { getSalesReport, downloadSalesReportPDF, downloadSalesReportExcel }
  from "../controllers/admin/reportController.js";
import {
  getAdminDashboard, getRevenueStats, getBestSellingProducts,
  getBestSellingCategories, getBestSellingBrands, getLedger
}
  from "../controllers/admin/dashboardController.js";
import { validateObjectId } from "../middlewares/errorHandler.js";

const router = express.Router();

/* PUBLIC AUTH */
router.get("/login", getAdminLoginPage); 
router.post("/login", adminLogin); 
router.get("/logout", adminLogout);
router.get("/forgot-password", getAdminForgotPassword); 
router.post("/forgot-password", postAdminForgotPassword);
router.get("/verify-forgot-otp", getAdminForgotOtpPage);
 router.post("/verify-forgot-otp", verifyAdminForgotOtp);
router.get("/resend-forgot-otp", resendAdminForgotOtp); 
router.get("/reset-password", getAdminResetPasswordPage); 
router.post("/reset-password", resetAdminPassword);

/* PROTECTED ROUTES */
router.use(isAdmin); 
router.use(setCurrentPath);

/* DASHBOARD */
router.get("/dashboard", getAdminDashboard);
 router.get("/revenue-stats", getRevenueStats);
router.get("/best-selling-products", getBestSellingProducts); 
router.get("/best-selling-categories", getBestSellingCategories); 
router.get("/best-selling-brands", getBestSellingBrands);
 router.get("/ledger", getLedger);

/* USERS */
router.get("/users", getAllUsers); 
router.get("/user/:id/toggle", validateObjectId("id"), toggleUserStatus);

/* CATEGORIES */
router.get("/categories", getCategories); 
router.get("/categories/add", getAddCategoryPage);
router.post("/categories/add", uploadSingleImage, processCategoryImage, addCategory);
router.get("/categories/edit/:id", validateObjectId("id"), getEditCategoryPage);
router.post("/categories/edit/:id", validateObjectId("id"), uploadSingleImage, processCategoryImage, editCategory);
router.delete("/categories/delete/:id", validateObjectId("id"), deleteCategory);
router.post("/categories/toggle/:id", validateObjectId("id"), toggleCategory);

/* PRODUCTS */
router.get("/products", showAllProducts); 
router.get("/products/add", getAddProductPage);
router.post("/products/add", uploadProductImages, processProductImages, validateProduct, addProduct);
router.get("/products/edit/:id", validateObjectId("id"), getEditProductPage);
router.post("/products/edit/:id", validateObjectId("id"), uploadProductImages, processProductImagesForEdit, validateProduct, updateProduct);
router.get("/products/delete/:id", validateObjectId("id"), deleteProduct);
router.get("/products/:id/toggle-block", validateObjectId("id"), blockProduct);

/* ORDERS */
router.get("/orders", getOrdersPage); 
router.get("/orders/:id", validateObjectId("id"), viewSingleOrder);
router.post("/orders/update-status/:id", validateObjectId("id"), updateOrderStatus);
router.get("/orders/cancel/:id", validateObjectId("id"), adminCancelOrder);
//router.post("/orders/approve-return/:id", validateObjectId("id"), approveReturn);

/* RETURNS */
router.get("/return-requests", getReturnRequests);
router.get("/return-requests/:orderID", getSingleReturnRequest);
router.post("/return-requests/approve/:orderID", approveReturnRequest);
router.post("/return-requests/reject/:orderID", rejectReturnRequest);
router.post("/return-requests/approve-item/:orderID/:productId", validateObjectId("productId"), approveItemReturn);

/* COUPONS */
router.get("/coupons", getCouponListPage);
 router.post("/coupons/create", createCoupon);
router.put("/coupons/update/:id", validateObjectId("id"), updateCoupon);
router.delete("/coupons/delete/:id", validateObjectId("id"), deleteCoupon);

/* SALES REPORT */
router.get("/salesReport", getSalesReport);
router.get("/salesReport/download/pdf", downloadSalesReportPDF);
router.get("/salesReport/download/excel", downloadSalesReportExcel);

export default router;
