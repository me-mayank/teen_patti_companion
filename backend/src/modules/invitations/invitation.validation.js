const { z } = require('zod');

const invitePlayersSchema = z.object({
  body: z.object({
    userIds: z.array(z.string()).min(1, 'At least one user must be invited'),
  }),
});

const respondInviteSchema = z.object({
  body: z.object({
    status: z.enum(['ACCEPTED', 'DECLINED']),
  }),
});

module.exports = {
  invitePlayersSchema,
  respondInviteSchema,
};
