import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import MESSAGES from "../../utils/messages.js";
import STATUS from "../../utils/statusCodes.js";

// HOME PAGE
const getHomePage = async (req, res) => {
  try {
    const categories = await Category.find({ isListed: true });
    const categoryId = req.query.category;

    let maxOfferProduct = null;

    if (categoryId) {
      maxOfferProduct = await Product.findOne({
        category: categoryId,
        isDeleted: false,
        isBlocked: false,
        isListed: true,
        "activeOffer.percentage": { $gt: 0 }
      })
        .sort({ "activeOffer.percentage": -1, createdAt: -1 })
        .populate("category");
    } else {

      maxOfferProduct = await Product.findOne({
        isDeleted: false,
        isBlocked: false,
        isListed: true,
        "activeOffer.percentage": { $gt: 0 }
      })
        .sort({ "activeOffer.percentage": -1, createdAt: -1 })
        .populate("category");
    }

    const newArrivals = await Product.find({
      isDeleted: false,
      isBlocked: false,
      isListed: true
    })
      .sort({ createdAt: -1 })
      .limit(4);

    const products = await Product.find({
      isDeleted: false,
      isBlocked: false,
      isListed: true
    })
      .sort({ createdAt: -1 })
      .limit(8);

    const topBrands = await Product.aggregate([
      { $match: { isDeleted: false, isBlocked: false, isListed: true } },
      {
        $group: {
          _id: "$brand",
          image: { $first: "$images" },
          count: { $sum: 1 },
        }
      },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);

    const offerExpiry = new Date();
    offerExpiry.setDate(offerExpiry.getDate() + 3);

    res.status(STATUS.SUCCESS).render("user/userHome", {
      title: "Home",
      activePage: "home",
      products,
      newArrivals,
      categories,
      maxOfferProduct,
      topBrands,
      offerExpiry,
      selectedCategory: categoryId || null
    });
  } catch (error) {
    console.error("HomePage Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

//CATEGORY OFFER
const getCategoryOffer = async (req, res) => {
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

//GET MAX OFFER
const getMaxOfferProductByCategory = async (req, res) => {
  try {
    const categoryId = req.params.categoryId;

    const product = await Product.findOne({
      category: categoryId,
      isDeleted: false,
      isBlocked: false,
      isListed: true,
      "activeOffer.percentage": { $gt: 0 }
    })
      .sort({ "activeOffer.percentage": -1, createdAt: -1 })
      .populate("category");

    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.CATEGORY_OFFER_NOT_FOUND
      });
    }

    res.status(STATUS.SUCCESS).json({ success: true, product });
  } catch (err) {
    console.error("MaxOfferProduct Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};

// PRODUCT LIST PAGE
const getUserProductListPage = async (req, res) => {
  try {
    const search = req.query.search || "";
    const categoryFilter = req.query.category || "";
    const brand = req.query.brand || "";
    const sort = req.query.sort || "";
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || Infinity;
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
      const categoryDoc = await Category.findOne({
        categoryName: categoryFilter,
        isListed: true,
      });
      query.category = categoryDoc ? categoryDoc._id : null;
    }

    if (brand) query.brand = brand;

    query.price = { $gte: minPrice, $lte: maxPrice };

    let sortOption = {};
    switch (sort) {
      case "priceAsc": sortOption.price = 1; break;
      case "priceDesc": sortOption.price = -1; break;
      case "aToZ": sortOption.name = 1; break;
      case "zToA": sortOption.name = -1; break;
      case "popularity": sortOption.soldCount = -1; break;
      case "newArrivals": sortOption.createdAt = -1; break;
      case "featured": sortOption.isFeatured = -1; break;
      default: sortOption.createdAt = -1;
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    let products = await Product.find(query)
      .populate("category")
      .sort(sortOption)
      .skip((page - 1) * limit)
      .limit(limit);

    const categories = await Category.find({ isListed: true });
    const brands = await Product.distinct("brand", {
      isDeleted: false,
      isBlocked: false,
      isListed: true,
    });

    const userId = req.session.user?.id;
    let cartCount = 0,
      wishlistCount = 0;

    if (userId) {
      const cart = await Cart.findOne({ userId });
      const wishlist = await Wishlist.findOne({ userId });

      cartCount = cart ? cart.items.length : 0;
      wishlistCount = wishlist ? wishlist.products.length : 0;

      let formattedProducts = products.map((p) => p.toObject());

      if (wishlist && wishlist.products.length) {
        const wishlistIds = wishlist.products.map((wp) => wp.toString());

        formattedProducts = formattedProducts.map((p) => ({
          ...p,
          inWishlist: wishlistIds.includes(p._id.toString()),
        }));
      }

      products = formattedProducts;
    }

    return res.status(STATUS.SUCCESS).render("user/productList", {
      activePage: "shop",
      cartCount,
      wishlistCount,
      products,
      categories,
      brands,
      currentFilters: {
        search,
        category: categoryFilter,
        brand,
        sort,
        minPrice,
        maxPrice,
      },
      totalPages,
      currentPage: page,
      flash: req.flash(),
    });
  } catch (err) {
    console.error("Product List Error:", err);
    return res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// PRODUCT DETAILS PAGE
const getProductDetailsPage = async (req, res) => {
  try {
    const productId = req.params.id;

    if (!productId || productId === "undefined") {
      req.flash("error", MESSAGES.INVALID_INPUT);
      return res.status(STATUS.BAD_REQUEST).redirect("/products");
    }

    const product = await Product.findById(productId)
      .populate("category")
      .populate("coupons");

    if (!product || product.isDeleted || product.isBlocked) {
      req.flash("error", MESSAGES.PRODUCT_NOT_FOUND);
      return res.status(STATUS.NOT_FOUND).redirect("/products");
    }

    let recommendedProducts = await Product.find({
      category: product.category._id,
      _id: { $ne: product._id },
      isDeleted: false,
      isBlocked: false
    }).limit(8);

    if (!recommendedProducts.length) {
      recommendedProducts = await Product.find({
        _id: { $ne: product._id },
        isDeleted: false,
        isBlocked: false
      })
        .sort({ createdAt: -1 })
        .limit(8);
    }

    res.status(STATUS.SUCCESS).render("user/productDetails", {
      title: product.name,
      activePage: "product",
      product,
      recommendedProducts,
      flash: req.flash(),
    });
  } catch (err) {
    console.error("Product Details Error:", err);
    req.flash("error", MESSAGES.SERVER_ERROR);
    res.status(STATUS.SERVER_ERROR).redirect("/products");
  }
};

// PRODUCT STATUS 
const getProductStatus = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .select("isBlocked isDeleted stock");

    if (!product) {
      return res.status(STATUS.NOT_FOUND).json({ isDeleted: true });
    }

    return res.json({
      isBlocked: product.isBlocked,
      isDeleted: product.isDeleted,
      stock: product.stock
    });
  } catch (error) {
    console.error("Product Status Error:", error);
    return res.status(STATUS.SERVER_ERROR).json({ error: MESSAGES.SERVER_ERROR });
  }
};

export {
  getHomePage,
  getCategoryOffer,
  getMaxOfferProductByCategory,
  getUserProductListPage,
  getProductDetailsPage,
  getProductStatus
};
