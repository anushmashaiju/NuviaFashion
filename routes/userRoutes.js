import express from "express";
import {
  getWelcomePage,
  getHomePage,
  getSignupPage,
  registerUser,
  verifyOtp,
  resendOtp,
  getLoginPage,
  loginUser,
  logoutUser,
  googleLogin,
  googleCallback,
  googleRedirectSuccess,
  getForgotPasswordPage,
  sendForgotPasswordOtp,
  verifyForgotOtp,
  resendForgotOtp,
  resetPassword,

} from "../controllers/user/userController.js";
import { addProductReview, addToCart, buyNow, getProductDetailsPage, getUserProductListPage } from "../controllers/user/userProductController.js";
import { isUserAuthenticated, isGuest } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 🏠 Welcome Page
router.get("/", getWelcomePage);

// 📝 Signup + OTP
router.get("/signup", isGuest, getSignupPage);
router.post("/signup", registerUser);
router.post("/verify-otp", verifyOtp);
router.get("/resend-otp", resendOtp);

// 🔑 Login / Logout
router.get("/userLogin", isGuest, getLoginPage);
router.post("/userLogin", loginUser);
router.get("/logout", logoutUser);

// 🏡 Home Page (Protected)
router.get("/home", isUserAuthenticated, getHomePage);

// 🛍 Products (Protected)
router.get("/products", isUserAuthenticated, getUserProductListPage);
router.get("/product/:id", isUserAuthenticated, getProductDetailsPage);

// 🌐 Google Auth
router.get("/auth/google", googleLogin);
router.get("/auth/google/callback", googleCallback, googleRedirectSuccess);

// 🔐 Forgot Password
router.get("/forgot-password", isGuest, getForgotPasswordPage);
router.post("/forgot-password", sendForgotPasswordOtp);
router.post("/verify-forgot-otp", verifyForgotOtp);
router.get('/resend-forgot-otp', resendForgotOtp);
router.post("/reset-password", resetPassword);

// 🛒 Add to Cart
router.get("/add-to-cart/:id", isUserAuthenticated, addToCart);

// 💳 Buy Now
router.get("/checkout/:id", isUserAuthenticated, buyNow);

router.post("/product/:id/review", isUserAuthenticated, addProductReview);


export default router;
