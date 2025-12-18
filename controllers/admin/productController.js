import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

function calculateFinalPrice(product) {
  const now = new Date();

  const productOffer = product.productOffer;
  const categoryOffer = product.category?.categoryOffer;

  let productActive = false;
  let categoryActive = false;

  if (
    productOffer &&
    productOffer.percentage > 0 &&
    productOffer.startDate &&
    productOffer.endDate
  ) {
    productActive =
      now >= new Date(productOffer.startDate) &&
      now <= new Date(productOffer.endDate);
  }

  if (
    categoryOffer &&
    categoryOffer.percentage > 0 &&
    categoryOffer.isActive &&
    categoryOffer.startDate &&
    categoryOffer.endDate
  ) {
    categoryActive =
      now >= new Date(categoryOffer.startDate) &&
      now <= new Date(categoryOffer.endDate);
  }

  const applicableOffer = Math.max(
    productActive ? productOffer.percentage : 0,
    categoryActive ? categoryOffer.percentage : 0
  );

  const finalPrice =
    applicableOffer > 0
      ? product.price - (product.price * applicableOffer) / 100
      : product.price;

  return {
    finalPrice: Number(finalPrice.toFixed(2)),
    activeOffer: applicableOffer > 0
      ? { percentage: applicableOffer }
      : null
  };
}

// OFFER HELPERS

function isOfferActive(startDate, endDate) {
  if (!startDate || !endDate) return false;
  const now = new Date();
  return now >= new Date(startDate) && now <= new Date(endDate);
}

function getApplicableOffer(productOffer, productStart, productEnd, categoryOffer, categoryStart, categoryEnd) {
  const productActive = isOfferActive(productStart, productEnd);
  const categoryActive = isOfferActive(categoryStart, categoryEnd);

  if (productActive && categoryActive) return Math.max(productOffer, categoryOffer);
  if (productActive) return productOffer;
  if (categoryActive) return categoryOffer;
  return 0;
}


// SHOW ALL PRODUCTS

// export const showAllProducts = async (req, res) => {
//   try {
//     const search = req.query.search || "";
//     const page = parseInt(req.query.page) || 1;
//     const limit = 10;
//     const skip = (page - 1) * limit;

//     const query = {
//       isDeleted: false,
//       ...(search
//         ? {
//             $or: [
//               { name: { $regex: search, $options: "i" } },
//               { brand: { $regex: search, $options: "i" } },
//             ],
//           }
//         : {}),
//     };

//     const totalProducts = await Product.countDocuments(query);
//     const totalPages = Math.ceil(totalProducts / limit);

