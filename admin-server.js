
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;
const app = express();
const PORT = parseInt(process.env.ADMIN_PORT || '8080');

// Configuration
const PYTHON_SCRIPT_PATH = path.resolve(process.env.HOME || '/root', 'tse_downloader/full_market_download.py');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

let isUpdating = false;
let lastUpdateLog = "هنوز آپدیتی انجام نشده است.";
let currentProcess = null;

app.use(cors());
app.use(express.json());

const dbConfig = {
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432'),
};

const pool = new Pool(dbConfig);

// Init DB for Assets
const initAssetDB = async () => {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_groups (
                symbol VARCHAR(50),
                type VARCHAR(20),
                url TEXT,
                is_default BOOLEAN DEFAULT FALSE,
                PRIMARY KEY (symbol, type)
            );
        `);
        // Add columns if they don't exist (Migration)
        await client.query(`ALTER TABLE asset_groups ADD COLUMN IF NOT EXISTS url TEXT;`);
        await client.query(`ALTER TABLE asset_groups ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;`);
        
        console.log("✅ Asset Groups table checked/updated.");
    } catch (e) {
        console.error("Error creating/updating asset_groups table:", e);
    } finally {
        client.release();
    }
};
initAssetDB();

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  const validToken = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
  if (token === validToken) next();
  else res.status(403).json({ error: 'Forbidden' });
};

const syncSymbolsTable = async () => {
  const client = await pool.connect();
  try {
    const insertQuery = `
      INSERT INTO symbols (symbol, name)
      SELECT symbol, MAX(name) as name
      FROM daily_prices
      GROUP BY symbol
      ON CONFLICT (symbol) DO NOTHING;
    `;
    const res = await client.query(insertQuery);
    return res.rowCount;
  } finally {
    client.release();
  }
};

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    res.json({ token });
  } else {
    res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
  }
});

// Search Endpoint
app.get('/api/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);

  let client;
  try {
    client = await pool.connect();
    const query = `
      SELECT symbol, name 
      FROM symbols 
      WHERE symbol LIKE $1 OR name LIKE $1
      LIMIT 10
    `;
    const values = [`%${q}%`];
    const result = await client.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error('Search Error:', err);
    res.status(500).json([]); 
  } finally {
    if (client) client.release();
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const countQuery = `
      SELECT (SELECT COUNT(*) FROM symbols) as symbol_count,
             (SELECT MAX(date) FROM daily_prices) as last_date
    `;
    const result = await client.query(countQuery);
    const scriptExists = fs.existsSync(PYTHON_SCRIPT_PATH);

    res.json({
      symbolCount: result.rows[0].symbol_count || 0,
      lastDate: result.rows[0].last_date,
      isUpdating,
      lastLog: lastUpdateLog,
      scriptPath: PYTHON_SCRIPT_PATH,
      scriptExists
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error' });
  } finally {
    client.release();
  }
});

app.post('/api/update', requireAuth, (req, res) => {
  if (isUpdating) return res.status(400).json({ message: 'عملیات آپدیت هم‌اکنون در حال اجراست.' });
  if (!fs.existsSync(PYTHON_SCRIPT_PATH)) return res.status(500).json({ message: `فایل اسکریپت یافت نشد.` });

  isUpdating = true;
  lastUpdateLog = "🚀 آپدیت شروع شد (حالت چند رشته‌ای)...\n";
  
  currentProcess = spawn('python3', ['-u', PYTHON_SCRIPT_PATH]);

  currentProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    lastUpdateLog = (lastUpdateLog + chunk).slice(-5000); 
  });

  currentProcess.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('%') || text.includes('it/s')) {
        lastUpdateLog += `\n[PROGRESS]: ${text}`; 
    } else {
        lastUpdateLog += `\n[ERROR]: ${text}`;
    }
    lastUpdateLog = lastUpdateLog.slice(-5000);
  });

  currentProcess.on('close', async (code) => {
    console.log(`Script finished: ${code}`);
    currentProcess = null;
    isUpdating = false;

    if (code === 0) {
        lastUpdateLog += `\n✅ دریافت دیتا تمام شد.`;
        try {
            const count = await syncSymbolsTable();
            lastUpdateLog += `\n✨ لیست جستجو بروز شد (${count} نماد جدید).`;
        } catch (e) {
            lastUpdateLog += `\n⚠️ خطا در بروزرسانی لیست جستجو: ${e.message}`;
        }
    } else {
        lastUpdateLog += `\n❌ عملیات متوقف شد (Code: ${code}).`;
    }
  });

  res.json({ message: 'دستور آپدیت ارسال شد.', status: 'started' });
});

app.post('/api/stop', requireAuth, (req, res) => {
    if (!isUpdating || !currentProcess) return res.status(400).json({ message: 'چیزی در حال اجرا نیست.' });
    currentProcess.kill('SIGINT');
    res.json({ message: 'دستور توقف ارسال شد.' });
});

// --- ASSET GROUP MANAGEMENT ---

app.get('/api/assets', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT symbol, type, url, is_default FROM asset_groups ORDER BY symbol');
        res.json(result.rows);
    } catch(e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/assets', requireAuth, async (req, res) => {
    const { symbol, type, url } = req.body;
    if (!symbol || !type) return res.status(400).json({error: 'Invalid data'});
    
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO asset_groups (symbol, type, url) VALUES ($1, $2, $3) ON CONFLICT (symbol, type) DO UPDATE SET url = $3', 
            [symbol, type, url || null]
        );
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.put('/api/assets/default', requireAuth, async (req, res) => {
    const { symbol, type } = req.body;
    if (!symbol || !type) return res.status(400).json({error: 'Invalid data'});
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Reset all to false for this type
        await client.query('UPDATE asset_groups SET is_default = FALSE WHERE type = $1', [type]);
        // Set specific one to true
        await client.query('UPDATE asset_groups SET is_default = TRUE WHERE symbol = $1 AND type = $2', [symbol, type]);
        await client.query('COMMIT');
        res.json({ success: true });
    } catch(e) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.delete('/api/assets', requireAuth, async (req, res) => {
    const { symbol, type } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM asset_groups WHERE symbol = $1 AND type = $2', [symbol, type]);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ Admin Server running on http://0.0.0.0:${PORT}`);
});
