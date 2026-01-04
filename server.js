
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

// In-Memory Cache
let assetsCache = null;
let assetsCacheTime = 0;
const ASSETS_CACHE_TTL = 60 * 1000; // 1 minute

let seoCache = null;
let seoCacheTime = 0;
const SEO_CACHE_TTL = 300 * 1000; // 5 minutes

// Market Overview Cache (Short TTL since it's live-ish data)
let marketCache = null;
let marketCacheTime = 0;
const MARKET_CACHE_TTL = 30 * 1000; // 30 seconds

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
 * Market Overview Endpoint (For Identification Page)
 * Returns all symbols grouped by industry with calculated daily change.
 */
app.get('/api/market/overview', async (req, res) => {
  const now = Date.now();
  if (marketCache && (now - marketCacheTime < MARKET_CACHE_TTL)) {
      return res.json(marketCache);
  }

  let client;
  try {
    client = await pool.connect();
    
    // Logic: 
    // 1. Find the latest 2 distinct dates.
    // 2. Get Today's price and Industry.
    // 3. Get Yesterday's price to calculate change %.
    const query = `
        WITH LastTwoDates AS (
            SELECT DISTINCT date FROM daily_prices ORDER BY date DESC LIMIT 2
        ),
        TodayData AS (
            SELECT dp.symbol, dp.close, dp.industry
            FROM daily_prices dp
            WHERE dp.date = (SELECT MAX(date) FROM LastTwoDates)
        ),
        YesterdayData AS (
            SELECT dp.symbol, dp.close
            FROM daily_prices dp
            WHERE dp.date = (SELECT MIN(date) FROM LastTwoDates)
        )
        SELECT
            t.symbol,
            t.industry,
            t.close,
            CASE 
              WHEN y.close > 0 THEN ROUND(((CAST(t.close AS NUMERIC) - CAST(y.close AS NUMERIC)) / CAST(y.close AS NUMERIC) * 100), 2)
              ELSE 0 
            END as change_percent
        FROM TodayData t
        LEFT JOIN YesterdayData y ON t.symbol = y.symbol
        ORDER BY t.industry, t.symbol
    `;
    
    const result = await client.query(query);
    marketCache = result.rows;
    marketCacheTime = now;
    
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Market Overview Error:', err);
    res.status(500).json({ error: 'Database error' });
  } finally {
    if (client) client.release();
  }
});

/**
 * Asset Groups Endpoint
 */
app.get('/api/assets', async (req, res) => {
  const now = Date.now();
  if (assetsCache && (now - assetsCacheTime < ASSETS_CACHE_TTL)) {
      return res.json(assetsCache);
  }

  let client;
  try {
    client = await pool.connect();
    const result = await client.query(`
        SELECT symbol, type, url, is_default, last_return FROM asset_groups ORDER BY symbol
    `);
    
    assetsCache = result.rows;
    assetsCacheTime = now;
    
    res.json(result.rows);
  } catch (err) {
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
 */
app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit) || 10000;

  let client;
  try {
    client = await pool.connect();
    
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

/**
 * SEO Endpoint
 * Returns all configured pages and their metadata
 */
app.get('/api/seo', async (req, res) => {
    const now = Date.now();
    if (seoCache && (now - seoCacheTime < SEO_CACHE_TTL)) {
        return res.json(seoCache);
    }
    
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT route, title, description, keywords FROM seo_pages');
        seoCache = result.rows;
        seoCacheTime = now;
        res.json(result.rows);
    } catch (err) {
        if (err.code === '42P01') return res.json([]);
        console.error('❌ SEO Fetch Error:', err);
        res.status(500).json({ error: 'Database error' });
    } finally {
        if (client) client.release();
    }
});

/**
 * Sitemap Endpoint
 */
app.get('/sitemap.xml', async (req, res) => {
    let client;
    try {
        client = await pool.connect();
        let seoPages = [];
        
        try {
            const seoPagesRes = await client.query('SELECT route FROM seo_pages');
            seoPages = seoPagesRes.rows;
        } catch (dbErr) {
            // Check if error is "relation does not exist" (table missing)
            if (dbErr.code === '42P01') {
                console.warn('⚠️ SEO table missing, returning default sitemap.');
                seoPages = [{ route: '/' }];
            } else {
                throw dbErr;
            }
        }
        
        // Start XML
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        const baseUrl = 'https://arkarise.ir'; 

        // Add Static Pages
        seoPages.forEach(page => {
            xml += '  <url>\n';
            xml += `    <loc>${baseUrl}${page.route}</loc>\n`;
            xml += `    <changefreq>weekly</changefreq>\n`;
            xml += `    <priority>${page.route === '/' ? '1.0' : '0.8'}</priority>\n`;
            xml += '  </url>\n';
        });

        xml += '</urlset>';
        
        res.header('Content-Type', 'application/xml');
        res.send(xml);

    } catch (err) {
        console.error('❌ Sitemap Error:', err);
        res.status(500).send('Error generating sitemap');
    } finally {
        if (client) client.release();
    }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
