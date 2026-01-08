
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
const SHAKHES_SCRIPT_PATH = path.resolve(process.env.HOME || '/root', 'tse_downloader/shakhes.py');
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

// Init DB for Assets, Backup Table & SEO
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
                last_return FLOAT DEFAULT 0,
                PRIMARY KEY (symbol, type)
            );
        `);

        // Backup Table Structure
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_prices_backup (LIKE daily_prices INCLUDING ALL);
        `);
        
        // SEO Table
        await client.query(`
            CREATE TABLE IF NOT EXISTS seo_pages (
                route VARCHAR(50) PRIMARY KEY,
                title VARCHAR(255),
                description TEXT,
                keywords TEXT
            );
        `);

        // Seed Default SEO Data if empty
        const seoCheck = await client.query('SELECT count(*) FROM seo_pages');
        if (parseInt(seoCheck.rows[0].count) === 0) {
            const defaults = [
                { route: '/', title: 'تحلیلگر بورس | خانه', description: 'پلتفرم جامع تحلیل تکنیکال، همبستگی و مدیریت دارایی‌های بازار سرمایه ایران (TSETMC).', keywords: 'بورس, تحلیل تکنیکال, همبستگی, صندوق طلا, صندوق سهامی' },
                { route: '/correlation', title: 'محاسبه همبستگی نمادها', description: 'ابزار محاسبه ضریب همبستگی تاریخی بین دو نماد بورس و فرابورس، تحلیل واگرایی و نمودارهای مقایسه‌ای.', keywords: 'همبستگی بورس, همبستگی نمادها, تحلیل همبستگی, کورولیشن' },
                { route: '/technical', title: 'تحلیل تکنیکال (Technical Analysis)', description: 'رسم نمودار نسبت قیمت دو دارایی به یکدیگر و تحلیل تکنیکال نمادها برای شناسایی حباب‌های قیمتی.', keywords: 'تحلیل تکنیکال, نمودار نسبت, تحلیل تکنیکال پیشرفته, حباب سنج, اندیکاتور بورس' },
                { route: '/portfolio', title: 'سبد دارایی هوشمند', description: 'پیشنهاد سبد دارایی بهینه شامل طلا، سهام و درآمد ثابت بر اساس تحلیل ریسک و بازدهی بازار.', keywords: 'سبدگردانی, پرتفوی پیشنهادی, صندوق اهرمی, صندوق درآمد ثابت' }
            ];
            for (const p of defaults) {
                await client.query(
                    'INSERT INTO seo_pages (route, title, description, keywords) VALUES ($1, $2, $3, $4)',
                    [p.route, p.title, p.description, p.keywords]
                );
            }
            console.log("✅ Default SEO pages seeded.");
        }

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
    // 1. Sync from daily_prices (Stocks)
    await client.query(`
      INSERT INTO symbols (symbol, name)
      SELECT symbol, MAX(name) as name
      FROM daily_prices
      GROUP BY symbol
      ON CONFLICT (symbol) DO NOTHING;
    `);

    // 2. Sync from index_prices (Indices)
    try {
        await client.query(`
          INSERT INTO symbols (symbol, name)
          SELECT symbol, MAX(name) as name
          FROM index_prices
          GROUP BY symbol
          ON CONFLICT (symbol) DO NOTHING;
        `);
    } catch (e) {
        console.warn('⚠️ Index table sync skipped (table might not exist yet).');
    }

    const res = await client.query('SELECT COUNT(*) FROM symbols');
    return res.rows[0].count;
  } finally {
    client.release();
  }
};

// ... (Existing Return Calculation Logic - calcReturn, calculateAllAssetReturns - kept as is) ...
const calcReturn = (data) => {
    if (!data || data.length < 2) return 0;
    const lastPoint = data[data.length - 1];
    const lastDateStr = lastPoint.date; 
    const parseDate = (d) => {
        const y = parseInt(d.substring(0, 4));
        const m = parseInt(d.substring(4, 6)) - 1;
        const dy = parseInt(d.substring(6, 8));
        return new Date(y, m, dy);
    };
    const lastDate = parseDate(lastDateStr);
    const targetTime = lastDate.getTime() - (365 * 24 * 60 * 60 * 1000);
    let closestPoint = data[data.length - 1];
    let minDiff = Infinity;
    for (let i = data.length - 1; i >= 0; i--) {
        const p = data[i];
        const pTime = parseDate(p.date).getTime();
        const diff = Math.abs(pTime - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            closestPoint = p;
        } else if (diff > minDiff && pTime < targetTime) {
            break; 
        }
    }
    if (closestPoint.date === lastPoint.date) return 0;
    return ((lastPoint.close - closestPoint.close) / closestPoint.close) * 100;
};

