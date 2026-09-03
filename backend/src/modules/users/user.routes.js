const express = require('express');
const router = express.Router();
const { getUsers, changeUsername, updateProfilePicture } = require('./user.controller');
const { protect } = require('../../shared/middleware/auth.middleware');

router.route('/').get(protect, getUsers);
router.route('/username').put(protect, changeUsername);
router.route('/profile-picture').put(protect, updateProfilePicture);

module.exports = router;
