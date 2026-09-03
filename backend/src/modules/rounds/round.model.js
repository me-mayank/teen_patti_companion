const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
    roundNumber: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['CREATED', 'ACTIVE', 'SIDE_SHOW_PENDING', 'SHOW_PENDING', 'COMPLETED'],
      default: 'CREATED',
    },
    potAmount: {
      type: Number,
      default: 0,
    },
    currentBet: {
      type: Number,
      default: 0,
    },
    startingBet: {
      type: Number,
    },
    currentTurnIndex: {
      type: Number,
      default: 0,
    },
    players: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: { type: String, enum: ['ACTIVE', 'PACKED', 'WINNER'], default: 'ACTIVE' },
        totalContribution: { type: Number, default: 0 },
        seenCards: { type: Boolean, default: false },
      },
    ],
    sideShowRequest: {
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      targetPlayer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      result: { type: String, enum: ['PENDING', 'ACCEPTED', 'REQUESTER_WON', 'TARGET_WON'] },
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    startedAt: Date,
    endedAt: Date,
  },
  {
    timestamps: true,
  }
);

roundSchema.index({ gameId: 1, roundNumber: 1 });

const Round = mongoose.model('Round', roundSchema);
module.exports = Round;
