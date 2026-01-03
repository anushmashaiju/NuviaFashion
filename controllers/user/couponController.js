import Coupon from "../../models/couponModel.js";
import Cart from "../../models/cartModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";
import Order from "../../models/orderModel.js";
// GET AVAILABLE COUPONS
// export const getAvailableCoupons = async (req, res) => {
//   try {
//     const userId = req.session.user?._id;
//     const summary = req.session.orderSummary;

//     if (!userId || !summary)
//       return res.json({ coupons: [] });

//     const coupons = await Coupon.find({
//       expireOn: { $gte: new Date() },
//       minimumPrice: { $lte: summary.subtotal },
//       usedBy: { $ne: userId },
//       isList: true
//     });

//     res.json({ coupons });

//   } catch (err) {
//     console.error(err);
//     res.json({ coupons: [] });
//   }
// };
export const getAvailableCoupons = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    let summary = req.session.orderSummary;

    if (!userId) {
      return res.json({ coupons: [] });
    }

    // ✅ Ensure subtotal exists
    if (!summary) {
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0) {
        return res.json({ coupons: [] });
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

    res.json({ coupons: filteredCoupons });

  } catch (err) {
    console.error(err);
    res.json({ coupons: [] });
  }
};


// APPLY COUPON
// export const applyCoupon = async (req, res) => {
//   try {
//     const { couponId } = req.body;
//     const summary = req.session.orderSummary;

//     if (!summary) 
//       return res.status(STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.INVALID_INPUT });

//     const coupon = await Coupon.findById(couponId);
//     if (!coupon) 
//       return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.CATEGORY_OFFER_NOT_FOUND });

//     if (summary.subtotal < coupon.minimumPrice) {
//       return res.status(STATUS.BAD_REQUEST).json({
//         success: false,
//         message: `Minimum purchase ₹${coupon.minimumPrice} required`
//       });
//     }

//    summary.couponDiscount = coupon.offerPrice || 0;
// summary.appliedCouponId = couponId;

// summary.finalAmount = +(
//   summary.subtotal +
//   summary.tax +
//   summary.deliveryCharge -
//   summary.couponDiscount
// ).toFixed(2);

// req.session.orderSummary = summary;
// await req.session.save();


//     await Coupon.findByIdAndUpdate(couponId, { $addToSet: { usedBy: req.session.user._id } });

//     return res.status(STATUS.SUCCESS).json({ success: true, summary });

//   } catch (err) {
//     console.error("Coupon apply error:", err);
//     return res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
//   }
// };

export const applyCoupon = async (req, res) => {
  try {
    const { couponId } = req.body;
    const summary = req.session.orderSummary;

    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ success: false });
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

summary.couponOfferPrice = coupon.offerPrice;
summary.couponMinimumPrice = coupon.minimumPrice;
summary.couponName = coupon.couponName;

    summary.finalAmount = +(
      summary.subtotal +
      summary.tax +
      summary.deliveryCharge -
      summary.couponDiscount
    ).toFixed(2);

    req.session.orderSummary = summary;
    await req.session.save();

    // ❌ DO NOT UPDATE usedBy HERE

    res.json({ success: true, summary });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};


//COUPON PAGE
export const userCouponPage = async (req, res) => {
  try {
    const user = req.session.user;

    const coupons = await Coupon
      .find({ isList: true })
      .sort({ createdAt: -1 });

    res.render("user/coupon", {
      coupons,
      userId: user._id,
      user,                  
      activePage: "coupons"  
    });

  } catch (err) {
    console.error("User coupon page error:", err);
    res.redirect("/");
  }
};
