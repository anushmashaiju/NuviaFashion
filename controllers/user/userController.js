import User from "../../models/userModel.js";
import bcrypt from "bcrypt";
import passport from "passport";
import { generateOtp, sendVerificationEmail } from "../../utils/otpHelper.js";
import Address from "../../models/addressModel.js";
import cloudinary from "../../config/cloudinary.js";

//  Welcome Page
export const getWelcomePage = (req, res) => {
  res.render("user/welcome", { title: "Welcome" });
};

// Signup Page
export const getSignupPage = (req, res) => {
  res.render("user/signup", {
    errorField: null,
    errorMessage: null,
    name: "",
    email: "",
    mobile: ""
  });
};


//  Register User (with OTP)
export const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password, confirmPassword } = req.body;

    if (!name || !/^[A-Za-z\s]+$/.test(name)) {
      return res.render("user/signup", {
        errorField: "name",
        errorMessage: "Enter a valid name",
        name, email, mobile
      });
    }

    if (!email) {
      return res.render("user/signup", {
        errorField: "email",
        errorMessage: "Email is required",
        name, email, mobile
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render("user/signup", {
        errorField: "email",
        errorMessage: "User already exists",
        name, email, mobile
      });
    }

    if (!/^\d{10}$/.test(mobile)) {
      return res.render("user/signup", {
        errorField: "mobile",
        errorMessage: "Enter a valid 10-digit mobile number",
        name, email, mobile
      });
    }

    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!strongRegex.test(password)) {
      return res.render("user/signup", {
        errorField: "password",
        errorMessage: "Password must contain uppercase, lowercase, number and special character",
        name, email, mobile
      });
    }

    if (password !== confirmPassword) {
      return res.render("user/signup", {
        errorField: "confirmPassword",
        errorMessage: "Passwords do not match",
        name, email, mobile
      });
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.render("user/signup", {
        errorField: "email",
        errorMessage: "Failed to send OTP. Try again.",
        name, email, mobile
      });
    }

    req.session.userOtp = otp;
    req.session.userData = { name, email, mobile, password };

    res.render("user/verifyOtp", { email, errorMessage: "OTP sent to your email" });

  } catch (error) {
    console.error("Signup error:", error);
    res.redirect("/error");
  }
};

// Verify OTP
export const verifyOtp = async (req, res) => {
  const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
  const { userOtp, userData } = req.session;

  if (!userOtp || !userData) {
    return res.render("user/signup", { errorMessage: "Session expired. Please sign up again." });
  }

  if (otp !== userOtp) {
    return res.render("user/verifyOtp", { email: userData.email, errorMessage: "Invalid OTP" });
  }

  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const newUser = new User({
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      password: hashedPassword,
      isVerified: true,
      role: "user",
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

//  RESEND OTP
export const resendOtp = async (req, res) => {
  try {
    const { userData } = req.session;
    if (!userData) {
      return res.render("user/signup", { errorMessage: "Session expired. Please sign up again." });
    }

    const newOtp = generateOtp();
    console.log(`Resent OTP for ${userData.email}: ${newOtp}`);

    const emailSent = await sendVerificationEmail(userData.email, newOtp);
    if (!emailSent) {
      return res.render("user/verifyOtp", { email: userData.email, errorMessage: "Failed to resend OTP. Try again." });
    }

    req.session.userOtp = newOtp;
    res.render("user/verifyOtp", { email: userData.email, errorMessage: "A new OTP has been sent to your email." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.redirect("/error");
  }
};

// Login Page
export const getLoginPage = (req, res) => {
  res.render("user/userLogin", {
    title: "Login",
    errorField: null,
    errorMessage: null,
    error: null
  });
};


// Login User (Check Admin/User)
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "Email is required",
        error: null
      });
    }

    if (!password) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "password",
        errorMessage: "Password is required",
        error: null
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "User not found.",
        error: null
      });
    }

    if (!user.isVerified) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "Please verify your account first.",
        error: null
      });
    }

    if (!user.isActive) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "Your account is blocked. Contact support.",
        error: null
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "password",
        errorMessage: "Incorrect password.",
        error: null
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    if (user.role === "admin") {
      return res.redirect("/admin/dashboard");
    }

    return res.redirect("/home");

  } catch (error) {
    console.error("Login Error:", error);
    return res.render("user/userLogin", {
      title: "Login",
      errorField: null,
      errorMessage: null,
      error: "Something went wrong. Please try again."
    });
  }
};

