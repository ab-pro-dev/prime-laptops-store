const pool = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * GET /api/cart
 */
const getCart = async (req, res) => {
  const result = await pool.query(
    `SELECT c.id, c.quantity,
            p.id AS product_id, p.name, p.brand, p.price, p.image, p.stock
     FROM cart c
     JOIN products p ON c.product_id = p.id
     WHERE c.user_id = $1
     ORDER BY c.id`,
    [req.user.id]
  );
  res.json(result.rows);
};

/**
 * POST /api/cart/add
 * Body: { product_id, quantity }
 */
const addToCart = async (req, res) => {
  const { product_id, quantity = 1 } = req.body;

  const result = await pool.query(
    `INSERT INTO cart (user_id, product_id, quantity)
     SELECT $1, p.id, $3
     FROM products p
     WHERE p.id = $2 AND p.stock >= $3
     ON CONFLICT (user_id, product_id)
     DO UPDATE SET quantity = cart.quantity + EXCLUDED.quantity
     WHERE cart.quantity + EXCLUDED.quantity <= (
       SELECT stock FROM products WHERE id = EXCLUDED.product_id
     )
     RETURNING *`,
    [req.user.id, product_id, quantity]
  );

  if (result.rows.length === 0) {
    const prod = await pool.query('SELECT id FROM products WHERE id = $1', [product_id]);
    if (prod.rows.length === 0) throw new AppError('Product not found.', 404);
    throw new AppError('Insufficient stock.', 400);
  }

  res.status(201).json(result.rows[0]);
};

/**
 * PUT /api/cart/:id
 * Body: { quantity }
 */
const updateCartItem = async (req, res) => {
  const { quantity } = req.body;

  const result = await pool.query(
    `UPDATE cart c
     SET quantity = $1
     FROM products p
     WHERE c.id = $2
       AND c.user_id = $3
       AND p.id = c.product_id
       AND p.stock >= $1
     RETURNING c.*`,
    [quantity, req.params.id, req.user.id]
  );
  if (result.rows.length === 0) {
    const existing = await pool.query('SELECT id FROM cart WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (existing.rows.length === 0) throw new AppError('Cart item not found.', 404);
    throw new AppError('Insufficient stock.', 400);
  }
  res.json(result.rows[0]);
};

/**
 * DELETE /api/cart/:id
 */
const removeCartItem = async (req, res) => {
  const result = await pool.query(
    'DELETE FROM cart WHERE id = $1 AND user_id = $2 RETURNING id',
    [req.params.id, req.user.id]
  );
  if (result.rows.length === 0) throw new AppError('Cart item not found.', 404);
  res.json({ message: 'Item removed.' });
};

/**
 * DELETE /api/cart
 * Clear entire cart
 */
const clearCart = async (req, res) => {
  await pool.query('DELETE FROM cart WHERE user_id = $1', [req.user.id]);
  res.json({ message: 'Cart cleared.' });
};

module.exports = { getCart, addToCart, updateCartItem, removeCartItem, clearCart };
