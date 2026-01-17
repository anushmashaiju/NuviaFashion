import Coupon from "../../models/couponModel.js";
import STATUS from "../../utils/statusCodes.js";

// COUPON PAGE
const getCouponListPage = async (req, res) => {
  try {
    const search = req.query.search || "";

    const query = search
      ? { couponName: { $regex: search, $options: "i" } }
      : {};

    const coupons = await Coupon.find(query).sort({ createdAt: -1 });

    res.status(STATUS.SUCCESS).render("admin/couponList", {
      title: "Coupon Management",
      admin: req.session.user,
      coupons,
      search,
      success: req.flash("success"),
      error: req.flash("error")
    });

  } catch (err) {
    console.log(err);
    req.flash("error", "Failed to load coupons");
    res.status(STATUS.SERVER_ERROR).redirect("/admin/dashboard");
  }
};

//CREATE COUPON
const createCoupon = async (req, res) => {
  try {
    const { couponName, expireOn, offerPrice, minimumPrice, type, discountType } = req.body;

    if (!couponName || !expireOn || !offerPrice || !minimumPrice || !type) {

      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: "All fields required"
      });
    }

    const exists = await Coupon.findOne({ couponName });
    if (exists) {
      return res.status(STATUS.CONFLICT).json({
        success: false,
        error: "Coupon code already exists"
      });
    }

    await Coupon.create({
      couponName,
      expireOn: new Date(expireOn),
      offerPrice: Number(offerPrice),
      minimumPrice: Number(minimumPrice),
      type,
      discountType: discountType || "FLAT",
      isActive: true,
      isList: true
    });

    res.status(STATUS.CREATED).json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).json({
      success: false,
      error: "Server error"
    });
  }
};

// UPDATE COUPON

const updateCoupon = async (req, res) => {
  try {
    const { couponName, expireOn, offerPrice, minimumPrice, type } = req.body;
    if (!couponName || !expireOn || !offerPrice || !minimumPrice || !type) {

      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: "All fields required"
      });
    }

    const exists = await Coupon.findOne({
      couponName,
      _id: { $ne: req.params.id }
    });

    if (exists) {
      return res.status(STATUS.CONFLICT).json({
        success: false,
        error: "Coupon code already exists"
      });
    }

    const updated = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        couponName,
        expireOn: new Date(expireOn),
        offerPrice: Number(offerPrice),
        minimumPrice: Number(minimumPrice),
        type
      },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: "Update failed"
      });
    }

    res.status(STATUS.SUCCESS).json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).json({
      success: false,
      error: err.message
    });
  }
};

// DELETE COUPON
const deleteCoupon = async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(STATUS.NOT_FOUND).json({ success: false, error: "Coupon not found" });
    }

    res.status(STATUS.SUCCESS).json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, error: "Delete failed" });
  }
};

export {
  getCouponListPage,
  createCoupon,
  updateCoupon,
  deleteCoupon
};
