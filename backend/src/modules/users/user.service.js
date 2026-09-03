const User = require('./user.model');

const searchUsers = async (searchTerm = '') => {
  const query = searchTerm
    ? {
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { username: { $regex: searchTerm, $options: 'i' } },
        ],
      }
    : {};
  return await User.find(query).select('-passwordHash');
};

module.exports = {
  searchUsers,
};
