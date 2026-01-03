import Wishlist from "../../models/wishlistModel.js"; 
import Cart from "../../models/cartModel.js";
import MESSAGES from "../../utils/messages.js";
import STATUS from "../../utils/statusCodes.js";

// LOAD WISHLIST PAGE
export const getWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    let wishlist = await Wishlist.findOne({ userId })
  .populate("products.productId")
  
    const cart = await Cart.findOne({ userId });

    if (wishlist) {
      wishlist.products = wishlist.products.filter(
        item => item.productId !== null
      );
    }

    const cartCount = cart ? cart.items.length : 0;
    const wishlistCount = wishlist ? wishlist.products.length : 0;

    res.status(STATUS.SUCCESS).render("user/wishlist", {
      activePage: "My Wishlist",
      wishlist: wishlist || { products: [] },
      cartCount,
      wishlistCount
    });

  } catch (error) {
    console.error("getWishlist Error:", error);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// ADD TO WISHLIST OR TOGGLE
export const toggleWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const productId = req.params.id;
const variantId = req.body?.variantId
  ? new mongoose.Types.ObjectId(req.body.variantId)
  : null;


    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: MESSAGES.USER_NOT_LOGGED_IN
      });
    }

    let wishlist = await Wishlist.findOne({ userId });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId,
        products: [{ productId, variantId }]
      });

      return res.status(STATUS.CREATED).json({
        success: true,
        inWishlist: true,
        count: 1
      });
    }

    const index = wishlist.products.findIndex(p =>
      p.productId.toString() === productId &&
     String(p.variantId) === String(variantId)

    );

    if (index !== -1) {
      wishlist.products.splice(index, 1);
      await wishlist.save();

      return res.status(STATUS.SUCCESS).json({
        success: true,
        inWishlist: false,
        count: wishlist.products.length
      });
    }

    wishlist.products.push({ productId, variantId });
    await wishlist.save();

    return res.status(STATUS.SUCCESS).json({
      success: true,
      inWishlist: true,
      count: wishlist.products.length
    });

  } catch (err) {
    console.error("toggleWishlist Error:", err);
    return res.status(STATUS.SERVER_ERROR).json({
      success: false,
      message: MESSAGES.SERVER_ERROR
    });
  }
};

// REMOVE FROM WISHLIST
export const removeFromWishlist = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    const { productId } = req.body;

    if (!userId) {
      return res.status(STATUS.UNAUTHORIZED).json({ success: false, message: MESSAGES.USER_NOT_LOGGED_IN });
    }

    const wishlist = await Wishlist.findOne({ userId });
    if (!wishlist) {
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.NOT_FOUND });
    }

    wishlist.products = wishlist.products.filter(p => p.productId.toString() !== productId);
    await wishlist.save();

    const count = wishlist.products.length;
    res.status(STATUS.SUCCESS).json({ success: true, message: "Removed from wishlist", count });

  } catch (error) {
    console.error("removeFromWishlist Error:", error);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};
