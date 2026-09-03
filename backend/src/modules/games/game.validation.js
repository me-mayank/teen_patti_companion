const { z } = require('zod');

const createGameSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Game name is required'),
    bootAmount: z.number().min(1, 'Boot amount must be at least 1'),
    maxBetMultiplier: z.number().min(1).default(5),
  }),
});

const turnOrderSchema = z.object({
  body: z.object({
    orderedUserIds: z.array(z.string()).min(2, 'At least 2 players required'),
  }),
});

module.exports = {
  createGameSchema,
  turnOrderSchema,
};
