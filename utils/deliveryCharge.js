export const calculateDeliveryCharge = ({
  subtotal,
  products,
  paymentMethod,
  address
}) => {
  let deliveryCharge = 0;

  // PHASE 1: Order value based
  if (subtotal < 999) {
    deliveryCharge = 50;
  }

  // PHASE 2: Product-based (bulky items)
  const productDeliveryCharge = Math.max(
    ...products.map(p => p.deliveryCharge || 0),
    0
  );

  deliveryCharge = Math.max(deliveryCharge, productDeliveryCharge);

  // PHASE 3: Location based
  if (address?.deliveryCharge) {
    deliveryCharge += address.deliveryCharge;
  }

  // COD extra charge
  if (paymentMethod === "COD") {
    deliveryCharge += 50;
  }

  return deliveryCharge;
};
