const router = require('express').Router({ mergeParams: true });
const { body, param } = require('express-validator');
const {
  createReview, getProductReviews, deleteReview,
} = require('../controllers/reviewController');
const { verifyToken, refreshUser } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { handleValidation } = require('../middleware/validate');

const idParamValidation = [
  param('id').isInt({ min: 1 }).toInt().withMessage('Product id must be a positive integer.'),
];

const reviewValidation = [
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be an integer between 1 and 5.')
    .toInt(),
  body('comment')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Comment must be at most 2000 characters.'),
];

const reviewIdValidation = [
  param('reviewId').isInt({ min: 1 }).toInt().withMessage('Review id must be a positive integer.'),
];

router.get(
  '/',
  idParamValidation,
  handleValidation,
  asyncHandler(getProductReviews)
);

router.post(
  '/',
  verifyToken,
  idParamValidation,
  reviewValidation,
  handleValidation,
  asyncHandler(createReview)
);

router.delete(
  '/:reviewId',
  verifyToken,
  refreshUser,
  idParamValidation,
  reviewIdValidation,
  handleValidation,
  asyncHandler(deleteReview)
);

module.exports = router;
