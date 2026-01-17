import Cart from "../../models/cartModel.js";
import Address from "../../models/addressModel.js";
import Product from "../../models/productModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";
import Coupon from "../../models/couponModel.js";
import { buildCheckoutSession } from "../../utils/stockValidator.js";
import { calculateDeliveryCharge, calculateFinalPrice } from "../../utils/charges.js";

// BUY NOW 

 const buyNow = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const productId = req.params.id;
    const variantId = req.query.variantId || null;

    const product = await Product.findById(productId).populate("category");
    if (!product) {
      req.flash("error", MESSAGES.PRODUCT_NOT_FOUND);
      return res.redirect(`/product/${productId}`);
    }

    let finalItem = {};
    let variant = null;

    if (variantId) {
      variant = product.variants.id(variantId);
      if (!variant) {
        req.flash("error", MESSAGES.VARIANT_NOT_FOUND);
        return res.redirect(`/product/${productId}`);
      }
      if (variant.stock <= 0) {
        req.flash("error", MESSAGES.VARIANT_OUT_OF_STOCK);
        return res.redirect(`/product/${productId}`);
      }

      const price = Number(variant.price);
      const discountPercentage = product.activeOffer?.percentage || 0;
      const discountAmount = (price * discountPercentage) / 100;
      const finalPrice = price - discountAmount;

   const MAX_LIMIT = 5;

finalItem = {
  productId: product._id,
  variantId: variant ? variant._id : null,
  name: product.name,
  image: variant?.image || product.images?.[0],
  price: parseFloat(finalPrice.toFixed(2)),
  basePrice: parseFloat(price.toFixed(2)),
  discount: parseFloat(discountAmount.toFixed(2)),
  quantity: 1,
  sku: variant?.sku || product.sku,
  color: variant?.color || product.color || null,
  size: variant?.size || product.size || null,
  isVariant: !!variant,
  maxQty: Math.min(variant ? variant.stock : product.stock, MAX_LIMIT)
};

    } else {
    
      if (product.stock <= 0) {
        req.flash("error", MESSAGES.PRODUCT_OUT_OF_STOCK);
        return res.redirect(`/product/${productId}`);
      }

      const price = Number(product.price);
      const discountPercentage = product.activeOffer?.percentage || 0;
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
        isVariant: false,
        maxQty: product.stock
      };
    }

    req.session.buyNow = finalItem;

    return res.redirect("/checkout?buyNow=true");

  } catch (err) {
    console.error("Buy Now Error:", err);
    req.flash("error", MESSAGES.BUY_NOW_ERROR);
    return res.redirect("/error");
  }
};

 const updateBuyNowQty = async (req, res) => {
  try {
    const { action } = req.body;
    const buyNow = req.session.buyNow;

    if (!buyNow) {
      return res.json({ success: false ,
       message: MESSAGES.BUY_NOW_SESSION_EXPIRED
       });
    }

    let qty = buyNow.quantity || 1;

   const MAX_LIMIT = 5;

if (action === "inc") {
  if (qty >= Math.min(buyNow.maxQty, MAX_LIMIT)) {
    return res.json({
      success: false,
      message: MESSAGES.OUT_OF_STOCK_OR_LIMIT
    });
  }
  qty++;
}
    if (action === "dec") {
      if (qty <= 1) {
        return res.json({
          success: false,
          message: MESSAGES.MIN_QUANTITY_REACHED
        });
      }
      qty--;
    }

    buyNow.quantity = qty;
    req.session.buyNow = buyNow;

    const subtotal = +(buyNow.price * qty).toFixed(2);
    const tax = +(subtotal * 0.18).toFixed(2);

    const addressId = req.session.selectedAddress;
    const address = addressId ? await Address.findById(addressId) : null;

    const deliveryCharge = calculateDeliveryCharge({
      subtotal,
      paymentMethod: "Razorpay",
      address
    });

    const summary = req.session.orderSummary || {};

    summary.subtotal = subtotal;
    summary.tax = tax;
    summary.deliveryCharge = deliveryCharge;
    summary.finalAmount =
      subtotal + tax + deliveryCharge - (summary.couponDiscount || 0);

   req.session.orderItems = [{
  productId: buyNow.productId,
  variantId: buyNow.variantId || null,
  quantity: qty,
  basePrice: buyNow.basePrice,
  finalPrice: buyNow.price,
  subtotal,
  sku: buyNow.sku,
  productName: buyNow.name,
  image: buyNow.image
}];


    await req.session.save();

return res.json({
  success: true,
  quantity: qty,
  itemTotal: subtotal,
  subtotal: summary.subtotal,
  tax: summary.tax,
  deliveryCharge: summary.deliveryCharge,
  finalAmount: summary.finalAmount,
  summary
});
 } catch (err) {
    console.error(err);
    return res.json({
      success: false,
      message: MESSAGES.SOMETHING_WENT_WRONG
    });
  }
};

//  CHECKOUT PAGE 
 const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).redirect("/login");
    }
    const addresses = await Address.find({ userId }).sort({ isDefault: -1 });
    if (!addresses.length) {
      req.flash("error", MESSAGES.ADD_ADDRESS_BEFORE_CHECKOUT);
      return res.redirect("/user/addresses?redirect=checkout");
    }

const selectedAddressId = req.session.selectedAddress;

