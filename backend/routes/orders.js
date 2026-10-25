const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { checkout, getOrders, getOrderById, updateOrderStatus, getStats } = require('../controllers/orderController');
const { verifyToken, refreshUser, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { handleValidation } = require('../middleware/validate');

const orderIdValidation = [
  param('id').isInt({ min: 1 }).toInt().withMessage('Order id must be a positive integer.'),
];

const orderListValidation = [
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100.'),
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt().withMessage('Page must be a positive integer.'),
];

const statusValidation = [
  body('status')
    .isIn(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'])
    .withMessage('Invalid status value.'),
];

router.use(verifyToken, refreshUser);

router.get('/stats', requireAdmin, asyncHandler(getStats));
router.post('/checkout', asyncHandler(checkout));
router.get('/', orderListValidation, handleValidation, asyncHandler(getOrders));
router.get('/:id', orderIdValidation, handleValidation, asyncHandler(getOrderById));
router.put('/:id/status', requireAdmin, orderIdValidation, statusValidation, handleValidation, asyncHandler(updateOrderStatus));

module.exports = router;
