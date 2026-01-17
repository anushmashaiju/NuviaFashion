import User from "../../models/userModel.js";
import bcrypt from "bcrypt";
import STATUS from "../../utils/statusCodes.js";
import MESSAGES from "../../utils/messages.js";

// Admin Login Page
 const getAdminLoginPage = (req, res) => {
  res.status(STATUS.SUCCESS).render("admin/adminLogin", { 
    title: "Admin Login",
    email: "",
    errorField: null,
    errorMessage: null
  });
};

// Admin Login
 const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!email) {
      return res.status(STATUS.BAD_REQUEST).render("admin/adminLogin", {
        title: "Admin Login",
        errorField: "email",
        errorMessage: MESSAGES.EMAIL_REQUIRED
      });
    }

    if (!password) {
      return res.status(STATUS.BAD_REQUEST).render("admin/adminLogin", {
        title: "Admin Login",
        errorField: "password",
        errorMessage: MESSAGES.PASSWORD_REQUIRED
      });
    }

    if (!user || user.role !== "admin") {
      return res.status(STATUS.UNAUTHORIZED).render("admin/adminLogin", {
        title: "Admin Login",
        email,
        errorField: "email",
        errorMessage: MESSAGES.EMAIL_REQUIRED
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(STATUS.UNAUTHORIZED).render("admin/adminLogin", {
        title: "Admin Login",
        email,
        errorField: "password",
        errorMessage: MESSAGES.INCORRECT_PASSWORD
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
          errorMessage: MESSAGES.SERVER_ERROR
        });
      }
      res.status(STATUS.SUCCESS).redirect("/admin/dashboard");
    });

  } catch (error) {
    console.error(error);
    res.status(STATUS.SERVER_ERROR).render("admin/adminLogin", {
      title: "Admin Login",
      errorField: "",
      errorMessage: MESSAGES.SERVER_ERROR
    });
  }
};
// postAdminForgotPassword
 const postAdminForgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || email.trim() === "") {
    return res.status(STATUS.BAD_REQUEST).render("admin/adminForgotPassword", {
      email,
      errorField: "email",
      errorMessage: MESSAGES.EMAIL_REQUIRED,
      message: null
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(STATUS.BAD_REQUEST).render("admin/adminForgotPassword", {
      email,
      errorField: "email",
      errorMessage: MESSAGES.EMAIL_INVALID,
      message: null
    });
  }

  try {
    const admin = await User.findOne({ email, role: "admin" });

    if (!admin) {
      return res.status(STATUS.NOT_FOUND).render("admin/adminForgotPassword", {
        email,
        errorField: "email",
        errorMessage: MESSAGES.ADMIN_NOT_FOUND,
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
        errorMessage:MESSAGES.OTP_INVALID,
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
      errorMessage: MESSAGES.SERVER_ERROR,
      message: null
    });
  }
};

// Verify OTP 
 const getAdminForgotOtpPage = (req, res) => {
  const email = req.query.email || req.session.adminResetEmail;
  if (!email) return res.status(STATUS.BAD_REQUEST).redirect("/admin/forgot-password");

  res.status(STATUS.SUCCESS).render("admin/otpForgotPassword", { email, errorMessage: null });
};

// Verify AdminForgotOtp
 const verifyAdminForgotOtp = async (req, res) => {
  const { otp1, otp2, otp3, otp4, email } = req.body;
  const enteredOtp = `${otp1}${otp2}${otp3}${otp4}`;

  if (enteredOtp === String(req.session.adminResetOtp)) {
    req.session.adminOtpVerified = true;
    return res.status(STATUS.SUCCESS).redirect(`/admin/reset-password?email=${email}`);
  } else {
    return res.status(STATUS.UNAUTHORIZED).render("admin/otpForgotPassword", { 
      email, 
      errorMessage: MESSAGES.OTP_INVALID
    });
  }
};

// Resend OTP 
 const resendAdminForgotOtp = async (req, res) => {
  try {
    const email = req.query.email || req.session.adminResetEmail;
    if (!email) return res.status(STATUS.BAD_REQUEST).redirect("/admin/forgot-password");

    const newOtp = Math.floor(1000 + Math.random() * 9000);
    req.session.adminResetOtp = newOtp;

    const emailSent = await sendVerificationEmail(email, newOtp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("admin/otpForgotPassword", { 
        email, 
        errorMessage: MESSAGES.OTP_RESEND_FAILED
      });
    }

    console.log("Resent Admin OTP:", newOtp);
    res.status(STATUS.SUCCESS).render("admin/otpForgotPassword", { 
      email, 
      errorMessage: MESSAGES.OTP_SEND_SUCCESS
    });

  } catch (error) {
    console.error("Resend Admin OTP Error:", error);
    res.status(STATUS.SERVER_ERROR).render("admin/otpForgotPassword", { 
      email: req.session.adminResetEmail, 
      errorMessage: MESSAGES.SERVER_ERROR 
    });
  }
};

// Admin Reset Password Page
 const getAdminResetPasswordPage = (req, res) => {
  const email = req.query.email || req.session.adminResetEmail;

  if (!req.session.adminOtpVerified) 
    return res.status(STATUS.FORBIDDEN).redirect("/admin/forgot-password");

  res.status(STATUS.SUCCESS).render("admin/resetPassword", { 
    email, 
    errorMessage: null 
  });
};

// Reset Admin Password 
 const resetAdminPassword = async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(STATUS.BAD_REQUEST).render("admin/resetPassword", { 
      email,
      errorField: "confirmPassword",
      errorMessage: MESSAGES.PASSWORD_MISMATCH
    });
  }

  if (password.length < 6) {
    return res.status(STATUS.BAD_REQUEST).render("admin/resetPassword", { 
      email,
      errorField: "password",
      errorMessage: MESSAGES.PASSWORD_WEAK 
    });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email, role: "admin" }, { password: hashed });

    req.session.adminOtpVerified = false;
    req.session.adminResetEmail = null;

    res.status(STATUS.SUCCESS).render("admin/adminLogin", { 
      title: "Admin Login", 
      errorMessage: MESSAGES.PASSWORD_CHANGED_SUCCESS
    });

  } catch (error) {
    console.error("Admin Reset Password Error:", error);
    res.status(STATUS.SERVER_ERROR).render("admin/resetPassword", { 
      email,
      errorField: "password",
      errorMessage: MESSAGES.SERVER_ERROR
    });
  }
};

// Logout
 const adminLogout = (req, res) => {
  req.session.admin = null; 
  res.status(STATUS.SUCCESS).redirect("/admin/login");
};

// Get All Users 
 const getAllUsers = async (req, res) => {
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
 const toggleUserStatus = async (req, res) => {
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
 const getAdminForgotPassword = (req, res) => {
  res.status(STATUS.SUCCESS).render("admin/adminForgotPassword", { 
    email: "",
    errorField: null,
    errorMessage: null,
    message: null
  });
};


export {
  getAdminLoginPage,
  adminLogin,
  getAdminForgotPassword,
  postAdminForgotPassword,
  getAdminForgotOtpPage,
  verifyAdminForgotOtp,
  resendAdminForgotOtp,
  getAdminResetPasswordPage,
  resetAdminPassword,
  adminLogout,
  getAllUsers,
  toggleUserStatus
};
