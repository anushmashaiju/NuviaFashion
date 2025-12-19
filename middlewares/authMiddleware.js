import User from "../models/userModel.js"; 


export const isUserAuthenticated = async (req, res, next) => {
  try {
    if (!req.session?.user) {
      return res.redirect("/login");
    }

    // ✅ Normalize ID
    const userId = req.session.user._id || req.session.user.id;
    if (!userId) return res.redirect("/login");

    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      req.session.destroy(err => {
        if (err) console.error("Session destroy error:", err);
        return res.redirect("/login?blocked=true");
      });
      return;
    }

    // ✅ Always store both
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
    return res.redirect("/login");
  }
};



export const isGuest = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  next();
};

