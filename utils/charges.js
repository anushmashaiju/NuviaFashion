import Product from "../models/productModel.js";

//  PRICE CALCULATION 
export const calculateFinalPrice = (basePrice, product) => {
  if (!product || typeof basePrice !== "number") return 0;

  let discount = 0;

  if (product.activeOffer?.percentage > 0) {
    discount = product.activeOffer.percentage;
  } else if (product.productOffer?.percentage > 0) {
    discount = product.productOffer.percentage;
  }

  return Math.round(basePrice - (basePrice * discount) / 100);
};

//  CART NORMALIZATION 
export const normalizeCartPrices = async (cart) => {
  for (const item of cart.items) {
    const product = await Product.findById(item.productId);
    if (!product) continue;

    let basePrice;

    if (item.variantId) {
      const variant = product.variants.id(item.variantId);
      if (!variant) continue;
      basePrice = variant.price;
    } else {
      basePrice = product.price;
    }

    item.price = calculateFinalPrice(basePrice, product);
  }
};

//  DELIVERY CHARGE 
export const calculateDeliveryCharge = ({
  subtotal = 0,
paymentMethod = "Razorpay",
  address
}) => {
  if (!address) return 0;

  let deliveryCharge = 0;
const state = address.state?.trim().toLowerCase();
const isKerala = state === "kerala";

  if (isKerala) {
    if (subtotal >= 1000) deliveryCharge = 0;
    else if (subtotal >= 500) deliveryCharge = 30;
    else deliveryCharge = 50;
  } else {
    if (subtotal >= 1000) deliveryCharge = 50;
    else if (subtotal >= 500) deliveryCharge = 80;
    else deliveryCharge = 100;
  }

  return deliveryCharge;
};

// ACTIVE OFFER
export const applyActiveOffer = (products) => {
  const now = new Date();

  return products.map((p) => {
    const product = p.toObject ? p.toObject() : p;

    let activeOffer = null;

    if (
      product.productOffer?.percentage > 0 &&
      now >= new Date(product.productOffer.startDate) &&
      now <= new Date(product.productOffer.endDate)
    ) {
      activeOffer = {
        percentage: product.productOffer.percentage,
        type: "product"
      };
    } else if (
      product.category?.categoryOffer?.percentage > 0 &&
      product.category.categoryOffer.isActive
    ) {
      activeOffer = {
        percentage: product.category.categoryOffer.percentage,
        type: "category"
      };
    }

    product.activeOffer = activeOffer;
    return product;
  });
};




