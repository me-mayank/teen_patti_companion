const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema(
  {
    gameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
    invitedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
      default: 'PENDING',
    },
    respondedAt: Date,
  },
  {
    timestamps: true,
  }
);

invitationSchema.index({ gameId: 1, invitedUserId: 1 }, { unique: true });
invitationSchema.index({ gameId: 1, status: 1 });
invitationSchema.index({ invitedUserId: 1, status: 1 });

const Invitation = mongoose.model('Invitation', invitationSchema);
module.exports = Invitation;
