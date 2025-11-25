import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";

// Get Cart Page
export const getCartPage = async (req, res) => {
  const user = req.session.user;

  const cart = await Cart.findOne({ userId: user.id }).populate("items.productId");
  const wishlist = await Wishlist.findOne({ userId: user.id });

  const cartCount = cart ? cart.items.length : 0;
  const wishlistCount = wishlist ? wishlist.products.length : 0;

  let total = 0;

  if (cart && cart.items.length > 0) {
    total = cart.items.reduce((acc, item) => {
      const price = item.productId.salePrice || item.productId.price;
      return acc + price * item.quantity;
    }, 0);
  }

  res.render("user/cart", {
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
  const MAX_LIMIT = 5;

  const product = await Product.findById(productId).populate("category");

  if (
    !product ||
    product.stock <= 0 ||
    product.isDeleted ||
    product.isBlocked ||
    !product.isListed ||
    !product.category?.isListed
  ) {
    req.flash("error", "This product is unavailable");
    return res.redirect(`/product/${productId}`);
  }

  let cart = await Cart.findOne({ userId: user.id });
  if (!cart) cart = new Cart({ userId: user.id, items: [] });

  const existingItem = cart.items.find(i => i.productId.toString() === productId);

  if (existingItem) {
    const limit = Math.min(product.stock, MAX_LIMIT);

    if (existingItem.quantity >= limit) {
      req.flash("error", "Maximum quantity reached for this product");
      return res.redirect(`/product/${productId}`);
    }

    existingItem.quantity += 1;
  } else {
    cart.items.push({ productId, quantity: 1 });
  }

  await cart.save();

  await Wishlist.updateOne(
    { userId: user.id },
    { $pull: { products: { productId } } }
  );

  req.flash("success", "Added to cart");
  return res.redirect("/cart");
};


// Increment Quantity
export const incrementQuantity = async (req, res) => {
  const { productId } = req.params;
  const userId = req.session.user.id;
  const MAX_LIMIT = 5;

  const cart = await Cart.findOne({ userId });
  const product = await Product.findById(productId);
  const item = cart.items.find(i => i.productId.toString() === productId);

  if (!product || product.stock <= 0) {
    req.flash("error", "Product unavailable");
    return res.redirect("/cart");
  }

  const allowed = Math.min(product.stock, MAX_LIMIT);

  if (item.quantity < allowed) {
    item.quantity += 1;
    await cart.save();
  } else {
    req.flash("error", "Maximum quantity reached");
  }

  res.redirect("/cart");
};


// Decrement Quantity
export const decrementQuantity = async (req, res) => {
  const { productId } = req.params;
  const userId = req.session.user.id;

  const cart = await Cart.findOne({ userId });
  const item = cart.items.find(i => i.productId.toString() === productId);

  if (!item) return res.redirect("/cart");

  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    cart.items = cart.items.filter(i => i.productId.toString() !== productId);
  }

  await cart.save();
  return res.redirect("/cart");
};

// Remove Item From Cart
export const removeFromCart = async (req, res) => {
  const userId = req.session.user.id;
  const { productId } = req.body;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      item => item.productId.toString() !== productId
    );

    await cart.save();

    const total = cart.items.reduce((acc, item) => {
      const price = item.productId.salePrice || item.productId.price;
      return acc + price * item.quantity;
    }, 0);

    return res.json({
      success: true,
      message: "Item removed from cart",
      total
    });

  } catch (err) {
    return res.json({ success: false, message: "Something went wrong" });
  }
};

// AddToCartAjax
export const addToCartAjax = async (req, res) => {
  const user = req.session.user;
  const productId = req.params.id;
  const MAX_LIMIT = 5;

  if (!user) {
    return res.json({ success: false, message: "Please login first" });
  }

  const product = await Product.findById(productId).populate("category");

  if (
    !product ||
    product.stock <= 0 ||
    product.isDeleted ||
    product.isBlocked ||
    !product.isListed ||
    !product.category?.isListed
  ) {
    return res.json({ success: false, message: "Product unavailable" });
  }

  let cart = await Cart.findOne({ userId: user.id });
  if (!cart) cart = new Cart({ userId: user.id, items: [] });

  const existingItem = cart.items.find(i => i.productId.toString() === productId);
  const limit = Math.min(product.stock, MAX_LIMIT);

  if (existingItem) {
    if (existingItem.quantity >= limit) {
      return res.json({ success: false, message: "Maximum limit reached" });
    }
    existingItem.quantity += 1;
  } else {
    cart.items.push({ productId, quantity: 1 });
  }

  await cart.save();

  await Wishlist.updateOne(
    { userId: user.id },
    { $pull: { products: { productId } } }
  );

  return res.json({ success: true, message: "Added to cart" });
};

//update Quantity Ajax
export const updateQuantityAjax = async (req, res) => {
  const { productId, action } = req.body;
  const userId = req.session.user.id;
  const MAX_LIMIT = 5;

  try {
    const cart = await Cart.findOne({ userId });
    const item = cart.items.find(i => i.productId.toString() === productId);
    const product = await Product.findById(productId);

    if (!item || !product || product.stock <= 0) {
      return res.json({ success: false, message: "Product unavailable" });
    }

    const allowed = Math.min(product.stock, MAX_LIMIT);

    if (action === "inc") {
      if (item.quantity < allowed) item.quantity += 1;
      else return res.json({ success: false, message: "Maximum quantity reached" });
    } else if (action === "dec") {
      if (item.quantity > 1) item.quantity -= 1;
      else cart.items = cart.items.filter(i => i.productId.toString() !== productId);
    } else {
      return res.json({ success: false, message: "Invalid action" });
    }

    await cart.save();

    const total = cart.items.reduce((acc, i) => {
      const price = i.productId.salePrice || i.productId.price;
      return acc + price * i.quantity;
    }, 0);

    return res.json({ success: true, message: "Cart updated", total });

  } catch (err) {
    return res.json({ success: false, message: err.message });
  }
};
