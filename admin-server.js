
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
// CHANGED: Pointing to the .js script now
const DOWNLOADER_SCRIPT_PATH = path.join(__dirname, 'tse_downloader', 'full_market_download.js');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'; 

// State
let isUpdating = false;
let lastUpdateLog = "هنوز آپدیتی انجام نشده است.";

// Middleware
app.use(cors());
app.use(express.json());

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

// Authentication Middleware
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  
  const token = authHeader.split(' ')[1]; // Bearer <token>
  const validToken = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
  
  if (token === validToken) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
};

// Helper: Sync Symbols Table
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

// Serve Static Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// API: Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = Buffer.from(`${username}:${password}`).toString('base64');
    res.json({ token });
  } else {
    res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است.' });
  }
});

// API: Stats
app.get('/api/stats', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    // Check tables existence first
    const checkTables = await client.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'daily_prices'
        ) as prices_exist,
        EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'symbols'
        ) as symbols_exist;
    `);

    const hasPrices = checkTables.rows[0].prices_exist;
    const hasSymbols = checkTables.rows[0].symbols_exist;

    let symbolCount = 0;
    let lastDate = null;

    if (hasSymbols) {
         const countRes = await client.query('SELECT COUNT(*) FROM symbols');
         symbolCount = countRes.rows[0].count;
    }

    if (hasPrices) {
        const dateRes = await client.query('SELECT MAX(date) as last_date FROM daily_prices');
        lastDate = dateRes.rows[0].last_date;
    }
    
    const scriptExists = fs.existsSync(DOWNLOADER_SCRIPT_PATH);

    res.json({
      symbolCount: parseInt(symbolCount),
      lastDate: lastDate,
      isUpdating,
      lastLog: lastUpdateLog,
      scriptPath: DOWNLOADER_SCRIPT_PATH,
      scriptExists
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database Error', details: err.message });
  } finally {
    client.release();
  }
});

// API: Trigger Update
app.post('/api/update', requireAuth, (req, res) => {
  if (isUpdating) {
    return res.status(400).json({ message: 'عملیات آپدیت هم‌اکنون در حال اجراست.' });
  }

  if (!fs.existsSync(DOWNLOADER_SCRIPT_PATH)) {
    return res.status(500).json({ message: `فایل اسکریپت در مسیر ${DOWNLOADER_SCRIPT_PATH} یافت نشد.` });
  }

  isUpdating = true;
  lastUpdateLog = "🚀 آپدیت شروع شد (Node.js)...\n";
  
  const env = { ...process.env };
  
  // CHANGED: Spawning 'node' instead of 'python3'
  const downloaderProcess = spawn('node', [DOWNLOADER_SCRIPT_PATH], { env });

  downloaderProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    console.log(`Downloader: ${chunk}`);
    lastUpdateLog = (lastUpdateLog + chunk).slice(-2000); 
  });

  downloaderProcess.stderr.on('data', (data) => {
    console.error(`Downloader Error: ${data}`);
    lastUpdateLog += `\n[LOG]: ${data.toString()}`; 
  });

  downloaderProcess.on('close', async (code) => {
    console.log(`Downloader exited with code ${code}`);
    
    if (code === 0) {
        lastUpdateLog += `\n✅ دریافت دیتا با موفقیت انجام شد.`;
        lastUpdateLog += `\n🔄 در حال بروزرسانی لیست نمادها برای جستجو...`;
        
        try {
            const count = await syncSymbolsTable();
            lastUpdateLog += `\n✨ لیست نمادها بروز شد. (${count} نماد جدید اضافه شد)`;
        } catch (err) {
            console.error("Symbol sync failed:", err);
            lastUpdateLog += `\n❌ خطا در بروزرسانی جدول نمادها: ${err.message}`;
        }
    } else {
        lastUpdateLog += `\n❌ عملیات با کد خطا (${code}) متوقف شد.`;
    }

    setTimeout(() => {
        isUpdating = false;
    }, 1000);
  });

  res.json({ message: 'دستور آپدیت به سرور ارسال شد.', status: 'started' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ Admin Server running on http://0.0.0.0:${PORT}`);
});
