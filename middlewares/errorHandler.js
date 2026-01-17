import STATUS from "../utils/statusCodes.js";
import MESSAGES from "../utils/messages.js";
import mongoose from "mongoose";

/* 403 Forbidden */
const error403Handler = (req, res) => {
  const isAdminRoute = req.originalUrl.startsWith("/admin");

  return res.status(STATUS.FORBIDDEN).render("partials/errorPage", {
    statusCode: STATUS.FORBIDDEN,
    message: MESSAGES.ERROR_403 || "Access forbidden",
    redirectPath: isAdminRoute ? "/admin/login" : "/login",
    admin: isAdminRoute ? req.session.admin : null
  });
};

/* 404 Not Found */
const error404Handler = (req, res) => {
  const isAdminRoute = req.originalUrl.startsWith("/admin");

  return res.status(STATUS.NOT_FOUND).render("partials/errorPage", {
    statusCode: STATUS.NOT_FOUND,
    message: MESSAGES.ERROR_404 || "Page not found",
    redirectPath: isAdminRoute ? "/admin/dashboard" : "/home",
    admin: isAdminRoute ? req.session.admin : null
  });
};

/* ===================== GLOBAL ERROR HANDLER ===================== */
const globalErrorHandler = (err, req, res, next) => {
  console.error("🔥 SERVER ERROR:", err);

  let statusCode = err.statusCode || STATUS.SERVER_ERROR;
  let message = err.message || MESSAGES.SERVER_ERROR || "Server error";

  // Handle invalid ObjectId errors
  if (err instanceof mongoose.Error.CastError) {
    statusCode = STATUS.BAD_REQUEST;
    message = MESSAGES.INVALID_INPUT || "Invalid request parameter";
  }

  const isAdminRoute = req.originalUrl.startsWith("/admin");

  return res.status(statusCode).render("partials/errorPage", {
    statusCode,
    message,
    redirectPath: isAdminRoute ? "/admin/dashboard" : "/home",
    admin: isAdminRoute ? req.session.admin : null
  });
};

/* VALIDATE OBJECT ID */
const validateObjectId = (paramName = "id") => {
  return (req, res, next) => {
    const value = req.params[paramName];

    if (!mongoose.Types.ObjectId.isValid(value)) {
      const error = new Error(
        MESSAGES.INVALID_INPUT || "Invalid request parameter"
      );
      error.statusCode = STATUS.BAD_REQUEST;
      return next(error);
    }

    next();
  };
};

export {
  error403Handler,
  error404Handler,
  globalErrorHandler,
  validateObjectId
};
