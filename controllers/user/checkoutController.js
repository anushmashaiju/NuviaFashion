import Cart from "../../models/cartModel.js";
import Address from "../../models/addressModel.js";
import Product from "../../models/productModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";
import Coupon from "../../models/couponModel.js";
import { calculateDeliveryCharge,calculateFinalPrice } from "../../utils/charges.js";

// BUY NOW
export const buyNow = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).redirect("/login");
    }

    const productId = req.params.id;
    const variantId = req.query.variantId || null;

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      req.flash("error", MESSAGES.PRODUCT_NOT_FOUND);
      return res.status(STATUS.NOT_FOUND).redirect(`/product/${productId}`);
    }

    let finalItem = {};
    let variant = null;

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

      const price = Number(variant.price);
      const discountPercentage = product.activeOffer?.percentage
        ? Number(product.activeOffer.percentage)
        : 0;

      const discountAmount = (price * discountPercentage) / 100;
      const finalPrice = price - discountAmount;

      finalItem = {
        productId: product._id,
        variantId: variant._id,
        name: product.name,
        image: variant.image || product.images?.[0],
        price: parseFloat(finalPrice.toFixed(2)),
        basePrice: parseFloat(price.toFixed(2)),
        discount: parseFloat(discountAmount.toFixed(2)),
        quantity: 1,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        isVariant: true
      };

    } else {
      if (product.stock <= 0) {
        req.flash("error", MESSAGES.PRODUCT_OUT_OF_STOCK);
        return res.status(STATUS.BAD_REQUEST).redirect(`/product/${productId}`);
      }

      const price = Number(product.price);
      const discountPercentage = product.activeOffer?.percentage
        ? Number(product.activeOffer.percentage)
        : 0;

      const discountAmount = (price * discountPercentage) / 100;
      const finalPrice = price - discountAmount;

      finalItem = {
        productId: product._id,
        variantId: null,
        name: product.name,
        image: product.images?.[0],
        price: parseFloat(finalPrice.toFixed(2)),
        basePrice: parseFloat(price.toFixed(2)),
        discount: parseFloat(discountAmount.toFixed(2)),
        quantity: 1,
        sku: product.sku,
        color: product.color || null,
        size: product.size || null,
        isVariant: false
      };
    }

    req.session.buyNow = finalItem;
    req.session.save(() => res.redirect("/checkout"));

  } catch (err) {
    console.error("Buy Now Error:", err);
    return res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// controllers/user/buyNowController.js
export const updateBuyNowQty = async (req, res) => {
  try {
    console.log("updateBuyNowQty called with body:", req.body);

    const { action } = req.body;
    const buyNow = req.session.buyNow;

    if (!buyNow) {
      console.log("No buyNow item in session");
      return res.json({ success: false, message: "No Buy Now item found" });
    }

    // 🔹 Update quantity
    let qty = buyNow.quantity || 1;
    if (action === "inc") qty++;
    if (action === "dec" && qty > 1) qty--;
    buyNow.quantity = qty;
    req.session.buyNow = buyNow;

    console.log("Updated buyNow quantity:", qty);

    // 🔹 Recalculate subtotal, tax, delivery
    const subtotal = Number((buyNow.price * qty).toFixed(2));
    const tax = Number((subtotal * 0.18).toFixed(2));
    const deliveryCharge = req.session.orderSummary?.deliveryCharge || 0;

    console.log("Recalculated prices -> Subtotal:", subtotal, "Tax:", tax, "Delivery:", deliveryCharge);

    // 🔹 Coupon revalidation
    const summary = req.session.orderSummary || {};
    let couponDiscount = summary.couponDiscount || 0;

    if (summary.appliedCouponId && subtotal < summary.couponMinimumPrice) {
      console.log("Coupon removed due to minimum price not met");
      couponDiscount = 0;
      summary.appliedCouponId = null;
      summary.couponOfferPrice = 0;
      summary.couponMinimumPrice = 0;
      summary.couponName = null;
    }

    // 🔹 Update summary
    summary.subtotal = subtotal;
    summary.tax = tax;
    summary.couponDiscount = couponDiscount;
    summary.finalAmount = Number((subtotal + tax + deliveryCharge - couponDiscount).toFixed(2));

    req.session.orderSummary = summary;

    // ✅ Log full summary
    console.log("Updated SUMMARY:", req.session.orderSummary);

    // 🔹 Save session
    await req.session.save();

    return res.json({
      success: true,
      quantity: qty,
      summary
    });

  } catch (err) {
    console.error("updateBuyNowQty error:", err);
    return res.json({ success: false });
  }
};



export const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).redirect("/login");
    }
    let stockAdjusted = false; 
    const addresses = await Address.find({ userId }).sort({ isDefault: -1 });

    let items = [];
    let isBuyNow = false;

    if (req.session.buyNow) {
      const b = req.session.buyNow;
      const discountAmount = b.discount || 0;
      const quantity = b.quantity || 1;
      const subtotalItem = parseFloat((b.price * quantity).toFixed(2));

      items.push({
        productId: {
          _id: b.productId,
          name: b.name,
          images: [b.image],
          price: b.basePrice,
          finalPrice: b.price
        },
        variantId: b.variantId || null,
        quantity,
        basePrice: b.basePrice,
        discount: discountAmount,
        finalPrice: b.price,
        subtotal: subtotalItem,
        sku: b.sku,
        productName: b.name,
        color: b.color,
        size: b.size,
        image: b.image,
        isVariant: !!b.variantId

      });

      isBuyNow = true;

} else {

  const cart = await Cart.findOne({ userId }).populate("items.productId");

  if (!cart || !cart.items.length) {
    req.flash("error", MESSAGES.CART_EMPTY);
    return res.status(STATUS.BAD_REQUEST).redirect("/cart");
  }

  stockAdjusted = false;

  for (const item of cart.items) {
    const product = item.productId;

    let availableStock = 0;

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      availableStock = variant ? variant.stock : 0;
    } else {
      availableStock = product.stock;
    }

    if (item.quantity > availableStock) {
      item.quantity = availableStock > 0 ? availableStock : 1;
      stockAdjusted = true;
    }

    const basePrice = item.variantId
      ? product.variants.id(item.variantId)?.price
      : product.price;

    item.price = calculateFinalPrice(basePrice, product);
  }

  if (stockAdjusted) {
    await cart.save();
    req.flash("error", "Some items were updated due to stock changes");
  }

  items = cart.items.map(i => {
    const product = i.productId;

    const finalPrice = i.price;
    let basePrice = product.price;
    let image = product.images?.[0] || "";

    if (i.variantId) {
      const variant = product.variants.id(i.variantId);
      if (variant) {
        basePrice = variant.price;
        image = variant.image || image;
      }
    }

    const discountAmount = basePrice - finalPrice;

    return {
      productId: {
        _id: product._id,
        name: product.name,
        images: product.images,
        price: basePrice,
        finalPrice
      },
      variantId: i.variantId || null,
      quantity: i.quantity,
      basePrice,
      discount: +discountAmount.toFixed(2),
      finalPrice,
      subtotal: +(finalPrice * i.quantity).toFixed(2),
      sku: product.sku,
      productName: product.name,
      color: i.variantId ? product.variants.id(i.variantId)?.color : product.color,
      size: i.variantId ? product.variants.id(i.variantId)?.size : product.size,
      image,
      isVariant: !!i.variantId,
      deliveryCharge: 0
    };
  });
}
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

    const subtotal = parseFloat(items.reduce((s, i) => s + i.subtotal, 0).toFixed(2));
    const tax = parseFloat((subtotal * 0.18).toFixed(2));
   const coupons = await Coupon.find({
  isActive: true,
  expireOn: { $gte: new Date() }
});

    const productsForDelivery = items.map(i => ({ deliveryCharge: i.deliveryCharge || 0 }));
    const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];

    const deliveryCharge = calculateDeliveryCharge({
      subtotal,
      products: productsForDelivery,
      paymentMethod: "Razorpay",
      address: defaultAddress
    });

    const finalAmount = parseFloat((subtotal + tax + deliveryCharge).toFixed(2));

const existingSummary = req.session.orderSummary || {};

req.session.orderSummary = {
  ...(req.session.orderSummary || {}),
  subtotal,
  tax,
  deliveryCharge,
  finalAmount
};

console.log("SUMMARY:", req.session.orderSummary);

    req.session.save();

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
      deliveryCharge: i.deliveryCharge || 0
    }));

    req.session.save();

    res.status(STATUS.SUCCESS).render("user/checkout", {
      activePage: "Checkout",
      cart: { items },
      addresses,
      summary: req.session.orderSummary,
      isBuyNow,
      buyNowProductId: req.session.buyNow?.productId || null,
      coupons,
      stockAdjusted,
      user: req.session.user
    });

  } catch (err) {
    console.error("Checkout Page Error:", err);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};
