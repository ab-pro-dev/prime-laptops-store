const pool = require('../config/db');
const AppError = require('../utils/AppError');

/**
 * GET /api/products
 * Supports: ?brand=Apple&ram_gb=16&storage_gb=512&max_price=1500&search=macbook
 */
const getAllProducts = async (req, res) => {
  const { brand, ram_gb, storage_gb, max_price, min_price, search } = req.query;
  const limit = req.query.limit || 50;
  const page = req.query.page || 1;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const params = [];
  let i = 1;

  if (brand) {
    whereClause += ` AND LOWER(brand) = LOWER($${i++})`;
    params.push(brand);
  }
  if (ram_gb !== undefined) {
    whereClause += ` AND ram_gb >= $${i++}`;
    params.push(ram_gb);
  }
  if (storage_gb !== undefined) {
    whereClause += ` AND storage_gb >= $${i++}`;
    params.push(storage_gb);
  }
  if (min_price !== undefined) {
    whereClause += ` AND price >= $${i++}`;
    params.push(min_price);
  }
  if (max_price !== undefined) {
    whereClause += ` AND price <= $${i++}`;
    params.push(max_price);
  }
 if (search) {
   whereClause += ` AND (LOWER(name) LIKE LOWER($${i}) OR LOWER(brand) LIKE LOWER($${i + 1}) OR LOWER(cpu) LIKE LOWER($${i + 2}))`;
   params.push(`%${search}%`, `%${search}%`, `%${search}%`);
   i += 3;
 }

  const countResult = await pool.query(`SELECT COUNT(*)::int AS total FROM products ${whereClause}`, params);
  const total = countResult.rows[0].total;

  const listParams = [...params, limit, offset];
  const result = await pool.query(
    `SELECT p.id, p.name, p.brand, p.price, p.cpu, p.ram_gb, p.storage_gb, p.storage_unit, p.gpu, p.size_inches, p.stock, p.image, p.image2, p.image3, p.created_at,
            COALESCE(r_stats.avg_rating, 0)::numeric(10,2) AS avg_rating,
            COALESCE(r_stats.review_count, 0)::int AS review_count
     FROM products p
     LEFT JOIN LATERAL (
       SELECT AVG(rating)::numeric(10,2) AS avg_rating, COUNT(*)::int AS review_count
       FROM reviews WHERE product_id = p.id
     ) r_stats ON true
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${i++} OFFSET $${i++}`,
    listParams
  );

  res.json({
    products: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    },
  });
};

/**
 * GET /api/products/:id
 */
const getProductById = async (req, res) => {
  const result = await pool.query(
    `SELECT p.id, p.name, p.brand, p.price, p.cpu, p.ram_gb, p.storage_gb, p.storage_unit, p.gpu, p.size_inches, p.stock, p.image, p.image2, p.image3, p.created_at,
            COALESCE(r_stats.avg_rating, 0)::numeric(10,2) AS avg_rating,
            COALESCE(r_stats.review_count, 0)::int AS review_count
     FROM products p
     LEFT JOIN LATERAL (
       SELECT AVG(rating)::numeric(10,2) AS avg_rating, COUNT(*)::int AS review_count
       FROM reviews WHERE product_id = p.id
     ) r_stats ON true
     WHERE p.id = $1`,
    [req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Product not found.', 404);
  res.json(result.rows[0]);
};

/**
 * POST /api/products  (Admin)
 */
const createProduct = async (req, res) => {
  const { name, brand, price, cpu, ram_gb, storage_gb, storage_unit, gpu, size_inches, stock, image, image2, image3 } = req.body;
  const result = await pool.query(
    `INSERT INTO products (name, brand, price, cpu, ram_gb, storage_gb, storage_unit, gpu, size_inches, stock, image, image2, image3)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [name, brand, price, cpu, ram_gb, storage_gb, storage_unit, gpu, size_inches, stock, image, image2 || null, image3 || null]
  );
  res.status(201).json(result.rows[0]);
};

/**
 * PUT /api/products/:id  (Admin)
 */
const updateProduct = async (req, res) => {
  const { name, brand, price, cpu, ram_gb, storage_gb, storage_unit, gpu, size_inches, stock, image, image2, image3 } = req.body;
  const result = await pool.query(
    `UPDATE products
     SET name=$1, brand=$2, price=$3, cpu=$4, ram_gb=$5, storage_gb=$6, storage_unit=$7, gpu=$8, size_inches=$9, stock=$10, image=$11, image2=$12, image3=$13
     WHERE id=$14 RETURNING *`,
    [name, brand, price, cpu, ram_gb, storage_gb, storage_unit, gpu, size_inches, stock, image, image2 || null, image3 || null, req.params.id]
  );
  if (result.rows.length === 0) throw new AppError('Product not found.', 404);
  res.json(result.rows[0]);
};

/**
 * DELETE /api/products/:id  (Admin)
 */
const deleteProduct = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cart WHERE product_id = $1', [id]);
    await client.query('DELETE FROM order_items WHERE product_id = $1', [id]);
    const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) throw new AppError('Product not found.', 404);
    await client.query('COMMIT');
    res.json({ message: 'Product deleted successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * GET /api/products/brands
 */
const getBrands = async (req, res) => {
  const result = await pool.query('SELECT DISTINCT brand FROM products ORDER BY brand');
  res.json({ brands: result.rows.map(r => r.brand) });
};

/**
 * DELETE /api/products  (Admin — bulk)
 */
const deleteProducts = async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('ids must be a non-empty array of positive integers.', 400);
  }
  if (ids.length > 100) {
    throw new AppError('Cannot delete more than 100 products at once.', 400);
  }
  if (!ids.every(Number.isInteger) || !ids.every(id => id > 0)) {
    throw new AppError('Each id must be a positive integer.', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM cart WHERE product_id = ANY($1::int[])', [ids]);
    await client.query('DELETE FROM order_items WHERE product_id = ANY($1::int[])', [ids]);
    const result = await client.query('DELETE FROM products WHERE id = ANY($1::int[]) RETURNING id', [ids]);
    await client.query('COMMIT');
    res.json({ message: `${result.rowCount} products deleted successfully`, deleted: result.rowCount });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, deleteProducts, getBrands };
