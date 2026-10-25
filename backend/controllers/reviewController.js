const pool = require('../config/db');
const AppError = require('../utils/AppError');

const createReview = async (req, res) => {
  const { id: productId } = req.params;
  const { rating, comment } = req.body;
  const userId = req.user.id;

  const product = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (product.rows.length === 0) throw new AppError('Product not found.', 404);

  const existing = await pool.query(
    'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2',
    [productId, userId]
  );
  if (existing.rows.length > 0) throw new AppError('You have already reviewed this product.', 409);

  const result = await pool.query(
    `INSERT INTO reviews (product_id, user_id, rating, comment)
     VALUES ($1, $2, $3, $4) RETURNING id, product_id, user_id, rating, comment, created_at`,
    [productId, userId, rating, comment || null]
  );

  const userResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
  const review = result.rows[0];
  review.user_name = userResult.rows[0].name;

  res.status(201).json(review);
};

const getProductReviews = async (req, res) => {
  const { id: productId } = req.params;

  const product = await pool.query('SELECT id FROM products WHERE id = $1', [productId]);
  if (product.rows.length === 0) throw new AppError('Product not found.', 404);

  const result = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name AS user_name
     FROM reviews r
     JOIN users u ON u.id = r.user_id
     WHERE r.product_id = $1
     ORDER BY r.created_at DESC`,
    [productId]
  );

  const stats = await pool.query(
    `SELECT COALESCE(AVG(rating)::numeric(10,2), 0) AS avg_rating,
            COUNT(*)::int AS review_count
     FROM reviews WHERE product_id = $1`,
    [productId]
  );

  res.json({
    reviews: result.rows,
    avg_rating: parseFloat(stats.rows[0].avg_rating),
    review_count: stats.rows[0].review_count,
  });
};

const deleteReview = async (req, res) => {
  const { id: productId, reviewId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  const review = await pool.query(
    'SELECT id, user_id FROM reviews WHERE id = $1 AND product_id = $2',
    [reviewId, productId]
  );
  if (review.rows.length === 0) throw new AppError('Review not found.', 404);

  if (userRole !== 'admin' && review.rows[0].user_id !== userId) {
    throw new AppError('Not authorized to delete this review.', 403);
  }

  await pool.query('DELETE FROM reviews WHERE id = $1', [reviewId]);
  res.json({ message: 'Review deleted successfully.' });
};

module.exports = { createReview, getProductReviews, deleteReview };
