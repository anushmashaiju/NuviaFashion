import Wallet from "../../models/walletModel.js";
import Cart from "../../models/cartModel.js";
import Order from "../../models/orderModel.js";
import Address from "../../models/addressModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

// Helper: round to 2 decimals

const round2 = (value) => Number((value || 0).toFixed(2));

// WALLET PAYMENT
export const walletPayment = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }

    const { selectedAddress } = req.body;
    const summary = req.session.orderSummary;
    if (!summary) {
      return res.status(400).json({ success: false, message: "Invalid order" });
    }

    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance < summary.finalAmount) {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    /* ---------------- WALLET DEDUCTION ---------------- */
    wallet.balance = round2(wallet.balance - summary.finalAmount);
    wallet.transactions.push({
      type: "DEBIT",
      amount: round2(summary.finalAmount),
      description: "Order payment via Wallet"
    });
    await wallet.save();

   const sessionItems = req.session.orderItems;
if (!sessionItems || sessionItems.length === 0) {
  return res.status(400).json({ success: false, message: "Order items missing" });
}

const orderItems = sessionItems.map(item => ({
  productId: item.productId,
  quantity: item.quantity,
  basePrice: round2(item.basePrice),
  discount: round2(item.discount || 0),
  finalPrice: round2(item.finalPrice),
  subtotal: round2(item.subtotal),
  sku: item.sku,
  productName: item.productName,
  color: item.color || null,
  size: item.size || null,
  image: item.image || "",
  deliveryCharge: round2(item.deliveryCharge || 0)
}));


    /* ---------------- CREATE ORDER ---------------- */
 const order = await Order.create({
  orderID: "ORD" + Date.now(),
  user_id: userId, // ✅ important
  shippingAddressId: selectedAddress,
  items: orderItems,
  subtotal: round2(summary.subtotal),
  tax: round2(summary.tax),
  deliveryCharge: round2(summary.deliveryCharge || 0),
  couponDiscount: round2(summary.couponDiscount || 0),
  walletUsed: round2(summary.finalAmount),
  totalPrice: round2(summary.finalAmount),
  paymentMethod: "Wallet",
  paymentStatus: "success",
  orderStatus: "Order Placed",
  statusTimeline: {
    orderPlaced: new Date()
  }
});

    /* ---------------- CLEAR CART ---------------- */
   if (!req.session.buyNow) {
  await Cart.updateOne({ userId }, { $set: { items: [] } });
}


// ✅ CLEAN SESSION
delete req.session.orderItems;
delete req.session.orderSummary;
delete req.session.buyNow;

await req.session.save();

res.json({ success: true, orderId: order.orderID });

  } catch (err) {
    console.error("Wallet Payment Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};


// REFUND ON CANCEL
export const refundOnCancel = async (order) => {
  const wallet = await Wallet.findOne({ userId: order.userId });
  wallet.balance = round2(wallet.balance + order.totalPrice);
  wallet.transactions.push({
    type: "CREDIT",
    amount: round2(order.totalPrice),
    description: "Refund for canceled order"
  });
  await wallet.save();
};

// REFUND ON RETURN (ADMIN)
export const approveReturnRefund = async (orderId) => {
  const order = await Order.findById(orderId);
  const wallet = await Wallet.findOne({ userId: order.userId });
  wallet.balance = round2(wallet.balance + order.totalPrice);
  wallet.transactions.push({
    type: "CREDIT",
    amount: round2(order.totalPrice),
    description: "Refund for returned order (Admin Approved)"
  });
  await wallet.save();
};

// GET USER WALLET PAGE
export const getWalletPage = async (req, res) => {
  try {
    if (!req.session.user) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const userId = req.session.user.id;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) wallet = await Wallet.create({ userId, balance: 0, transactions: [] });

    const cart = await Cart.findOne({ userId }).populate("items.productId");
    const addresses = await Address.find({ userId });

    let subtotal = 0;
    if (cart && cart.items.length > 0) {
      cart.items.forEach(item => {
        const price = item.productId.finalPrice || item.productId.price;
        subtotal += price * item.quantity;
      });
    }

    const tax = round2(subtotal * 0.18); // GST 18%
    const finalAmount = round2(subtotal + tax);

    const summary = { subtotal: round2(subtotal), tax, finalAmount };

    res.status(STATUS.SUCCESS).render("user/wallet", {
      wallet,
      user: req.session.user,
      activePage: "wallet",
      cart: cart || { items: [] },
      addresses: addresses || [],
      isBuyNow: !!req.session.buyNow,
      buyNowProductId: req.session.buyNow?.productId || null,
      summary
    });
  } catch (err) {
    console.error("Wallet Load Error:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// ADD MONEY TO WALLET
export const addMoneyToWallet = async (req, res) => {
  try {
    const amount = round2(Number(req.body.amount));
    const userId = req.session.user.id;
    if (!amount || amount <= 0) return res.status(STATUS.BAD_REQUEST).json({ message: MESSAGES.INVALID_INPUT });

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: amount,
        transactions: [{ type: "CREDIT", amount, description: "Money added to wallet" }]
      });
    } else {
      wallet.balance = round2(wallet.balance + amount);
      wallet.transactions.push({ type: "CREDIT", amount, description: "Money added to wallet" });
    }
    await wallet.save();

    res.json({ message: "Wallet balance updated successfully", balance: wallet.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// APPLY WALLET
export const applyWallet = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Login required" });

    const { totalAmount } = req.body;
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance <= 0) return res.json({ success: false, message: "No wallet balance" });

    const usedAmount = Math.min(wallet.balance, totalAmount);
    const newTotal = round2(totalAmount - usedAmount);

    return res.json({
      success: true,
      usedAmount: round2(usedAmount),
      newTotal,
      remainingBalance: round2(wallet.balance - usedAmount)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET WALLET BALANCE
export const getWalletBalance = async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.session.user.id });
  res.json({ balance: round2(wallet?.balance || 0) });
};
