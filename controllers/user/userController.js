import User from "../../models/userModel.js";
import bcrypt from "bcrypt";
import passport from "passport";
import { generateOtp, sendVerificationEmail } from "../../utils/otpHelper.js";
import Address from "../../models/addressModel.js";
import cloudinary from "../../config/cloudinary.js";
import ReferralCode from "../../models/referralModel.js";
import Wallet from "../../models/walletModel.js";
import { generateReferralCode } from "../../utils/referralHelper.js";
import STATUS from "../../utils/statusCodes.js";

//  Welcome Page
export const getWelcomePage = (req, res) => {
  res.status(STATUS.SUCCESS).render("user/welcome", { title: "Welcome" });
};

// Signup Page
export const getSignupPage = (req, res) => {
  return res.status(STATUS.SUCCESS).render("user/signup", {
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
    const { name, email, mobile, password, confirmPassword, referralCode } = req.body;

    if (!name || !/^[A-Za-z\s]+$/.test(name)) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "name",
        errorMessage: "Enter a valid name",
        name, email, mobile
      });
    }

    if (!email) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "email",
        errorMessage: "Email is required",
        name, email, mobile
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(STATUS.CONFLICT).render("user/signup", {
        errorField: "email",
        errorMessage: "User already exists",
        name, email, mobile
      });
    }

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "mobile",
        errorMessage: "Enter a valid 10-digit mobile number",
        name, email, mobile
      });
    }

    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!strongRegex.test(password)) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "password",
        errorMessage: "Password must contain uppercase, lowercase, number and special character",
        name, email, mobile
      });
    }

    if (password !== confirmPassword) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "confirmPassword",
        errorMessage: "Passwords do not match",
        name, email, mobile
      });
    }

    const refCode = referralCode || req.query.ref || null;
    let referredBy = null;

    if (refCode) {
      const referral = await ReferralCode.findOne({ code: refCode });
      if (!referral || referral.usedCount >= referral.usageLimit) {
        return res.status(STATUS.BAD_REQUEST).render("user/signup", {
          errorField: "referralCode",
          errorMessage: "Invalid or expired referral code",
          name, email, mobile
        });
      }
      referredBy = referral.user;
    }

    const otp = generateOtp();
    console.log("Signup OTP for", email, "=>", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("user/signup", {
        errorField: "email",
        errorMessage: "Failed to send OTP. Try again.",
        name, email, mobile
      });
    }

    req.session.userOtp = otp;
    req.session.userData = {
      name,
      email,
      mobile,
      password,
      referredBy,
      referralCode: refCode || null
    };

    res.status(STATUS.SUCCESS).render("user/verifyOtp", { email, errorMessage: "OTP sent to your email" });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Verify OTP
