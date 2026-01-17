import Wallet from "../models/walletModel.js";

const processWalletRefund = async ({ userId, order, item, description }) => {
  if (!order || !item) return;
  if (item.refundProcessed) return;

  const refundable =
    order.paymentMethod !== "COD" ||
    (order.paymentMethod === "COD" && order.orderStatus === "Delivered");

  if (!refundable) return;

  const itemSubtotal = Number((item.finalPrice * item.quantity).toFixed(2));

  let itemTax = 0;
  if (order.tax > 0 && order.subtotal > 0) {
    itemTax = Number(((itemSubtotal / order.subtotal) * order.tax).toFixed(2));
  }

  const refundAmount = Number((itemSubtotal + itemTax).toFixed(2));
  if (refundAmount <= 0) return;

  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = new Wallet({
      userId,
      balance: refundAmount,
      transactions: [],
    });
  } else {
    wallet.balance = Number((wallet.balance + refundAmount).toFixed(2));
  }

  wallet.transactions.push({
    type: "CREDIT",
    amount: refundAmount,
    description: description || `Refund for ${item.productName}`,
  });

  await wallet.save();

  item.refundProcessed = true;
  item.refundAmount = refundAmount;
  item.isReturned = true;

  order.refundAmount = Number(((order.refundAmount || 0) + refundAmount).toFixed(2));

  const allRefunded = order.items.every(i => i.isCancelled || i.refundProcessed);

  if (allRefunded) {
    order.refundProcessed = true;
    order.refundDate = new Date();
    order.refundMethod = "Wallet";
    order.orderStatus = "Returned";
  }

  await order.save();
};


export { processWalletRefund };