const selectedAddress =
  addresses.find(a => a._id.toString() === selectedAddressId) ||
  addresses.find(a => a.isDefault) ||
  addresses[0];


    const isBuyNowFlow = req.query.buyNow === "true";
    const buyNow = isBuyNowFlow ? req.session.buyNow : null;

    if (isBuyNowFlow && !buyNow) {
      req.flash("error", MESSAGES.BUY_NOW_SESSION_EXPIRED);
      return res.redirect("/cart");
    }

    const { items, summary, stockAdjusted } =
      await buildCheckoutSession({
        userId,
        buyNow, 
        address: selectedAddress,
        paymentMethod: "Razorpay",
        sessionSummary: req.session.orderSummary
      });

    if (!items || !items.length) {
      req.flash("error", MESSAGES.NO_ITEMS_TO_CHECKOUT);
      return res.redirect(
        isBuyNowFlow && buyNow?.productId
          ? `/product/${buyNow.productId}`
          : "/cart"
      );
    }

    req.session.orderItems = items.map(i => ({
      productId: i.productId,
      variantId: i.variantId || null,
      quantity: i.quantity,
      basePrice: i.basePrice,
      finalPrice: i.finalPrice,
      discount: i.discount || 0,
      subtotal: i.subtotal,
      sku: i.sku,
      productName: i.productName || i.name,
      image: i.image,
      deliveryCharge: i.deliveryCharge || 0
    }));

    req.session.orderSummary = summary;
    await req.session.save();
    const coupons = await Coupon.find({
      isActive: true,
      expireOn: { $gte: new Date() }
    });

    return res.render("user/checkout", {
      activePage: "Checkout",
      cart: { items },
      addresses,
      summary,
      coupons,
      stockAdjusted,
      isBuyNow: isBuyNowFlow,
      buyNowProductId: buyNow?.productId || null,
      user: req.session.user
    });

  } catch (err) {
    console.error("Checkout Page Error:", err);
    req.flash("error", err.message || MESSAGES.CHECKOUT_ERROR);
    return res.redirect("/cart");
  }
};


// Update Quantity Ajax
 const updateCartQuantityAjax = async (req, res) => {
  let { productId, variantId, action } = req.body;

if (!variantId) variantId = null;

  const userId = req.session.user.id;
  const MAX_LIMIT = 5;

  try {
    const cart = await Cart.findOne({ userId }).populate("items.productId");
    if (!cart) {
      return res.status(STATUS.NOT_FOUND).json({
        success: false,
        message: MESSAGES.CART_NOT_FOUND
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
        message: MESSAGES.PRODUCT_UNAVAILABLE
      });
    }

 let stock;

if (variantId) {
  const variant = product.variants.id(variantId);
  if (!variant) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: MESSAGES.VARIANT_NOT_FOUND
    });
  }
  stock = variant.stock;
} else {
  stock = product.stock;
}
    const allowed = Math.min(stock, MAX_LIMIT);

  if (action === "inc") {
  if (stock <= 0 || item.quantity >= allowed) {
    return res.status(STATUS.BAD_REQUEST).json({
      success: false,
      message: MESSAGES.OUT_OF_STOCK_OR_LIMIT
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
        message:MESSAGES.INVALID_ACTION
      });
    }

cart.items.forEach(i => {
  if (typeof i.price !== "number") {
    throw new Error("Cart item price missing");
  }
});

await cart.save();

req.session.orderItems = cart.items.map(i => ({
  productId: i.productId._id,
  variantId: i.variantId || null,
  quantity: i.quantity,
  basePrice: i.basePrice || i.price,
  finalPrice: i.price,
  subtotal: Number((i.price * i.quantity).toFixed(2)),
  sku: i.sku || i.productId.sku,
  productName: i.productName || i.productId.name,
  image: i.image || i.productId.images?.[0]
}));


await req.session.save();

    const total = cart.items.reduce((acc, i) => {
      return acc + i.price * i.quantity;
    }, 0);

 const cartCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);

const updatedItem = cart.items.find(i =>
  i.productId._id.toString() === productId &&
  (variantId ? i.variantId?.toString() === variantId : !i.variantId)
);

const stockRemaining = updatedItem
  ? Math.max(stock - updatedItem.quantity, 0)
  : stock;


return res.status(STATUS.SUCCESS).json({
  success: true,
  message: MESSAGES.CART_UPDATED,
  quantity: item.quantity,       
  total,
  cartCount,
  stockRemaining                 
});

  } catch (err) {
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: err.message
    });
  }
};

//RECALCULATE CHECKOUT
 const recalculateCheckout = async (req, res) => {
  try {
    const { addressId, paymentMethod } = req.body;

  const address = await Address.findById(addressId);
if (!address) {
  return res.json({ success: false });
}

req.session.selectedAddress = addressId;
await req.session.save(); 

const summary = req.session.orderSummary;
const items = req.session.orderItems;

    if (!summary || !items || items.length === 0) {
      return res.json({ success: false });
    }

    const subtotal = items.reduce(
      (sum, i) => sum + (i.finalPrice * i.quantity),
      0
    );

    const deliveryCharge = calculateDeliveryCharge({
      subtotal,
      paymentMethod,
      address
    });

    summary.subtotal = Number(subtotal.toFixed(2));
    summary.deliveryCharge = Number(deliveryCharge.toFixed(2));

    summary.finalAmount = Number((
      summary.subtotal +
      summary.tax -
      (summary.couponDiscount || 0) +
      summary.deliveryCharge
    ).toFixed(2));

    req.session.orderSummary = summary;
    await req.session.save();

  return res.json({
  success: true,
  summary: {
    subtotal: summary.subtotal,
    tax: summary.tax,
    deliveryCharge: summary.deliveryCharge,
    finalAmount: summary.finalAmount,
    couponDiscount: summary.couponDiscount || 0
  }
});


  } catch (err) {
    console.error("Recalculate error:", err);
    return res.json({ success: false });
  }
};


export {
  buyNow,
  updateBuyNowQty,
  checkoutPage,
  updateCartQuantityAjax,
  recalculateCheckout
};
