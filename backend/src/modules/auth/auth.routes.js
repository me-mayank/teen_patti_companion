const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('./auth.controller');
const { protect } = require('../../shared/middleware/auth.middleware');
const { validate } = require('../../shared/middleware/validate.middleware');
const { registerSchema, loginSchema } = require('./auth.validation');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.get('/me', protect, getMe);

module.exports = router;
