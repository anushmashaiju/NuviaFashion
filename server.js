import express from "express";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import session from "express-session";
import passport from "passport";
import "./config/passport.js";
import flash from "connect-flash";
import { addUserCounts, fetchActiveCategories } from "./middlewares/categoryProductMiddleware.js";

dotenv.config();
const app = express();

//  Connect MongoDB
connectDB();

//  Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Disable caching to prevent back-button issues
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || "nuviaSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, secure: false, sameSite: "lax" },
  })
);

// Flash Messages
app.use(flash());

// Global Middleware for EJS
app.use((req, res, next) => {
  res.locals.flash = req.flash();
  res.locals.user = req.session.user || null; // make user accessible in all templates
  next();
});

//  Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

//  ES module dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Fetch categories for header
app.use(fetchActiveCategories);
app.use(addUserCounts);

// Routes
app.use("/admin", adminRoutes);
app.use("/", userRoutes);

// 403 error
app.get("/error", (req, res) => {
  const redirectPath = req.session?.user?.role === "admin" ? "/admin/dashboard" : "/home";

  res.status(403).render("partials/errorPage", {
    statusCode: 403,
    message: "Access denied.",
    redirectPath
  });
});

// 404 error
app.use((req, res) => {
  const redirectPath = req.session?.user?.role === "admin" ? "/admin/dashboard" : "/home";

  res.status(404).render("partials/errorPage", {
    statusCode: 404,
    message: "Page not found.",
    redirectPath
  });
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(` Server running at http://localhost:${PORT}`));
