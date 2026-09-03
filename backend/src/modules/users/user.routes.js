const express = require('express');
const router = express.Router();
const { getUsers } = require('./user.controller');
const { protect } = require('../../shared/middleware/auth.middleware');

router.route('/').get(protect, getUsers);

module.exports = router;
