import Category from "../models/categoryModel.js"; 
import Cart from "../models/cartModel.js";
import Wishlist from "../models/wishlistModel.js";

// Middleware to fetch categories for header
export const fetchActiveCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isListed: true, isActive: true })
      .sort({ categoryName: 1 }); 
    res.locals.headerCategories = categories; 
    next();
  } catch (error) {
    console.error(" Error fetching categories for header:", error);
    res.locals.headerCategories = [];
    next();
  }
};

// Product validation middleware
export const validateProduct = async (req, res, next) => {
  const { name, description, brand, category, price, stock } = req.body;
  const thumbnail = req.thumbnailUrl; 
  const errors = [];

  if (!name || name.trim().length < 3) errors.push("Name must be at least 3 characters");
  if (description && description.length > 1000) errors.push("Description too long");
  if (!brand) errors.push("Brand is required");
  if (!category) errors.push("Category is required");
  if (!price || isNaN(price) || Number(price) < 0) errors.push("Price must be a positive number");

  const categoryDoc = await Category.findById(category);
  if (!categoryDoc || !categoryDoc.isListed) errors.push("Invalid category selected");

  if (errors.length > 0) {
    const categories = await Category.find({ isListed: true, isActive: true }).sort({ categoryName: 1 });

    return res.status(400).render("admin/addProduct", {
      title: "Add Product",
      admin: req.session.user,
      categories,         
      errorMessage: errors.join(", "),
      inputData: req.body,
    });
  }

  next();
};


export const addUserCounts = async (req, res, next) => {
  try {
    if (!req.session.user) {
      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;
      return next();
    }

    const userId = req.session.user.id;

    const cart = await Cart.findOne({ userId });
    const wishlist = await Wishlist.findOne({ userId });

    res.locals.cartCount = cart ? cart.items.length : 0;
    res.locals.wishlistCount = wishlist ? wishlist.products.length : 0;

    next();
  } catch (err) {
    console.log("Count Middleware Error:", err);
    next();
  }
};
