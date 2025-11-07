import dotenv from "dotenv";
dotenv.config();

import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// ======================
// 🌩️ Cloudinary Configuration
// ======================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ======================
// 🧠 Multer Memory Storage Setup
// ======================
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ======================
// 📁 Upload Single Category Image
// ======================
// -> Form input name: "thumbnail"
export const uploadSingleImage = upload.single("thumbnail");

// ======================
// 🧩 Upload Product Images (Main + Variant)
// ======================
// -> Form input names: "images" (main) and "variantImages" (variant)
export const uploadProductImages = upload.fields([
  { name: "images", maxCount: 5 },         // main product images
  { name: "variantImages", maxCount: 10 }, // variant images
]);

// ======================
// ☁️ Upload Buffer to Cloudinary
// ======================
export const uploadToCloudinary = (fileBuffer, folderName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: folderName,
        transformation: [{ width: 600, height: 600, crop: "fill" }],
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};

// ======================
// 🖼️ Process Category Image
// ======================
// -> Used with: uploadSingleImage
export const processCategoryImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).send("Please upload a category image");
    }

    const imageUrl = await uploadToCloudinary(req.file.buffer, "nuvia_categories");
    req.thumbnailUrl = imageUrl;
    next();
  } catch (error) {
    console.error("❌ Cloudinary category upload error:", error);
    res.status(500).send("Category image upload failed");
  }
};

// ======================
// 🖼️ Process Product Images (Add Product)
// ======================
export const processProductImages = async (req, res, next) => {
  try {
    const mainFiles = req.files?.["images"] || [];
    const variantFiles = req.files?.["variantImages"] || [];

    if (mainFiles.length < 3) {
      return res.status(400).send("Please upload at least 3 main product images");
    }

    const mainUrls = [];
    for (const file of mainFiles) {
      const url = await uploadToCloudinary(file.buffer, "nuvia_products");
      mainUrls.push(url);
    }

    const variantUrls = [];
    for (const file of variantFiles) {
      const url = await uploadToCloudinary(file.buffer, "nuvia_product_variants");
      variantUrls.push(url);
    }

    req.imageUrls = mainUrls;
    req.variantImageUrls = variantUrls;
    next();
  } catch (error) {
    console.error("❌ Product upload error:", error);
    res.status(500).send("Product image upload failed");
  }
};

// ======================
// 🖼️ Process Product Images (Edit Product)
// ======================
export const processProductImagesForEdit = async (req, res, next) => {
  try {
    const mainFiles = req.files?.["images"] || [];
    const variantFiles = req.files?.["variantImages"] || [];

    const mainUrls = [];
    for (const file of mainFiles) {
      const url = await uploadToCloudinary(file.buffer, "nuvia_products");
      mainUrls.push(url);
    }

    const variantUrls = [];
    for (const file of variantFiles) {
      const url = await uploadToCloudinary(file.buffer, "nuvia_product_variants");
      variantUrls.push(url);
    }

    req.imageUrls = mainUrls;
    req.variantImageUrls = variantUrls;
    next();
  } catch (error) {
    console.error("❌ Edit product upload error:", error);
    res.status(500).send("Product image upload failed");
  }
};
