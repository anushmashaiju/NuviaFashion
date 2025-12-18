import Wallet from "../models/walletModel.js";

// CANCELLED ORDER REFUND
export const refundCancelledOrder = async (userId, amount) => {
  let wallet = await Wallet.findOne({ userId });

  if (!wallet) wallet = new Wallet({ userId, balance: 0 });

  wallet.balance += amount;

  wallet.transactions.push({
    type: "CREDIT",
    amount,
    description: "Refund for cancelled order"
  });

  await wallet.save();
};

// RETURNED ORDER REFUND
export const refundReturnedOrder = async (userId, amount) => {
  let wallet = await Wallet.findOne({ userId });

  if (!wallet) wallet = new Wallet({ userId, balance: 0 });

  wallet.balance += amount;

  wallet.transactions.push({
    type: "CREDIT",
    amount,
    description: "Refund for returned order"
  });

  await wallet.save();
};
