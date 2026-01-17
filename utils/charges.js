import Product from "../models/productModel.js";

//  PRICE CALCULATION 
const calculateFinalPrice = (basePrice, product) => {
  if (!product || typeof basePrice !== "number") return 0;

  let discount = 0;

  if (product.activeOffer?.percentage > 0) {
    discount = product.activeOffer.percentage;
  }
  return Math.round(basePrice - (basePrice * discount) / 100);
};

//  CART NORMALIZATION 
const normalizeCartPrices = async (cart) => {
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
const calculateDeliveryCharge = ({
  subtotal = 0,
  paymentMethod = "Razorpay",
  address
}) => {
  if (!address) return 0;

  const state = address.state?.trim().toLowerCase();
  const isKerala = state === "kerala";

  let charge = 0;

  if (isKerala) {
    if (subtotal >= 1000) charge = 0;
    else if (subtotal >= 500) charge = 30;
    else charge = 50;
  } else {
    if (subtotal >= 1000) charge = 50;
    else if (subtotal >= 500) charge = 80;
    else charge = 100;
  }

  if (paymentMethod === "COD") {
    charge += 30;
  }
console.log("calculateDeliveryCharge called with:", {
  subtotal,
  state: address?.state,
  paymentMethod
});
  return charge;
};


// ACTIVE OFFER
const applyActiveOffer = (products) => {
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


export {
  calculateFinalPrice,
  normalizeCartPrices,
  calculateDeliveryCharge,
  applyActiveOffer
};

