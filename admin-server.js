
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
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123'; // Change this in production!

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
  // Simple token based on base64 of username:password
  const validToken = Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString('base64');
  
  if (token === validToken) {
    next();
  } else {
    res.status(403).json({ error: 'Forbidden' });
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
    // Get total symbols (from symbols table if exists, else count unique in prices)
    const countQuery = `
      SELECT (SELECT COUNT(*) FROM symbols) as symbol_count,
             (SELECT MAX(date) FROM daily_prices) as last_date
    `;
    const result = await client.query(countQuery);
    
    // Check if script exists
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

// API: Trigger Update
app.post('/api/update', requireAuth, (req, res) => {
  if (isUpdating) {
    return res.status(400).json({ message: 'عملیات آپدیت هم‌اکنون در حال اجراست.' });
  }

  if (!fs.existsSync(PYTHON_SCRIPT_PATH)) {
    return res.status(500).json({ message: `فایل اسکریپت در مسیر ${PYTHON_SCRIPT_PATH} یافت نشد.` });
  }

  isUpdating = true;
  lastUpdateLog = "🚀 آپدیت شروع شد...\n";
  
  // Spawn Python Process
  // Adjust 'python3' if your environment uses 'python'
  const pythonProcess = spawn('python3', [PYTHON_SCRIPT_PATH]);

  pythonProcess.stdout.on('data', (data) => {
    const chunk = data.toString();
    console.log(`Python: ${chunk}`);
    // Keep last 1000 chars of log to send to UI
    lastUpdateLog = (lastUpdateLog + chunk).slice(-2000); 
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python Error: ${data}`);
    lastUpdateLog += `\n[ERROR]: ${data.toString()}`;
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python script exited with code ${code}`);
    isUpdating = false;
    lastUpdateLog += `\n✅ عملیات با کد ${code} پایان یافت.`;
  });

  res.json({ message: 'دستور آپدیت به سرور ارسال شد.', status: 'started' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ Admin Server running on http://0.0.0.0:${PORT}`);
});
