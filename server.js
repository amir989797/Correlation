
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

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TSETMC Node.js API is running' });
});

/**
 * Search Endpoint
 * OPTIMIZED: Now searches in the 'symbols' table instead of 'daily_prices'.
 */
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  let client;
  try {
    client = await pool.connect();
    
    // Fast query on the dedicated symbols table
    const query = `
      SELECT symbol, name 
      FROM symbols 
      WHERE symbol LIKE $1 OR name LIKE $1
      LIMIT 20
    `;
    const values = [`%${q}%`];
    const result = await client.query(query, values);
    
    // Fallback: If symbols table is empty (migration not run), this returns empty array.
    
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Search Error:', err);
    // Silent fail for search to avoid crashing frontend logic, just return empty
    res.status(500).json([]); 
  } finally {
    if (client) client.release();
  }
});

/**
 * History Endpoint
 * Fetches history from daily_prices
 * CRITICAL FIX: Ensures date is formatted as 'YYYYMMDD' (no dashes) to match frontend expectation.
 */
app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit) || 10000;

  let client;
  try {
    client = await pool.connect();
    
    // We format date as 'YYYYMMDD' (no dashes) because the frontend utils/mathUtils.ts
    // expects strict indices (slice(0,4), slice(4,6), slice(6,8)).
    const query = `
      SELECT to_char(date, 'YYYYMMDD') as date, close, open, high, low, volume
      FROM daily_prices 
      WHERE symbol = $1 
      ORDER BY date ASC 
      LIMIT $2
    `;
    const values = [symbol, limit];
    const result = await client.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Symbol not found' });
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
