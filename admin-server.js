
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
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
let isRestoring = false;
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

// Init DB for Assets & Backup Table
const initDB = async () => {
    const client = await pool.connect();
    try {
        // Asset Groups
        await client.query(`
            CREATE TABLE IF NOT EXISTS asset_groups (
                symbol VARCHAR(50),
                type VARCHAR(20),
                url TEXT,
                is_default BOOLEAN DEFAULT FALSE,
                PRIMARY KEY (symbol, type)
            );
        `);
        
        // Backup Table Structure (Clone of daily_prices structure without data)
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_prices_backup (LIKE daily_prices INCLUDING ALL);
        `);
        
        console.log("✅ Database tables checked/initialized.");
    } catch (e) {
        console.error("Error creating/updating tables:", e);
    } finally {
        client.release();
    }
};
initDB();

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

// --- DATA BACKUP & RESTORE LOGIC ---

const createBackup = async () => {
    const client = await pool.connect();
    try {
        console.log('📦 Starting backup process...');
        await client.query('TRUNCATE daily_prices_backup');
        await client.query('INSERT INTO daily_prices_backup SELECT * FROM daily_prices');
        console.log('✅ Backup created successfully.');
        return true;
    } catch (e) {
        console.error('❌ Backup failed:', e);
        lastUpdateLog += `\n❌ خطای بکاپ گیری: ${e.message}`;
        return false;
    } finally {
        client.release();
    }
};

const restoreBackupData = async () => {
    const client = await pool.connect();
    try {
        console.log('♻️ Starting restore process...');
        await client.query('BEGIN');
        await client.query('TRUNCATE daily_prices');
        await client.query('INSERT INTO daily_prices SELECT * FROM daily_prices_backup');
        await client.query('COMMIT');
        console.log('✅ Data restored from backup.');
        return true;
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('❌ Restore failed:', e);
        throw e;
    } finally {
        client.release();
    }
};

// --- CORE UPDATE LOGIC ---

const runUpdateProcess = async () => {
    if (isUpdating) return;
    if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
        lastUpdateLog += `\n❌ فایل اسکریپت یافت نشد.`;
        return;
    }

    isUpdating = true;
    lastUpdateLog = "📦 در حال ایجاد نسخه پشتیبان (Backup)...\n";

    // 1. Backup First
    const backupSuccess = await createBackup();
    if (!backupSuccess) {
        lastUpdateLog += "\n❌ عملیات به دلیل شکست در بکاپ‌گیری متوقف شد.";
        isUpdating = false;
        return;
    }

    lastUpdateLog += "✅ بکاپ گرفته شد.\n🚀 آپدیت شروع شد (حالت چند رشته‌ای)...\n";
    
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
};

// --- SCHEDULER (Every Day at 18:00 Tehran Time) ---
cron.schedule('0 18 * * *', () => {
    console.log('⏰ Running scheduled daily update...');
    runUpdateProcess();
}, {
    scheduled: true,
    timezone: "Asia/Tehran"
});

// --- API ENDPOINTS ---

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
      isRestoring,
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
  if (isRestoring) return res.status(400).json({ message: 'عملیات بازیابی بکاپ در حال اجراست.' });
  
  runUpdateProcess();
  res.json({ message: 'دستور آپدیت و بکاپ‌گیری ارسال شد.', status: 'started' });
});

app.post('/api/restore', requireAuth, async (req, res) => {
    if (isUpdating) return res.status(400).json({ message: 'نمی‌توان هنگام آپدیت، بکاپ را برگرداند.' });
    if (isRestoring) return res.status(400).json({ message: 'عملیات بازیابی هم‌اکنون در حال اجراست.' });

    isRestoring = true;
    try {
        await restoreBackupData();
        isRestoring = false;
        res.json({ message: 'اطلاعات با موفقیت به روز قبل (بکاپ) بازگردانده شد.' });
    } catch (e) {
        isRestoring = false;
        res.status(500).json({ message: `خطا در بازیابی: ${e.message}` });
    }
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
    if (!symbol || !type) return res.status(400).json({error: 'نماد و نوع الزامی است'});
    if (!url) return res.status(400).json({error: 'آدرس سایت الزامی است'});
    
    const client = await pool.connect();
    try {
        await client.query(
            'INSERT INTO asset_groups (symbol, type, url) VALUES ($1, $2, $3) ON CONFLICT (symbol, type) DO UPDATE SET url = $3', 
            [symbol, type, url]
        );
        res.json({ success: true });
    } catch(e) {
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
