import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

// GET OFFER PRODUCT BY CATEGORY 
export const getCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const product = await Product.findOne({
      category: categoryId,
      isDeleted: false,
      isBlocked: false,
      isListed: true,
      activeOffer: { $gt: 0 },
    })
      .sort({ activeOffer: -1, createdAt: -1 })
      .populate("category");

    if (!product) {
      return res
        .status(STATUS.NOT_FOUND)
        .json({ success: false, errorMessage: MESSAGES.CATEGORY_OFFER_NOT_FOUND });
    }

    return res
      .status(STATUS.SUCCESS)
      .json({ success: true, product });

  } catch (err) {
    console.error("Category Offer Fetch Error:", err);
    return res
      .status(STATUS.SERVER_ERROR)
      .json({ success: false, errorMessage: MESSAGES.SERVER_ERROR });
  }
};
