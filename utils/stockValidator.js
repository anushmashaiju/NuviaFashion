import Product from "../models/productModel.js";
import Cart from "../models/cartModel.js";
import { calculateDeliveryCharge, calculateFinalPrice } from "./charges.js";
import Coupon from "../models/couponModel.js";

async function validateStock(items) {
  const errors = [];
  const outOfStockItems = [];

  for (const item of items) {
    const product = await Product.findById(item.productId);

    if (!product || product.isBlocked || product.isDeleted) {
      outOfStockItems.push(item);
      errors.push("Product unavailable");
      continue;
    }

    const availableStock = item.variantId
      ? product.variants.id(item.variantId)?.stock || 0
      : product.stock;

    if (availableStock <= 0) {
      outOfStockItems.push(item);
      errors.push(`${product.name} is out of stock`);
      continue;
    }

    if (item.quantity > availableStock) {
      errors.push(`${product.name} stock changed. Only ${availableStock} left`);
    }
  }

  return { errors, outOfStockItems };
}


 const buildCheckoutSession = async ({
  userId,
  buyNow,
  address,
  paymentMethod = "Razorpay",
  sessionSummary = null  
}) => {
  let items = [];
  let stockAdjusted = false;

  if (buyNow) {
    const product = await Product.findById(buyNow.productId).populate("category");
    if (!product) throw new Error("Product not found");

    let availableStock = buyNow.variantId
      ? product.variants.id(buyNow.variantId)?.stock || 0
      : product.stock;

    let quantity = Math.min(buyNow.quantity, availableStock);
    if (quantity !== buyNow.quantity) stockAdjusted = true;

    const basePrice = buyNow.variantId
      ? product.variants.id(buyNow.variantId)?.price
      : product.price;

    const finalPrice = calculateFinalPrice(basePrice, product);

    items.push({
      productId: product._id,
      variantId: buyNow.variantId || null,
      quantity,
      basePrice,
      finalPrice,
      subtotal: finalPrice * quantity,
      sku: buyNow.sku,
      productName: product.name,
      image: buyNow.image || product.images?.[0],
      deliveryCharge: product.deliveryCharge || 0
    });
  }

  else {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart || !cart.items.length) throw new Error("Cart empty");

    for (let item of cart.items) {
      const product = item.productId;

      let availableStock = item.variantId
        ? product.variants.id(item.variantId)?.stock || 0
        : product.stock;

      if (item.quantity > availableStock) {
        item.quantity = availableStock;
        stockAdjusted = true;
      }

      const basePrice = item.variantId
        ? product.variants.id(item.variantId)?.price
        : product.price;

      const finalPrice = calculateFinalPrice(basePrice, product);

      items.push({
        productId: product._id,
        variantId: item.variantId || null,
        quantity: item.quantity,
        basePrice,
        finalPrice,
        subtotal: finalPrice * item.quantity,
        sku: product.sku,
        productName: product.name,
        image: product.images?.[0],
        deliveryCharge: product.deliveryCharge || 0
      });
    }

    if (stockAdjusted) await cart.save();
  }

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const tax = +(subtotal * 0.18).toFixed(2);

  // const deliveryCharge = calculateDeliveryCharge({
  //   subtotal,
  //   products: items,
  //   paymentMethod,
  //   address
  // });
const deliveryCharge = sessionSummary?.deliveryCharge || 0;

  let couponDiscount = 0;
  let appliedCouponId = null;
  let couponName = null;
  let couponMinimumPrice = 0;
  let couponOfferPrice = 0;

  if (
    sessionSummary?.appliedCouponId &&
    subtotal >= sessionSummary.couponMinimumPrice
  ) {
    const coupon = await Coupon.findById(sessionSummary.appliedCouponId);

    if (coupon && coupon.expireOn >= new Date()) {
      if (coupon.discountType === "FLAT") {
        couponDiscount = coupon.offerPrice;
      } else {
        couponDiscount = (subtotal * coupon.offerPrice) / 100;
        if (coupon.maxDiscount) {
          couponDiscount = Math.min(couponDiscount, coupon.maxDiscount);
        }
      }

      couponDiscount = +couponDiscount.toFixed(2);
      appliedCouponId = coupon._id;
      couponName = coupon.couponName;
      couponMinimumPrice = coupon.minimumPrice;
      couponOfferPrice = coupon.offerPrice;
    }
  }

  const finalAmount = +(
    subtotal +
    tax +
    deliveryCharge -
    couponDiscount
  ).toFixed(2);

  return {
    items,
    summary: {
      subtotal,
      tax,
      deliveryCharge,
      couponDiscount,
      appliedCouponId,
      couponName,
      couponMinimumPrice,
      couponOfferPrice,
      finalAmount
    },
    stockAdjusted
  };
};

export { validateStock, buildCheckoutSession };
