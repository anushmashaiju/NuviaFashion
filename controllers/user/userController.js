import User from "../../models/userModel.js";
import bcrypt from "bcrypt";
import passport from "passport";
import { generateOtp, sendVerificationEmail } from "../../utils/otpHelper.js";


// 🟢 1. Welcome Page
export const getWelcomePage = (req, res) => {
  res.render("user/welcome", { title: "Welcome" });
};

// 🟢 2. Signup Page
export const getSignupPage = (req, res) => {
  res.render("user/signup", { message: null });
};

// 🟢 3. Register User (with OTP)
export const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render("user/signup", { message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("user/signup", { message: "User already exists" });
    }

    const otp = generateOtp();
    console.log("Generated OTP for signup:", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("user/signup", { message: "Failed to send OTP. Try again." });
    }

    req.session.userOtp = otp;
    req.session.userData = { name, email, mobile, password };

    res.render("user/verifyOtp", { email, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Signup error:", error);
    res.redirect("/error");
  }
};

// 🟢 4. Verify OTP
export const verifyOtp = async (req, res) => {
  const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
  const { userOtp, userData } = req.session;

  if (!userOtp || !userData) {
    return res.render("user/signup", { message: "Session expired. Please sign up again." });
  }

  if (otp !== userOtp) {
    return res.render("user/verifyOtp", { email: userData.email, message: "Invalid OTP" });
  }

  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = new User({
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      password: hashedPassword,
      isVerified: true,
      role: "user", // default role
    });

    await newUser.save();

    req.session.userOtp = null;
    req.session.userData = null;
    req.session.user = { id: newUser._id, name: newUser.name, email: newUser.email };

    res.redirect("/home");
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.redirect("/error");
  }
};

// 🟢 5. RESEND OTP
export const resendOtp = async (req, res) => {
  try {
    const { userData } = req.session;
    if (!userData) {
      return res.render("user/signup", { message: "Session expired. Please sign up again." });
    }

    const newOtp = generateOtp();
    console.log(`Resent OTP for ${userData.email}: ${newOtp}`);

    const emailSent = await sendVerificationEmail(userData.email, newOtp);
    if (!emailSent) {
      return res.render("user/verifyOtp", { email: userData.email, message: "Failed to resend OTP. Try again." });
    }

    req.session.userOtp = newOtp;
    res.render("user/verifyOtp", { email: userData.email, message: "A new OTP has been sent to your email." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.redirect("/error");
  }
};

// 🟢 6. Login Page
export const getLoginPage = (req, res) => {
  res.render("user/userLogin", { title: "Login", error: null });
};

// 🟢 7. Login User (Check Admin/User)
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.render("user/userLogin", { title: "Login", error: "User not found." });

    if (!user.isVerified)
      return res.render("user/userLogin", { title: "Login", error: "Please verify your account first." });

if (!user.isActive) {
  return res.render("user/userLogin", { error: "Your account is blocked. Contact support." });
}

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.render("user/userLogin", { title: "Login", error: "Incorrect password." });

    // Save session
    req.session.user = { id: user._id, name: user.name, email: user.email, role: user.role };

    // ✅ Check role and redirect accordingly
    if (user.role === "admin") {
      console.log("🛠 Admin logged in:", user.email);
      return res.redirect("/admin/dashboard");
    } else {
      console.log("User logged in:", user.email);
      return res.redirect("/home");
    }
  } catch (error) {
    console.error("Login Error:", error);
    res.render("user/userLogin", { title: "Login", error: "Something went wrong." });
  }
};

// 🟢 8. Google Auth Success (Check Role + Blocked)
export const googleAuthSuccess = async (req, res) => {
  try {
    if (!req.user) return res.redirect("/userLogin");

    // Fetch full user from DB using email
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.render("user/userLogin", { title: "Login", error: "User not found." });
    }

    if (!user.isActive) {
      return res.render("user/userLogin", { title: "Login", error: "Your account is blocked. Contact support." });
    }

    // Save session
    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
    };

    if (user.role === "admin") {
      console.log("🛠 Admin logged in via Google:", user.email);
      return res.redirect("/admin/dashboard");
    } else {
      console.log("User logged in via Google:", user.email);
      return res.redirect("/home");
    }
  } catch (error) {
    console.error("Google Auth Error:", error);
    res.render("user/userLogin", { title: "Login", error: "Something went wrong." });
  }
};
// 🟢 9. Home Page
export const getHomePage = (req, res) => {
  if (!req.session.user) return res.redirect("/userLogin");
  res.render("user/userHome", { title: "Home", user: req.session.user });
};

// 🟢 10. Logout
export const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout Error:", err);
    res.redirect("/userLogin");
  });
};

// 🟢 11. Google Auth Controllers
export const googleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
});

export const googleCallback = passport.authenticate("google", {
  failureRedirect: "/userLogin",
});

export const googleRedirectSuccess = (req, res) => {
  if (!req.user) return res.redirect("/userLogin");

  req.session.user = {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role || "user",
  };

  if (req.user.role === "admin") {
    return res.redirect("/admin/dashboard");
  } else {
    return res.redirect("/home");
  }
};

// 🟢 12. Forgot Password Page
export const getForgotPasswordPage = (req, res) => {
  res.render("user/forgotPassword", { message: null });
};

// 🟢 13. Handle Forgot Password (send OTP)
export const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/forgotPassword", { message: "No user found with this email." });
    }

    const otp = generateOtp();
    console.log(`Forgot password OTP for ${email}: ${otp}`);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("user/forgotPassword", { message: "Failed to send OTP. Try again." });
    }

    req.session.resetOtp = otp;
    req.session.resetEmail = email;

    res.render("user/otpForgotPassword", { email, message: "OTP sent to your email" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.redirect("/error");
  }
};

// 🟢 14. Verify OTP for Forgot Password
export const verifyForgotOtp = async (req, res) => {
  const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
  const { resetOtp, resetEmail } = req.session;

  if (!resetOtp || !resetEmail) {
    return res.render("user/forgotPassword", { message: "Session expired. Try again." });
  }

  if (otp !== resetOtp) {
    return res.render("user/otpForgotPassword", { email: resetEmail, message: "Invalid OTP" });
  }

  // OTP verified
  req.session.resetOtp = null;
  req.session.otpVerified = true;

  res.render("user/changePassword", { email: resetEmail, message: null });
};

// 🟢 16. Resend Forgot Password OTP (Fixed)
export const resendForgotOtp = async (req, res) => {
  try {
    const email = req.query.email || req.session.resetEmail; // get saved email

    if (!email) {
      return res.redirect("/forgot-password");
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000);
    req.session.resetOtp = newOtp; // use the same session key used in verifyForgotOtp

    console.log(`Resent forgot password OTP for ${email}: ${newOtp}`);

    const emailSent = await sendVerificationEmail(email, newOtp);
    if (!emailSent) {
      return res.render("user/otpForgotPassword", {
        email,
        message: "Failed to resend OTP. Please try again.",
      });
    }

    res.render("user/otpForgotPassword", {
      email,
      message: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend Forgot OTP Error:", error);
    res.render("user/otpForgotPassword", {
      email: req.session.resetEmail,
      message: "Something went wrong. Please try again.",
    });
  }
};


// 🟢 16. Reset Password (Final Step)
export const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, email } = req.body;

    if (password !== confirmPassword) {
      return res.render("user/changePassword", { email, message: "Passwords do not match" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    req.session.resetEmail = null;
    req.session.otpVerified = null;

    res.render("user/userLogin", { title: "Login", error: "Password reset successful. Please login." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.redirect("/error");
  }
};
