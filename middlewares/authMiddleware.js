export const isUserAuthenticated = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/userLogin");
  }
};

export const isGuest = (req, res, next) => {
  if (req.session.user) {
    return res.redirect("/home");
  }
  next();
};
