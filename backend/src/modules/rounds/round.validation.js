const { z } = require('zod');

const sideShowRequestSchema = z.object({
  body: z.object({
    targetUserId: z.string().min(1, 'Target user ID is required'),
  }),
});

const sideShowRespondSchema = z.object({
  body: z.object({
    accept: z.boolean(),
  }),
});

const sideShowResultSchema = z.object({
  body: z.object({
    loserUserId: z.string().min(1, 'Loser user ID is required'),
  }),
});

const showResultSchema = z.object({
  body: z.object({
    winnerUserId: z.string().min(1, 'Winner user ID is required'),
  }),
});

module.exports = {
  sideShowRequestSchema,
  sideShowRespondSchema,
  sideShowResultSchema,
  showResultSchema,
};
