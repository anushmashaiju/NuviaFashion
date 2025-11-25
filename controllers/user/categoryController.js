import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";

 // GET OFFER PRODUCT BY CATEGORY 
export const getCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const product = await Product.findOne({
      category: categoryId,
      isDeleted: false,
      isBlocked: false,
      isListed: true,
      discount: { $gt: 0 },
    })
      .sort({ discount: -1, createdAt: -1 })
      .populate("category");

    if (!product) {
      return res.json({ success: false, errorMessage: "No offer found" });
    }

    res.json({ success: true, product });
  } catch (err) {
    console.error(" Category Offer Fetch Error:", err);
    res.status(500).json({ success: false, errorMessage: "Server Error" });
  }
};
