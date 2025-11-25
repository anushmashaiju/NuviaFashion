import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        }
      }
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Wishlist", wishlistSchema);
