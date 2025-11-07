import express from "express";
import { isAdmin } from "../middlewares/isAdmin.js";

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
  renderAddCategoryPage,
  addCategory,
  renderEditCategoryPage,
  editCategory,
  deleteCategory,
  toggleCategory,
} from "../controllers/admin/categoryController.js";

import {
  showAllProducts,
  renderAddProductPage,
  addProduct,
  renderEditProductPage,
  updateProduct,
  deleteProduct,
  toggleBlockProduct,
  toggleListProduct,
} from "../controllers/admin/productController.js";

import {
  uploadSingleImage,
  processCategoryImage,
  uploadProductImages,
  processProductImages,
  processProductImagesForEdit,
} from "../utils/imageHelper.js";

const router = express.Router();

// Admin Authentication
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

// Dashboard
router.get("/dashboard", isAdmin, getAdminDashboard);

// Users
router.get("/users", isAdmin, getAllUsers);
router.get("/user/:id/toggle", isAdmin, toggleUserStatus);


// Categories
router.get("/categories", isAdmin, getCategories);
router.get("/categories/add", isAdmin, renderAddCategoryPage);
router.post("/categories/add", isAdmin, uploadSingleImage, processCategoryImage, addCategory);
router.get("/categories/edit/:id", isAdmin, renderEditCategoryPage);
router.post("/categories/edit/:id", isAdmin, uploadSingleImage, processCategoryImage, editCategory);
router.get("/categories/delete/:id", isAdmin, deleteCategory);
router.post("/categories/toggle/:id", isAdmin, toggleCategory);

// Products
router.get("/products", isAdmin, showAllProducts);
router.get("/products/add", isAdmin, renderAddProductPage);
router.post("/products/add", isAdmin, uploadProductImages, processProductImages, addProduct);
router.get("/products/edit/:id", isAdmin, renderEditProductPage);
router.post("/products/edit/:id", isAdmin, uploadProductImages, processProductImagesForEdit, updateProduct);
router.get("/products/delete/:id", isAdmin, deleteProduct);
router.get("/products/:id/toggle-block", isAdmin, toggleBlockProduct);
router.get("/products/:id/toggle-list", isAdmin, toggleListProduct);

export default router;
