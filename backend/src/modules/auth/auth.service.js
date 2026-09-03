const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const User = require('../users/user.model');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

const registerUser = async ({ name, username, password }) => {
  const userExists = await User.findOne({ username: username.toLowerCase() });

  if (userExists) {
    throw new Error('User already exists');
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await User.create({
    name,
    username: username.toLowerCase(),
    passwordHash,
  });

  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    token: generateToken(user._id),
  };
};

const loginUser = async ({ username, password }) => {
  const user = await User.findOne({ username: username.toLowerCase() });

  if (user && (await bcrypt.compare(password, user.passwordHash))) {
    return {
      _id: user._id,
      name: user.name,
      username: user.username,
      token: generateToken(user._id),
    };
  } else {
    throw new Error('Invalid username or password');
  }
};

const getMe = async (userId) => {
  const user = await User.findById(userId).select('-passwordHash');
  if (!user) {
    throw new Error('User not found');
  }
  return user;
};

module.exports = {
  registerUser,
  loginUser,
  getMe,
};