export const verifyOtp = async (req, res) => {
  const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
  const { userOtp, userData } = req.session;

  if (!userOtp || !userData) {
    return res.status(STATUS.BAD_REQUEST).render("user/signup", { errorMessage: "Session expired. Please sign up again." });
  }

  if (otp !== userOtp) {
    return res.status(STATUS.BAD_REQUEST).render("user/verifyOtp", { email: userData.email, errorMessage: "Invalid OTP" });
  }

  try {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const newUser = new User({
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      password: hashedPassword,
      isVerified: true,
      referredBy: userData.referredBy || null
    });

    await newUser.save();

    const newCode = generateReferralCode();
    const baseUrl = process.env.BASE_URL;
    const referralLink = `${baseUrl}/signup?ref=${newCode}`;

    await ReferralCode.create({
      user: newUser._id,
      code: newCode,
      referralLink,
      referredBy: userData.referredBy || null
    });

    if (userData.referralCode) {
      const referral = await ReferralCode.findOne({ code: userData.referralCode });
      if (referral) {
        referral.usedCount += 1;
        await referral.save();

        const rewardAmount = referral.rewardAmount || 100;

        await Wallet.updateOne(
          { userId: referral.user },
          {
            $inc: { balance: rewardAmount },
            $push: {
              transactions: {
                type: "credit",
                amount: rewardAmount,
                description: `Referral bonus for inviting ${newUser.email}`
              }
            }
          },
          { upsert: true }
        );

        await Wallet.updateOne(
          { userId: newUser._id },
          {
            $inc: { balance: rewardAmount },
            $push: {
              transactions: {
                type: "credit",
                amount: rewardAmount,
                description: `Signup bonus for using referral code`
              }
            }
          },
          { upsert: true }
        );
      }
    }

    req.session.userOtp = null;
    req.session.userData = null;

    req.session.user = {
      id: newUser._id,
      name: newUser.name,
      email: newUser.email
    };

    res.status(STATUS.CREATED).redirect("/home");

  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// RESEND OTP
export const resendOtp = async (req, res) => {
  try {
    const { userData } = req.session;
    if (!userData) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", { errorMessage: "Session expired. Please sign up again." });
    }

    const newOtp = generateOtp();
    console.log(`Resent OTP for ${userData.email}: ${newOtp}`);

    const emailSent = await sendVerificationEmail(userData.email, newOtp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("user/verifyOtp", { email: userData.email, errorMessage: "Failed to resend OTP. Try again." });
    }

    req.session.userOtp = newOtp;
    res.status(STATUS.SUCCESS).render("user/verifyOtp", { email: userData.email, errorMessage: "A new OTP has been sent to your email." });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Login Page
export const getLoginPage = (req, res) => {
  res.status(STATUS.SUCCESS).render("user/userLogin", {
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
      return res.status(STATUS.BAD_REQUEST).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "Email is required",
        error: null
      });
    }

    if (!password) {
      return res.status(STATUS.BAD_REQUEST).render("user/userLogin", {
        title: "Login",
        errorField: "password",
        errorMessage: "Password is required",
        error: null
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(STATUS.NOT_FOUND).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "User not found.",
        error: null
      });
    }

    if (!user.isVerified) {
      return res.status(STATUS.FORBIDDEN).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "Please verify your account first.",
        error: null
      });
    }

    if (!user.isActive) {
      return res.status(STATUS.FORBIDDEN).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "Your account is blocked. Contact support.",
        error: null
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(STATUS.BAD_REQUEST).render("user/userLogin", {
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
      return res.status(STATUS.SUCCESS).redirect("/admin/dashboard");
    }

    return res.status(STATUS.SUCCESS).redirect("/home");

  } catch (error) {
    console.error("Login Error:", error);
    return res.status(STATUS.SERVER_ERROR).render("user/userLogin", {
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
    if (!req.user) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(STATUS.NOT_FOUND).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: "User not found.",
        error: null
      });
    }

    if (!user.isActive) {
      return res.status(STATUS.FORBIDDEN).render("user/userLogin", {
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
      return res.status(STATUS.SUCCESS).redirect("/admin/dashboard");
    } else {
      return res.status(STATUS.SUCCESS).redirect("/home");
    }

  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(STATUS.SERVER_ERROR).render("user/userLogin", {
      title: "Login",
      errorField: null,
      errorMessage: null,
      error: "Something went wrong."
    });
  }
};

// Logout
export const logoutUser = (req, res) => {
  req.session.user = null;
  res.status(STATUS.SUCCESS).redirect("/login");
};

// Google Auth Controllers
export const googleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
});

export const googleCallback = passport.authenticate("google", {
  failureRedirect: "/login",
});

export const googleRedirectSuccess = (req, res) => {
  if (!req.user) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

  req.session.user = {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role || "user",
  };

  if (req.user.role === "admin") {
    return res.status(STATUS.SUCCESS).redirect("/admin/dashboard");
  } else {
    return res.status(STATUS.SUCCESS).redirect("/home");
  }
};

// Forgot Password Page
export const getForgotPasswordPage = (req, res) => {
  res.status(STATUS.SUCCESS).render("user/forgotPassword", {
    email: "",
    errorField: null,
    errorMessage: null
  });
};

