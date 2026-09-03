const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
    roundId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Round',
      default: null,
    },
    type: {
      type: String,
      enum: ['BOOT', 'BET', 'BET_TWICE', 'ROUND_WIN', 'SETTLEMENT', 'ADJUSTMENT'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ gameId: 1 });
transactionSchema.index({ userId: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction;