const calculateAllAssetReturns = async () => {
    let mainClient;
    try {
        mainClient = await pool.connect();
        const assetsRes = await mainClient.query('SELECT symbol, type FROM asset_groups');
        const assets = assetsRes.rows;
        mainClient.release();
        mainClient = null;

        const processAsset = async (asset) => {
            const client = await pool.connect();
            try {
                // Check daily_prices first, fallback to index_prices (though assets usually stocks)
                const historyResOpt = await client.query(`
                    SELECT * FROM (
                        SELECT to_char(date, 'YYYYMMDD') as date, close 
                        FROM daily_prices 
                        WHERE symbol = $1
                        UNION ALL
                        SELECT to_char(date, 'YYYYMMDD') as date, close
                        FROM index_prices
                        WHERE symbol = $1
                        ORDER BY date DESC
                        LIMIT 600
                    ) sub ORDER BY date ASC
                `, [asset.symbol]);
                
                const history = historyResOpt.rows;
                if (history.length > 0) {
                    const retVal = calcReturn(history);
                    await client.query(`
                        UPDATE asset_groups 
                        SET last_return = $1 
                        WHERE symbol = $2 AND type = $3
                    `, [retVal, asset.symbol, asset.type]);
                    return 1;
                }
                return 0;
            } catch (err) {
                console.error(`Failed to calc return for ${asset.symbol}:`, err.message);
                return 0;
            } finally {
                client.release();
            }
        };
        const results = await Promise.all(assets.map(asset => processAsset(asset)));
        return results.reduce((sum, val) => sum + val, 0);
    } catch (e) {
        if (mainClient) mainClient.release();
        throw e;
    }
};

// ... (Existing Backup/Restore Logic - createBackup, restoreBackupData) ...
const createBackup = async () => {
    const client = await pool.connect();
    try {
        await client.query('TRUNCATE daily_prices_backup');
        await client.query('INSERT INTO daily_prices_backup SELECT * FROM daily_prices');
        return true;
    } catch (e) {
        lastUpdateLog += `\n❌ خطای بکاپ گیری: ${e.message}`;
        return false;
    } finally {
        client.release();
    }
};

const restoreBackupData = async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('TRUNCATE daily_prices');
        await client.query('INSERT INTO daily_prices SELECT * FROM daily_prices_backup');
        await client.query('COMMIT');
        return true;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

// Helper to run python scripts
const executeScript = (scriptPath) => {
    return new Promise((resolve, reject) => {
        const proc = spawn('python3', ['-u', scriptPath]);
        currentProcess = proc;
        
        proc.stdout.on('data', (data) => {
            lastUpdateLog = (lastUpdateLog + data.toString()).slice(-5000);
        });
        
        proc.stderr.on('data', (data) => {
             const text = data.toString();
             if (text.includes('%') || text.includes('it/s')) {
                lastUpdateLog += `\n[PROGRESS]: ${text}`;
             } else {
                lastUpdateLog += `\n[LOG]: ${text}`;
             }
             lastUpdateLog = lastUpdateLog.slice(-5000);
        });

        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`Script exited with code ${code}`));
        });
        
        proc.on('error', (err) => reject(err));
    });
};

