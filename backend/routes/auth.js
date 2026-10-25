const router = require('express').Router();
const { body } = require('express-validator');
const { register, login, refresh, logout, getMe } = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { handleValidation, passwordComplexityRules } = require('../middleware/validate');

router.post(
  '/register',
  [
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters.'),
    body('email').isEmail().withMessage('Valid email is required.'),
    ...passwordComplexityRules('password'),
  ],
  handleValidation,
  asyncHandler(register)
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email is required.'),
    body('password').isLength({ min: 1, max: 128 }).withMessage('Password is required.'),
  ],
  handleValidation,
  asyncHandler(login)
);

router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.get('/me', verifyToken, asyncHandler(getMe));

module.exports = router;
