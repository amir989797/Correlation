
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
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

// Test Connection
pool.connect().then(client => {
  console.log(`✅ Connected to PostgreSQL database at ${dbConfig.host}:${dbConfig.port}`);
  client.release();
}).catch(err => {
  console.error('❌ Failed to connect to database:', err.message);
});

// In-Memory Cache for Assets
let assetsCache = null;
let assetsCacheTime = 0;
const ASSETS_CACHE_TTL = 60 * 1000; // 1 minute

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TSETMC Node.js API is running' });
});

/**
 * Search Endpoint
 */
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  let client;
  try {
    client = await pool.connect();
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
    res.status(500).json([]); 
  } finally {
    if (client) client.release();
  }
});

/**
 * Asset Groups Endpoint (Public)
 * Returns the curated lists of funds/assets.
 * Cached for performance.
 */
app.get('/api/assets', async (req, res) => {
  // Check Cache
  const now = Date.now();
  if (assetsCache && (now - assetsCacheTime < ASSETS_CACHE_TTL)) {
      return res.json(assetsCache);
  }

  let client;
  try {
    client = await pool.connect();
    // Check if table exists first to avoid crash if migration hasn't run
    const result = await client.query(`
        SELECT symbol, type, url, is_default, last_return FROM asset_groups ORDER BY symbol
    `);
    
    // Update Cache
    assetsCache = result.rows;
    assetsCacheTime = now;
    
    res.json(result.rows);
  } catch (err) {
    // If table doesn't exist yet, return empty list gracefully
    if (err.code === '42P01') { 
        res.json([]);
    } else {
        console.error('❌ Assets Error:', err);
        res.status(500).json({ error: 'Database error' });
    }
  } finally {
    if (client) client.release();
  }
});

/**
 * History Endpoint
 * Optimized to return LATEST records when limit is applied
 */
app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit) || 10000;

  let client;
  try {
    client = await pool.connect();
    
    // Optimized Query: Get LATEST N records (DESC), then sort them ASC for the chart
    const query = `
      SELECT * FROM (
          SELECT to_char(date, 'YYYYMMDD') as date, close, open, high, low, volume
          FROM daily_prices 
          WHERE symbol = $1 
          ORDER BY date DESC 
          LIMIT $2
      ) sub ORDER BY date ASC
    `;
    const values = [symbol, limit];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      // Check if symbol exists but has no data, or doesn't exist at all
      // For simplicity, we just return 404
      return res.status(404).json({ error: 'Symbol not found or no data' });
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
