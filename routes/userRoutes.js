

import express from "express";

/*  MIDDLEWARES  */
import { isUserAuthenticated, isGuest } from "../middlewares/authMiddleware.js";
import { validateObjectId } from "../middlewares/errorHandler.js";

/*  USER CONTROLLERS  */
import {
  getWelcomePage, getSignupPage, registerUser, verifyOtp, resendOtp,
  getLoginPage, loginUser, logoutUser, googleLogin, googleCallback, googleRedirectSuccess,
  getForgotPasswordPage, sendForgotPasswordOtp, verifyForgotOtp, resendForgotOtp,
  resetPassword, getReferralPage
}
  from "../controllers/user/userController.js";

/*  PRODUCT CONTROLLERS  */
import {
  getCategoryOffer, getHomePage, getMaxOfferProductByCategory,
  getProductDetailsPage, getProductStatus, getUserProductListPage
}
  from "../controllers/user/productController.js";

/*  WISHLIST CONTROLLERS  */
import { addToWishlist, getWishlist, removeFromWishlist }
  from "../controllers/user/wishlistController.js";

/*  CART CONTROLLERS  */
import {
  addToCart, addToCartAjax, decrementQuantity, getCartPage,
  incrementQuantity, removeFromCart, validateCheckoutStock
}
  from "../controllers/user/cartController.js";

/*  ORDER CONTROLLERS  */
import {
  cancelOrder, cancelProduct, downloadInvoice, getOrderDetail,
  listOrders, requestItemReturn, requestReturn, searchOrders
}
  from "../controllers/user/orderController.js";

/*  ADDRESS CONTROLLERS  */
import {
  addAddress, deleteAddress, getAddressPage, getEditAddress,
  postEditAddress, setDefaultAddress
}
  from "../controllers/user/addressController.js";

/*  CHECKOUT / PAYMENT CONTROLLERS  */
import {
  buyNow, checkoutPage, recalculateCheckout, updateBuyNowQty,
  updateCartQuantityAjax
}
  from "../controllers/user/checkoutController.js";
import {
  createRazorpayOrder, getPaymentPage, orderSuccessPage,
  paymentFailedPage, placeCODOrder, placeOrder, verifyPayment, walletPayment
}
  from "../controllers/user/paymentController.js";

/*  LOGGED USER CONTROLLERS  */
import {
  changePasswordLogged, editUserProfile, getChangePasswordPage,
  getEditUserProfile, getUserProfile, resendEditEmailOtp, verifyEditProfileOtp
}
  from "../controllers/user/loggedUserController.js";

/*  WALLET CONTROLLERS  */
import { addMoneyToWallet, applyWallet, getWalletBalance, getWalletPage }
  from "../controllers/user/walletController.js";

/*  COUPON CONTROLLERS  */
import { applyCoupon, getAvailableCoupons, userCouponPage }
  from "../controllers/user/couponController.js";

/*  IMAGE HELPERS  */
import { processProfileImage, uploadProfileImage } from "../utils/imageHelper.js";

const router = express.Router();

/*  PUBLIC  */
router.get("/", getWelcomePage);
router.get("/home", getHomePage);
router.get("/products", getUserProductListPage);
router.get("/product/:id", validateObjectId("id"), getProductDetailsPage);
router.get("/offers/category/:categoryId", validateObjectId("categoryId"), getCategoryOffer);
router.get("/max-offer-product/:categoryId", validateObjectId("categoryId"), getMaxOfferProductByCategory);
router.get("/product/status/:id", validateObjectId("id"), getProductStatus);

/*  AUTH  */
router.get("/signup", isGuest, getSignupPage);
router.post("/signup", registerUser);
router.post("/verify-otp", verifyOtp);
router.get("/resend-otp", resendOtp);
router.get("/login", isGuest, getLoginPage);
router.post("/login", loginUser);
router.get("/logout", logoutUser);
router.get("/auth/google", googleLogin);
router.get("/auth/google/callback", googleCallback, googleRedirectSuccess);

/*  FORGOT PASSWORD  */
router.get("/forgot-password", isGuest, getForgotPasswordPage);
router.post("/forgot-password", sendForgotPasswordOtp);
router.post("/verify-forgot-otp", verifyForgotOtp);
router.get("/resend-forgot-otp", resendForgotOtp);
router.post("/reset-password", resetPassword);

