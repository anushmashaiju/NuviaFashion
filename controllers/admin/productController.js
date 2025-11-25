import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";

// Show All Products 
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
      search,
      currentPage: page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("Show All Products Error:", error);
    res.redirect("/error");
  }
};

// Render Add Product Page
export const getAddProductPage = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, isListed: true });
  res.render("admin/addProduct", {
  title: "Add Product",
  admin: req.session.user,
  categories,
  errorMessage: req.query.error || null
});
  } catch (error) {
    console.error("Render Add Product Page Error:", error);
    res.redirect("/error");
  }
};

// Add Product
export const addProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      brand,
      price,
      discount,
      description,
      color,
      size,
      sku,
      stock,
    } = req.body;

    const imageUrls = req.imageUrls || [];
    if (!price || price <= 0) return res.status(400).json({ errorMessage: "Price must be > 0" });
    if (!category || !/^[0-9a-fA-F]{24}$/.test(category))
      return res.status(400).json({ errorMessage: "Invalid category ID" });
    if (imageUrls.length < 3) return res.status(400).json({ errorMessage: "Upload at least 3 images" });

    const finalPrice = discount ? price - (price * discount) / 100 : price;

    const variants = req.body.variantColor
      ? req.body.variantColor.map((color, i) => ({
          color,
          size: req.body.variantSize[i],
          sku: req.body.variantSKU[i],
          stock: parseInt(req.body.variantStock[i]),
          image: req.variantImageUrls?.[i] || null,
        }))
      : [];

    const totalStock = (parseInt(stock) || 0) + variants.reduce((sum, v) => sum + v.stock, 0);

    await Product.create({
      name,
      category,
      brand,
      price,
      discount,
      finalPrice,
      description,
      color,
      size,
      sku,
      stock: parseInt(stock),
      totalStock,
      images: imageUrls,
      variants,
    });

    return res.status(200).json({ success: true, errorMessage: "Product added successfully" });

  } catch (error) {
    console.error("Add Product Error:", error);
    return res.status(500).json({ errorMessage: "Server Error", error: error.message });
  }
};

// Render Edit Product Page
export const getEditProductPage = async (req, res) => {
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

// Update Product
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ errorMessage: "Product not found" });

    const { name, brand, price, discount, finalPrice, description, category, stock } = req.body;

    product.name = name;
    product.brand = brand;
    product.price = parseFloat(price);
    product.discount = parseFloat(discount || 0);
    product.finalPrice = parseFloat(finalPrice);
    product.description = description;
    product.category = category;
    product.stock = parseInt(stock);

    let existingImages = req.body.imageFilenames?.split(",") || [];
    const newImages = req.imageUrls || [];
    product.images = [...existingImages, ...newImages];

    let variants = [];
    if (req.body.variantColor) {
      const colors = Array.isArray(req.body.variantColor) ? req.body.variantColor : [req.body.variantColor];
      const sizes = Array.isArray(req.body.variantSize) ? req.body.variantSize : [req.body.variantSize];
      const skus = Array.isArray(req.body.variantSKU) ? req.body.variantSKU : [req.body.variantSKU];
      const stocks = Array.isArray(req.body.variantStock) ? req.body.variantStock : [req.body.variantStock];
      const existingVariantImages = Array.isArray(req.body.variantExistingImage) ? req.body.variantExistingImage : [req.body.variantExistingImage];
      const variantFiles = req.variantImageUrls || [];

      variants = colors.map((c, i) => {
        let img = existingVariantImages[i] || "";
        if (variantFiles[i]) img = variantFiles[i];
        return { color: c, size: sizes[i], sku: skus[i], stock: parseInt(stocks[i]), image: img };
      });
    }

    product.variants = variants;
    product.totalStock = parseInt(stock) + variants.reduce((sum, v) => sum + v.stock, 0);

    await product.save();
    res.json({ success: true, errorMessage: "Product updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ errorMessage: "Server Error", error: err.message });
  }
};

// Soft Delete Product
export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.redirect("/error");
  }
};

// Toggle Block / Unblock Product
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

// Toggle List / Unlist Product
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

