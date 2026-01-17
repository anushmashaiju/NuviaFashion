import Coupon from "../../models/couponModel.js";
import Cart from "../../models/cartModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";
import Order from "../../models/orderModel.js";

const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    let summary = req.session.orderSummary;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        coupons: [],
        message: MESSAGES.LOGIN_REQUIRED
      });
    }

    if (!summary) {
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0) {
        return res.status(STATUS.SUCCESS).json({ coupons: [] });
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      summary = { subtotal };
    }

    const orderCount = await Order.countDocuments({
      userId,
      paymentStatus: "success"
    });

    const coupons = await Coupon.find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
      isList: true,
      expireOn: { $gte: new Date() },
      minimumPrice: { $lte: summary.subtotal }
    });

    const filteredCoupons = coupons.filter(c => {
      if (c.type === "FIRST_ORDER" && orderCount > 0) return false;

      if (
        c.type === "ONE_TIME" &&
        Array.isArray(c.usedBy) &&
        c.usedBy.some(id => id.toString() === userId.toString())
      ) return false;

      return true;
    });

    res.status(STATUS.SUCCESS).json({ coupons: filteredCoupons });

  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).json({
      coupons: [],
      message: MESSAGES.SERVER_ERROR
    });
  }
};

//APPLY COUPON
const applyCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;
    const userId = req.session.user?.id;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.LOGIN_REQUIRED
      });
    }

    let summary = req.session.orderSummary;

    if (!summary) {
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0) {
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: MESSAGES.CART_EMPTY
        });
      }

      const subtotal = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );

      summary = {
        subtotal,
        tax: 0,
        deliveryCharge: 0,
        couponDiscount: 0
      };
    }

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.NOT_FOUND
      });
    }

    if (coupon.expireOn && coupon.expireOn < new Date()) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.COUPON_EXPIRED
      });
    }

    if (summary.subtotal < coupon.minimumPrice) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.COUPON_MIN_PURCHASE_NOT_MET
      });
    }

    const orderCount = await Order.countDocuments({
      userId,
      paymentStatus: "success"
    });

    if (coupon.type === "FIRST_ORDER" && orderCount > 0) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.COUPON_FIRST_ORDER_ONLY
      });
    }

    if (
      coupon.type === "ONE_TIME" &&
      coupon.usedBy?.some(id => id.toString() === userId.toString())
    ) {
      return res.status(STATUS.CONFLICT).json({
        success: false,
        message: MESSAGES.COUPON_ALREADY_USED
      });
    }

    let discount = 0;
    if (coupon.discountType === "FLAT") {
      discount = coupon.offerPrice;
    } else {
      discount = (summary.subtotal * coupon.offerPrice) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    }

    summary.couponDiscount = +discount.toFixed(2);
    summary.appliedCouponId = coupon._id;
    summary.couponName = coupon.couponName;
    summary.couponMinimumPrice = coupon.minimumPrice;
    summary.finalAmount = +(
      summary.subtotal +
      summary.tax +
      summary.deliveryCharge -
      summary.couponDiscount
    ).toFixed(2);

    req.session.orderSummary = summary;
    await req.session.save();

    res.status(STATUS.SUCCESS).json({
      success: true,
      summary,
      message: MESSAGES.COUPON_APPLIED_SUCCESS
    });

  } catch (err) {
    console.error("Apply coupon error:", err);
    res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

//COUPON PAGE
const userCouponPage = async (req, res) => {
  try {
    const user = req.session.user;

    const coupons = await Coupon.find({ isList: true })
      .sort({ createdAt: -1 });

    res.status(STATUS.SUCCESS).render("user/coupon", {
      coupons,
      user,
      userId: user._id,
      activePage: "coupons"
    });

  } catch (err) {
    console.error("User coupon page error:", err);
    res.status(STATUS.SERVER_ERROR).redirect("/");
  }
};

export {
  getAvailableCoupons,
  applyCoupon,
  userCouponPage
};
