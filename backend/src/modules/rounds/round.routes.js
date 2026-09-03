const express = require('express');
const router = express.Router();
const {
  bet,
  betTwice,
  pack,
  requestSideShow,
  requestShow,
  submitShowResult,
  getRound,
} = require('./round.controller');
const { protect } = require('../../shared/middleware/auth.middleware');
const { validate } = require('../../shared/middleware/validate.middleware');
const {
  showResultSchema,
} = require('./round.validation');

router.route('/:id').get(protect, getRound);
router.route('/:id/bet').post(protect, bet);
router.route('/:id/bet-twice').post(protect, betTwice);
router.route('/:id/pack').post(protect, pack);

router.route('/:id/side-show/request').post(protect, requestSideShow);

router.route('/:id/show/request').post(protect, requestShow);
router.route('/:id/show/result').post(protect, validate(showResultSchema), submitShowResult);

module.exports = router;
