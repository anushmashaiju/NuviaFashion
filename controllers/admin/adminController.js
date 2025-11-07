import User from "../../models/userModel.js";
import bcrypt from "bcrypt";

// Admin Login Page
export const getAdminLoginPage = (req, res) => {
  res.render("admin/adminLogin", { title: "Admin Login", error: null });
};

// Admin Login
export const adminLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user || user.role !== "admin") {
      return res.render("admin/adminLogin", { title: "Admin Login", error: "Invalid credentials or not admin" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("admin/adminLogin", { title: "Admin Login", error: "Invalid credentials or not admin" });
    }

    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };
    req.session.save(err => {
      if (err) return res.render("admin/adminLogin", { title: "Admin Login", error: "Session error" });
      res.redirect("/admin/dashboard");
    });
  } catch (error) {
    console.error(error);
    res.render("admin/adminLogin", { title: "Admin Login", error: "Something went wrong" });
  }
};

// Admin Dashboard
export const getAdminDashboard = async (req, res) => {
  try {
    res.render("admin/dashboard", { title: "Admin Dashboard", admin: req.session.user });
  } catch (error) {
    console.error(error);
    res.redirect("/error");
  }
};

// Logout
export const adminLogout = (req, res) => {
  req.session.destroy(err => res.redirect("/admin/login"));
};


// Get All Users (search + pagination + sort)
export const getAllUsers = async (req, res) => {
  try {
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;

    const query = {
      role: "user",
      isDeleted: false, // ✅ exclude deleted users
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
      .sort({ createdAt: -1 }) // ✅ latest first
      .skip((page - 1) * limit)
      .limit(limit);

    res.render("admin/users", {
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
    res.redirect("/error");
  }
};

// Block / Unblock User
export const toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) return res.redirect("/admin/users");

    user.isActive = !user.isActive;
    await user.save();
    res.redirect("/admin/users");
  } catch (error) {
    console.error("Toggle User Status Error:", error);
    res.redirect("/error");
  }
};


// --------------------- Forgot Password ---------------------
export const getAdminForgotPassword = (req, res) => {
  res.render("admin/forgotPassword", { message: null });
};

export const postAdminForgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const admin = await User.findOne({ email, role: "admin" });
    if (!admin) {
      return res.render("admin/forgotPassword", { message: "Admin account not found." });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);
    req.session.adminResetOtp = otp;
    req.session.adminResetEmail = email;

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("admin/forgotPassword", { message: "Failed to send OTP. Try again." });
    }

    console.log("Admin Forgot OTP:", otp);
    res.redirect(`/admin/verify-forgot-otp?email=${email}`);
  } catch (error) {
    console.error("Admin Forgot Password Error:", error);
    res.render("admin/forgotPassword", { message: "Something went wrong. Try again." });
  }
};

// --------------------- Verify OTP ---------------------
export const getAdminForgotOtpPage = (req, res) => {
  const email = req.query.email || req.session.adminResetEmail;
  if (!email) return res.redirect("/admin/forgot-password");
  res.render("admin/otpForgotPassword", { email, message: null });
};

export const verifyAdminForgotOtp = async (req, res) => {
  const { otp1, otp2, otp3, otp4, email } = req.body;
  const enteredOtp = `${otp1}${otp2}${otp3}${otp4}`;

  if (enteredOtp === String(req.session.adminResetOtp)) {
    req.session.adminOtpVerified = true;
    res.redirect(`/admin/reset-password?email=${email}`);
  } else {
    res.render("admin/otpForgotPassword", { email, message: "Invalid OTP. Try again." });
  }
};

// --------------------- Resend OTP ---------------------
export const resendAdminForgotOtp = async (req, res) => {
  try {
    const email = req.query.email || req.session.adminResetEmail;
    if (!email) return res.redirect("/admin/forgot-password");

    const newOtp = Math.floor(1000 + Math.random() * 9000);
    req.session.adminResetOtp = newOtp;

    const emailSent = await sendVerificationEmail(email, newOtp);
    if (!emailSent) {
      return res.render("admin/otpForgotPassword", { email, message: "Failed to resend OTP." });
    }

    console.log("Resent Admin OTP:", newOtp);
    res.render("admin/otpForgotPassword", { email, message: "New OTP sent successfully." });
  } catch (error) {
    console.error("Resend Admin OTP Error:", error);
    res.render("admin/otpForgotPassword", { email: req.session.adminResetEmail, message: "Something went wrong." });
  }
};

// --------------------- Reset Password ---------------------
export const getAdminResetPasswordPage = (req, res) => {
  const email = req.query.email || req.session.adminResetEmail;
  if (!req.session.adminOtpVerified) return res.redirect("/admin/forgot-password");
  res.render("admin/resetPassword", { email, message: null });
};

export const resetAdminPassword = async (req, res) => {
  const { email, password, confirmPassword } = req.body;
  if (password !== confirmPassword) {
    return res.render("admin/resetPassword", { email, message: "Passwords do not match." });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email, role: "admin" }, { password: hashed });

    req.session.adminOtpVerified = false;
    req.session.adminResetEmail = null;

    res.render("admin/adminLogin", { title: "Admin Login", error: "Password reset successful. Please login." });
  } catch (error) {
    console.error("Admin Reset Password Error:", error);
    res.render("admin/resetPassword", { email, message: "Something went wrong. Try again." });
  }
};