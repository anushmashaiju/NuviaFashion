import User from "../../models/userModel.js";
import bcrypt from "bcrypt";
import passport from "passport";
import { generateOtp, sendVerificationEmail } from "../../utils/otpHelper.js";
import ReferralCode from "../../models/referralModel.js";
import Wallet from "../../models/walletModel.js";
import { generateReferralCode } from "../../utils/referralHelper.js";
import STATUS from "../../utils/statusCodes.js";

//  Welcome Page
const getWelcomePage = (req, res) => {
  res.status(STATUS.SUCCESS).render("user/welcome", { title: "Welcome" });
};

// Signup Page
const getSignupPage = (req, res) => {
  return res.status(STATUS.SUCCESS).render("user/signup", {
    errorField: null,
    errorMessage: null,
    name: "",
    email: "",
    mobile: ""
  });
};

//  Register User (with OTP)
const registerUser = async (req, res) => {
  try {
    const { name, email, mobile, password, confirmPassword, referralCode } = req.body;

    if (!name || !/^[A-Za-z\s]+$/.test(name)) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "name",
        errorMessage: MESSAGES.NAME_INVALID,
        name, email, mobile
      });
    }

    if (!email) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "email",
        errorMessage: MESSAGES.EMAIL_REQUIRED,
        name, email, mobile
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(STATUS.CONFLICT).render("user/signup", {
        errorField: "email",
        errorMessage: MESSAGES.USER_ALREADY_EXISTS,
        name, email, mobile
      });
    }

    if (!/^\d{10}$/.test(mobile)) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "mobile",
        errorMessage: MESSAGES.MOBILE_INVALID,
        name, email, mobile
      });
    }

    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!strongRegex.test(password)) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "password",
        errorMessage: MESSAGES.PASSWORD_WEAK,
        name, email, mobile
      });
    }

    if (password !== confirmPassword) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", {
        errorField: "confirmPassword",
        errorMessage: MESSAGES.PASSWORD_MISMATCH,
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
          errorMessage: MESSAGES.REFERRAL_INVALID_OR_EXPIRED,
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
        errorMessage: MESSAGES.OTP_SEND_FAILED,
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

    res.status(STATUS.SUCCESS).render("user/verifyOtp", {
      email, errorMessage: MESSAGES.OTP_SEND_SUCCESS
    });

  } catch (error) {
    console.error("Signup error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Verify OTP
const verifyOtp = async (req, res) => {
  const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
  const { userOtp, userData } = req.session;

  if (!userOtp || !userData) {
    return res.status(STATUS.BAD_REQUEST).render("user/signup", { errorMessage: MESSAGES.SESSION_EXPIRED_SIGNUP });
  }

  if (otp !== userOtp) {
    return res.status(STATUS.BAD_REQUEST).render("user/verifyOtp", { email: userData.email, errorMessage: MESSAGES.OTP_INVALID });
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
                type: "CREDIT",
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
                type: "CREDIT",
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
const resendOtp = async (req, res) => {
  try {
    const { userData } = req.session;
    if (!userData) {
      return res.status(STATUS.BAD_REQUEST).render("user/signup", { errorMessage: MESSAGES.SESSION_EXPIRED_SIGNUP });
    }

    const newOtp = generateOtp();
    console.log(`Resent OTP for ${userData.email}: ${newOtp}`);

    const emailSent = await sendVerificationEmail(userData.email, newOtp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("user/verifyOtp", {
        email: userData.email,
        errorMessage: MESSAGES.OTP_RESEND_FAILED
      });
    }

    req.session.userOtp = newOtp;
    res.status(STATUS.SUCCESS).render("user/verifyOtp", {
      email: userData.email,
      errorMessage: MESSAGES.OTP_RESEND_SUCCESS
    });
  } catch (error) {
    console.error("Resend OTP Error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Login Page
const getLoginPage = (req, res) => {
  res.status(STATUS.SUCCESS).render("user/userLogin", {
    title: "Login",
    errorField: null,
    errorMessage: null,
    error: null
  });
};

// Login User (Check Admin/User)
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(STATUS.BAD_REQUEST).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: MESSAGES.EMAIL_REQUIRED,
        error: null
      });
    }

    if (!password) {
      return res.status(STATUS.BAD_REQUEST).render("user/userLogin", {
        title: "Login",
        errorField: "password",
        errorMessage: MESSAGES.NEW_PASSWORD_REQUIRED,
        error: null
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(STATUS.NOT_FOUND).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: MESSAGES.NOT_FOUND,
        error: null
      });
    }

    if (!user.isVerified) {
      return res.status(STATUS.FORBIDDEN).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: MESSAGES.EMAIL_NOT_VERIFIED,
        error: null
      });
    }

    if (!user.isActive) {
      return res.status(STATUS.FORBIDDEN).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: MESSAGES.ACCOUNT_BLOCKED,
        error: null
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(STATUS.BAD_REQUEST).render("user/userLogin", {
        title: "Login",
        errorField: "password",
        errorMessage: MESSAGES.INCORRECT_PASSWORD,
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
      error: MESSAGES.LOGIN_FAILED
    });
  }
};

// Google Auth Success (Check Role + Blocked)
const googleAuthSuccess = async (req, res) => {
  try {
    if (!req.user) return res.status(STATUS.UNAUTHORIZED).redirect("/login");

    const user = await User.findOne({ email: req.user.email });
    if (!user) {
      return res.status(STATUS.NOT_FOUND).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: MESSAGES.NOT_FOUND,
        error: null
      });
    }

    if (!user.isActive) {
      return res.status(STATUS.FORBIDDEN).render("user/userLogin", {
        title: "Login",
        errorField: "email",
        errorMessage: MESSAGES.ACCOUNT_BLOCKED,
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
      error: MESSAGES.LOGIN_FAILED
    });
  }
};

