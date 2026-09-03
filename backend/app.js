const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { errorHandler } = require('./src/shared/middleware/error.middleware');

const authRoutes = require('./src/modules/auth/auth.routes');
const userRoutes = require('./src/modules/users/user.routes');
const gameRoutes = require('./src/modules/games/game.routes');
const invitationRoutes = require('./src/modules/invitations/invitation.routes');
const roundRoutes = require('./src/modules/rounds/round.routes');
const ledgerRoutes = require('./src/modules/ledger/ledger.routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Root Route
app.get('/', (req, res) => {
  res.status(200).send('Teen Patti Companion API is running');
});

// Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/rounds', roundRoutes);
app.use('/api/ledger', ledgerRoutes);

app.use(errorHandler);

module.exports = app;