/*  LOGGED-IN USER  */
router.get("/refer", isUserAuthenticated, getReferralPage);
router.get("/userProfile", isUserAuthenticated, getUserProfile);
router.get("/user/edit-profile", isUserAuthenticated, getEditUserProfile);
router.post("/user/edit-profile", isUserAuthenticated, uploadProfileImage, processProfileImage, editUserProfile);
router.post("/user/edit-profile/verify-otp", isUserAuthenticated, verifyEditProfileOtp);
router.get("/user/edit-profile/resend-otp", isUserAuthenticated, resendEditEmailOtp);
router.get("/user/change-password", isUserAuthenticated, getChangePasswordPage);
router.post("/user/change-password", isUserAuthenticated, changePasswordLogged);

/*  ADDRESS  */
router.get("/user/addresses", isUserAuthenticated, getAddressPage);
router.post("/user/addresses", isUserAuthenticated, addAddress);
router.get("/user/addresses/edit/:id", isUserAuthenticated, validateObjectId("id"), getEditAddress);
router.post("/user/addresses/edit/:id", isUserAuthenticated, validateObjectId("id"), postEditAddress);
router.get("/user/addresses/set-default/:id", isUserAuthenticated, validateObjectId("id"), setDefaultAddress);
router.get("/user/addresses/delete/:id", isUserAuthenticated, validateObjectId("id"), deleteAddress);

/*  WISHLIST  */
router.get("/wishlist", isUserAuthenticated, getWishlist);
router.post("/wishlist/add/:id", isUserAuthenticated, validateObjectId("id"), addToWishlist);
router.post("/wishlist/remove", isUserAuthenticated, removeFromWishlist);

/*  CART  */
router.get("/cart", isUserAuthenticated, getCartPage);
router.post("/cart/add/:id", isUserAuthenticated, validateObjectId("id"), addToCart);
router.post("/cart/increment/:productId", isUserAuthenticated, validateObjectId("productId"), incrementQuantity);
router.post("/cart/decrement/:productId", isUserAuthenticated, validateObjectId("productId"), decrementQuantity);
router.post("/cart/add-ajax/:id", isUserAuthenticated, validateObjectId("id"), addToCartAjax);
router.post("/cart/update-quantity", isUserAuthenticated, updateCartQuantityAjax);
router.post("/cart/remove", isUserAuthenticated, removeFromCart);

/*  BUY NOW  */
router.get("/buy-now/:id", isUserAuthenticated, validateObjectId("id"), buyNow);
router.post("/buy-now/update-quantity", isUserAuthenticated, updateBuyNowQty);

/*  CHECKOUT & PAYMENT  */
router.get("/checkout", isUserAuthenticated, checkoutPage);
router.post("/checkout/recalculate", isUserAuthenticated, recalculateCheckout);
router.post("/checkout/cod", isUserAuthenticated, placeCODOrder);
router.post("/checkout/razorpay", isUserAuthenticated, createRazorpayOrder);
router.post("/checkout/wallet", isUserAuthenticated, walletPayment);
router.post("/payment/verify", isUserAuthenticated, verifyPayment);
router.get("/payment/failed/:id", isUserAuthenticated, paymentFailedPage);
router.get("/order-success/:id", isUserAuthenticated, orderSuccessPage);
router.get("/payment-gateway", isUserAuthenticated, getPaymentPage);
router.post("/payment-gateway/place-order", isUserAuthenticated, placeOrder);
router.post("/checkout/validate-stock", isUserAuthenticated, validateCheckoutStock);

/*  ORDERS  */
router.get("/order/list", isUserAuthenticated, listOrders);
router.get("/order/search/:query", isUserAuthenticated, searchOrders);
router.get("/order/:orderID", isUserAuthenticated, getOrderDetail);
router.post("/order/:orderID/cancel", isUserAuthenticated, cancelOrder);
router.post("/order/:orderID/return", isUserAuthenticated, requestReturn);
router.post("/order/:orderID/return-item", isUserAuthenticated, requestItemReturn);
router.post("/order/:orderID/cancel-product", isUserAuthenticated, cancelProduct);
router.get("/order/:orderID/invoice", isUserAuthenticated, downloadInvoice);

/*  WALLET  */
router.get("/wallet", isUserAuthenticated, getWalletPage);
router.post("/wallet/add", isUserAuthenticated, addMoneyToWallet);
router.post("/wallet/apply", isUserAuthenticated, applyWallet);
router.get("/wallet/balance", isUserAuthenticated, getWalletBalance);

/*  COUPON  */
router.get("/coupon/available", isUserAuthenticated, getAvailableCoupons);
router.post("/coupon/apply", isUserAuthenticated, applyCoupon);
router.get("/coupons", isUserAuthenticated, userCouponPage);

export default router;