// Logout
const logoutUser = (req, res) => {
  req.session.user = null;
  res.status(STATUS.SUCCESS).redirect("/login");
};

// Google Auth Controllers
const googleLogin = passport.authenticate("google", {
  scope: ["profile", "email"],
});

const googleCallback = passport.authenticate("google", {
  failureRedirect: "/login",
});

const googleRedirectSuccess = (req, res) => {
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
const getForgotPasswordPage = (req, res) => {
  res.status(STATUS.SUCCESS).render("user/forgotPassword", {
    email: "",
    errorField: null,
    errorMessage: null
  });
};

// Handle Forgot Password (send OTP)
const sendForgotPasswordOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || email.trim() === "") {
      return res.status(STATUS.BAD_REQUEST).render("user/forgotPassword", {
        email: "",
        errorField: "email",
        errorMessage: MESSAGES.EMAIL_REQUIRED
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(STATUS.BAD_REQUEST).render("user/forgotPassword", {
        email,
        errorField: "email",
        errorMessage: MESSAGES.EMAIL_INVALID
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(STATUS.NOT_FOUND).render("user/forgotPassword", {
        email,
        errorField: "email",
        errorMessage: MESSAGES.USER_NOT_FOUND_EMAIL
      });
    }

    const otp = generateOtp();
    console.log(`Forgot password OTP for ${email}: ${otp}`);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(STATUS.SERVER_ERROR).render("user/forgotPassword", {
        errorMessage: MESSAGES.OTP_SEND_FAILED
      });
    }

    req.session.resetOtp = otp;
    req.session.resetEmail = email;

    res.status(STATUS.SUCCESS).render("user/otpForgotPassword", {
      email, errorMessage: MESSAGES.OTP_SEND_SUCCESS
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(STATUS.SERVER_ERROR).redirect("/error");
  }
};

// Verify OTP for Forgot Password
const verifyForgotOtp = async (req, res) => {
  try {
    const otp = `${req.body.otp1}${req.body.otp2}${req.body.otp3}${req.body.otp4}`;
    const { resetOtp, resetEmail } = req.session;

    if (!resetOtp || !resetEmail) {
      return res.status(STATUS.BAD_REQUEST).render("user/forgotPassword", {
        errorMessage: MESSAGES.SESSION_EXPIRED_SIGNUP
      });
    }

    if (otp !== resetOtp) {
      return res.status(STATUS.BAD_REQUEST).render("user/otpForgotPassword", {
        email: resetEmail,
        errorMessage: MESSAGES.OTP_INVALID
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
      error: MESSAGES.LOGIN_FAILED
    });
  }
};

// Resend Forgot Password OTP
const resendForgotOtp = async (req, res) => {
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
        errorMessage: MESSAGES.OTP_RESEND_FAILED,
      });
    }

    res.status(STATUS.SUCCESS).render("user/otpForgotPassword", {
      email,
      errorMessage: MESSAGES.OTP_RESEND_SUCCESS,
    });
  } catch (error) {
    console.error("Resend Forgot OTP Error:", error);
    res.status(STATUS.SERVER_ERROR).render("user/otpForgotPassword", {
      email: req.session.resetEmail,
      error: MESSAGES.LOGIN_FAILED,
    });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, email } = req.body;
    if (!password) {
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: MESSAGES.NEW_PASSWORD_REQUIRED
      });
    }
    const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!strongRegex.test(password)) {
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: MESSAGES.PASSWORD_WEAK
      });
    }
    if (!confirmPassword) {
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "confirmPassword",
        errorMessage: MESSAGES.CONFIRM_PASSWORD_REQUIRED_RESET
      });
    }
    if (password !== confirmPassword) {
      return res.status(STATUS.BAD_REQUEST).render("user/resetPassword", {
        email,
        errorField: "password",
        errorMessage: MESSAGES.PASSWORD_MISMATCH
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
const getReferralPage = async (req, res) => {
  try {
    const userId = req.session.user?.id;
    if (!userId) return res.redirect("/login");

    let referral = await ReferralCode.findOne({ user: userId });

    if (!referral) {
      const newCode = generateReferralCode();
      const baseUrl = process.env.BASE_URL;
      const referralLink = `${baseUrl}/signup?ref=${newCode}`;

      referral = await ReferralCode.create({
        user: userId,
        code: newCode,
        referralLink,
        usedCount: 0,
        rewardAmount: 100
      });
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

    return res.render("user/referral", {
      title: "Refer & Earn",
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

export {
  getWelcomePage,
  getSignupPage,
  registerUser,
  verifyOtp,
  resendOtp,
  getLoginPage,
  loginUser,
  googleAuthSuccess,
  logoutUser,
  googleLogin,
  googleCallback,
  googleRedirectSuccess,
  getForgotPasswordPage,
  sendForgotPasswordOtp,
  verifyForgotOtp,
  resendForgotOtp,
  resetPassword,
  getReferralPage
};
