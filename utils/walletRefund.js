import Wallet from "../models/walletModel.js";

export const processWalletRefund = async ({ userId, amount, description, order }) => {
  // If order is provided, calculate refund amount properly
  if (order) {
    if (order.refundProcessed) return; // prevent double refund
    userId = order.user_id;

    // Refund amount = totalPrice + couponDiscount (to neutralize coupon)
    amount = Number((order.totalPrice + (order.couponDiscount || 0)).toFixed(2));
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

// export const processWalletRefund = async ({ userId, amount, description, order }) => {
//   // If order is provided, override userId and amount from order
//   if (order) {
//     if (order.refundProcessed) return; // prevent double refund
//     userId = order.user_id;
//     amount = order.totalPrice;
//     description = description || `Refund for order #${order._id}`;
//   }

//   if (!userId || !amount || amount <= 0) return; // safety check

//   // Find or create wallet
//   let wallet = await Wallet.findOne({ userId });
//   if (!wallet) {
//     wallet = await Wallet.create({
//       userId,
//       balance: amount,
//       transactions: [{ type: "CREDIT", amount, description }],
//     });
//   } else {
//     wallet.balance += amount;
//     wallet.transactions.push({ type: "CREDIT", amount, description });
//     wallet.balance = Number(wallet.balance.toFixed(2));
//     await wallet.save();
//   }

//   // Mark order as refunded if applicable
//   if (order) {
//     order.refundProcessed = true;
//     await order.save();
//   }
// };