//     const products = await Product.find(query)
//       .populate("category", "categoryName categoryOffer")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     res.status(STATUS.SUCCESS).render("admin/products", {
//       title: "All Products",
//       products,
//       admin: req.session.user,
//       search,
//       currentPage: page,
//       totalPages,
//       limit,
//     });
//   } catch (error) {
//     console.error("Show All Products Error:", error);
//     res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
//   }
// };

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
      .populate("category", "categoryName categoryOffer")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // ✅ APPLY HELPER HERE
    const enrichedProducts = products.map((product) => {
      const offerData = calculateFinalPrice(product);

      return {
        ...product.toObject(),
        finalPrice: offerData.finalPrice,
        activeOffer: offerData.activeOffer,
      };
    });

    res.status(STATUS.SUCCESS).render("admin/products", {
      title: "All Products",
      products: enrichedProducts, // ✅ send recalculated data
      admin: req.session.user,
      search,
      currentPage: page,
      totalPages,
      limit,
    });
  } catch (error) {
    console.error("Show All Products Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// RENDER ADD PRODUCT PAGE

export const getAddProductPage = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, isListed: true });

    res.status(STATUS.SUCCESS).render("admin/addProduct", {
      title: "Add Product",
      admin: req.session.user,
      categories,
      formData: {},
      errors: {},
      errorField: null,
      errorMessage: null,
    });
  } catch (error) {
    console.error("Render AddProduct Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};


// ADD PRODUCT

export const addProduct = [
  async (req, res) => {
    try {
      const {
        name, category, brand, price, offerPercentage,
        offerStartDate, offerEndDate, color, size, sku,
        stock, totalStock, description
      } = req.body;

      const categories = await Category.find({ isActive: true, isListed: true });
      const errors = {};
      const priceNum = parseFloat(price);
      const offerNum = offerPercentage ? parseFloat(offerPercentage) : 0;
      const stockNum = parseInt(stock);

      if (!name || name.trim().length < 3) errors.name = "Product name must be at least 3 characters.";
      if (!category) errors.category = "Select a category.";
      if (!brand) errors.brand = "Brand is required.";
      if (!price || isNaN(priceNum) || priceNum <= 0) errors.price = "Enter a valid price.";
      if (isNaN(offerNum) || offerNum < 0 || offerNum > 90) errors.offerPercentage = "Offer must be between 0–90%.";
      if (isNaN(stockNum) || stockNum < 0) errors.stock = "Stock must be 0 or higher.";
      if (!totalStock || parseInt(totalStock) <= 0) errors.totalStock = "Total stock required.";
      if (!description || description.trim().length < 5) errors.description = "Description too short.";

      const uploadedImages = Array.isArray(req.imageUrls) ? req.imageUrls : [];
      if (uploadedImages.length < 3) errors.images = "Upload at least 3 images.";

      if (Object.keys(errors).length > 0) {
        return req.xhr
          ? res.status(STATUS.BAD_REQUEST).json({ success: false, errors })
          : res.status(STATUS.BAD_REQUEST).render("admin/addProduct", {
              title: "Add Product",
              admin: req.session.user,
              categories,
              formData: req.body,
              errors,
            });
      }

      const categoryDoc = await Category.findById(category);
      const categoryOfferValue = categoryDoc?.categoryOffer?.percentage || 0;
      const categoryOfferStart = categoryDoc?.categoryOffer?.startDate;
      const categoryOfferEnd = categoryDoc?.categoryOffer?.endDate;
      const categoryOfferActive = categoryDoc?.categoryOffer?.isActive && isOfferActive(categoryOfferStart, categoryOfferEnd);

      const productStart = offerStartDate ? new Date(offerStartDate) : null;
      const productEnd = offerEndDate ? new Date(offerEndDate) : null;
      const productActive = offerNum > 0 && isOfferActive(productStart, productEnd);

      let applicableOffer = 0;
      let appliedOfferType = null;

      if (productActive && categoryOfferActive) {
        if (offerNum >= categoryOfferValue) {
          applicableOffer = offerNum;
          appliedOfferType = "product";
        } else {
          applicableOffer = categoryOfferValue;
          appliedOfferType = "category";
        }
      } else if (productActive) {
        applicableOffer = offerNum;
        appliedOfferType = "product";
      } else if (categoryOfferActive) {
        applicableOffer = categoryOfferValue;
        appliedOfferType = "category";
      }

      const finalPrice = applicableOffer > 0
        ? priceNum - (priceNum * applicableOffer / 100)
        : priceNum;

      let variants = [];
      if (req.body.variantName?.length) {
        const variantFiles = req.variantImageUrls || [];
        variants = req.body.variantName.map((color, i) => {
          const variantPrice = parseFloat(req.body.variantPrice?.[i]) || 0;
          const variantFinalPrice = applicableOffer > 0
            ? variantPrice - (variantPrice * applicableOffer / 100)
            : variantPrice;

          return {
            color,
            size: req.body.variantSize?.[i] || "",
            sku: req.body.variantSKU?.[i] || "",
            price: variantPrice,
            finalPrice: Number(variantFinalPrice.toFixed(2)),
            stock: parseInt(req.body.variantStock?.[i]) || 0,
            image: variantFiles[i] || ""
          };
        });
      }

      const newProduct = new Product({
        name,
        category,
        brand,
        price: priceNum,
        finalPrice: Number(finalPrice.toFixed(2)),
        color: color || "",
        size: size || "",
        sku: sku || "",
        stock: stockNum,
        totalStock: parseInt(totalStock),
        description,
        images: uploadedImages,
        variants,
        productOffer: {
          percentage: offerNum,
          startDate: productStart,
          endDate: productEnd
        },
        activeOffer: {
          type: appliedOfferType,
          percentage: applicableOffer
        }
      });

      await newProduct.save();

      if (req.xhr)
        return res.status(STATUS.SUCCESS).json({ success: true, message: "Product added successfully!", redirect: "/admin/products" });

      req.flash("success", "Product added successfully!");
      res.status(STATUS.CREATED).redirect("/admin/products");

    } catch (error) {
      console.error("Add Product Error:", error);
      const categories = await Category.find({ isActive: true, isListed: true });

      return res.status(STATUS.SERVER_ERROR).render("admin/addProduct", {
        title: "Add Product",
        admin: req.session.user,
        categories,
        formData: req.body,
        errors: { general: "Internal server error" }
      });
    }
  }
];


// RENDER EDIT PRODUCT PAGE

export const getEditProductPage = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("category");
    if (!product || product.isDeleted)
      return res.status(STATUS.NOT_FOUND).send(MESSAGES.PRODUCT_NOT_FOUND);

    const categories = await Category.find({ isActive: true, isListed: true });

    res.status(STATUS.SUCCESS).render("admin/editProduct", {
      title: "Edit Product",
      product,
      categories,
      admin: req.session.user,
    });
  } catch (error) {
    console.error("Render Edit Product Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};


// UPDATE PRODUCT

export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(STATUS.NOT_FOUND).json({ errorMessage: MESSAGES.PRODUCT_NOT_FOUND });

    const {
      name, brand, price, description, category, stock,
      offerPercentage, offerStartDate, offerEndDate,
      color, size, sku
    } = req.body;

    const priceNum = parseFloat(price) || 0;
    const stockNum = parseInt(stock) || 0;
    const offerNum = offerPercentage ? parseFloat(offerPercentage) : 0;

    product.name = name;
    product.brand = brand;
    product.price = priceNum;
    product.description = description;
    product.category = category;
    product.stock = stockNum;
    product.color = color || "";
    product.size = size || "";
    product.sku = sku || "";

    const existingImages = req.body.imageFilenames?.split(",") || [];
    const newImages = req.imageUrls || [];
    product.images = [...existingImages, ...newImages];

    const categoryDoc = await Category.findById(category);
    const categoryOfferValue = categoryDoc?.categoryOffer?.percentage || 0;
    const categoryOfferStart = categoryDoc?.categoryOffer?.startDate;
    const categoryOfferEnd = categoryDoc?.categoryOffer?.endDate;
    const categoryOfferActive = categoryDoc?.categoryOffer?.isActive && isOfferActive(categoryOfferStart, categoryOfferEnd);

    const productStart = offerStartDate ? new Date(offerStartDate) : null;
    const productEnd = offerEndDate ? new Date(offerEndDate) : null;
    const productActive = offerNum > 0 && isOfferActive(productStart, productEnd);

    let applicableOffer = 0;
    let appliedOfferType = null;

    if (productActive && categoryOfferActive) {
      if (offerNum >= categoryOfferValue) {
        applicableOffer = offerNum;
        appliedOfferType = "product";
      } else {
        applicableOffer = categoryOfferValue;
        appliedOfferType = "category";
      }
    } else if (productActive) {
      applicableOffer = offerNum;
      appliedOfferType = "product";
    } else if (categoryOfferActive) {
      applicableOffer = categoryOfferValue;
      appliedOfferType = "category";
    }

    product.finalPrice = Number((applicableOffer > 0 ? priceNum - (priceNum * applicableOffer / 100) : priceNum).toFixed(2));

    let variants = [];
    if (req.body.variantName?.length) {
      const variantFiles = req.variantImageUrls || [];
      variants = req.body.variantName.map((color, i) => {
        const variantPrice = parseFloat(req.body.variantPrice?.[i]) || 0;
        const variantFinalPrice = applicableOffer > 0
          ? variantPrice - (variantPrice * applicableOffer / 100)
          : variantPrice;

        return {
          color,
          size: req.body.variantSize?.[i] || "",
          sku: req.body.variantSKU?.[i] || "",
          price: variantPrice,
          finalPrice: Number(variantFinalPrice.toFixed(2)),
          stock: parseInt(req.body.variantStock?.[i]) || 0,
          image: variantFiles[i] || product.variants?.[i]?.image || ""
        };
      });
    }
    product.variants = variants;

    product.productOffer = { percentage: offerNum, startDate: productStart, endDate: productEnd };
    product.activeOffer = { type: appliedOfferType, percentage: applicableOffer };

    product.totalStock = stockNum + variants.reduce((sum, v) => sum + (v.stock || 0), 0);

    await product.save();

    if (req.xhr)
      return res.status(STATUS.SUCCESS).json({
        success: true,
        message: MESSAGES.PRODUCT_UPDATED,
        redirect: "/admin/products",
      });

    req.flash("success", "Product updated successfully!");
    return res.status(STATUS.SUCCESS).redirect("/admin/products");

  } catch (err) {
    console.error("Update Product Error:", err);
    const categories = await Category.find({ isActive: true, isListed: true });

    return req.xhr
      ? res.status(STATUS.SERVER_ERROR).json({
          success: false,
          errorMessage: MESSAGES.SERVER_ERROR,
          error: err.message,
        })
      : res.status(STATUS.SERVER_ERROR).render("admin/editProduct", {
          pageTitle: "Edit Product",
          admin: req.session.user,
          categories,
          formData: req.body,
          errors: { general: "Internal server error" },
        });
  }
};


// SOFT DELETE PRODUCT

export const deleteProduct = async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.status(STATUS.SUCCESS).redirect("/admin/products");
  } catch (error) {
    console.error("Delete Product Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};


// TOGGLE BLOCK / UNBLOCK PRODUCT

export const toggleBlockProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(STATUS.NOT_FOUND).send(MESSAGES.PRODUCT_NOT_FOUND);

    product.isBlocked = !product.isBlocked;
    await product.save();

    res.status(STATUS.SUCCESS).redirect("/admin/products");
  } catch (error) {
    console.error("Toggle Block Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};


// TOGGLE LIST / UNLIST PRODUCT

export const toggleListProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(STATUS.NOT_FOUND).send(MESSAGES.PRODUCT_NOT_FOUND);

    product.isListed = !product.isListed;
    await product.save();

    res.status(STATUS.SUCCESS).redirect("/admin/products");
  } catch (error) {
    console.error("Toggle List Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};
