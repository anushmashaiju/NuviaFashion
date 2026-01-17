const MESSAGES = {
    SERVER_ERROR: "Something went wrong.",
    NOT_FOUND: "Resource not found.",
    INVALID_INPUT: "Invalid input provided.",
    EMAIL_ALREADY_IN_USE: "Email already in use",
    OTP_INVALID: "Invalid OTP",
    OTP_SEND: "New OTP send",
    PROFILE_UPDATED_SUCCESS: "Profile updated successfully",
    LOGIN_REQUIRED: "Please login to continue.",
    UNAUTHORIZED: "You are not authorized to perform this action.",
    ACCOUNT_BLOCKED: "Your account has been blocked. Contact support.",
    USER_NOT_LOGGED_IN: "User not logged in",
    ADMIN_NOT_FOUND: "Admin not found",

    NAME_INVALID: "Enter a valid name.",
    EMAIL_REQUIRED: "Email is required.",
    USER_ALREADY_EXISTS: "User already exists.",
    MOBILE_INVALID: "Enter a valid 10-digit mobile number.",
    PASSWORD_WEAK:"Password must contain uppercase, lowercase, number and special character.",
    REFERRAL_INVALID_OR_EXPIRED: "Invalid or expired referral code.",

    OTP_SEND_SUCCESS: "OTP sent to your email.",
    OTP_SEND_FAILED: "Failed to send OTP. Try again.",
    SESSION_EXPIRED_SIGNUP: "Session expired. Please sign up again.",
    OTP_RESEND_FAILED: "Failed to resend OTP. Try again.",
    OTP_RESEND_SUCCESS: "A new OTP has been sent to your email.",

    EMAIL_NOT_VERIFIED: "Please verify your account first.",
    INCORRECT_PASSWORD: "Incorrect password.",
    LOGIN_FAILED: "Something went wrong. Please try again.",

    EMAIL_INVALID: "Email address is invalid.",
    USER_NOT_FOUND_EMAIL: "No user found with this email.",
    FORGOT_OTP_SENT: "OTP sent to your email.",
    FORGOT_SESSION_EXPIRED: "Session expired. Try again.",

    PASSWORD_REQUIRED: "Password is required.",
    CONFIRM_PASSWORD_REQUIRED_RESET: "Please confirm your password.",
    PASSWORD_RESET_FAILED: "Something went wrong. Try again.",

    CURRENT_PASSWORD_REQUIRED: "Current password is required.",
    NEW_PASSWORD_REQUIRED: "New password is required.",
    CONFIRM_PASSWORD_REQUIRED: "Please confirm the password.",

    GOOGLE_ACCOUNT_PASSWORD_CHANGE_NOT_ALLOWED: "You cannot change the password for Google login accounts.",
    CURRENT_PASSWORD_INCORRECT: "Current password is incorrect.",
    PASSWORD_MISMATCH: "Passwords do not match.",
    PASSWORD_CHANGED_SUCCESS: "Password changed successfully!",

    CATEGORY_NOT_FOUND: "Category not found.",
    CATEGORY_EXISTS: "Oops! Category already exists.",
    CATEGORY_ADDED: "Category added successfully.",
    CATEGORY_UPDATED: "Category updated successfully.",
    CATEGORY_DELETED: "Category soft deleted.",
    CATEGORY_NAME_REQUIRED: "Category name is required.",
    CATEGORY_DESCRIPTION_SHORT: "Description must be at least 10 characters long.",
    CATEGORY_OFFER_INVALID: "Offer must be between 0% and 100%.",
    CATEGORY_THUMBNAIL_REQUIRED: "Thumbnail image is required.",
    CATEGORY_OFFER_NOT_FOUND: "No offer found for this category.",

    PRODUCT_NOT_FOUND: "Product not found.",
    PRODUCT_ADDED: "Product added successfully.",
    PRODUCT_UPDATED: "Product updated successfully.",
    PRODUCT_DELETED: "Product deleted successfully.",
    PRODUCT_BLOCKED: "Product has been blocked.",
    PRODUCT_UNBLOCKED: "Product has been unblocked.",
    PRODUCT_LISTED: "Product is now listed.",
    PRODUCT_UNLISTED: "Product is now unlisted.",
    PRODUCT_CANCELLED_SUCCESS: "Product cancelled successfully",
    PRODUCT_NOT_IN_ORDER: "Product not found in order",
    PRODUCT_OUT_OF_STOCK: "This product is out of stock",
    PRODUCT_UNAVAILABLE: "Product unavailable",
    PRODUCT_ALREADY_CANCELLED: "Item already cancelled.",
    PRODUCT_ALREADY_RETURNED: "Returned items cannot be cancelled.",

    VARIANT_NOT_FOUND: "Selected variant does not exist",
    VARIANT_OUT_OF_STOCK: "This variant is out of stock",

    ORDER_NOT_FOUND: "Order not found.",
    ORDER_PLACED: "Order placed successfully.",
    ORDER_CANCELLED: "Order cancelled successfully.",
    ORDER_RETURNED: "Order returned successfully.",
    ORDER_ALREADY_CANCELLED: "Order is already cancelled",
    ORDER_PLACED_SUCCESS: "Order placed successfully",
    ORDER_SEARCH_FAILED: "Failed to search orders.",

    INVALID_NAME: "Enter a valid full name (min 3 characters).",
    INVALID_PHONE: "Invalid mobile number! Must be 10 digits.",
    INVALID_ADDRESS_LINE: "Address Line must have at least 5 characters.",
    INVALID_AREA: "Area must have at least 3 characters.",
    INVALID_STATE: "State must have at least 3 characters.",
    INVALID_PINCODE: "Invalid Pincode! Must be exactly 6 digits.",
    ADDRESS_ADD_FAILED: "Failed to add address.",
    ADDRESS_UPDATE_FAILED: "Failed to update address.",
    ADDRESS_DELETE_FAILED: "Failed to delete address.",
    ADDRESS_NOT_FOUND: "Address not found.",
    ADDRESS_REQUIRED: "Address required",

    CART_EMPTY: "Your cart is empty",
    CART_NOT_FOUND: "Cart not found.",
    ITEM_REMOVED_FROM_CART: "Item removed from cart.",
    CART_UPDATED: "Cart updated.",
    ADDED_TO_CART: "Added to cart.",
    CART_ITEM_PRICE_MISSING: "Cart item price missing.",
    REMOVE_INVALID_CART_ITEMS: "Remove unavailable items before checkout",

    MAX_QUANTITY_REACHED: "Maximum quantity reached.",
    
    OUT_OF_STOCK_OR_LIMIT: "Out of stock or maximum limit reached.",

    BUY_NOW_ERROR: "Something went wrong while trying to buy now.",
    BUY_NOW_SESSION_EXPIRED: "Buy Now session expired.",

    ADD_ADDRESS_BEFORE_CHECKOUT: "Please add a delivery address before checkout.",
    NO_ITEMS_TO_CHECKOUT: "No valid items to checkout.",
    CHECKOUT_ERROR: "Something went wrong during checkout.",
    INVALID_ACTION: "Invalid action.",

    ALREADY_IN_WISHLIST: "Already in Wishlist",
    REMOVED_FROM_WISHLIST: "Removed from wishlist",

    CHECKOUT_SESSION_EXPIRED: "Checkout session expired.",
    INSUFFICIENT_WALLET_BALANCE: "Insufficient wallet balance.",
    ORDER_ITEMS_MISSING: "Order items missing.",
    PAYMENT_FAILED_ORDER_NOT_FOUND: "Payment failed, but order not found.",

    RETURN_REASON_REQUIRED: "Return reason is required",
    ONLY_DELIVERED_CAN_RETURN: "Only delivered orders can be returned",
    RETURN_REQUEST_SUCCESS: "Return request submitted successfully.",
    ITEM_RETURN_REQUEST_SUCCESS: "Item return request submitted successfully.",
    INVALID_ITEM: "Invalid item.",
    INVALID_ORDER: "Invalid order.",
    COUPON_RESTRICTION: "This action is not allowed because the remaining order value does not meet the coupon minimum requirement.",
    
    STOCK_LIMIT_EXCEEDED: (productName, qty) => `Only ${qty} quantity available for ${productName}`,
    COUPON_MINIMUM_NOT_MET: (remaining, minimum) =>
        `This item cannot be cancelled because the remaining order value (₹${remaining.toFixed(2)}) is below the minimum purchase amount (₹${minimum}) required for the applied coupon.`,
    COUPON_MINIMUM_NOT_MET_FOR_RETURN: (remaining, minimum) =>
        `This item cannot be returned individually because a coupon is applied and the remaining order value (₹${remaining.toFixed(2)}) does not meet the minimum purchase amount (₹${minimum}).`,
    COUPON_ITEM_RETURN_NOT_ALLOWED:
        "This item cannot be returned individually because a coupon is applied. Please return the full order.",
COUPON_ITEM_CANCEL_NOT_ALLOWED:
  "You cannot cancel the last item when a coupon is applied.",
    COUPON_EXPIRED: "Coupon expired.",
    COUPON_MIN_PURCHASE_NOT_MET: "Minimum purchase amount not met.",
    COUPON_FIRST_ORDER_ONLY: "Coupon valid only for first order.",
    COUPON_ALREADY_USED: "Coupon already used.",
    COUPON_APPLIED_SUCCESS: "Coupon applied successfully.",

    WALLET_UPDATED_SUCCESS: "Wallet balance updated successfully.",
    NO_WALLET_BALANCE: "No wallet balance available.",

    PDF_GENERATION_ERROR: "PDF generation error.",
    PDF_DOWNLOAD_FAILED: "PDF download failed.",
    EXCEL_DOWNLOAD_FAILED: "Excel download failed.",

};

export default MESSAGES;
