const express = require('express');
const router = express.Router();
const { getUsers, changeUsername } = require('./user.controller');
const { protect } = require('../../shared/middleware/auth.middleware');

router.route('/').get(protect, getUsers);
router.route('/username').put(protect, changeUsername);

module.exports = router;