// Handle Forgot Password (send OTP)
export const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || email.trim() === "") {
      return res.status(STATUS.BAD_REQUEST).render("user/forgotPassword", {
        email: "",
        errorField: "email",
        errorMessage: "Email address is required."
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(STATUS.BAD_REQUEST).render("user/forgotPassword", {
        email,
        errorField: "email",
        errorMessage: "Email address is invalid."
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(STATUS.NOT_FOUND).render("user/forgotPassword", {
        email,
        errorField: "email",
        errorMessage: "No user found with this email."
      });
    }

    const otp = generateOtp();
    console.log(`Forgot password OTP for ${email}: ${otp}`);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("user/forgotPassword", { errorMessage: "Failed to send OTP. Try again." });
    }

    req.session.resetOtp = otp;
    req.session.resetEmail = email;

    res.status(STATUS.SUCCESS).render("user/otpForgotPassword", { email, errorMessage: "OTP sent to your email" });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Verify OTP for Forgot Password
export const verifyForgotOtp = async (req, res) => {
  try {
    const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
    const { resetOtp, resetEmail } = req.session;

    if (!resetOtp || !resetEmail) {
      return res.status(STATUS.BAD_REQUEST).render("user/forgotPassword", {
        errorMessage: "Session expired. Try again."
      });
    }

    if (otp !== resetOtp) {
      return res.status(STATUS.BAD_REQUEST).render("user/otpForgotPassword", {
        email: resetEmail,
        errorMessage: "Invalid OTP"
      });
    }

    req.session.resetOtp = null;
    req.session.otpVerified = true;

    return res.status(STATUS.SUCCESS).render("user/resetPassword", {
      email: resetEmail,
      errorField: null,
      errorMessage: null
    });

  } catch (error) {
    console.error(error);
    return res.status(STATUS.SERVER_ERROR).render("user/otpForgotPassword", {
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
      return res.status(STATUS.BAD_REQUEST).redirect("/forgot-password");
    }

    const newOtp = Math.floor(1000 + Math.random() * 9000);
    req.session.resetOtp = newOtp;

    console.log(`Resent forgot password OTP for ${email}: ${newOtp}`);

    const emailSent = await sendVerificationEmail(email, newOtp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("user/otpForgotPassword", {
        email,
        errorMessage: "Failed to resend OTP. Please try again.",
      });
    }

    res.status(STATUS.SUCCESS).render("user/otpForgotPassword", {
      email,
      errorMessage: "A new OTP has been sent to your email.",
    });
  } catch (error) {
    console.error("Resend Forgot OTP Error:", error);
    res.status(STATUS.SERVER_ERROR).render("user/otpForgotPassword", {
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
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: "Password is required"
      });
    }
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!strongRegex.test(password)) {
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: "Password must contain uppercase, lowercase, number & special character"
      });
    }
    if (!confirmPassword) {
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "confirmPassword",
        errorMessage: "Please confirm your password"
      });
    }
    if (password !== confirmPassword) {
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: "Passwords do not match"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.updateOne({ email }, { password: hashedPassword });

    req.session.otpVerified = null;
    req.session.resetEmail = null;

    res.status(STATUS.SUCCESS).redirect("/login");
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Referral Page
export const getReferralPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    const referral = await ReferralCode.findOne({ user: userId });
    if (!referral) {
      return res.render("user/referral", { errorMessage: "No referral info found." });
    }

    const referralUsers = await User.find({ referredBy: userId })
      .select("name email")
      .lean();

    const rewardPerUser = referral.rewardAmount || 100;

    const formattedUsers = referralUsers.map(u => ({
      name: u.name,
      email: u.email,
      reward: rewardPerUser
    }));

    res.render("user/referral", {
      title: "Referral",

      referralCode: referral.code,
      referralLink: referral.referralLink,  
      usedCount: referral.usedCount,
      rewardAmount: referral.usedCount * rewardPerUser,
      referralUsers: formattedUsers,

      activePage: "referral"
    });

  } catch (error) {
    console.error("Referral Page Error:", error);
    res.redirect("/error");
  }
};
