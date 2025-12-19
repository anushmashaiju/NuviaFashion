import mongoose from "mongoose";
import Cart from "../../models/cartModel.js";
import Address from "../../models/addressModel.js";
import Product from "../../models/productModel.js";
import Order from "../../models/orderModel.js";
import crypto from "crypto";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";
import Coupon from "../../models/couponModel.js";
import Wallet from "../../models/walletModel.js";
import { calculateDeliveryCharge } from "../../utils/deliveryCharge.js";

// BUY NOW
export const buyNow = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const productId = req.params.id;
    const variantId = req.query.variantId || null;

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      req.flash("error", MESSAGES.PRODUCT_NOT_FOUND);
      return res.status(STATUS.NOT_FOUND).redirect(`/product/${productId}`);
    }

    let finalItem = {};
    let variant = null;

    // BUYING VARIANT
    if (variantId) {
      variant = product.variants.id(variantId);

      if (!variant) {
        req.flash("error", MESSAGES.VARIANT_NOT_FOUND);
        return res.status(STATUS.NOT_FOUND).redirect(`/product/${productId}`);
      }

      if (variant.stock <= 0) {
        req.flash("error", MESSAGES.VARIANT_OUT_OF_STOCK);
        return res.status(STATUS.BAD_REQUEST).redirect(`/product/${productId}`);
      }

      const price = variant.price;
      const discountPercentage = product.activeOffer?.percentage ? Number(product.activeOffer.percentage) : 0;

      const discountAmount = (price * discountPercentage) / 100;
      const finalPrice = price - discountAmount;

      finalItem = {
        productId: product._id,
        variantId: variant._id,
        name: product.name,
        image: variant.image || product.images?.[0],
        price: parseFloat(finalPrice.toFixed(2)),
        quantity: 1,
        basePrice: parseFloat(price.toFixed(2)),
        discount: parseFloat(discountAmount.toFixed(2)),
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        isVariant: true
      };

    } else {
      // BUYING BASE PRODUCT
      if (product.stock <= 0) {
        req.flash("error", MESSAGES.PRODUCT_OUT_OF_STOCK);
        return res.status(STATUS.BAD_REQUEST).redirect(`/product/${productId}`);
      }

      const price = product.price;
      const discountPercentage = product.activeOffer?.percentage || 0;
      const discountAmount = (price * discountPercentage) / 100;
      const finalPrice = price - discountAmount;

      finalItem = {
        productId: product._id,
        variantId: null,
        name: product.name,
        image: product.images?.[0],
        price: parseFloat(finalPrice.toFixed(2)),
        quantity: 1,
        basePrice: parseFloat(price.toFixed(2)),
        discount: parseFloat(discountAmount.toFixed(2)),
        sku: product.sku,
        color: product.color,
        size: product.size,
        isVariant: false
      };
    }

    req.session.buyNow = finalItem;
    req.session.save(() => res.redirect("/checkout"));

  } catch (err) {
    console.error("Buy Now Error:", err);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};


