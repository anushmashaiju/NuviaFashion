import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import STATUS from "../../utils/statusCodes.js";
import { calculateFinalPrice, normalizeCartPrices } from "../../utils/charges.js";
import { validateStock } from "../../utils/stockValidator.js";
import MESSAGES from "../../utils/messages.js";

// Get Cart Page
const getCartPage = async (req, res) => {
  const user = req.session.user;

  const cart = await Cart.findOne({ userId: user.id }).populate("items.productId");
  const wishlist = await Wishlist.findOne({ userId: user.id });

  const cartCount = cart ? cart.items.length : 0;
  const wishlistCount = wishlist ? wishlist.products.length : 0;

  let total = 0;

  if (cart && cart.items.length > 0) {
    cart.items = cart.items.map(item => {

      let basePrice = 0;

      if (item.variantId) {
        const variant = item.productId.variants.id(item.variantId);
        if (!variant) return item;
        basePrice = variant.price;
      }

      else {
        basePrice = item.productId.price;
      }

      let offerPercent = 0;
      let finalPrice = basePrice;

      if (item.productId.activeOffer && item.productId.activeOffer.percentage > 0) {
        offerPercent = item.productId.activeOffer.percentage;
        finalPrice = calculateFinalPrice(basePrice, item.productId);

        item.originalPrice = basePrice;
        item.offerPercent = offerPercent;
      } else {

        item.originalPrice = null;
        item.offerPercent = 0;
        finalPrice = basePrice;
      }

      item.price = finalPrice;

      item.price = calculateFinalPrice(basePrice, item.productId);

      total += finalPrice * item.quantity;
      return item;
    });
  }
  return res.status(STATUS.SUCCESS).render("user/cart", {
    activePage: "My Cart",
    cart,
    user,
    total,
    cartCount,
    wishlistCount,
    success: req.flash("success"),
    error: req.flash("error"),
  });
};

// Add to Cart
const addToCart = async (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  const { variantId } = req.body;
  const MAX_LIMIT = 5;

  const product = await Product.findById(productId).populate("category");
  if (!product || product.isDeleted || product.isBlocked || !product.category?.isListed) {
    req.flash("error", "This product is unavailable");
    return res.redirect(`/product/${productId}`);
  }

  let cart = await Cart.findOne({ userId: user.id });
  if (!cart) cart = new Cart({ userId: user.id, items: [] });

  let stock;
  let finalPrice;

  if (variantId) {
    const variant = product.variants.id(variantId);
    if (!variant || variant.stock <= 0) {
      req.flash("error", "Variant unavailable");
      return res.redirect(`/product/${productId}`);
    }

    stock = variant.stock;
    finalPrice = calculateFinalPrice(variant.price, product);
  } else {
    if (product.stock <= 0) {
      req.flash("error", "Product out of stock");
      return res.redirect(`/product/${productId}`);
    }

    stock = product.stock;
    finalPrice = calculateFinalPrice(product.price, product);
  }

  const allowed = Math.min(stock, MAX_LIMIT);

  const existingItem = cart.items.find(
    i => i.productId.toString() === productId && (variantId ? i.variantId?.toString() === variantId : !i.variantId)
  );

  if (existingItem) {
    if (existingItem.quantity >= allowed) {
      req.flash("error", MES);
      return res.redirect(`/product/${productId}`);
    }
    existingItem.quantity += 1;
    existingItem.price = finalPrice;
  } else {
    cart.items.push({
      productId,
      variantId: variantId || null,
      quantity: 1,
      price: finalPrice
    });
  }
  cart.items.forEach(i => {
    if (typeof i.price !== "number") {
      throw new Error("Cart item price missing");
    }
  });

  await cart.save();

  req.flash("success", "Added to cart");
  return res.redirect("/cart");
};

// Increment Quantity
const incrementQuantity = async (req, res) => {
  const { productId, variantId } = req.params;
  const userId = req.session.user.id;
  const MAX_LIMIT = 5;

  const cart = await Cart.findOne({ userId });
  const product = await Product.findById(productId);

  if (!cart || !product) return res.redirect("/cart");

  const item = cart.items.find(
    i =>
      i.productId.toString() === productId &&
      (variantId ? i.variantId?.toString() === variantId : !i.variantId)
  );

  if (!item) return res.redirect("/cart");

  let stock = product.stock;

  if (variantId) {
    const variant = product.variants.id(variantId);
    stock = variant?.stock || 0;
  }

  const allowed = Math.min(stock, MAX_LIMIT);

  if (item.quantity < allowed) {
    item.quantity += 1;

    if (!item.price) {
      const basePrice = variantId
        ? product.variants.id(variantId)?.price
        : product.price;

      item.price = calculateFinalPrice(basePrice, product);
    }

    cart.items.forEach(i => {
      if (typeof i.price !== "number") {
        throw new Error("Cart item price missing");
      }
    });

    await cart.save();
  } else {
    req.flash("error", MES);
  }

  res.redirect("/cart");
};

// Decrement Quantity
const decrementQuantity = async (req, res) => {
  const { productId, variantId } = req.params;
  const userId = req.session.user.id;

  const cart = await Cart.findOne({ userId });
  if (!cart) return res.redirect("/cart");

  const itemIndex = cart.items.findIndex(
    i =>
      i.productId.toString() === productId &&
      (variantId ? i.variantId?.toString() === variantId : !i.variantId)
  );

  if (itemIndex === -1) return res.redirect("/cart");

  if (cart.items[itemIndex].quantity > 1) {
    cart.items[itemIndex].quantity -= 1;
  } else {
    cart.items.splice(itemIndex, 1);
  }

  cart.items.forEach(i => {
    if (typeof i.price !== "number") {
      throw new Error("Cart item price missing");
    }
  });

  await cart.save();

  res.redirect("/cart");
};

