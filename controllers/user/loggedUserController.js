import User from "../../models/userModel.js";
import bcrypt from "bcrypt";
import passport from "passport";
import { generateOtp, sendVerificationEmail } from "../../utils/otpHelper.js";
import Address from "../../models/addressModel.js";
import cloudinary from "../../config/cloudinary.js";
import STATUS from "../../utils/statusCodes.js";

// Render User Profile Page by logged user
export const getUserProfile = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(STATUS.UNAUTHORIZED).redirect("/login");
    }

    const userId = req.session.user.id;
    const user = await User.findById(userId).select("-password");
    const defaultAddress = await Address.findOne({ userId, isDefault: true });

    return res.status(STATUS.SUCCESS).render("user/profile", {
      title: "My Profile",
      user,
      defaultAddress,
      activePage: "profile"
    });
  } catch (error) {
    console.error("Profile Page Error:", error);
    return res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Render user edit profile page by logged user
export const getEditUserProfile = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.id) {
      return res.status(STATUS.UNAUTHORIZED).redirect("/login");
    }

    const userId = req.session.user.id;
    const user = await User.findById(userId).select("-password");

    return res.status(STATUS.SUCCESS).render("user/editProfile", {
      title: "Edit Profile",
      user,
      activePage: "profile",
      errorMessage: null,
      successMessage: null,
      errorField: null
    });
  } catch (error) {
    console.error("Edit Profile Page Error:", error);
    return res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// EDIT USER PROFILE by logged user
export const editUserProfile = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const { name, email, mobile, profileImage } = req.body;
    const user = await User.findById(userId);

    if (!name || !/^[A-Za-z\s]+$/.test(name)) {
      return res.status(STATUS.BAD_REQUEST).render("user/editProfile", {
        title: "Edit Profile",
        user: { ...user.toObject(), name, email, mobile },
        errorMessage: "Enter a valid name",
        errorField: "name",
        successMessage: null
      });
    }
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(STATUS.BAD_REQUEST).render("user/editProfile", {
        title: "Edit Profile",
        user: { ...user.toObject(), name, email, mobile },
        errorMessage: "Enter a valid 10-digit mobile number",
        errorField: "mobile",
        successMessage: null
      });
    }
    const existing = await User.findOne({ email, _id: { $ne: userId } });
    if (existing) {
      return res.status(STATUS.CONFLICT).render("user/editProfile", {
        title: "Edit Profile",
        user: { ...user.toObject(), name, email, mobile },
        errorMessage: "Email already in use",
        errorField: "email",
        successMessage: null
      });
    }
    if (email === user.email) {
      const updateData = { name, mobile };
      if (profileImage) updateData.profileImage = profileImage;

      await User.findByIdAndUpdate(userId, updateData);
      req.session.user.name = name;
      req.session.user.email = email;
      if (profileImage) req.session.user.profileImage = profileImage;

      return res.status(STATUS.SUCCESS).redirect("/userProfile");
    }

    const otp = generateOtp();
    req.session.editProfileOtp = otp;
    console.log("EDIT PROFILE OTP:", otp);

    req.session.tempEditData = {
      name,
      email,
      mobile,
      imageUrl: profileImage || user.profileImage
    };

    await sendVerificationEmail(email, otp);

    return res.status(STATUS.CREATED).render("user/verifyEmailEdit", {
      email,
      errorMessage: null
    });
  } catch (error) {
    console.error("Edit Profile Error:", error);
    return res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// VERIFY EMAIL OTP DURING EDIT PROFILE by logged user
export const verifyEditProfileOtp = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const enteredOtp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
    const savedOtp = req.session.editProfileOtp;
    const data = req.session.tempEditData;

    if (!savedOtp || !data) {
      return res.status(STATUS.BAD_REQUEST).redirect("/user/edit-profile");
    }

    if (enteredOtp !== savedOtp) {
      return res.status(STATUS.BAD_REQUEST).render("user/verifyEmailEdit", {
        email: data.email,
        errorMessage: "Invalid OTP"
      });
    }

    await User.findByIdAndUpdate(userId, {
      name: data.name,
      email: data.email,
      mobile: data.mobile,
      profileImage: data.imageUrl
    });

    req.session.user.name = data.name;
    req.session.user.email = data.email;
    req.session.editProfileOtp = null;
    req.session.tempEditData = null;

    return res.status(STATUS.SUCCESS).redirect("/userProfile");
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Resend Edit Email OTP by logged user
export const resendEditEmailOtp = async (req, res) => {
  try {
    const data = req.session.tempEditData;
    if (!data) return res.status(STATUS.BAD_REQUEST).redirect("/user/edit-profile");

    const newOtp = generateOtp();
    req.session.editProfileOtp = newOtp;
    console.log("EDIT PROFILE OTP:", newOtp);

    await sendVerificationEmail(data.email, newOtp);

    return res.status(STATUS.SUCCESS).render("user/verifyEmailEdit", {
      email: data.email,
      errorMessage: "A new OTP has been sent"
    });
  } catch (error) {
    console.error("Resend Edit OTP Error:", error);
    return res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Render change password page by logged user
export const getChangePasswordPage = (req, res) => {
  const successMessage = req.session.passwordSuccess || null;
  delete req.session.passwordSuccess;

  return res.status(STATUS.SUCCESS).render("user/profileChangePassword", {
    activePage: "Change Password",
    errorMessage: null,
    errors: {},
    passwordSuccess: successMessage || null
  });
};

// Change password page by logged user
export const changePasswordLogged = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user?.id;
    if (!userId) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    };

    if (!currentPassword) errors.currentPassword = "Current password is required.";
    if (!newPassword) errors.newPassword = "New password is required.";
    if (!confirmPassword) errors.confirmPassword = "Please confirm the password.";

    if (errors.currentPassword || errors.newPassword || errors.confirmPassword) {
      return res.status(STATUS.BAD_REQUEST).render("user/profileChangePassword", {
        errors,
        passwordSuccess: null,
        activePage: "Change Password"
      });
    }

    const user = await User.findById(userId);

    if (!user.password) {
      errors.currentPassword = "You cannot change password for Google login accounts.";
      return res.status(STATUS.FORBIDDEN).render("user/profileChangePassword", {
        errors,
        passwordSuccess: null,
        activePage: "Change Password"
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      errors.currentPassword = "Current password is incorrect.";
      return res.status(STATUS.BAD_REQUEST).render("user/profileChangePassword", {
        errors,
        passwordSuccess: null,
        activePage: "Change Password"
      });
    }

    if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
      return res.status(STATUS.BAD_REQUEST).render("user/profileChangePassword", {
        errors,
        passwordSuccess: null,
        activePage: "Change Password"
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    req.session.passwordSuccess = "Password changed successfully!";
    return res.status(STATUS.SUCCESS).redirect("/user/change-password");

  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};
