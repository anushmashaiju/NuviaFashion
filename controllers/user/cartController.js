import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import STATUS from "../../utils/statusCodes.js";
import { calculateFinalPrice,normalizeCartPrices } from "../../utils/charges.js";

// Get Cart Page
export const getCartPage = async (req, res) => {
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

    const offerPercent =
      item.productId.activeOffer?.percentage ||
      item.productId.productOffer?.percentage ||
      0;

    const finalPrice = calculateFinalPrice(basePrice, item.productId);

    item.originalPrice = basePrice;
    item.offerPercent = offerPercent;
    item.price = finalPrice;

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
export const addToCart = async (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  const { variantId } = req.body;
  const MAX_LIMIT = 5;

  const product = await Product.findById(productId).populate("category");
  if (!product || product.isDeleted || product.isBlocked || !product.isListed || !product.category?.isListed) {
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
      req.flash("error", "Maximum quantity reached");
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
export const incrementQuantity = async (req, res) => {
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
    req.flash("error", "Maximum quantity reached");
  }

  res.redirect("/cart");
};

// Decrement Quantity
export const decrementQuantity = async (req, res) => {
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
export const removeFromCart = async (req, res) => {
  const userId = req.session.user.id;
  const { productId, variantId } = req.body;

  try {
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: "Cart not found"
      });
    }
    cart.items = cart.items.filter(
      item =>!(item.productId._id.toString() === productId &&
      (variantId ? item.variantId?.toString() === variantId: !item.variantId))
    );

    await cart.save();

    cart = await Cart.findOne({ userId }).populate("items.productId");

    const total = cart.items.reduce((acc, item) => {
      return acc + item.price * item.quantity;
    }, 0);

  const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

return res.status(STATUS.SUCCESS).json({
  success: true,
  message: "Item removed from cart",
  total,
  cartCount
});

  } catch (err) {
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: "Something went wrong"
    });
  }
};

// Add To Cart Ajax

export const addToCartAjax = async (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  const { variantId } = req.body;
  const MAX_LIMIT = 5;

  if (!user) {
    return res.status(STATUS.UNAUTHORIZED).json({
      success: false,
      message: "Please login first"
    });
  }

  const product = await Product.findById(productId).populate("category");

  if (!product || product.isDeleted || product.isBlocked ||!product.isListed ||!product.category?.isListed)
     {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: "Product unavailable"
    });
  }

  let cart = await Cart.findOne({ userId: user.id });
  if (!cart) cart = new Cart({ userId: user.id, items: [] });

 let stock;
let price;

if (variantId) {
  const variant = product.variants.id(variantId);
  if (!variant || variant.stock <= 0) {
    return res.status(400).json({ success: false, message: "Variant unavailable" });
  }

  stock = variant.stock;
  price = calculateFinalPrice(variant.price, product);
} else {
  if (product.stock <= 0) {
    return res.status(400).json({
      success: false,
      message: "Product out of stock"
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
      message: "Maximum limit reached"
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
    message: "Added to cart",
    cartCount: cart.items.reduce((sum, i) => sum + i.quantity, 0)

  });
};

// Update Quantity Ajax

export const updateQuantityAjax = async (req, res) => {
  let { productId, variantId, action } = req.body;

if (!variantId) variantId = null;

  const userId = req.session.user.id;
  const MAX_LIMIT = 5;

  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: "Cart not found"
      });
    }

 const item = cart.items.find(i => {
  if (i.productId._id.toString() !== productId) return false;

  if (variantId) {
    return i.variantId && i.variantId.toString() === variantId;
  } else {
    return !i.variantId;
  }
});

    const product = await Product.findById(productId);

    if (!item || !product) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "Product unavailable"
      });
    }

 let stock;

if (variantId) {
  const variant = product.variants.id(variantId);
  if (!variant) {
    return res.status(400).json({
      success: false,
      message: "Variant not found"
    });
  }
  stock = variant.stock;
} else {
  stock = product.stock;
}
    const allowed = Math.min(stock, MAX_LIMIT);

  if (action === "inc") {
  if (stock <= 0 || item.quantity >= allowed) {
    return res.status(400).json({
      success: false,
      message: "Out of stock or maximum limit reached"
    });
  }

  const basePrice = variantId
    ? product.variants.id(variantId)?.price
    : product.price;

  item.price = calculateFinalPrice(basePrice, product);
  item.quantity += 1;
    } else if (action === "dec") {
      if (item.quantity > 1) {
        item.quantity -= 1;
      } else {
        cart.items = cart.items.filter(
          i =>
            !(
              i.productId._id.toString() === productId &&
              (variantId
                ? i.variantId?.toString() === variantId
                : !i.variantId)
            )
        );
      }
    } else {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "Invalid action"
      });
    }

cart.items.forEach(i => {
  if (typeof i.price !== "number") {
    throw new Error("Cart item price missing");
  }
});

await cart.save();

    const total = cart.items.reduce((acc, i) => {
      return acc + i.price * i.quantity;
    }, 0);

 const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

return res.status(STATUS.SUCCESS).json({
  success: true,
  message: "Cart updated",
  total,
  cartCount
});

  } catch (err) {
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: err.message
    });
  }
};