// Google Auth Success (Check Role + Blocked)
export const googleAuthSuccess = async (req, res) => {
  try {
    if (!req.user) return res.redirect("/login");

    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "User not found.",
        error: null
      });
    }

    if (!user.isActive) {
      return res.render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "Your account is blocked. Contact support.",
        error: null
      });
    }

    req.session.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role || "user",
    };

    if (user.role === "admin") {
      return res.redirect("/admin/dashboard");
    } else {
      return res.redirect("/home");
    }

  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.render("user/userLogin", {
      title: "Login",
      errorField: null,
      errorMessage: null,
      error: "Something went wrong."
    });
  }
};

// Logout
export const logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout Error:", err);
    res.redirect("/login");
  });
};

// Google Auth Controllers
export const googleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
});

export const googleCallback = passport.authenticate("google", {
  failureRedirect: "/login",
});

export const googleRedirectSuccess = (req, res) => {
  if (!req.user) return res.redirect("/login");

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

//  Forgot Password Page
export const getForgotPasswordPage = (req, res) => {
  res.render("user/forgotPassword", {
    email: "",
    errorField: null,
    errorMessage: null
  });
};

//  Handle Forgot Password (send OTP)
export const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || email.trim() === "") {
      return res.render("user/forgotPassword", {
        email: "",
        errorField: "email",
        errorMessage: "Email address is required."
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.render("user/forgotPassword", {
        email,
        errorField: "email",
        errorMessage: "Email address is invalid."
      });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.render("user/forgotPassword", {
        email,
        errorField: "email",
        errorMessage: "No user found with this email."
      });
    }

    const otp = generateOtp();
    console.log(`Forgot password OTP for ${email}: ${otp}`);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.render("user/forgotPassword", { errorMessage: "Failed to send OTP. Try again." });
    }

    req.session.resetOtp = otp;
    req.session.resetEmail = email;

    res.render("user/otpForgotPassword", { email, errorMessage: "OTP sent to your email" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.redirect("/error");
  }
};

// Verify OTP for Forgot Password
export const verifyForgotOtp = async (req, res) => {
  try {
    const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
    const { resetOtp, resetEmail } = req.session;

    if (!resetOtp || !resetEmail) {
      return res.render("user/forgotPassword", {
        errorMessage: "Session expired. Try again."
      });
    }

    if (otp !== resetOtp) {
      return res.render("user/otpForgotPassword", {
        email: resetEmail,
        errorMessage: "Invalid OTP"
      });
    }

    req.session.resetOtp = null;
    req.session.otpVerified = true;

    return res.render("user/resetPassword", {
      email: resetEmail,
      errorField: null,
      errorMessage: null
    });

  } catch (error) {
    console.error(error);
    return res.render("user/otpForgotPassword", {
      email: req.session.resetEmail,
      errorMessage: "Something went wrong. Try again."
    });
  }
};

// Resend Forgot Password OTP
export const resendForgotOtp = async (req, res) => {
  try {
    const email = req.query.email || req.session.resetEmail;

    if (!email) {
      return res.redirect("/forgot-password");
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000);
    req.session.resetOtp = newOtp;

    console.log(`Resent forgot password OTP for ${email}: ${newOtp}`);

    const emailSent = await sendVerificationEmail(email, newOtp);
    if (!emailSent) {
      return res.render("user/otpForgotPassword", {
        email,
        errorMessage: "Failed to resend OTP. Please try again.",
      });
    }

    res.render("user/otpForgotPassword", {
      email,
      errorMessage: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend Forgot OTP Error:", error);
    res.render("user/otpForgotPassword", {
      email: req.session.resetEmail,
      errorMessage: "Something went wrong. Please try again.",
    });
  }
};


// Reset Password 
export const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, email } = req.body;
    if (!password) {
      return res.render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: "Password is required"
      });
    }
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!strongRegex.test(password)) {
      return res.render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: "Password must contain uppercase, lowercase, number & special character"
      });
    }
    if (!confirmPassword) {
      return res.render("user/resetPassword", {
        email,
        errorField: "confirmPassword",
        errorMessage: "Please confirm your password"
      });
    }
    if (password !== confirmPassword) {
      res.render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: "Password is required"
      });

    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    req.session.resetEmail = null;
    req.session.otpVerified = null;

    res.render("user/userLogin", {
      title: "Login",
      errorField: null,
      errorMessage: null,
      error: null
    });


  } catch (error) {
    console.error("Reset Password Error:", error);
    res.redirect("/error");
  }
};


