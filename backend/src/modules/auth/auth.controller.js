const asyncHandler = require('../../shared/utils/asyncHandler');
const authService = require('./auth.service');

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = asyncHandler(async (req, res) => {
  const user = await authService.registerUser(req.body);
  res.status(201).json(user);
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
const login = asyncHandler(async (req, res) => {
  const user = await authService.loginUser(req.body);
  res.json(user);
});

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  res.json(user);
});

module.exports = {
  register,
  login,
  getMe,
};
