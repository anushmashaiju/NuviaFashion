import Wallet from "../models/walletModel.js";

export const processWalletRefund = async ({ userId, amount, description, order }) => {
  if (order) {
    if (order.refundProcessed) return; 
    userId = order.user_id;

    amount = Number((order.totalPrice).toFixed(2));
    description = description || `Refund for order #${order.orderID}`;
  }

  if (!userId || !amount || amount <= 0) return;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({
      userId,
      balance: amount,
      transactions: [{ type: "CREDIT", amount, description }]
    });
  } else {
    wallet.balance = Number((wallet.balance + amount).toFixed(2));
    wallet.transactions.push({ type: "CREDIT", amount, description });
    await wallet.save();
  }

  if (order) {
    order.refundProcessed = true;
    await order.save();
  }
};
