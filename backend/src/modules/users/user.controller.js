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

module.exports = {
  getUsers,
};