// CHECKOUT PAGE
export const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const addresses = await Address.find({ userId }).sort({ isDefault: -1 });

    let items = [];
    let isBuyNow = false;

    // ---------------- BUY NOW ----------------
    if (req.session.buyNow) {
      const b = req.session.buyNow;

      const discountAmount = b.discount || 0;
      const subtotal = parseFloat((b.price * b.quantity).toFixed(2));

      items.push({
        productId: { _id: b.productId, name: b.name, images: [b.image], price: b.basePrice, finalPrice: b.price },
        variantId: b.variantId || null,
        quantity: 1,
        basePrice: b.basePrice,
        discount: discountAmount,
        finalPrice: b.price,
        subtotal,
        sku: b.sku,
        productName: b.name,
        color: b.color,
        size: b.size,
        image: b.image,
        isVariant: b.isVariant
      });

      isBuyNow = true;

    } else {
      // ---------------- CART ----------------
      const cart = await Cart.findOne({ userId }).populate("items.productId");

      if (!cart || !cart.items.length) {
        req.flash("error", MESSAGES.CART_EMPTY);
        return res.status(STATUS.BAD_REQUEST).redirect("/cart");
      }

      items = cart.items.map(i => {
        const product = i.productId;

        const price = product.price;
        const discountPercentage = product.activeOffer?.percentage || 0;
        const discountAmount = (price * discountPercentage) / 100;

        const finalPrice = parseFloat((price - discountAmount).toFixed(2));
        const subtotal = parseFloat((finalPrice * i.quantity).toFixed(2));

        return {
          productId: {
            _id: product._id,
            name: product.name,
            images: product.images,
            price,
            finalPrice,
          },
          quantity: i.quantity,
          basePrice: price,
          discount: parseFloat(discountAmount.toFixed(2)),
          finalPrice,
          subtotal,
          sku: product.sku,
          productName: product.name,
          color: product.color,
          size: product.size,
          image: product.images?.[0] || "",
          isVariant: false
        };
      });
    }

    // ---------------- STOCK CHECK ----------------
    for (let item of items) {
      const product = await Product.findById(item.productId._id);

      if (!product) {
        req.flash("error", MESSAGES.PRODUCT_NOT_FOUND);
        return res.status(STATUS.NOT_FOUND).redirect("/cart");
      }

      if (item.isVariant && item.variantId) {
        const variant = product.variants.id(item.variantId);
        if (!variant || variant.stock < item.quantity) {
          req.flash("error", "Variant stock not available");
          return res.status(STATUS.BAD_REQUEST).redirect("/cart");
        }
      } else {
        if (product.stock < item.quantity) {
          req.flash("error", "Product stock not available");
          return res.status(STATUS.BAD_REQUEST).redirect("/cart");
        }
      }
    }

    // ---------------- BASE CALCULATION ONLY ----------------
    const subtotal = parseFloat(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const tax = parseFloat((subtotal * 0.18).toFixed(2));
const deliveryCharge = calculateDeliveryCharge({
  subtotal,
  products: items.map(i => ({ deliveryCharge: i.deliveryCharge || 0 })),
  paymentMethod: "ONLINE", // default
  address: null
});

const finalAmount = parseFloat(
  (subtotal + tax + deliveryCharge).toFixed(2)
);

req.session.orderSummary = {
  subtotal,
  tax,
  deliveryCharge,
  couponDiscount: 0,
  appliedCouponId: null,
  finalAmount
};

    // ---------------- COUPONS ----------------
    const coupons = await Coupon.find({
      isActive: true,
      usedBy: { $ne: userId },
      expiryDate: { $gte: new Date() }
    });

    // Save items for wallet / order
    req.session.orderItems = items.map(i => ({
      productId: i.productId._id,
      quantity: i.quantity,
      basePrice: i.basePrice,
      discount: i.discount || 0,
      finalPrice: i.finalPrice,
      subtotal: i.subtotal,
      sku: i.sku,
      productName: i.productName,
      color: i.color || null,
      size: i.size || null,
      image: i.image || "",
      deliveryCharge: 0
    }));

    await req.session.save();

    return res.status(STATUS.SUCCESS).render("user/checkout", {
      activePage: "Checkout",
      cart: { items },
      addresses,
      summary: req.session.orderSummary,
      isBuyNow,
      buyNowProductId: req.session.buyNow?.productId || null,
      coupons,
      user: req.session.user
    });

  } catch (err) {
    console.error("Checkout Page Error:", err);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// ORDER SUCCESS PAGE
export const orderSuccessPage = async (req, res) => {
  try {
    const id = req.params.id;

    const order = await Order.findOne({ orderID: id })
      .populate("items.productId")
      .populate("user_id")
      .populate("shippingAddressId");

    if (!order) {
      return res.status(STATUS.NOT_FOUND).send("Order not found");
    }

    res.status(STATUS.SUCCESS).render("user/orderSuccess", { order, activePage: "" });
  } catch (error) {
    console.error("Order Success Page Error:", error);
    res.status(STATUS.SERVER_ERROR).send("Server Error");
  }
};



// Render Payment Gateway Page
export const renderPaymentPage = async (req, res) => {
  try {
    const summary = req.session.orderSummary;
    if (!summary) return res.status(STATUS.BAD_REQUEST).redirect("/checkout");

    const userId = req.session.user?._id;
    const addressId = req.query.address;

    const walletDoc = await Wallet.findOne({ userId });
    const walletBalance = walletDoc ? walletDoc.balance : 0;

    return res.status(STATUS.SUCCESS).render("user/paymentGateway", {
      summary,
      addressId,
      activePage: "checkout",
      user: {
        ...req.session.user,
        wallet: walletBalance
      }
    });

  } catch (err) {
    console.error("Render Payment Page Error:", err);
    return res.status(STATUS.SERVER_ERROR).redirect("/checkout");
  }
};


export const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user?._id || req.session.user?.id;

    if (!userId)
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: "User not logged in"
      });

    const { selectedAddress, paymentMethod, useWallet } = req.body;

    if (!selectedAddress || !paymentMethod)
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "Address and Payment Method required"
      });

    const summary = req.session.orderSummary;
    if (!summary)
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "Missing order summary"
      });

    const address = await Address.findById(selectedAddress);
    if (!address)
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "Address not found"
      });

    // ---------------- BUILD ITEMS ----------------
    let items = [];

    if (req.session.buyNow) {
      const b = req.session.buyNow;
      items.push({
        productId: b.productId,
        quantity: b.quantity || 1,
        basePrice: b.basePrice,
        discount: b.discount || 0,
        finalPrice: b.price,
        subtotal: parseFloat((b.price * (b.quantity || 1)).toFixed(2)),
        sku: b.sku,
        productName: b.name,
        color: b.color,
        size: b.size,
        image: b.image || "",
        deliveryCharge: 0
      });
    } else {
      const cart = await Cart.findOne({ userId }).populate("items.productId");
      if (!cart || cart.items.length === 0)
        return res.status(STATUS.BAD_REQUEST).json({
          success: false,
          message: "Cart is empty"
        });

      items = cart.items.map(i => {
        const p = i.productId;
        const price = p.finalPrice || p.price;
        const discountAmount = p.activeOffer
          ? (price * p.activeOffer.percentage) / 100
          : 0;

        const finalPrice = parseFloat((price - discountAmount).toFixed(2));

        return {
          productId: p._id,
          quantity: i.quantity,
          basePrice: p.price,
          discount: discountAmount,
          finalPrice,
          subtotal: parseFloat((finalPrice * i.quantity).toFixed(2)),
          sku: p.sku || `SKU-${p._id.toString().slice(-6)}`,
          productName: p.name,
          color: p.color || null,
          size: p.size || null,
          image: p.images?.[0] || "",
          deliveryCharge: p.deliveryCharge || 0
        };
      });
    }

    // ---------------- AMOUNT CALCULATION ----------------
    const subtotal = parseFloat(summary.subtotal.toFixed(2));
    const tax = parseFloat(summary.tax.toFixed(2));
    const couponDiscount = parseFloat(summary.couponDiscount || 0);
    const products = items.map(i => ({
      deliveryCharge: i.deliveryCharge || 0
    }));
    const deliveryCharge = calculateDeliveryCharge({
      subtotal,
      products,
      paymentMethod,
      address
    });

    let totalAmount = subtotal + tax - couponDiscount + deliveryCharge;

    // ---------------- WALLET (CALCULATION ONLY) ----------------
    let walletUsed = 0;

    if (useWallet) {
      const walletDoc = await Wallet.findOne({ userId });
      const walletBalance = walletDoc ? walletDoc.balance : 0;

      if (walletBalance > 0) {
        walletUsed = Math.min(walletBalance, totalAmount);
        totalAmount -= walletUsed;
      }
    }

    // ---------------- CREATE ORDER ----------------
    const orderID = "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const newOrder = new Order({
      user_id: userId,
      shippingAddressId: selectedAddress,
      items,
      subtotal,
      tax,
      couponDiscount,
      deliveryCharge,
      walletUsed,
      totalPrice: parseFloat(totalAmount.toFixed(2)),
      orderID,
      paymentMethod,
      orderStatus:
        paymentMethod === "COD" || useWallet ? "Processing" : "Order Placed",
      paymentStatus:
        paymentMethod === "COD" || useWallet ? "success" : "pending"
    });

    await newOrder.save();

    // ---------------- WALLET DEDUCTION + TRANSACTION ----------------
    if (useWallet && walletUsed > 0) {
      await Wallet.updateOne(
        { userId },
        {
          $inc: { balance: -walletUsed },
          $push: {
            transactions: {
              type: "DEBIT",
              amount: walletUsed,
              description: "Used for order payment"
            }
          }
        }
      );
    }

    // ---------------- COUPON MARK USED ----------------
    if (summary.appliedCouponId) {
      await Coupon.findByIdAndUpdate(summary.appliedCouponId, {
        $addToSet: { usedBy: userId }
      });
    }

    // ---------------- STOCK UPDATE ----------------
    for (let i of items) {
      await Product.updateOne(
        { _id: i.productId },
        { $inc: { stock: -i.quantity } }
      );
    }

    // ---------------- CLEAR CART / BUY NOW ----------------
    if (req.session.buyNow) {
      delete req.session.buyNow;
    } else {
      await Cart.findOneAndUpdate({ userId }, { items: [] });
    }

    req.session.orderSummary = null;

    // ---------------- RESPONSE ----------------
    return res.status(STATUS.CREATED).json({
      success: true,
      orderId: orderID
    });

  } catch (err) {
    console.error("Place Order Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: err.message
    });
  }
};

export const placeCODOrder = placeOrder;

