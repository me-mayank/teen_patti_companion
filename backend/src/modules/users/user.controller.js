const asyncHandler = require('../../shared/utils/asyncHandler');
const userService = require('./user.service');

// @desc    Get all users / search users
// @route   GET /api/users
// @access  Private
const getUsers = asyncHandler(async (req, res) => {
  const users = await userService.searchUsers(req.query.search);
  // Exclude current user from the list
  const filteredUsers = users.filter(
    (user) => user._id.toString() !== req.user._id.toString()
  );
  res.json(filteredUsers);
});

// @desc    Change username
// @route   PUT /api/users/username
// @access  Private
const changeUsername = asyncHandler(async (req, res) => {
  const { username } = req.body;
  if (!username) {
    res.status(400);
    throw new Error('Please provide a new username');
  }

  const user = await userService.changeUsername(req.user._id, username);
  res.json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    balance: user.balance,
    profilePicture: user.profilePicture,
  });
});

// @desc    Update profile picture
// @route   PUT /api/users/profile-picture
// @access  Private
const updateProfilePicture = asyncHandler(async (req, res) => {
  const { profilePicture } = req.body;
  
  const user = await userService.updateProfilePicture(req.user._id, profilePicture);
  res.json({
    _id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    balance: user.balance,
    profilePicture: user.profilePicture,
  });
});

module.exports = {
  getUsers,
  changeUsername,
  updateProfilePicture,
};
