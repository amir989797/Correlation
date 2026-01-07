
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

// Helper to sync indices on startup (Optional now, as search is dynamic)
const syncIndicesToSymbols = async () => {
  const client = await pool.connect();
  try {
    // We try to create/sync, but errors won't stop the server
    await client.query(`
      CREATE TABLE IF NOT EXISTS symbols (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255)
      );
    `);
    await client.query(`
      INSERT INTO symbols (symbol, name)
      SELECT symbol, MAX(name) as name
      FROM index_prices
      GROUP BY symbol
      ON CONFLICT (symbol) DO NOTHING;
    `);
    console.log('✅ Synced indices to symbols table (Background).');
  } catch (err) {
    // console.warn('Sync indices skipped:', err.message);
  } finally {
    client.release();
  }
};

// Test Connection & Sync
pool.connect().then(async client => {
  console.log(`✅ Connected to PostgreSQL database at ${dbConfig.host}:${dbConfig.port}`);
  client.release();
  // We still run this in background for performance optimization
  syncIndicesToSymbols();
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

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'TSETMC Node.js API is running' });
});

/**
 * Search Endpoint
 * Updates: Uses UNION to search both 'symbols' (stocks) and 'index_prices' (indices)
 * This allows finding indices even if the sync script hasn't run.
 */
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  let client;
  try {
    client = await pool.connect();
    
    // Check if index_prices exists to avoid error if script never ran
    let hasIndicesTable = false;
    try {
        await client.query("SELECT 1 FROM index_prices LIMIT 1");
        hasIndicesTable = true;
    } catch(e) { hasIndicesTable = false; }

    let query = '';
    
    if (hasIndicesTable) {
        // Combined search: Stocks (from symbols table) + Indices (direct from index_prices)
        query = `
          SELECT symbol, name FROM (
              (SELECT symbol, name FROM symbols WHERE symbol LIKE $1 OR name LIKE $1 LIMIT 10)
              UNION
              (SELECT symbol, MAX(name) as name FROM index_prices WHERE symbol LIKE $1 OR name LIKE $1 GROUP BY symbol LIMIT 10)
          ) as combined_search
          LIMIT 20
        `;
    } else {
        // Fallback to just symbols table
        query = `
          SELECT symbol, name 
          FROM symbols 
          WHERE symbol LIKE $1 OR name LIKE $1
          LIMIT 20
        `;
    }

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
    
    // 1. Try daily_prices (Stocks)
    const stockQuery = `
      SELECT * FROM (
          SELECT to_char(date, 'YYYYMMDD') as date, close, open, high, low, volume
          FROM daily_prices 
          WHERE symbol = $1 
          ORDER BY date DESC 
          LIMIT $2
      ) sub ORDER BY date ASC
    `;
    const values = [symbol, limit];
    let result = await client.query(stockQuery, values);

    // 2. If not found, Try index_prices (Indices)
    if (result.rows.length === 0) {
         try {
             const indexQuery = `
              SELECT * FROM (
                  SELECT to_char(date, 'YYYYMMDD') as date, close, open, high, low, volume
                  FROM index_prices 
                  WHERE symbol = $1 
                  ORDER BY date DESC 
                  LIMIT $2
              ) sub ORDER BY date ASC
            `;
            result = await client.query(indexQuery, values);
         } catch (e) {
             // Ignore if table doesn't exist
             if (e.code !== '42P01') throw e; 
         }
    }

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
