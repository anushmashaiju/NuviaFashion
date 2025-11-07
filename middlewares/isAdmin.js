export const isAdmin = (req, res, next) => {
  console.log(" Session user:", req.session.user);

  if (req.session.user && req.session.user.role === "admin") {
    return next();
  }

  console.log("⛔ Unauthorized access attempt");
  return res.redirect("/error");
};


