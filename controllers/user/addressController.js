import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Address from "../../models/addressModel.js";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

// Validation helper
const validateAddressInput = ({ name, phone, addressLine, area, state, pincode }) => {
  const errors = {};
  const phoneRegex = /^[6-9]\d{9}$/;
  const pincodeRegex = /^\d{6}$/;
  const nameRegex = /^[A-Za-z ]{3,}$/;

  if (!name || !nameRegex.test(name)) errors.name = MESSAGES.INVALID_NAME;
  if (!phone || !phoneRegex.test(phone)) errors.phone = MESSAGES.INVALID_PHONE;
  if (!addressLine || addressLine.length < 5) errors.addressLine = MESSAGES.INVALID_ADDRESS_LINE;
  if (!area || area.length < 3) errors.area = MESSAGES.INVALID_AREA;
  if (!state || state.length < 3) errors.state = MESSAGES.INVALID_STATE;
  if (!pincode || !pincodeRegex.test(pincode)) errors.pincode = MESSAGES.INVALID_PINCODE;

  return errors;
};

// Render Addresses Page
const getAddressPage = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id)
      return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const userId = req.session.user.id;
    const addresses = await Address.find({ userId }).lean();

    const {
      name = "",
      phone = "",
      addressLine = "",
      landmark = "",
      area = "",
      state = "",
      pincode = "",
      addressType = "home",
      redirect = "",
      nameError = "",
      phoneError = "",
      addressLineError = "",
      areaError = "",
      stateError = "",
      pincodeError = "",
      error = ""
    } = req.query;

    res.status(STATUS.SUCCESS).render("user/addresses", {
      title: "My Addresses",
      user: req.session.user,
      addresses,
      name,
      phone,
      addressLine,
      landmark,
      area,
      state,
      pincode,
      addressType,
      redirect,
      error,
      nameError,
      phoneError,
      addressLineError,
      areaError,
      stateError,
      pincodeError,
      activePage: "My Addresses"
    });

  } catch (err) {
    console.error("Error rendering address page:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// Add New Address
const addAddress = async (req, res) => {
  try {
    const { name, phone, addressLine, landmark, area, state, pincode, addressType } = req.body;
    const userId = req.session.user?.id;

    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const errors = validateAddressInput({ name, phone, addressLine, area, state, pincode });

    if (Object.keys(errors).length > 0) {
      const query = new URLSearchParams({
        ...req.body,
        redirect: req.query.redirect || ""
      });

      Object.keys(errors).forEach(key => {
        query.set(`${key}Error`, errors[key]);
      });

      return res.status(STATUS.BAD_REQUEST).redirect(`/user/addresses?${query.toString()}`);
    }

    const hasAddresses = await Address.exists({ userId });
    const newAddress = new Address({
      userId, name, phone, addressLine, landmark, area, state, pincode, addressType,
      isDefault: !hasAddresses
    });

    await newAddress.save();

    if (req.query.redirect === "checkout")
      return res.status(STATUS.CREATED).redirect("/checkout");

    return res.status(STATUS.CREATED).redirect("/user/addresses");

  } catch (err) {
    console.error("Error adding address:", err);
    return res.status(STATUS.SERVER_ERROR).redirect(`/user/addresses?error=${MESSAGES.ADDRESS_ADD_FAILED}`);
  }
};

// Get Edit Address Page
const getEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user.id;
    const redirect = req.query.redirect || "";

    const address = await Address.findOne({ _id: addressId, userId }).lean();
    if (!address)
      return res.status(STATUS.NOT_FOUND).redirect(`/user/addresses?error=${MESSAGES.ADDRESS_NOT_FOUND}`);

    const {
      name = address.name,
      phone = address.phone,
      addressLine = address.addressLine,
      landmark = address.landmark,
      area = address.area,
      state = address.state,
      pincode = address.pincode,
      addressType = address.addressType,
      nameError = "",
      phoneError = "",
      addressLineError = "",
      areaError = "",
      stateError = "",
      pincodeError = "",
      error = ""
    } = req.query;

    res.status(STATUS.SUCCESS).render("user/editAddress", {
      address,
      redirect,
      name,
      phone,
      addressLine,
      landmark,
      area,
      state,
      pincode,
      addressType,
      nameError,
      phoneError,
      addressLineError,
      areaError,
      stateError,
      pincodeError,
      error,
      title: "Edit Address",
      activePage: "Edit Address"
    });

  } catch (err) {
    console.error("Get Edit Address Error:", err);
    res.status(STATUS.SERVER_ERROR).send(MESSAGES.SERVER_ERROR);
  }
};

// Post Edit Address
const postEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user.id;
    const redirect = req.query.redirect || "";

    const { name, phone, addressLine, landmark, area, state, pincode, addressType } = req.body;

    const errors = validateAddressInput({ name, phone, addressLine, area, state, pincode });

    if (Object.keys(errors).length > 0) {
      const query = new URLSearchParams({
        name, phone, addressLine, landmark, area, state, pincode, addressType,
        redirect
      });
      Object.keys(errors).forEach(key => {
        query.set(`${key}Error`, errors[key]);
      });

      return res.status(STATUS.BAD_REQUEST).redirect(`/user/addresses/edit/${addressId}?${query.toString()}`);
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address)
      return res.status(STATUS.NOT_FOUND).redirect(`/user/addresses?error=${MESSAGES.ADDRESS_NOT_FOUND}`);

    address.name = name;
    address.phone = phone;
    address.addressLine = addressLine;
    address.landmark = landmark;
    address.area = area;
    address.state = state;
    address.pincode = pincode;
    address.addressType = addressType;

    await address.save();

    if (redirect === "checkout")
      return res.status(STATUS.SUCCESS).redirect("/checkout");

    return res.status(STATUS.SUCCESS).redirect("/user/addresses");

  } catch (error) {
    console.error("Address update failed:", error);
    return res
      .status(STATUS.SERVER_ERROR)
      .redirect(`/user/addresses/edit/${req.params.id}?error=${MESSAGES.ADDRESS_UPDATE_FAILED}`);
  }
};

// Set Default Address
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;

    await Address.updateMany({ userId }, { $set: { isDefault: false } });
    await Address.findByIdAndUpdate(addressId, { $set: { isDefault: true } });

    res.status(STATUS.SUCCESS).redirect("/user/addresses");
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(STATUS.SERVER_ERROR).render("errorPage", { errorMessage: MESSAGES.ADDRESS_UPDATE_FAILED });
  }
};

// Delete Address
const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;

    await Address.findByIdAndDelete(addressId);

    res.status(STATUS.SUCCESS).redirect("/user/addresses");
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(STATUS.SERVER_ERROR).render("errorPage", { errorMessage: MESSAGES.ADDRESS_DELETE_FAILED });
  }
};

export {
  getAddressPage,
  addAddress,
  getEditAddress,
  postEditAddress,
  setDefaultAddress,
  deleteAddress
};
