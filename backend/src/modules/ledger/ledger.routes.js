const express = require('express');
const router = express.Router();
// Ledger routes are actually mounted via game.routes.js in the plan:
// GET /api/games/:id/transactions
// GET /api/games/:id/summary
// But I will just export the controller functions to be used there, or mount this under /api/ledger if preferred.
// Wait, plan says:
// GET /api/games/:id/transactions
// GET /api/games/:id/summary
// So let's mount them in game.routes.js and leave ledger.routes.js empty or just export router for completeness.

module.exports = router;
