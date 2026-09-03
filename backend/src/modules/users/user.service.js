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

const changeUsername = async (userId, newUsername) => {
  const mongoose = require('mongoose');
  const { recordTransaction } = require('../ledger/ledger.service');

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
    throw new Error('Username must be 3-20 characters long and can only contain letters, numbers, and underscores');
  }

  const existingUser = await User.findOne({ username: newUsername });
  if (existingUser) {
    throw new Error('Username is already taken');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error('User not found');

    if (user.balance < 1000) {
      throw new Error('Insufficient balance to change username. ₹1000 required.');
    }

    user.balance -= 1000;
    user.username = newUsername;
    await user.save({ session });

    await recordTransaction(session, {
      userId: user._id,
      type: 'FEE',
      amount: 1000,
      description: 'Username change fee',
    });

    await session.commitTransaction();
    return user;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

module.exports = {
  searchUsers,
  changeUsername,
};
