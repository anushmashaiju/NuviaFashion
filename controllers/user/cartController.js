import Cart from "../../models/cartModel.js";
import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import STATUS from "../../utils/statusCodes.js";

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
      const price = item.productId.finalPrice || item.productId.price;
      return acc + price * item.quantity;
    }, 0);
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
    return res.status(STATUS.BAD_REQUEST).redirect(`/product/${productId}`);
  }

  let cart = await Cart.findOne({ userId: user.id });
  if (!cart) cart = new Cart({ userId: user.id, items: [] });

  const existingItem = cart.items.find(i => i.productId.toString() === productId);

  if (existingItem) {
    const limit = Math.min(product.stock, MAX_LIMIT);

    if (existingItem.quantity >= limit) {
      req.flash("error", "Maximum quantity reached for this product");
      return res.status(STATUS.BAD_REQUEST).redirect(`/product/${productId}`);
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
  return res.status(STATUS.CREATED).redirect("/cart");
};

// Increment Quantity
export const incrementQuantity = async (req, res) => {
  const { productId } = req.params;
  const userId = req.session.user.id;
  const MAX_LIMIT = 5;

  const cart = await Cart.findOne({ userId });
  const product = await Product.findById(productId);

  if (!cart) return res.status(STATUS.NOT_FOUND).redirect("/cart");

  const item = cart.items.find(i => i.productId.toString() === productId);

  if (!product || product.stock <= 0) {
    req.flash("error", "Product unavailable");
    return res.status(STATUS.BAD_REQUEST).redirect("/cart");
  }

  const allowed = Math.min(product.stock, MAX_LIMIT);

  if (item.quantity < allowed) {
    item.quantity += 1;
    await cart.save();
  } else {
    req.flash("error", "Maximum quantity reached");
  }

  return res.status(STATUS.SUCCESS).redirect("/cart");
};

// Decrement Quantity
export const decrementQuantity = async (req, res) => {
  const { productId } = req.params;
  const userId = req.session.user.id;

  const cart = await Cart.findOne({ userId });
  if (!cart) return res.status(STATUS.NOT_FOUND).redirect("/cart");

  const item = cart.items.find(i => i.productId.toString() === productId);

  if (!item) return res.status(STATUS.BAD_REQUEST).redirect("/cart");

  if (item.quantity > 1) {
    item.quantity -= 1;
  } else {
    cart.items = cart.items.filter(i => i.productId.toString() !== productId);
  }

  await cart.save();
  return res.status(STATUS.SUCCESS).redirect("/cart");
};

// Remove Item From Cart
export const removeFromCart = async (req, res) => {
  const userId = req.session.user.id;
  const { productId } = req.body;

  try {
    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: "Cart not found"
      });
    }

    cart.items = cart.items.filter(
      item => item.productId._id.toString() !== productId
    );

    await cart.save();

    cart = await Cart.findOne({ userId }).populate("items.productId");

    const total = cart.items.reduce((acc, item) => {
      const price = item.productId.finalPrice || item.productId.price;
      return acc + price * item.quantity;
    }, 0);

    return res.status(STATUS.SUCCESS).json({
      success: true,
      message: "Item removed from cart",
      total
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
  const MAX_LIMIT = 5;

  if (!user) {
    return res.status(STATUS.UNAUTHORIZED).json({ success: false, message: "Please login first" });
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
    return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Product unavailable" });
  }

  let cart = await Cart.findOne({ userId: user.id });
  if (!cart) cart = new Cart({ userId: user.id, items: [] });

  const existingItem = cart.items.find(i => i.productId.toString() === productId);
  const limit = Math.min(product.stock, MAX_LIMIT);

  if (existingItem) {
    if (existingItem.quantity >= limit) {
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Maximum limit reached" });
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

  const cartCount = cart.items.length;

  return res.status(STATUS.CREATED).json({
    success: true,
    message: "Added to cart",
    cartCount
  });
};

// Update Quantity Ajax
export const updateQuantityAjax = async (req, res) => {
  const { productId, action } = req.body;
  const userId = req.session.user.id;
  const MAX_LIMIT = 5;

  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart)
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: "Cart not found" });

    const item = cart.items.find(i => i.productId._id.toString() === productId);
    const product = await Product.findById(productId);

    if (!item || !product || product.stock <= 0) {
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Product unavailable" });
    }

    const allowed = Math.min(product.stock, MAX_LIMIT);

    if (action === "inc") {
      if (item.quantity >= allowed)
        return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Maximum limit reached" });
      item.quantity += 1;
    } else if (action === "dec") {
      if (item.quantity > 1) item.quantity -= 1;
      else cart.items = cart.items.filter(i => i.productId._id.toString() !== productId);
    } else {
      return res.status(STATUS.BAD_REQUEST).json({ success: false, message: "Invalid action" });
    }

    await cart.save();

    const total = cart.items.reduce((acc, i) => {
      const price = i.productId.finalPrice ?? i.productId.price ?? 0;
      return acc + price * i.quantity;
    }, 0);

    return res.status(STATUS.SUCCESS).json({ success: true, message: "Cart updated", total });

  } catch (err) {
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: err.message
    });
  }
};
