const router = require('express').Router();
const { body } = require('express-validator');
const {
  getOverview,
  updateProfile,
  changePassword,
  getStoreSettings,
  updateStoreSettings,
  getPreferences,
  updatePreferences,
  getActivity,
  getSessions,
  revokeOtherSessions,
  getSystemInfo,
} = require('../controllers/settingsController');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { handleValidation, passwordComplexityRules } = require('../middleware/validate');

const profileValidation = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.'),
  body('email').isEmail().withMessage('Valid email is required.'),
  body('avatar_url').optional({ nullable: true, checkFalsy: true }).trim().isURL({ protocols: ['http', 'https'] }).withMessage('Avatar must be a valid URL.'),
];

const passwordValidation = [
  body('current_password').isLength({ min: 1, max: 128 }).withMessage('Current password is required.'),
  ...passwordComplexityRules('new_password'),
];

const storeValidation = [
  body('store_name').trim().isLength({ min: 2, max: 120 }).withMessage('Store name must be between 2 and 120 characters.'),
  body('logo_url').optional({ nullable: true, checkFalsy: true }).trim().isURL({ protocols: ['http', 'https'] }).withMessage('Logo must be a valid URL.'),
  body('support_email').isEmail().withMessage('Support email must be valid.'),
  body('phone').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 3, max: 40 }).withMessage('Phone must be between 3 and 40 characters.'),
  body('currency').trim().isLength({ min: 3, max: 3 }).isUppercase().withMessage('Currency must be a 3-letter uppercase code.'),
  body('tax_rate').isFloat({ min: 0, max: 100 }).toFloat().withMessage('Tax rate must be between 0 and 100.'),
  body('shipping_fee').isFloat({ min: 0 }).toFloat().withMessage('Shipping fee must be non-negative.'),
];

const preferenceValidation = [
  body('theme_mode').isIn(['dark', 'light']).withMessage('Theme mode must be dark or light.'),
  body('email_notifications').isBoolean().toBoolean().withMessage('Email notifications must be true or false.'),
  body('order_notifications').isBoolean().toBoolean().withMessage('Order notifications must be true or false.'),
  body('stock_notifications').isBoolean().toBoolean().withMessage('Stock notifications must be true or false.'),
  body('security_notifications').isBoolean().toBoolean().withMessage('Security notifications must be true or false.'),
];

router.use(verifyToken, requireAdmin);

router.get('/', asyncHandler(getOverview));
router.put('/profile', profileValidation, handleValidation, asyncHandler(updateProfile));
router.put('/security/password', passwordValidation, handleValidation, asyncHandler(changePassword));
router.get('/store', asyncHandler(getStoreSettings));
router.put('/store', storeValidation, handleValidation, asyncHandler(updateStoreSettings));
router.get('/preferences', asyncHandler(getPreferences));
router.put('/preferences', preferenceValidation, handleValidation, asyncHandler(updatePreferences));
router.get('/activity', asyncHandler(getActivity));
router.get('/sessions', asyncHandler(getSessions));
router.delete('/sessions/others', asyncHandler(revokeOtherSessions));
router.get('/system', asyncHandler(getSystemInfo));

module.exports = router;
