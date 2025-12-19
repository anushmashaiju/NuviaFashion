import Coupon from "../../models/couponModel.js";
import Cart from "../../models/cartModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

// GET AVAILABLE COUPONS
export const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    const summary = req.session.orderSummary;

    if (!userId || !summary)
      return res.json({ coupons: [] });

    const coupons = await Coupon.find({
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: summary.subtotal },
      usedBy: { $ne: userId },
      isList: true
    });

    res.json({ coupons });

  } catch (err) {
    console.error(err);
    res.json({ coupons: [] });
  }
};

// APPLY COUPON
export const applyCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;
    const summary = req.session.orderSummary;

    if (!summary) 
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.INVALID_INPUT });

    const coupon = await Coupon.findById(couponId);
    if (!coupon) 
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.CATEGORY_OFFER_NOT_FOUND });

    if (summary.subtotal < coupon.minimumPrice) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: `Minimum purchase ₹${coupon.minimumPrice} required`
      });
    }

    // Apply coupon only if valid
    summary.couponDiscount = coupon.offerPrice || 0;
    summary.appliedCouponId = couponId;

    req.session.orderSummary = summary;
    await req.session.save();

    await Coupon.findByIdAndUpdate(couponId, { $addToSet: { usedBy: req.session.user._id } });

    return res.status(STATUS.SUCCESS).json({ success: true, summary });

  } catch (err) {
    console.error("Coupon apply error:", err);
    return res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};


// PAYMENT PAGE
export const paymentPage = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) return res.status(STATUS.NOT_FOUND).redirect("/cart");

    const subtotal = cart.items.reduce((sum, item) => {
      const price = item.productId.finalPrice || item.productId.price;
      return sum + price * item.quantity;
    }, 0);

    const tax = +(subtotal * 0.18).toFixed(2);
    const summary = req.session.orderSummary || {};
    const couponDiscount = summary.couponDiscount || 0;
    const finalAmount = +(subtotal + tax - couponDiscount).toFixed(2);

    return res.status(STATUS.SUCCESS).render("payment-gateway", {
      user: req.session.user,
      summary: { subtotal, tax, finalAmount },
      couponDiscount,
      cart
    });

  } catch (err) {
    console.error("Payment page error:", err);
    return res.status(STATUS.SERVER_ERROR).redirect("/cart");
  }
};

export const userCouponPage = async (req, res) => {
  try {
    const user = req.session.user;

    const coupons = await Coupon
      .find({ isList: true })
      .sort({ createdAt: -1 });

    res.render("user/coupon", {
      coupons,
      userId: user._id,
      user,                  // ✅ REQUIRED
      activePage: "coupons"  // optional
    });

  } catch (err) {
    console.error("User coupon page error:", err);
    res.redirect("/");
  }
};
