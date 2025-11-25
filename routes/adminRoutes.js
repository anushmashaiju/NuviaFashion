import express from "express";


import {
  getAdminLoginPage,
  adminLogin,
  getAdminDashboard,
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
  addProduct,
  updateProduct,
  deleteProduct,
  toggleBlockProduct,
  toggleListProduct,
  getAddProductPage,
  getEditProductPage,
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
import { adminCancelOrder,getOrdersPage, updateOrderStatus, viewSingleOrder } from "../controllers/admin/orderController.js";

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



export default router;