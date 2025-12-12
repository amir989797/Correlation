
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL Connection Pool
// Please ensure these environment variables are set, or update the defaults here.
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// Test DB Connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error acquiring client', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

/**
 * Search Endpoint
 * GET /api/search?q=symbol_name
 */
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  try {
    // Note: Adjust table and column names according to your actual DB schema.
    // Assuming table 'symbols' with columns 'symbol' and 'name'.
    const query = `
      SELECT symbol, name 
      FROM symbols 
      WHERE symbol LIKE $1 OR name LIKE $1 
      LIMIT 20
    `;
    const values = [`%${q}%`];
    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json({ error: 'Database error during search' });
  }
});

/**
 * History Endpoint
 * GET /api/history/:symbol
 */
app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit) || 365;

  try {
    // Note: Adjust table and column names.
    // We format date to YYYYMMDD string to match frontend expectations.
    const query = `
      SELECT to_char(date, 'YYYYMMDD') as date, close 
      FROM history 
      WHERE symbol = $1 
      ORDER BY date ASC 
      LIMIT $2
    `;
    const values = [symbol, limit];
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('History Error:', err);
    res.status(500).json({ error: 'Database error fetching history' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
