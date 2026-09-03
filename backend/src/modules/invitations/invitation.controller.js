const asyncHandler = require('../../shared/utils/asyncHandler');
const invitationService = require('./invitation.service');

// @desc    Invite players to a game
// @route   POST /api/games/:id/invitations
// @access  Private
const invitePlayers = asyncHandler(async (req, res) => {
  const invitations = await invitationService.inviteUsers(
    req.params.id,
    req.body.userIds,
    req.user._id
  );
  res.status(201).json(invitations);
});

// @desc    Get invitations for a game
// @route   GET /api/games/:id/invitations
// @access  Private
const getGameInvitations = asyncHandler(async (req, res) => {
  const invitations = await invitationService.getInvitationsByGameId(
    req.params.id
  );
  res.json(invitations);
});

// @desc    Respond to an invitation
// @route   POST /api/invitations/:id/respond
// @access  Private
const respondInvite = asyncHandler(async (req, res) => {
  const invitation = await invitationService.respondToInvitation(
    req.params.id,
    req.user._id,
    req.body.status
  );
  res.json(invitation);
});

// @desc    Get pending invitations for current user
// @route   GET /api/invitations/me
// @access  Private
const getMyInvitations = asyncHandler(async (req, res) => {
  const invitations = await invitationService.getPendingInvitationsForUser(
    req.user._id
  );
  res.json(invitations);
});

module.exports = {
  invitePlayers,
  getGameInvitations,
  respondInvite,
  getMyInvitations,
};
