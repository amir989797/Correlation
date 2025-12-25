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
  
  // استفاده از -u برای unbuffered output (نمایش آنی لاگ‌ها)
  currentProcess = spawn('python3', ['-u', PYTHON_SCRIPT_PATH]);

  currentProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    lastUpdateLog = (lastUpdateLog + chunk).slice(-5000); 
  });

  // اصلاح مهم: تشخیص نوار پیشرفت از خطای واقعی
  currentProcess.stderr.on('data', (data) => {
    const text = data.toString();
    if (text.includes('%') || text.includes('it/s')) {
        // این فقط نوار پیشرفت است، خطا نیست
        lastUpdateLog += `\n[PROGRESS]: ${text}`; 
    } else {
        // خطای واقعی
        lastUpdateLog += `\n[ERROR]: ${text}`;
    }
    // محدود کردن حجم لاگ
    lastUpdateLog = lastUpdateLog.slice(-5000);
  });

  currentProcess.on('close', async (code) => {
    console.log(`Script finished: ${code}`);
    currentProcess = null;
    isUpdating = false; // سریع آزاد کن

    if (code === 0) {
        lastUpdateLog += `\n✅ دریافت دیتا تمام شد.`;
        // سینک کردن جدول نمادها
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ Admin Server running on http://0.0.0.0:${PORT}`);
});