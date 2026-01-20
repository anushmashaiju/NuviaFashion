import Wallet from "../models/walletModel.js";

const refundFullOrder = async ({ userId, order, description }) => {
  if (order.refundProcessed) return;

  const refundAmount = Number(order.totalPrice.toFixed(2));
  if (refundAmount <= 0) return;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({ userId, balance: 0, transactions: [] });
  }

  wallet.balance += refundAmount;
  wallet.transactions.push({
    type: "CREDIT",
    amount: refundAmount,
    description
  });

  await wallet.save();

  order.refundProcessed = true;
  order.refundAmount = refundAmount;
  order.refundDate = new Date();
  order.refundMethod = "Wallet";
  await order.save();
};

const refundSingleItem = async ({ userId, item, refundAmount, description }) => {
  if (item.refundProcessed || refundAmount <= 0) return;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) wallet = new Wallet({ userId, balance: 0, transactions: [] });

  wallet.balance = Number((wallet.balance + refundAmount).toFixed(2));
  wallet.transactions.push({
    type: "CREDIT",
    amount: refundAmount,
    description
  });

  await wallet.save();

  item.refundProcessed = true;
  item.refundAmount = refundAmount;
};

export {refundFullOrder ,refundSingleItem };