const runUpdateProcess = async () => {
    if (isUpdating) return;
    isUpdating = true;
    lastUpdateLog = "📦 در حال ایجاد نسخه پشتیبان (Backup)...\n";
    
    // 1. Backup
    const backupSuccess = await createBackup();
    if (!backupSuccess) {
        lastUpdateLog += "\n❌ عملیات به دلیل شکست در بکاپ‌گیری متوقف شد.";
        isUpdating = false;
        return;
    }
    lastUpdateLog += "✅ بکاپ گرفته شد.\n";

    try {
        // 2. Market Update
        if (fs.existsSync(PYTHON_SCRIPT_PATH)) {
            lastUpdateLog += "🚀 آپدیت بازار (سهام) شروع شد...\n";
            await executeScript(PYTHON_SCRIPT_PATH);
            lastUpdateLog += "\n✅ آپدیت سهام تمام شد.\n";
        } else {
            lastUpdateLog += "\n⚠️ فایل اسکریپت سهام یافت نشد.\n";
        }

        // 3. Index Update
        if (fs.existsSync(SHAKHES_SCRIPT_PATH)) {
            lastUpdateLog += "🚀 آپدیت شاخص‌ها شروع شد...\n";
            await executeScript(SHAKHES_SCRIPT_PATH);
            lastUpdateLog += "\n✅ آپدیت شاخص‌ها تمام شد.\n";
        } else {
            lastUpdateLog += "\n⚠️ فایل اسکریپت شاخص یافت نشد.\n";
        }

        // 4. Sync & Recalc
        const count = await syncSymbolsTable();
        lastUpdateLog += `\n✨ لیست جستجو بروز شد (تعداد کل: ${count}).`;
        
        lastUpdateLog += `\n🔄 در حال محاسبه بازدهی نمادهای منتخب...`;
        const updated = await calculateAllAssetReturns();
        lastUpdateLog += `\n✅ بازدهی ${updated} نماد محاسبه و ذخیره شد.`;

    } catch (e) {
        lastUpdateLog += `\n❌ عملیات با خطا متوقف شد: ${e.message}`;
    } finally {
        isUpdating = false;
        currentProcess = null;
    }
};

cron.schedule('0 18 * * *', () => {
    console.log('⏰ Running scheduled daily update...');
    runUpdateProcess();
}, { scheduled: true, timezone: "Asia/Tehran" });

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

// ... (Existing endpoints for search, stats, update, restore, assets) ...
app.get('/api/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  let client;
  try {
    client = await pool.connect();
    const query = `SELECT symbol, name FROM symbols WHERE symbol LIKE $1 OR name LIKE $1 LIMIT 10`;
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
    const countQuery = `SELECT (SELECT COUNT(*) FROM symbols) as symbol_count, (SELECT MAX(date) FROM daily_prices) as last_date`;
    const result = await client.query(countQuery);
    const scriptExists = fs.existsSync(PYTHON_SCRIPT_PATH);
    const indexScriptExists = fs.existsSync(SHAKHES_SCRIPT_PATH);
    
    res.json({
      symbolCount: result.rows[0].symbol_count || 0,
      lastDate: result.rows[0].last_date,
      isUpdating,
      isRestoring,
      lastLog: lastUpdateLog,
      scriptPath: PYTHON_SCRIPT_PATH,
      scriptExists,
      indexScriptExists
    });
  } catch (err) {
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

app.get('/api/assets', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT symbol, type, url, is_default, last_return FROM asset_groups ORDER BY symbol');
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

app.post('/api/assets/recalc', requireAuth, async (req, res) => {
    if (isUpdating) return res.status(400).json({ message: 'سیستم در حال آپدیت است. لطفا صبر کنید.' });
    try {
        const count = await calculateAllAssetReturns();
        res.json({ message: `بازدهی ${count} صندوق با موفقیت محاسبه و ذخیره شد.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
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

// --- SEO MANAGEMENT ENDPOINTS ---

app.get('/api/seo', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM seo_pages ORDER BY route');
        res.json(result.rows);
    } catch(e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.post('/api/seo', requireAuth, async (req, res) => {
    const { route, title, description, keywords } = req.body;
    if (!route) return res.status(400).json({ error: 'مسیر (Route) الزامی است.' });
    
    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO seo_pages (route, title, description, keywords) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (route) DO UPDATE 
             SET title = $2, description = $3, keywords = $4`,
            [route, title, description, keywords]
        );
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

app.delete('/api/seo', requireAuth, async (req, res) => {
    const { route } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM seo_pages WHERE route = $1', [route]);
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
