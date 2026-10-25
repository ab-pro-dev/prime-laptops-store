const router = require('express').Router();
const { body, param, query } = require('express-validator');
const {
  getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, deleteProducts, getBrands,
} = require('../controllers/productController');
const reviewRoutes = require('./reviews');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { handleValidation } = require('../middleware/validate');

const productQueryValidation = [
  query('brand').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Brand filter is invalid.'),
  query('ram_gb').optional().isInt({ min: 1, max: 512 }).toInt().withMessage('RAM filter is invalid.'),
  query('storage_gb').optional().isInt({ min: 1, max: 100000 }).toInt().withMessage('Storage filter is invalid.'),
  query('min_price').optional().isFloat({ min: 0 }).toFloat().withMessage('Minimum price is invalid.'),
  query('max_price').optional().isFloat({ min: 0 }).toFloat().withMessage('Maximum price is invalid.'),
  query('search').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Search term is invalid.'),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt().withMessage('Limit must be between 1 and 100.'),
  query('page').optional().isInt({ min: 1, max: 10000 }).toInt().withMessage('Page must be a positive integer.'),
];

const idParamValidation = [
  param('id').isInt({ min: 1 }).toInt().withMessage('Product id must be a positive integer.'),
];

const productValidation = [
  body('name').trim().isLength({ min: 1, max: 255 }).withMessage('Product name is required.'),
  body('brand').trim().isLength({ min: 1, max: 50 }).withMessage('Brand is required.'),
  body('price').isFloat({ gt: 0 }).toFloat().withMessage('Price must be a positive number.'),
  body('cpu').trim().isLength({ min: 1, max: 100 }).withMessage('CPU is required.'),
  body('ram_gb').isInt({ min: 1, max: 512 }).toInt().withMessage('RAM must be a positive integer.'),
  body('storage_gb').isInt({ min: 1, max: 100000 }).toInt().withMessage('Storage must be a positive integer.'),
  body('storage_unit').isIn(['GB', 'TB']).withMessage('Storage unit must be GB or TB.'),
  body('gpu').trim().isLength({ min: 1, max: 100 }).withMessage('GPU is required.'),
  body('size_inches').isFloat({ gt: 0 }).toFloat().withMessage('Laptop size must be a positive number.'),
  body('stock').isInt({ min: 0, max: 1000000 }).toInt().withMessage('Stock must be a non-negative integer.'),
  body('image').trim().isURL({ protocols: ['http', 'https'] }).withMessage('Image URL is required.'),
  body('image2').optional({ values: 'falsy' }).trim().isURL({ protocols: ['http', 'https'] }).withMessage('Secondary image URL is invalid.'),
  body('image3').optional({ values: 'falsy' }).trim().isURL({ protocols: ['http', 'https'] }).withMessage('Third image URL is invalid.'),
];

const bulkDeleteValidation = [
  body('ids').isArray({ min: 1, max: 100 }).withMessage('ids must be a non-empty array of at most 100 items.'),
  body('ids.*').isInt({ min: 1 }).withMessage('Each id must be a positive integer.'),
];

router.get('/brands', asyncHandler(getBrands));
router.get('/', productQueryValidation, handleValidation, asyncHandler(getAllProducts));
router.get('/:id', idParamValidation, handleValidation, asyncHandler(getProductById));
router.post('/', verifyToken, requireAdmin, productValidation, handleValidation, asyncHandler(createProduct));
router.put('/:id', verifyToken, requireAdmin, idParamValidation, productValidation, handleValidation, asyncHandler(updateProduct));
router.delete('/', verifyToken, requireAdmin, bulkDeleteValidation, handleValidation, asyncHandler(deleteProducts));
router.delete('/:id', verifyToken, requireAdmin, idParamValidation, handleValidation, asyncHandler(deleteProduct));

router.use('/:id/reviews', reviewRoutes);

module.exports = router;
