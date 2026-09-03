const Invitation = require('./invitation.model');
const Game = require('../games/game.model');
const { getIO } = require('../../shared/sockets');

const inviteUsers = async (gameId, userIds, inviterId) => {
  const game = await Game.findById(gameId);
  if (!game) throw new Error('Game not found');
  if (game.createdBy.toString() !== inviterId.toString()) {
    throw new Error('Only the creator can invite players');
  }

  const invitations = userIds.map((userId) => ({
    gameId,
    invitedUserId: userId,
    invitedBy: inviterId,
  }));

  // Ignore duplicates using insertMany with ordered: false, or do upserts
  // We'll filter existing ones to avoid MongoBulkWriteError
  const existingInvites = await Invitation.find({
    gameId,
    invitedUserId: { $in: userIds },
  });
  
  const existingUserIds = existingInvites.map((inv) =>
    inv.invitedUserId.toString()
  );
  
  const newInvitations = invitations.filter(
    (inv) => !existingUserIds.includes(inv.invitedUserId.toString())
  );

  if (newInvitations.length > 0) {
    await Invitation.insertMany(newInvitations);
    
    // Update game status if it was CREATED
    if (game.status === 'CREATED') {
      game.status = 'WAITING_FOR_PLAYERS';
      await game.save();
    }
  }

  // Emit socket event to game room so central board updates
  getIO().to(`game:${gameId}`).emit('game:update', { gameId });
  
  return await getInvitationsByGameId(gameId);
};

const getInvitationsByGameId = async (gameId) => {
  return await Invitation.find({ gameId }).populate('invitedUserId', 'name username');
};

const respondToInvitation = async (invitationId, userId, status) => {
  const invitation = await Invitation.findOne({
    _id: invitationId,
    invitedUserId: userId,
  });

  if (!invitation) {
    throw new Error('Invitation not found or not yours');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Invitation already responded to');
  }

  invitation.status = status;
  invitation.respondedAt = new Date();
  await invitation.save();

  if (status === 'ACCEPTED') {
    // Add player to game participants
    const game = await Game.findById(invitation.gameId);
    if (game) {
      const alreadyParticipant = game.participants.some(
        (p) => p.userId.toString() === userId.toString()
      );
      if (!alreadyParticipant) {
        game.participants.push({ userId: userId, balance: 0 });
        await game.save();
      }
    }
  }

  // Notify clients
  getIO().to(`game:${invitation.gameId}`).emit('game:update', { gameId: invitation.gameId });

  return invitation;
};

const getPendingInvitationsForUser = async (userId) => {
  return await Invitation.find({ invitedUserId: userId, status: 'PENDING' })
    .populate('gameId', 'name bootAmount')
    .populate('invitedBy', 'name username');
};

const resendInvitation = async (invitationId, inviterId) => {
  const invitation = await Invitation.findById(invitationId).populate('gameId');
  if (!invitation) throw new Error('Invitation not found');
  
  if (invitation.invitedBy.toString() !== inviterId.toString()) {
    throw new Error('Only the inviter can resend this invitation');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Cannot resend invitation because it is not pending');
  }

  invitation.updatedAt = new Date();
  await invitation.save();

  return invitation;
};

module.exports = {
  inviteUsers,
  getInvitationsByGameId,
  respondToInvitation,
  getPendingInvitationsForUser,
  resendInvitation,
};
