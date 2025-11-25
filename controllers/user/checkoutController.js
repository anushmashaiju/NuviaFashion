import Cart from "../../models/cartModel.js";
import Address from "../../models/addressModel.js";
import Product from "../../models/productModel.js";
import Order from "../../models/orderModel.js";
import crypto from "crypto";


 // BUY NOW

export const buyNow = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const productId = req.params.id;
    const product = await Product.findById(productId).populate("category");

    if (!product || product.stock <= 0 || product.isDeleted || product.isBlocked || !product.isListed || !product.category?.isListed) {
      req.flash("error", "This product is unavailable");
      return res.redirect(`/product/${productId}`);
    }

    const price = product.salePrice || product.price;
    const discountAmount = product.discount ? (price * product.discount) / 100 : 0;
    const finalPrice = price - discountAmount;

    req.session.buyNow = {
      productId: product._id,
      name: product.name,
      image: product.images?.[0] || "",
      price: parseFloat(finalPrice.toFixed(2)),
      quantity: 1,
      basePrice: parseFloat(product.price.toFixed(2)),
      discount: parseFloat(discountAmount.toFixed(2)),
      sku: product.sku || `SKU-${product._id.toString().slice(-6)}`,
      color: product.color || null,
      size: product.size || null
    };

    return res.redirect("/checkout");
  } catch (err) {
    console.error("Buy Now Error:", err);
    res.redirect("/error");
  }
};

 // CHECKOUT PAGE 

export const checkoutPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const addresses = await Address.find({ userId }).sort({ isDefault: -1 });

    let items = [];
    let isBuyNow = false;

    if (req.session.buyNow) {
      const bItem = req.session.buyNow;
      const subtotal = parseFloat((bItem.price * bItem.quantity).toFixed(2));

      items.push({
        productId: {
          _id: bItem.productId,
          name: bItem.name,
          images: [bItem.image],
          price: bItem.price,
          salePrice: bItem.price,
        },
        quantity: bItem.quantity,
        basePrice: bItem.basePrice,
        discount: bItem.discount,
        finalPrice: bItem.price,
        subtotal,
        sku: bItem.sku,
        productName: bItem.name,
        color: bItem.color,
        size: bItem.size,
        image: bItem.image
      });

      isBuyNow = true;
    } else {
      const cartData = await Cart.findOne({ userId }).populate("items.productId");
      if (!cartData || cartData.items.length === 0) {
        req.flash("error", "Your cart is empty");
        return res.redirect("/cart");
      }

      const invalidItems = cartData.items.filter(item =>
        !item.productId || item.productId.stock <= 0 || !item.productId.isListed || item.productId.isBlocked || item.productId.isDeleted
      );
      if (invalidItems.length > 0) {
        req.flash("error", "Remove unavailable items before checkout");
        return res.redirect("/cart");
      }

      items = cartData.items.map(item => {
        const price = item.productId.salePrice || item.productId.price;
        const discountAmount = item.productId.discount ? (price * item.productId.discount) / 100 : 0;
        const finalPrice = parseFloat((price - discountAmount).toFixed(2));
        const subtotal = parseFloat((finalPrice * item.quantity).toFixed(2));

        return {
          productId: {
            _id: item.productId._id,
            name: item.productId.name,
            images: item.productId.images?.length ? item.productId.images : [item.image || ""],
            price: parseFloat(item.productId.price.toFixed(2)),
            salePrice: finalPrice
          },
          quantity: item.quantity,
          basePrice: parseFloat(item.productId.price.toFixed(2)),
          discount: parseFloat(discountAmount.toFixed(2)),
          finalPrice,
          subtotal,
          sku: item.productId.sku || `SKU-${item.productId._id.toString().slice(-6)}`,
          productName: item.productId.name,
          color: item.productId.color || null,
          size: item.productId.size || null,
          image: item.productId.images?.[0] || item.image || ""
        };
      });
    }

    const subtotal = parseFloat(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));
    const tax = parseFloat((subtotal * 0.18).toFixed(2));
    const totalPrice = parseFloat((subtotal + tax).toFixed(2));

    res.render("user/checkout", {
      activePage: "Checkout",
      cart: { items },
      addresses,
      summary: { subtotal, tax, finalAmount: totalPrice },
      isBuyNow
    });
  } catch (err) {
    console.error("Checkout Page Error:", err);
    res.redirect("/error");
  }
};


  // PLACE ORDER 

export const placeCODOrder = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "User not logged in" });

    const { selectedAddress } = req.body;
    if (!selectedAddress) return res.status(400).json({ success: false, message: "Address required" });

    let items = [];

    if (req.session.buyNow) {
      const bItem = req.session.buyNow;
      const subtotal = parseFloat((bItem.price * bItem.quantity).toFixed(2));

      items.push({
        productId: bItem.productId,
        quantity: bItem.quantity,
        basePrice: bItem.basePrice,
        discount: bItem.discount,
        finalPrice: bItem.price,
        subtotal,
        sku: bItem.sku,
        productName: bItem.name,
        color: bItem.color,
        size: bItem.size,
        image: bItem.image
      });
    } else {
      const cartData = await Cart.findOne({ userId }).populate("items.productId");
      if (!cartData || cartData.items.length === 0) return res.status(400).json({ success: false, message: "Cart is empty" });

      items = cartData.items.map(item => {
        const price = item.productId.salePrice || item.productId.price;
        const discountAmount = item.productId.discount ? (price * item.productId.discount) / 100 : 0;
        const finalPrice = parseFloat((price - discountAmount).toFixed(2));
        const subtotal = parseFloat((finalPrice * item.quantity).toFixed(2));

        return {
          productId: item.productId._id,
          quantity: item.quantity,
          basePrice: parseFloat(item.productId.price.toFixed(2)),
          discount: parseFloat(discountAmount.toFixed(2)),
          finalPrice,
          subtotal,
          sku: item.productId.sku || `SKU-${item.productId._id.toString().slice(-6)}`,
          productName: item.productId.name,
          color: item.productId.color || null,
          size: item.productId.size || null,
          image: item.productId.images?.[0] || ""
        };
      });
    }

    const subtotal = parseFloat(items.reduce((sum, i) => sum + i.subtotal, 0).toFixed(2));
    const tax = parseFloat((subtotal * 0.18).toFixed(2));
    const totalPrice = parseFloat((subtotal + tax).toFixed(2));

    const orderID = "ORD-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const newOrder = new Order({
      user_id: userId,
      shippingAddressId: selectedAddress,
      items,
      subtotal,
      discount: parseFloat(items.reduce((sum, i) => sum + i.discount, 0).toFixed(2)),
      tax,
      totalPrice,
      orderID,
      orderStatus: "Order Placed",
      paymentMethod: "COD"
    });

    await newOrder.save();

     for (let i of items) {
      await Product.updateOne(
        { _id: i.productId, stock: { $gte: i.quantity } },
        { $inc: { stock: -i.quantity } }
      );
    }

    if (req.session.buyNow) delete req.session.buyNow;
    else await Cart.findOneAndUpdate({ userId }, { items: [] });

    res.json({ success: true, message: "Order placed successfully", orderId: newOrder._id });
  } catch (err) {
    console.error("Place COD Order Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


  // ORDER SUCCESS PAGE

export const orderSuccessPage = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId);
    if (!order) return res.redirect("/");

    res.render("user/orderSuccess", {
      order,
      activePage: "orderSuccess"
    });
  } catch (err) {
    console.error("Order Success Page Error:", err);
    res.redirect("/error");
  }
};
