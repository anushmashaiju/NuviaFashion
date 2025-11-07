import Category from "../models/categoryModel.js"; // correct relative path

export const fetchActiveCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isListed: true, isActive: true })
      .sort({ categoryName: 1 }); // alphabetical order
    res.locals.headerCategories = categories; // accessible in all EJS templates
    next();
  } catch (error) {
    console.error("❌ Error fetching categories for header:", error);
    res.locals.headerCategories = [];
    next();
  }
};
