import Coupon from "../../models/couponModel.js";

// COUPON PAGE
export const getCouponListPage = async (req, res) => {
  try {
    const search = req.query.search || "";

    const query = search
      ? { couponName: { $regex: search, $options: "i" } }
      : {};

    const coupons = await Coupon.find(query).sort({ createdAt: -1 });

    res.status(200).render("admin/couponList", {
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
    res.status(500).redirect("/admin/dashboard");
  }
};


// CREATE COUPON (AJAX)
// export const createCoupon = async (req, res) => {
//   try {
//     const { couponName, expireOn, offerPrice, minimumPrice } = req.body;

//     if (!couponName || !expireOn || !offerPrice || !minimumPrice) {
//       return res.status(400).json({ success: false, error: "All fields required" });
//     }

//     const exists = await Coupon.findOne({ couponName });
//     if (exists) {
//       return res.status(409).json({ success: false, error: "Coupon code already exists" });
//     }

//     await Coupon.create({
//       couponName,
//       expireOn,
//       offerPrice,
//       minimumPrice
//     });

//     res.status(201).json({ success: true });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ success: false, error: "Server error" });
//   }
// };

export const createCoupon = async (req, res) => {
  try {
const { couponName, expireOn, offerPrice, minimumPrice, type, discountType } = req.body;

    if (!couponName || !expireOn || !offerPrice || !minimumPrice || !type) {

      return res.status(400).json({
        success: false,
        error: "All fields required"
      });
    }

    const exists = await Coupon.findOne({ couponName });
    if (exists) {
      return res.status(409).json({
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

    res.status(201).json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
};

// UPDATE COUPON
// export const updateCoupon = async (req, res) => {
//   try {
//     let { couponName, expireOn, offerPrice, minimumPrice } = req.body;

//     if (
//       couponName === "" ||
//       expireOn === "" ||
//       offerPrice === "" ||
//       minimumPrice === ""
//     ) {
//       return res.status(400).json({ success: false, error: "All fields required" });
//     }

//     const exists = await Coupon.findOne({
//       couponName,
//       _id: { $ne: req.params.id }
//     });

//     if (exists) {
//       return res.status(409).json({ success: false, error: "Coupon code already exists" });
//     }

//     const updated = await Coupon.findByIdAndUpdate(
//       req.params.id,
//       {
//         couponName,
//         expireOn: new Date(expireOn),
//         offerPrice: Number(offerPrice),
//         minimumPrice: Number(minimumPrice)
//       },
//       { new: true, runValidators: true }
//     );

//     if (!updated) {
//       return res.status(400).json({
//         success: false,
//         error: "Update failed (validation error)"
//       });
//     }

//     res.status(200).json({ success: true });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ success: false, error: err.message });
//   }
// };
export const updateCoupon = async (req, res) => {
  try {
    const { couponName, expireOn, offerPrice, minimumPrice, type } = req.body;
   if (!couponName || !expireOn || !offerPrice || !minimumPrice || !type) {

      return res.status(400).json({
        success: false,
        error: "All fields required"
      });
    }

    const exists = await Coupon.findOne({
      couponName,
      _id: { $ne: req.params.id }
    });

    if (exists) {
      return res.status(409).json({
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
      return res.status(400).json({
        success: false,
        error: "Update failed"
      });
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// DELETE COUPON
export const deleteCoupon = async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ success: false, error: "Coupon not found" });
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.log(err);
    res.status(500).json({ success: false, error: "Delete failed" });
  }
};
