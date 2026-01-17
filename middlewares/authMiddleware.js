import User from "../models/userModel.js"; 
import STATUS from "../utils/statusCodes.js";

//  const isUserAuthenticated = async (req, res, next) => {
//   try {
//     if (!req.session?.user) {
//       return res.redirect("/login");
//     }
//     const userId = req.session.user._id || req.session.user.id;
//     if (!userId) return res.redirect("/login");

//     const user = await User.findById(userId);
//     if (!user || !user.isActive) {
//       req.session.destroy(err => {
//         if (err) console.error("Session destroy error:", err);
//         return res.redirect("/login?blocked=true");
//       });
//       return;
//     }

//     req.session.user = {
//       _id: user._id,
//       id: user._id,
//       name: user.name,
//       email: user.email,
//       role: user.role
//     };

//     next();
//   } catch (err) {
//     console.error("Auth middleware error:", err);
//     return res.redirect("/login");
//   }
// };

const isUserAuthenticated = async (req, res, next) => {
  try {
    if (!req.session?.user) {

      if (req.headers.accept?.includes("application/json")) {
        return res.status(STATUS.UNAUTHORIZED).json({
          success: false,
          message: "LOGIN_REQUIRED"
        });
      }

      return res.redirect("/login");
    }

    const userId = req.session.user._id || req.session.user.id;
    if (!userId) {

      if (req.headers.accept?.includes("application/json")) {
        return res.status(STATUS.UNAUTHORIZED).json({
          success: false,
          message: "LOGIN_REQUIRED"
        });
      }

      return res.redirect("/login");
    }

    const user = await User.findById(userId);
    if (!user || !user.isActive) {

      req.session.destroy(err => {
        if (err) console.error("Session destroy error:", err);

        if (req.headers.accept?.includes("application/json")) {
          return res.status(STATUS.UNAUTHORIZED).json({
            success: false,
            message: "ACCOUNT_BLOCKED"
          });
        }

        return res.redirect("/login?blocked=true");
      });

      return;
    }

    req.session.user = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);

    if (req.headers.accept?.includes("application/json")) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: "LOGIN_REQUIRED"
      });
    }

    return res.redirect("/login");
  }
};

export default isUserAuthenticated;


//for Guest
 const isGuest = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  next();
};

export {isUserAuthenticated,isGuest};

