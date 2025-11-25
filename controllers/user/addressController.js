import Product from "../../models/productModel.js";
import Category from "../../models/categoryModel.js";
import Address from "../../models/addressModel.js"

// Validation helper
const validateAddressInput = ({ name, phone, addressLine, area, state, pincode }) => {
  const errors = {};
  const phoneRegex = /^[6-9]\d{9}$/;
  const pincodeRegex = /^\d{6}$/;
  const nameRegex = /^[A-Za-z ]{3,}$/;

  if (!name || !nameRegex.test(name)) errors.name = "Enter a valid full name (min 3 characters)";
  if (!phone || !phoneRegex.test(phone)) errors.phone = "Invalid mobile number! Must be 10 digits";
  if (!addressLine || addressLine.length < 5) errors.addressLine = "Address Line must have at least 5 characters";
  if (!area || area.length < 3) errors.area = "Area must have at least 3 characters";
  if (!state || state.length < 3) errors.state = "State must have at least 3 characters";
  if (!pincode || !pincodeRegex.test(pincode)) errors.pincode = "Invalid Pincode! Must be exactly 6 digits";

  return errors;
};

// Render Addresses Page
export const getAddressPage = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) return res.redirect("/login");

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

    res.render("user/addresses", {
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
    res.redirect("/error");
  }
};

// Add New Address
export const addAddress = async (req, res) => {
  try {
    const { name, phone, addressLine, landmark, area, state, pincode, addressType } = req.body;
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const errors = validateAddressInput({ name, phone, addressLine, area, state, pincode });

    if (Object.keys(errors).length > 0) {
      const query = new URLSearchParams({
        ...req.body,
        redirect: req.query.redirect || ""
      });

      Object.keys(errors).forEach(key => {
        query.set(`${key}Error`, errors[key]);
      });

      return res.redirect(`/user/addresses?${query.toString()}`);
    }

    const hasAddresses = await Address.exists({ userId });
    const newAddress = new Address({
      userId, name, phone, addressLine, landmark, area, state, pincode, addressType,
      isDefault: !hasAddresses
    });

    await newAddress.save();
    if (req.query.redirect === "checkout") return res.redirect("/checkout");
    return res.redirect("/user/addresses");

  } catch (err) {
    console.error("Error adding address:", err);
    return res.redirect("/user/addresses?error=Failed to add address");
  }
};

//get edit address page
export const getEditAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userId = req.session.user.id;
    const redirect = req.query.redirect || "";

    const address = await Address.findOne({ _id: addressId, userId }).lean();
    if (!address) return res.redirect("/user/addresses");

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

    res.render("user/editAddress", {
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
    res.redirect("/user/addresses");
  }
};

//post Edit Address

export const postEditAddress = async (req, res) => {
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

      return res.redirect(`/user/addresses/edit/${addressId}?${query.toString()}`);
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) return res.redirect("/user/addresses?error=Address not found");

    address.name = name;
    address.phone = phone;
    address.addressLine = addressLine;
    address.landmark = landmark;
    address.area = area;
    address.state = state;
    address.pincode = pincode;
    address.addressType = addressType;

    await address.save();

    if (redirect === "checkout") return res.redirect("/checkout");
    return res.redirect("/user/addresses");

  } catch (error) {
    console.error("Address update failed:", error);
    return res.redirect(`/user/addresses/edit/${req.params.id}?error=Failed to update address`);
  }
};

//Set default address
export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const addressId = req.params.id;

    await Address.updateMany({ userId }, { $set: { isDefault: false } });
    await Address.findByIdAndUpdate(addressId, { $set: { isDefault: true } });

    res.redirect("/user/addresses");
  } catch (error) {
    console.error("Error setting default address:", error);
    res.status(500).render("errorPage", { errorMessage: "Failed to update default address." });
  }
};

// Delete Address
export const deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    await Address.findByIdAndDelete(addressId);
    res.redirect("/user/addresses");
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).render("errorPage", { errorMessage: "Failed to delete address." });
  }
};
