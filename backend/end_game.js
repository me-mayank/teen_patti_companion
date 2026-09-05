const mongoose = require('mongoose');
const Game = require('./src/modules/games/game.model');
const Round = require('./src/modules/rounds/round.model');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const game = await Game.findOne({ name: 'RTC-test-4', status: 'ACTIVE' });
    if (!game) {
      console.log('Game RTC-test-4 not found or already ended.');
      process.exit(0);
    }

    game.status = 'ENDED';
    await game.save();
    
    // Also mark active rounds as completed just in case
    await Round.updateMany({ gameId: game._id, status: 'ACTIVE' }, { $set: { status: 'COMPLETED' } });

    console.log(`Successfully ended game ${game.name} (${game._id})`);
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
