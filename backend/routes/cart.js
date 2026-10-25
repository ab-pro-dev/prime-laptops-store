const router = require('express').Router();
const { body, param } = require('express-validator');
const { getCart, addToCart, updateCartItem, removeCartItem, clearCart } = require('../controllers/cartController');
const { verifyToken } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { handleValidation } = require('../middleware/validate');

const cartItemParamValidation = [
  param('id').isInt({ min: 1 }).toInt().withMessage('Cart item id must be a positive integer.'),
];

const addToCartValidation = [
  body('product_id').isInt({ min: 1 }).toInt().withMessage('product_id must be a positive integer.'),
  body('quantity').optional().isInt({ min: 1, max: 1000 }).toInt().withMessage('Quantity must be a positive integer.'),
];

const updateCartValidation = [
  body('quantity').isInt({ min: 1, max: 1000 }).toInt().withMessage('Quantity must be a positive integer.'),
];

router.use(verifyToken);

router.get('/', asyncHandler(getCart));
router.post('/add', addToCartValidation, handleValidation, asyncHandler(addToCart));
router.put('/:id', cartItemParamValidation, updateCartValidation, handleValidation, asyncHandler(updateCartItem));
router.delete('/clear', asyncHandler(clearCart));
router.delete('/:id', cartItemParamValidation, handleValidation, asyncHandler(removeCartItem));

module.exports = router;
