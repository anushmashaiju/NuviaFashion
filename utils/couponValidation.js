const validateCouponAfterItemRemoval = (order, productId) => {
  if (!order.couponApplied || order.couponMinimumPrice <= 0) {
    return { valid: true };
  }

  const activeItems = order.items.filter(
    i => !i.isCancelled && !i.isReturned
  );

  const remainingItems = activeItems.filter(
    i => i.productId.toString() !== productId
  );

  if (remainingItems.length === 0) {
    return {
      valid: false,
      reason: "LAST_ITEM"
    };
  }

  const remainingSubtotal = remainingItems.reduce(
    (sum, i) => sum + i.finalPrice * i.quantity,
    0
  );

  if (remainingSubtotal < order.couponMinimumPrice) {
    return {
      valid: false,
      reason: "MINIMUM_NOT_MET",
      remainingSubtotal
    };
  }

  return { valid: true };
};

export { validateCouponAfterItemRemoval };
