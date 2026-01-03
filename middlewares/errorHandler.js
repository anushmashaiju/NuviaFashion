import STATUS from "../utils/statusCodes.js";
import MESSAGES from "../utils/messages.js";

export const error403Handler = (req, res) => {
  const isAdminRoute =
    (req.originalUrl && req.originalUrl.startsWith("/admin")) ||
    (req.baseUrl && req.baseUrl.startsWith("/admin")) ||
    (req.headers.referer && req.headers.referer.includes("/admin"));

  if (isAdminRoute) {
    return res.redirect("/admin/login");
  }

  return res.redirect("/login");
};

export const error404Handler = (req, res) => {
  const redirectPath = req.session?.admin
    ? "/admin/dashboard"
    : "/home";

  return res.status(STATUS.NOT_FOUND).render("partials/errorPage", {
    statusCode: STATUS.NOT_FOUND,
    message: MESSAGES.ERROR_404,
    redirectPath,
  });
};

// GLOBAL ERROR HANDLER 
export const globalErrorHandler = (err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err.message);
  console.error(err.stack);

  const isAdminRoute =
    (req.originalUrl && req.originalUrl.startsWith("/admin")) ||
    (req.baseUrl && req.baseUrl.startsWith("/admin")) ||
    (req.headers.referer && req.headers.referer.includes("/admin"));

  if (isAdminRoute) {
    return res.redirect("/admin/login");
  }

  return res.redirect("/login");
};
