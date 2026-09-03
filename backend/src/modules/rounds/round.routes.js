const express = require('express');
const router = express.Router();
const {
  bet,
  betTwice,
  pack,
  requestSideShow,
  respondSideShow,
  submitSideShowResult,
  requestShow,
  submitShowResult,
  getRound,
} = require('./round.controller');
const { protect } = require('../../shared/middleware/auth.middleware');
const { validate } = require('../../shared/middleware/validate.middleware');
const {
  sideShowRequestSchema,
  sideShowRespondSchema,
  sideShowResultSchema,
  showResultSchema,
} = require('./round.validation');

router.route('/:id').get(protect, getRound);
router.route('/:id/bet').post(protect, bet);
router.route('/:id/bet-twice').post(protect, betTwice);
router.route('/:id/pack').post(protect, pack);

router.route('/:id/side-show/request').post(protect, validate(sideShowRequestSchema), requestSideShow);
router.route('/:id/side-show/respond').post(protect, validate(sideShowRespondSchema), respondSideShow);
router.route('/:id/side-show/result').post(protect, validate(sideShowResultSchema), submitSideShowResult);

router.route('/:id/show/request').post(protect, requestShow);
router.route('/:id/show/result').post(protect, validate(showResultSchema), submitShowResult);

module.exports = router;
