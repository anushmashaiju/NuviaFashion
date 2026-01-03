import User from "../../models/userModel.js";
import bcrypt from "bcrypt";
import STATUS from "../../utils/statusCodes.js";

// Admin Login Page
export const getAdminLoginPage = (req, res) => {
  res.status(STATUS.SUCCESS).render("admin/adminLogin", { 
    title: "Admin Login",
    email: "",
    errorField: null,
    errorMessage: null
  });
};

// Admin Login
export const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!email) {
      return res.status(STATUS.BAD_REQUEST).render("admin/adminLogin", {
        title: "Admin Login",
        errorField: "email",
        errorMessage: "Email is required"
      });
    }

    if (!password) {
      return res.status(STATUS.BAD_REQUEST).render("admin/adminLogin", {
        title: "Admin Login",
        errorField: "password",
        errorMessage: "Password is required"
      });
    }

    if (!user || user.role !== "admin") {
      return res.status(STATUS.UNAUTHORIZED).render("admin/adminLogin", {
        title: "Admin Login",
        email,
        errorField: "email",
        errorMessage: "Email is required"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(STATUS.UNAUTHORIZED).render("admin/adminLogin", {
        title: "Admin Login",
        email,
        errorField: "password",
        errorMessage: "Incorrect password"
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    req.session.save(err => {
      if (err) {
        return res.status(STATUS.SERVER_ERROR).render("admin/adminLogin", {
          title: "Admin Login",
          email,
          errorField: null,
          errorMessage: "Something went wrong"
        });
      }
      res.status(STATUS.SUCCESS).redirect("/admin/dashboard");
    });

  } catch (error) {
    console.error(error);
    res.status(STATUS.SERVER_ERROR).render("admin/adminLogin", {
      title: "Admin Login",
      errorField: "",
      errorMessage: "Something went wrong"
    });
  }
};
// postAdminForgotPassword
export const postAdminForgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || email.trim() === "") {
    return res.status(STATUS.BAD_REQUEST).render("admin/adminForgotPassword", {
      email,
      errorField: "email",
      errorMessage: "Email address is required.",
      message: null
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(STATUS.BAD_REQUEST).render("admin/adminForgotPassword", {
      email,
      errorField: "email",
      errorMessage: "Email address is invalid.",
      message: null
    });
  }

  try {
    const admin = await User.findOne({ email, role: "admin" });

    if (!admin) {
      return res.status(STATUS.NOT_FOUND).render("admin/adminForgotPassword", {
        email,
        errorField: "email",
        errorMessage: "Admin account not found.",
        message: null
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    req.session.adminResetOtp = otp;
    req.session.adminResetEmail = email;

    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("admin/adminForgotPassword", {
        email,
        errorField: "email",
        errorMessage: "Failed to send OTP. Try again.",
        message: null
      });
    }

    console.log("Admin Forgot OTP:", otp);
    res.status(STATUS.SUCCESS).redirect(`/admin/verify-forgot-otp?email=${email}`);

  } catch (error) {
    console.error("Forgot Password Error:", error);
    return res.status(STATUS.SERVER_ERROR).render("admin/adminForgotPassword", {
      email,
      errorField: "email",
      errorMessage: "Something went wrong. Try again.",
      message: null
    });
  }
};

// Verify OTP 
export const getAdminForgotOtpPage = (req, res) => {
  const email = req.query.email || req.session.adminResetEmail;
  if (!email) return res.status(STATUS.BAD_REQUEST).redirect("/admin/forgot-password");

  res.status(STATUS.SUCCESS).render("admin/otpForgotPassword", { email, errorMessage: null });
};

// Verify AdminForgotOtp
export const verifyAdminForgotOtp = async (req, res) => {
  const { otp1, otp2, otp3, otp4, email } = req.body;
  const enteredOtp = `${otp1}${otp2}${otp3}${otp4}`;

  if (enteredOtp === String(req.session.adminResetOtp)) {
    req.session.adminOtpVerified = true;
    return res.status(STATUS.SUCCESS).redirect(`/admin/reset-password?email=${email}`);
  } else {
    return res.status(STATUS.UNAUTHORIZED).render("admin/otpForgotPassword", { 
      email, 
      errorMessage: "Invalid OTP. Try again." 
    });
  }
};

// Resend OTP 
export const resendAdminForgotOtp = async (req, res) => {
  try {
    const email = req.query.email || req.session.adminResetEmail;
    if (!email) return res.status(STATUS.BAD_REQUEST).redirect("/admin/forgot-password");

    const newOtp = Math.floor(1000 + Math.random() * 9000);
    req.session.adminResetOtp = newOtp;

    const emailSent = await sendVerificationEmail(email, newOtp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("admin/otpForgotPassword", { 
        email, 
        errorMessage: "Failed to resend OTP." 
      });
    }

    console.log("Resent Admin OTP:", newOtp);
    res.status(STATUS.SUCCESS).render("admin/otpForgotPassword", { 
      email, 
      errorMessage: "New OTP sent successfully." 
    });

  } catch (error) {
    console.error("Resend Admin OTP Error:", error);
    res.status(STATUS.SERVER_ERROR).render("admin/otpForgotPassword", { 
      email: req.session.adminResetEmail, 
      errorMessage: "Something went wrong." 
    });
  }
};

// Admin Reset Password Page
export const getAdminResetPasswordPage = (req, res) => {
  const email = req.query.email || req.session.adminResetEmail;

  if (!req.session.adminOtpVerified) 
    return res.status(STATUS.FORBIDDEN).redirect("/admin/forgot-password");

  res.status(STATUS.SUCCESS).render("admin/resetPassword", { 
    email, 
    errorMessage: null 
  });
};

// Reset Admin Password 
export const resetAdminPassword = async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(STATUS.BAD_REQUEST).render("admin/resetPassword", { 
      email,
      errorField: "confirmPassword",
      errorMessage: "Passwords do not match." 
    });
  }

  if (password.length < 6) {
    return res.status(STATUS.BAD_REQUEST).render("admin/resetPassword", { 
      email,
      errorField: "password",
      errorMessage: "Password must be at least 6 characters." 
    });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email, role: "admin" }, { password: hashed });

    req.session.adminOtpVerified = false;
    req.session.adminResetEmail = null;

    res.status(STATUS.SUCCESS).render("admin/adminLogin", { 
      title: "Admin Login", 
      errorMessage: "Password reset successful. Please login." 
    });

  } catch (error) {
    console.error("Admin Reset Password Error:", error);
    res.status(STATUS.SERVER_ERROR).render("admin/resetPassword", { 
      email,
      errorField: "password",
      errorMessage: "Something went wrong. Try again." 
    });
  }
};

// Logout
export const adminLogout = (req, res) => {
  req.session.admin = null; 
  res.status(STATUS.SUCCESS).redirect("/admin/login");
};

// Get All Users 
export const getAllUsers = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const query = {
      role: "user",
      isDeleted: false,
      ...(search && {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      }),
    };

    const totalUsers = await User.countDocuments(query);
    const totalPages = Math.ceil(totalUsers / limit);

    const users = await User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(STATUS.SUCCESS).render("admin/users", {
      title: "Manage Users",
      cData: users,
      currentPage: page,
      totalPages,
      search,
      totalUsers,
      admin: req.session.user,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Block / Unblock User
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) 
      return res.status(STATUS.NOT_FOUND).redirect("/admin/users");

    user.isActive = !user.isActive;
    await user.save();
    res.status(STATUS.SUCCESS).redirect("/admin/users");

  } catch (error) {
    console.error("Toggle User Status Error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Forgot Password 
export const getAdminForgotPassword = (req, res) => {
  res.status(STATUS.SUCCESS).render("admin/adminForgotPassword", { 
    email: "",
    errorField: null,
    errorMessage: null,
    message: null
  });
};