// Remove Item From Cart 
const removeFromCart = async (req, res) => {
  const userId = req.session.user.id;
  const { productId, variantId } = req.body;

  try {
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.CART_NOT_FOUND
      });
    }
    cart.items = cart.items.filter(
      item => !(item.productId._id.toString() === productId &&
        (variantId ? item.variantId?.toString() === variantId : !item.variantId))
    );

    await cart.save();

    cart = await Cart.findOne({ userId }).populate("items.productId");

    const total = cart.items.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

    const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

    return res.status(STATUS.SUCCESS).json({
      success: true,
      message: MESSAGES.ITEM_REMOVED_FROM_CART,
      total,
      cartCount
    });

  } catch (err) {
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

// Add To Cart Ajax
const addToCartAjax = async (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  // const { variantId } = req.body;
  const { variantId } = req.body || {};

  const MAX_LIMIT = 5;

  if (!user) {
    return res.status(STATUS.UNAUTHORIZED).json({
      success: false,
      message: MESSAGES.LOGIN_REQUIRED
    });
  }

  const product = await Product.findById(productId).populate("category");

  if (!product || product.isDeleted || product.isBlocked || !product.category?.isListed) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: MESSAGES.PRODUCT_UNAVAILABLE
    });
  }

  let cart = await Cart.findOne({ userId: user.id });
  if (!cart) cart = new Cart({ userId: user.id, items: [] });

  let stock;
  let price;

  if (variantId) {
    const variant = product.variants.id(variantId);
    if (!variant || variant.stock <= 0) {
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: MESSAGES.VARIANT_NOT_FOUND });
    }

    stock = variant.stock;
    price = calculateFinalPrice(variant.price, product);
  } else {
    if (product.stock <= 0) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.PRODUCT_OUT_OF_STOCK
      });
    }

    stock = product.stock;
    price = calculateFinalPrice(product.price, product);
  }

  const allowed = Math.min(stock, MAX_LIMIT);

  if (allowed <= 0) {
    req.flash("error", "Product out of stock");
    return res.redirect("/cart");
  }

  const existingItem = cart.items.find(
    i =>
      i.productId.toString() === productId &&
      (variantId
        ? i.variantId?.toString() === variantId
        : !i.variantId)
  );

  if (existingItem) {
    if (existingItem.quantity >= allowed) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: MESSAGES.OUT_OF_STOCK_OR_LIMIT
      });
    }

    const basePrice = variantId
      ? product.variants.id(variantId)?.price
      : product.price;

    existingItem.price = calculateFinalPrice(basePrice, product);
    existingItem.quantity += 1;
  } else {
    cart.items.push({
      productId,
      variantId: variantId || null,
      quantity: 1,
      price
    });
  }

  await normalizeCartPrices(cart);

  cart.items.forEach(i => {
    if (typeof i.price !== "number") {
      throw new Error("Cart item price missing");
    }
  });

  await cart.save();

  await Wishlist.updateOne(
    { userId: user.id },
    { $pull: { products: { productId } } }
  );

  return res.status(STATUS.CREATED).json({
    success: true,
    message: MESSAGES.ADDED_TO_CART,
    cartCount: cart.items.reduce((sum, i) => sum + i.quantity, 0)

  });
};


//  const validateCheckoutStock = async (req, res) => {
//   const userId = req.session.user?.id;
//   if (!userId) return res.json({ success: false });

//   const items = req.session.buyNow
//     ? [{
//         productId: req.session.buyNow.productId,
//         variantId: req.session.buyNow.variantId,
//         quantity: req.session.buyNow.quantity
//       }]
//     : (await Cart.findOne({ userId }))?.items || [];

//   const { errors } = await validateStock(items);

//   if (errors.length) {
//     return res.json({ success: false, message: errors[0] });
//   }

//   return res.json({ success: true });
// };

const validateCheckoutStock = async (req, res) => {
  const userId = req.session.user?.id;
  if (!userId) return res.json({ success: false });

  let items = [];

  // 1️⃣ If Buy Now
  if (req.session.buyNow) {
    const b = req.session.buyNow;
    items.push({
      productId: b.productId,
      variantId: b.variantId || null,
      quantity: b.quantity || 1
    });
  } else {
    // 2️⃣ Otherwise use Cart
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.json({ success: false, message: "Cart is empty" });
    }
    items = cart.items.map(i => ({
      productId: i.productId,
      variantId: i.variantId || null,
      quantity: i.quantity
    }));
  }

  const { errors, outOfStockItems } = await validateStock(items);

  if (outOfStockItems.length > 0) {
    // Remove invalid items only if it's Cart
    if (!req.session.buyNow) {
      const cart = await Cart.findOne({ userId });
      cart.items = cart.items.filter(item =>
        !outOfStockItems.some(o =>
          o.productId.toString() === item.productId.toString() &&
          (o.variantId?.toString() || "") === (item.variantId?.toString() || "")
        )
      );
      await cart.save();
    }

    return res.json({
      success: false,
      message: errors[0] || "Some items went out of stock",
      removed: true
    });
  }

  return res.json({ success: true });
};

export {
  getCartPage,
  addToCart,
  incrementQuantity,
  decrementQuantity,
  removeFromCart,
  addToCartAjax,
  validateCheckoutStock
};
