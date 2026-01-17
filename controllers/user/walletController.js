import Wallet from "../../models/walletModel.js";
import Cart from "../../models/cartModel.js";
import Address from "../../models/addressModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

const round2 = (value) => Number((value || 0).toFixed(2));

// GET USER WALLET PAGE
const getWalletPage = async (req, res) => {
  try {
    if (!req.session.user) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const userId = req.session.user?._id;

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

    const tax = round2(subtotal * 0.18);
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
const addMoneyToWallet = async (req, res) => {
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

    res.json({ message: MESSAGES.WALLET_UPDATED_SUCCESS, balance: wallet.balance });
  } catch (err) {
    console.error(err);
    res.status(STATUS.SERVER_ERROR).json({ message: MESSAGES.SERVER_ERROR });
  }
};

// APPLY WALLET
const applyWallet = async (req, res) => {
  try {
    const userId = req.session.user?._id;

    if (!userId) return res.status(STATUS.UNAUTHORIZED).json({ success: false, message: MESSAGES.LOGIN_REQUIRED });

    const { totalAmount } = req.body;
    const wallet = await Wallet.findOne({ userId });
    if (!wallet || wallet.balance <= 0) return res.json({ success: false, message: MESSAGES.NO_WALLET_BALANCE });

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
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};

// GET WALLET BALANCE
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).json({ balance: 0 });

    const wallet = await Wallet.findOne({ userId });
    res.json({ balance: Number(wallet?.balance || 0).toFixed(2) });

  } catch (err) {
    console.error("Wallet Balance Error:", err);
    res.status(STATUS.SERVER_ERROR).json({ balance: 0 });
  }
};

export {
  getWalletPage,
  addMoneyToWallet,
  applyWallet,
  getWalletBalance
};