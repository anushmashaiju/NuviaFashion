import Wishlist from "../../models/wishlistModel.js";
import Product from "../../models/productModel.js";
import User from "../../models/userModel.js";
import Cart from "../../models/cartModel.js";

//  Load wishlist page
export const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const wishlist = await Wishlist.findOne({ userId }).populate("products.productId");
    const cart = await Cart.findOne({ userId });

    const cartCount = cart ? cart.items.length : 0;
    const wishlistCount = wishlist ? wishlist.products.length : 0;

    res.render("user/wishlist", {
      activePage: "My Wishlist",
      wishlist: wishlist || { products: [] },
      cartCount,
      wishlistCount
    });

  } catch (error) {
    console.log("getWishlist Error:", error);
    res.status(500).send("Server error");
  }
};

//  Add to Wishlist using GET 
export const addToWishlist = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const productId = req.params.id;

    if (!userId) {
      return res.json({ success: false, message: "Login required" });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      await Wishlist.create({
        userId,
        products: [{ productId }],
      });

      return res.json({ success: true, message: "Added to Wishlist" });
    }

    const exists = wishlist.products.some(
      item => item.productId.toString() === productId
    );

    if (exists) {
      return res.json({ success: true, already: true, message: "Already in Wishlist" });
    }

    wishlist.products.push({ productId });
    await wishlist.save();

    return res.json({ success: true, message: "Added to Wishlist" });

  } catch (err) {
    console.log("Add Wishlist Error:", err);
    return res.json({ success: false, message: "Something went wrong" });
  }
};

//  Remove product (AJAX)
export const removeFromWishlist = async (req, res) => {
  try {
   const userId = req.session.user.id;
    const { productId } = req.body;

    await Wishlist.findOneAndUpdate(
      { userId },
      { $pull: { products: { productId } } }
    );

    res.json({ success: true, message: "Removed from wishlist" });

  } catch (error) {
    console.log("removeFromWishlist Error:", error);
    res.status(500).json({ success: false });
  }
};

