const express = require('express');
const router = express.Router();
const {
  respondInvite,
  getMyInvitations,
  resendInvite,
} = require('./invitation.controller');
const { protect } = require('../../shared/middleware/auth.middleware');
const { validate } = require('../../shared/middleware/validate.middleware');
const { respondInviteSchema } = require('./invitation.validation');

// Note: POST /api/games/:id/invitations and GET /api/games/:id/invitations
// are mounted in game.routes.js or invitation.routes.js?
// The plan says `POST /api/games/:id/invitations`, so let's keep them here 
// and mount this router on `/api/invitations` BUT also we need to handle the game specific ones.
// I'll export game-specific routes in a separate router or just mount them in app.js on `/api/games`.

router.route('/me').get(protect, getMyInvitations);
router.route('/:id/respond').post(protect, validate(respondInviteSchema), respondInvite);
router.route('/:id/resend').post(protect, resendInvite);

module.exports = router;
