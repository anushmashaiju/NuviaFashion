import dotenv from "dotenv";
dotenv.config();
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// Cloudinary Configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Upload Single Category Image
export const uploadSingleImage = upload.single("thumbnail");

// Upload Product Images (Main + Variant)
export const uploadProductImages = upload.fields([
  { name: "images", maxCount: 5 },         
  { name: "variantImages", maxCount: 10 },
]);

//  Upload Buffer to Cloudinary
export const uploadToCloudinary = (fileBuffer, folder = "products") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (result) resolve(result.secure_url);
        else reject(error);
      }
    );
    streamifier.createReadStream(fileBuffer).pipe(stream);
  });


//  Process Category Image
export const processCategoryImage = async (req, res, next) => {
  try {
    if (req.file) {
      const imageUrl = await uploadToCloudinary(req.file.buffer, "nuvia_categories");
      req.thumbnailUrl = imageUrl;
    }
    next();
  } catch (error) {
    console.error(" Cloudinary category upload error:", error);
    res.status(500).send("Category image upload failed");
  }
};

//  Process Product Images (Add Product)
export const processProductImages = async (req, res, next) => {
  try {
    req.imageUrls = [];
    req.variantImageUrls = [];

    if (req.files?.images) {
      for (const file of req.files.images) {
        const url = await uploadToCloudinary(file.buffer, "products/main");
        req.imageUrls.push(url);
      }
    }

    if (req.files?.variantImages) {
      for (const file of req.files.variantImages) {
        const url = await uploadToCloudinary(file.buffer, "products/variants");
        req.variantImageUrls.push(url);
      }
    }
    next();
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    res.status(500).send("Error uploading images");
  }
}
//  Process Product Images (Edit Product)
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
    console.error(" Edit product upload error:", error);
    res.status(500).send("Product image upload failed");
  }
};

//uploadProfileImage
export const uploadProfileImage = upload.single("profileImage");

//processProfileImage
export const processProfileImage = async (req, res, next) => {
  try {
    if (!req.file) return next();

    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "user_profiles" },
          (error, result) => {
            if (result) resolve(result);
            else reject(error);
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const uploadedImage = await streamUpload();
    req.body.profileImage = uploadedImage.secure_url;

    next();
  } catch (error) {
    console.error("Profile image upload error:", error);
    next(error);
  }
};
