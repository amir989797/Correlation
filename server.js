
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

// Industry Cache (Heavy query, cache for 1 hour)
let industriesCache = null;
let industriesCacheTime = 0;
const INDUSTRIES_CACHE_TTL = 60 * 60 * 1000; 

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
 * Industries Endpoint
 * Returns industries with > 3 distinct symbols
 */
app.get('/api/industries', async (req, res) => {
  const now = Date.now();
  if (industriesCache && (now - industriesCacheTime < INDUSTRIES_CACHE_TTL)) {
      return res.json(industriesCache);
  }

  let client;
  try {
    client = await pool.connect();
    // Use a subquery to get distinct symbol-industry pairs first to optimize
    const query = `
      SELECT industry, COUNT(DISTINCT symbol)::int as count 
      FROM daily_prices 
      WHERE industry IS NOT NULL AND industry != ''
      GROUP BY industry 
      HAVING COUNT(DISTINCT symbol) > 3
      ORDER BY count DESC
    `;
    const result = await client.query(query);
    industriesCache = result.rows;
    industriesCacheTime = now;
    res.json(result.rows);
  } catch (err) {
    console.error('❌ Industries Error:', err);
    res.status(500).json({ error: 'Database error fetching industries' });
  } finally {
    if (client) client.release();
  }
});

/**
 * Symbols by Industry Endpoint
 */
app.get('/api/industries/:industry/symbols', async (req, res) => {
  const { industry } = req.params;
  let client;
  try {
    client = await pool.connect();
    // Get distinct symbols for this industry. 
    // We also grab the latest name for display.
    const query = `
        SELECT symbol, MAX(name) as name
        FROM daily_prices
        WHERE industry = $1
        GROUP BY symbol
        ORDER BY symbol ASC
    `;
    const result = await client.query(query, [industry]);
    res.json(result.rows);
  } catch (err) {
    console.error(`❌ Symbols for Industry ${industry} Error:`, err);
    res.status(500).json({ error: 'Database error fetching symbols' });
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
 * Supports both Stock symbols (daily_prices) and Indices (index_prices)
 */
app.get('/api/history/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit) || 10000;

  let client;
  try {
    client = await pool.connect();
    
    // Union both tables to find the symbol. 
    // Usually a symbol is unique to one table, but this covers both cases.
    const query = `
      SELECT * FROM (
          SELECT * FROM (
              SELECT to_char(date, 'YYYYMMDD') as date, close, open, high, low, volume
              FROM daily_prices 
              WHERE symbol = $1 
              UNION ALL
              SELECT to_char(date, 'YYYYMMDD') as date, close, open, high, low, volume
              FROM index_prices 
              WHERE symbol = $1 
          ) combined
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
    // If table index_prices doesn't exist yet, it throws an error. 
    // We send a generic 500 but log the detail.
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
