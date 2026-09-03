const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'CREATED',
        'WAITING_FOR_PLAYERS',
        'PLAYERS_FINALIZED',
        'TURN_ORDER_SETUP',
        'ACTIVE',
        'ENDED',
        'ARCHIVED',
      ],
      default: 'CREATED',
    },
    bootAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    maxBetMultiplier: {
      type: Number,
      default: 5,
    },
    participants: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        balance: { type: Number, default: 0 },
      },
    ],
    turnOrder: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    currentRoundNumber: {
      type: Number,
      default: 0,
    },
    startedAt: Date,
    endedAt: Date,
  },
  {
    timestamps: true,
  }
);

gameSchema.index({ status: 1 });
gameSchema.index({ 'participants.userId': 1 });

const Game = mongoose.model('Game', gameSchema);
module.exports = Game;
