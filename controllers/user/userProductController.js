import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Coupon from "../../models/couponModel.js"; 

// ===== User Product List Page =====
export const getUserProductListPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const brand = req.query.brand || "";
    const sort = req.query.sort || "";
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
    const minRating = parseFloat(req.query.minRating) || 0;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    let query = { isDeleted: false, isBlocked: false, isListed: true };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { brand: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    if (categoryFilter) {
      const categoryDoc = await Category.findOne({ categoryName: categoryFilter, isListed: true });
      if (categoryDoc) query.category = categoryDoc._id;
      else query.category = null;
    }

    if (brand) query.brand = brand;
    query.price = { $gte: minPrice, $lte: maxPrice };
    if (minRating > 0) query.rating = { $gte: minRating };

    let sortOption = {};
    switch (sort) {
      case "priceAsc": sortOption.price = 1; break;
      case "priceDesc": sortOption.price = -1; break;
      case "aToZ": sortOption.name = 1; break;
      case "zToA": sortOption.name = -1; break;
      case "popularity": sortOption.soldCount = -1; break;
      case "averageRating": sortOption.rating = -1; break;
      case "newArrivals": sortOption.createdAt = -1; break;
      case "featured": sortOption.isFeatured = -1; break;
      default: sortOption.createdAt = -1;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .populate("category")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit);

    const categories = await Category.find({ isListed: true });
    const brands = await Product.distinct("brand", { isDeleted: false, isBlocked: false, isListed: true });

    res.render("user/productList", {
      products,
      categories,
      brands,
      currentFilters: { search, category: categoryFilter, brand, sort, minPrice, maxPrice, minRating },
      totalPages,
      currentPage: page,
      flash: req.flash(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

// ===== Product Details Page =====
export const getProductDetailsPage = async (req, res) => {
  try {
    const productId = req.params.id;

    // Fetch product with category and active coupons
    const product = await Product.findById(productId)
      .populate("category")
      .populate({
        path: "coupons",
        match: { isActive: true, expiryDate: { $gte: new Date() } }
      });

    if (!product || product.isDeleted || product.isBlocked || !product.isListed) {
      req.flash("error", "Product unavailable");
      return res.redirect("/products");
    }

    // Compute average rating
    if (product.reviews?.length) {
      const sum = product.reviews.reduce((acc, r) => acc + r.rating, 0);
      product.rating = sum / product.reviews.length;
      product.reviewCount = product.reviews.length;
    } else {
      product.rating = 0;
      product.reviewCount = 0;
    }

    // Recommended products: same category, fallback to newest products
    let recommendedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isDeleted: false,
      isBlocked: false,
      isListed: true,
    }).limit(8);

    if (!recommendedProducts.length) {
      recommendedProducts = await Product.find({
        _id: { $ne: product._id },
        isDeleted: false,
        isBlocked: false,
        isListed: true,
      }).sort({ createdAt: -1 }).limit(8);
    }

    res.render("user/productDetails", {
      title: product.name,
      product,
      recommendedProducts,
      flash: req.flash(),
    });
  } catch (err) {
    console.error(err);
    req.flash("error", "Something went wrong");
    res.redirect("/products");
  }
};

// ===== Add to Cart =====
export const addToCart = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.isDeleted || product.isBlocked || !product.isListed || product.stock <= 0) {
      req.flash("error", "Product unavailable");
      return res.redirect(`/product/${req.params.id}`);
    }

    // TODO: actual cart logic here
    req.flash("success", "Product added to cart");
    res.redirect("/cart");
  } catch (err) {
    console.error(err);
    req.flash("error", "Error adding to cart");
    res.redirect(`/product/${req.params.id}`);
  }
};

// ===== Buy Now =====
export const buyNow = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || product.isDeleted || product.isBlocked || !product.isListed || product.stock <= 0) {
      req.flash("error", "Product unavailable");
      return res.redirect("/products");
    }

    // TODO: Implement checkout logic
    res.redirect(`/checkout-page/${product._id}`);
  } catch (err) {
    console.error(err);
    req.flash("error", "Error in checkout");
    res.redirect("/products");
  }
};

// ===== Add Product Review =====
export const addProductReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;

    // Check login
    if (!req.user) {
      req.flash("error", "You must be logged in to write a review");
      return res.redirect(`/product/${req.params.id}`);
    }

    if (!rating || !comment.trim()) {
      req.flash("error", "Please provide a valid rating and comment");
      return res.redirect(`/product/${req.params.id}`);
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      req.flash("error", "Product not found");
      return res.redirect("/products");
    }

    // Ensure reviews array exists
    if (!Array.isArray(product.reviews)) product.reviews = [];

    product.reviews.push({
      userId: req.user._id,
      userName: req.user.name,
      rating: parseInt(rating),
      comment: comment.trim(),
      date: new Date(),
    });

    // Update average rating
    const sum = product.reviews.reduce((acc, r) => acc + r.rating, 0);
    product.rating = sum / product.reviews.length;
    product.reviewCount = product.reviews.length;

    await product.save();
    req.flash("success", "Review added successfully");
    res.redirect(`/product/${product._id}`);
  } catch (err) {
    console.error(err);
    req.flash("error", "Error adding review");
    res.redirect(`/product/${req.params.id}`);
  }
};
