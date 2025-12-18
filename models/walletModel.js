import mongoose from "mongoose";

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  balance: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: { type: String }, 
    amount: Number,
    date: { type: Date, default: Date.now },
    description: String
  }]
});


export default mongoose.model("Wallet", walletSchema);
