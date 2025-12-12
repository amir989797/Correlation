
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const app = express();
const PORT = parseInt(process.env.PORT || '8000');

// Middleware
app.use(cors());
app.use(express.json());

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Database Config
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

// Create Pool
const pool = new Pool(dbConfig);

// Initial Connection Test
pool.connect().then(client => {
  console.log(`✅ Connected to PostgreSQL database at ${dbConfig.host}:${dbConfig.port}`);
  client.release();
}).catch(err => {
  console.error('❌ Failed to connect to database on startup:', err.message);
  console.error('Check your .env file or DB credentials.');
});

// Root Endpoint (Health Check)
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TSETMC Node.js API is running' });
});

/**
 * Search Endpoint
 * GET /api/search?q=symbol_name
 */
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  let client;
  try {
    client = await pool.connect();
    // Using ILIKE for case-insensitive search and explicit casting to text if needed
    // Assuming table 'symbols' exists.
    const query = `
      SELECT symbol, name 
      FROM symbols 
      WHERE symbol LIKE $1 OR name LIKE $1 
      LIMIT 20
    `;
    const values = [`%${q}%`];
    const result = await client.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Search Error:', err);
    res.status(500).json({ 
      error: 'Database error', 
      details: err.message,
      hint: 'Ensure table "symbols" exists.' 
    });
  } finally {
    if (client) client.release();
  }
});

/**
 * History Endpoint
 * GET /api/history/:symbol
 */
app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit) || 365;

  let client;
  try {
    client = await pool.connect();
    const query = `
      SELECT to_char(date, 'YYYYMMDD') as date, close 
      FROM history 
      WHERE symbol = $1 
      ORDER BY date ASC 
      LIMIT $2
    `;
    const values = [symbol, limit];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Symbol not found in history' });
    }

    res.json(result.rows);
  } catch (err) {
    console.error('❌ History Error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
  } finally {
    if (client) client.release();
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
