import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";

// ======================
// Render Add Product Page
// ======================
export const renderAddProductPage = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, isListed: true });
    res.render("admin/addProduct", {
      title: "Add Product",
      admin: req.session.user,
      categories,
    });
  } catch (error) {
    console.error("Render Add Product Page Error:", error);
    res.redirect("/error");
  }
};

// ======================
// Show All Products (with Search + Pagination)
// ======================
export const showAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = {
      isDeleted: false,
      ...(search
        ? {
            $or: [
              { name: { $regex: search, $options: "i" } },
              { brand: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    };

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    const products = await Product.find(query)
      .populate("category", "categoryName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("admin/products", {
      title: "All Products",
      products,
      admin: req.session.user,
      search,        // ✅ Prevents "search is not defined"
      currentPage: page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("Show All Products Error:", error);
    res.redirect("/error");
  }
};

// ======================
// Add Product
// ======================
export const addProduct = async (req, res) => {
  try {
    const { name, category, brand, price, discount, description } = req.body;
    const imageUrls = req.imageUrls || [];

    if (!category || !/^[0-9a-fA-F]{24}$/.test(category)) {
      return res.status(400).send("Invalid category ID");
    }

    if (imageUrls.length < 3) {
      return res.status(400).send("Please upload at least 3 product images");
    }

    const finalPrice = discount ? price - (price * discount) / 100 : price;

    const variants = req.body.variantColor
      ? req.body.variantColor.map((color, i) => ({
          color,
          size: req.body.variantSize[i],
          sku: req.body.variantSKU[i],
          stock: req.body.variantStock[i],
          image: req.variantImageUrls?.[i] || null,
        }))
      : [];

    await Product.create({
      name,
      category,
      brand,
      price,
      discount,
      finalPrice,
      description,
      images: imageUrls,
      variants,
    });

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Add Product Error:", error);
    res.redirect("/error");
  }
};

// ======================
// Render Edit Product Page
// ======================
export const renderEditProductPage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product || product.isDeleted) return res.redirect("/error");

    const categories = await Category.find({ isActive: true, isListed: true });

    res.render("admin/editProduct", {
      title: "Edit Product",
      product,
      categories,
      admin: req.session.user,
    });
  } catch (error) {
    console.error("Render Edit Product Error:", error);
    res.redirect("/error");
  }
};

// ======================
// Update Product
// ======================
export const updateProduct = async (req, res) => {
  try {
    const { name, category, brand, price, discount, description, imageFilenames } = req.body;

    let updatedImages = imageFilenames ? imageFilenames.split(",") : [];
    if (req.imageUrls?.length) updatedImages.push(...req.imageUrls);

    if (updatedImages.length < 3) {
      return res.status(400).send("Product must have at least 3 images");
    }

    const finalPrice = discount ? price - (price * discount) / 100 : price;

    const variantColors = Array.isArray(req.body.variantColor)
      ? req.body.variantColor
      : req.body.variantColor
      ? [req.body.variantColor]
      : [];

    const variantSizes = Array.isArray(req.body.variantSize)
      ? req.body.variantSize
      : req.body.variantSize
      ? [req.body.variantSize]
      : [];

    const variantSKUs = Array.isArray(req.body.variantSKU)
      ? req.body.variantSKU
      : req.body.variantSKU
      ? [req.body.variantSKU]
      : [];

    const variantStocks = Array.isArray(req.body.variantStock)
      ? req.body.variantStock
      : req.body.variantStock
      ? [req.body.variantStock]
      : [];

    const existingVariantImages = Array.isArray(req.body.variantExistingImage)
      ? req.body.variantExistingImage
      : req.body.variantExistingImage
      ? [req.body.variantExistingImage]
      : [];

    const newVariantImages = req.variantImageUrls || [];

    const variants = variantColors.map((color, i) => ({
      color,
      size: variantSizes[i] || "",
      sku: variantSKUs[i] || "",
      stock: variantStocks[i] || 0,
      image: newVariantImages[i] || existingVariantImages[i] || null,
    }));

    await Product.findByIdAndUpdate(req.params.id, {
      name,
      category,
      brand,
      price,
      discount,
      finalPrice,
      description,
      images: updatedImages,
      variants,
    });

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Update Product Error:", error);
    res.redirect("/error");
  }
};

// ======================
// Soft Delete Product
// ======================
export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.redirect("/error");
  }
};

// ======================
// Toggle Block / Unblock Product
// ======================
export const toggleBlockProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/error");

    product.isBlocked = !product.isBlocked;
    await product.save();

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Toggle Block Error:", error);
    res.redirect("/error");
  }
};

// ======================
// Toggle List / Unlist Product
// ======================
export const toggleListProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/error");

    product.isListed = !product.isListed;
    await product.save();

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Toggle List Error:", error);
    res.redirect("/error");
  }
};
