import User from "../models/userModel.js"; 

export const isUserAuthenticated = async (req, res, next) => {
  if (!req.session.user) return res.redirect("/login");

  try {
    const user = await User.findById(req.session.user.id);
    if (!user || !user.isActive) {
      req.session.destroy(err => {
        if (err) console.error("Session destroy error:", err);
        return res.redirect("/login?blocked=true");
      });
    } else {
      req.session.user = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      };
      next();
    }
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.redirect("/login");
  }
};


export const isGuest = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  next();
};

