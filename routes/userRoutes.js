import express from "express";

import {
  getWelcomePage,
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
  getReferralPage,
  
} from "../controllers/user/userController.js";

import {
  getCategoryOffer,
  getHomePage,
  getMaxOfferProductByCategory,
  getProductDetailsPage,
  getUserProductListPage,
} from "../controllers/user/productController.js";

import {
  getWishlist,
  removeFromWishlist,
  toggleWishlist,
} from "../controllers/user/wishlistController.js";

import {
  addToCart,
  addToCartAjax,
  decrementQuantity,
  getCartPage,
  incrementQuantity,
  removeFromCart,
  updateQuantityAjax
} from "../controllers/user/cartController.js";

import { isUserAuthenticated, isGuest } from "../middlewares/authMiddleware.js";
import { cancelOrder, cancelProduct, downloadInvoice, getOrderDetail, listOrders, requestReturn, searchOrders } from "../controllers/user/orderController.js";
import { addAddress, deleteAddress, getAddressPage, getEditAddress, postEditAddress, setDefaultAddress } from "../controllers/user/addressController.js";
import { buyNow, checkoutPage, updateBuyNowQty } from "../controllers/user/checkoutController.js";
import { processProfileImage, uploadProfileImage } from "../utils/imageHelper.js";
import { changePasswordLogged, editUserProfile, getChangePasswordPage, getEditUserProfile, getUserProfile, resendEditEmailOtp, verifyEditProfileOtp } from "../controllers/user/loggedUserController.js";
import { createRazorpayOrder, getPaymentPage, orderSuccessPage, paymentFailedPage, placeCODOrder, placeOrder, recalculateCheckout, verifyPayment, walletPayment } from "../controllers/user/paymentController.js";
import { addMoneyToWallet, applyWallet,  getWalletBalance,  getWalletPage } from "../controllers/user/walletController.js";
import { applyCoupon, getAvailableCoupons, userCouponPage } from "../controllers/user/couponController.js";



const router = express.Router();

// WELCOME 
router.get("/", getWelcomePage);

// SIGNUP
router.get("/signup", isGuest, getSignupPage);
router.post("/signup", registerUser);
router.post("/verify-otp", verifyOtp);
router.get("/resend-otp", resendOtp);

// GOOGLE LOGIN 
router.get("/auth/google", googleLogin);
router.get("/auth/google/callback", googleCallback, googleRedirectSuccess);

// FORGOT PASSWORD
router.get("/forgot-password", isGuest, getForgotPasswordPage);
router.post("/forgot-password", sendForgotPasswordOtp);
router.post("/verify-forgot-otp", verifyForgotOtp);
router.get("/resend-forgot-otp", resendForgotOtp);
router.post("/reset-password", resetPassword);
router.get("/refer", isUserAuthenticated, getReferralPage);

// LOGIN 
router.get("/login", isGuest, getLoginPage);
router.post("/login", loginUser);
router.get("/logout", logoutUser);

// HOME
router.get("/home", isUserAuthenticated, getHomePage);
router.get("/max-offer-product/:categoryId", getMaxOfferProductByCategory);

//PRODUCTS 
router.get("/products", isUserAuthenticated, getUserProductListPage);
router.get("/product/:id", isUserAuthenticated, getProductDetailsPage);

// CATEGORY OFFER
router.get("/offers/category/:categoryId", getCategoryOffer);

//USER PROFILE
router.get("/userProfile", isUserAuthenticated, getUserProfile);
router.get("/user/edit-profile", isUserAuthenticated, getEditUserProfile);
router.post( "/user/edit-profile",isUserAuthenticated,uploadProfileImage,processProfileImage,editUserProfile);
router.post("/user/edit-profile/verify-otp", isUserAuthenticated, verifyEditProfileOtp);
router.get("/user/edit-profile/resend-otp", isUserAuthenticated, resendEditEmailOtp);

// ADDRESSES 
router.get("/user/addresses", isUserAuthenticated, getAddressPage);
router.post("/user/addresses", isUserAuthenticated, addAddress);
router.get("/user/addresses/edit/:id", isUserAuthenticated, getEditAddress);
router.post("/user/addresses/edit/:id", isUserAuthenticated, postEditAddress);
router.get("/user/addresses/set-default/:id", isUserAuthenticated, setDefaultAddress);
router.get("/user/addresses/delete/:id", isUserAuthenticated, deleteAddress);

// CHANGE PASSWORD 
router.get("/user/change-password", isUserAuthenticated, getChangePasswordPage);
router.post("/user/change-password", isUserAuthenticated, changePasswordLogged);

// WISHLIST
router.get("/wishlist", isUserAuthenticated, getWishlist);
router.post("/wishlist/add/:id", isUserAuthenticated, toggleWishlist); 
router.post("/wishlist/remove", isUserAuthenticated, removeFromWishlist);

// CART 
router.get("/cart", isUserAuthenticated, getCartPage);
router.post("/cart/add/:id", isUserAuthenticated, addToCart);
router.post("/cart/increment/:productId", isUserAuthenticated, incrementQuantity);
router.post("/cart/decrement/:productId", isUserAuthenticated, decrementQuantity);
router.post("/cart/add-ajax/:id", isUserAuthenticated, addToCartAjax);
router.post("/cart/update-quantity", isUserAuthenticated, updateQuantityAjax);
router.post("/cart/remove", isUserAuthenticated, removeFromCart);

// BUY NOW 
router.get("/buy-now/:id", isUserAuthenticated, buyNow);
router.post("/buy-now/update-quantity", updateBuyNowQty);

// CHECKOUT 
router.get("/checkout", isUserAuthenticated, checkoutPage);
router.get("/order-success/:id", isUserAuthenticated, orderSuccessPage);
router.post("/checkout/cod", placeCODOrder);
router.post("/checkout/recalculate", recalculateCheckout);
router.post("/checkout/razorpay", createRazorpayOrder);
router.post("/checkout/wallet", walletPayment);
router.post("/payment/verify", verifyPayment);
router.get("/payment/failed/:id", paymentFailedPage);
router.get("/payment-gateway", isUserAuthenticated, getPaymentPage);
router.post("/payment-gateway/place-order", isUserAuthenticated, placeOrder);

// ORDERS
router.get("/order/list", isUserAuthenticated, listOrders);
router.get("/order/:id", isUserAuthenticated, getOrderDetail);
router.post("/order/:id/cancel", isUserAuthenticated, cancelOrder);
router.get("/order/search/:query", isUserAuthenticated, searchOrders);
router.get("/order/:id/invoice", isUserAuthenticated, downloadInvoice);
router.post("/order/:id/return", isUserAuthenticated, requestReturn);
router.post("/order/:id/cancel-product", isUserAuthenticated, cancelProduct);

// WALLET
router.get("/wallet", getWalletPage);
router.post("/wallet/add", addMoneyToWallet);
router.post("/wallet/apply", applyWallet);
router.get("/wallet/balance", getWalletBalance);

//COUPON
router.get("/coupon/available", isUserAuthenticated, getAvailableCoupons);
router.post("/coupon/apply", isUserAuthenticated, applyCoupon);
router.get("/coupons", isUserAuthenticated, userCouponPage);

export default router;
