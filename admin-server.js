
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
const BASE_DIR = process.env.HOME || '/root';
const SCRIPTS = {
    market: {
        id: 'market',
        name: 'بروزرسانی بازار (Full Market)',
        path: path.resolve(BASE_DIR, 'tse_downloader/full_market_download.py'),
        description: 'دریافت دیتای تمام نمادها و معاملات روزانه.'
    },
    industry: {
        id: 'industry',
        name: 'بروزرسانی صنایع (Industry)',
        path: path.resolve(BASE_DIR, 'tse_downloader/industry.py'),
        description: 'محاسبه و دریافت دیتای گروه‌های صنعتی.'
    },
    shakhes: {
        id: 'shakhes',
        name: 'بروزرسانی شاخص‌ها (Indices)',
        path: path.resolve(BASE_DIR, 'tse_downloader/shakhes.py'),
        description: 'دریافت دیتای شاخص کل و شاخص‌های هم‌وزن.'
    }
};

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

let isUpdating = false;
let runningScriptId = null; // Tracks which script is currently running
let isRestoring = false;
let lastUpdateLog = "هنوز آپدیتی انجام نشده است.";
let currentProcess = null;
let scriptQueue = [];

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
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_prices_backup (LIKE daily_prices INCLUDING ALL);
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS seo_pages (
                route VARCHAR(50) PRIMARY KEY,
                title VARCHAR(255),
                description TEXT,
                keywords TEXT
            );
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
  let totalCount = 0;
  try {
    // 1. Sync Stocks
    const resStocks = await client.query(`
      INSERT INTO symbols (symbol, name)
      SELECT symbol, MAX(name) as name
      FROM daily_prices
      GROUP BY symbol
      ON CONFLICT (symbol) DO NOTHING;
    `);
    totalCount += resStocks.rowCount;

    // 2. Sync Indices (Check if index_prices exists first implicitly by try/catch)
    try {
        const resIndices = await client.query(`
          INSERT INTO symbols (symbol, name)
          SELECT symbol, symbol as name
          FROM index_prices
          GROUP BY symbol
          ON CONFLICT (symbol) DO NOTHING;
        `);
        totalCount += resIndices.rowCount;
    } catch (e) {
        console.warn("Skipping indices sync (table might not exist):", e.message);
    }
    
    return totalCount;
  } finally {
    client.release();
  }
};

const calcReturn = (data) => {
    if (!data || data.length < 2) return 0;
    const lastPoint = data[data.length - 1];
    const parseDate = (d) => {
        const y = parseInt(d.substring(0, 4));
        const m = parseInt(d.substring(4, 6)) - 1;
        const dy = parseInt(d.substring(6, 8));
        return new Date(y, m, dy);
    };
    const lastDate = parseDate(lastPoint.date);
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
                // Try fetching from daily_prices first
                let historyResOpt = await client.query(`
                    SELECT * FROM (
                        SELECT to_char(date, 'YYYYMMDD') as date, close 
                        FROM daily_prices 
                        WHERE symbol = $1 
                        ORDER BY date DESC
                        LIMIT 600
                    ) sub ORDER BY date ASC
                `, [asset.symbol]);

                // If not found, try index_prices
                if (historyResOpt.rows.length === 0) {
                    try {
                         historyResOpt = await client.query(`
                            SELECT * FROM (
                                SELECT to_char(date, 'YYYYMMDD') as date, close 
                                FROM index_prices 
                                WHERE symbol = $1 
                                ORDER BY date DESC
                                LIMIT 600
                            ) sub ORDER BY date ASC
                        `, [asset.symbol]);
                    } catch (ignore) {}
                }

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

const runSingleScript = (scriptKey) => {
    return new Promise((resolve) => {
        const script = SCRIPTS[scriptKey];
        if (!script || !fs.existsSync(script.path)) {
            lastUpdateLog += `\n❌ فایل اسکریپت ${scriptKey} یافت نشد.`;
            return resolve(false);
        }

        runningScriptId = scriptKey;
        lastUpdateLog += `\n🚀 اجرای اسکریپت: ${script.name}...\n`;
        
        currentProcess = spawn('python3', ['-u', script.path]);
        
        currentProcess.stdout.on('data', (data) => {
            lastUpdateLog = (lastUpdateLog + data.toString()).slice(-8000); 
        });

        currentProcess.stderr.on('data', (data) => {
            const text = data.toString();
            lastUpdateLog = (lastUpdateLog + `\n[ERR]: ${text}`).slice(-8000);
        });

        currentProcess.on('close', (code) => {
            currentProcess = null;
            if (code === 0) {
                lastUpdateLog += `\n✅ ${script.name} با موفقیت پایان یافت.`;
                resolve(true);
            } else {
                lastUpdateLog += `\n❌ ${script.name} متوقف شد (Code: ${code}).`;
                resolve(false);
            }
        });
    });
};

const runUpdateProcess = async (sequence = ['market', 'industry', 'shakhes']) => {
    if (isUpdating) return;
    isUpdating = true;
    scriptQueue = [...sequence];

    lastUpdateLog = "📦 شروع فرآیند بروزرسانی...\n";

    // Backup only if market update is in the sequence
    if (sequence.includes('market')) {
        lastUpdateLog += "🛡️ در حال ایجاد نسخه پشتیبان (Backup)...\n";
        const backupSuccess = await createBackup();
        if (!backupSuccess) {
            lastUpdateLog += "\n❌ عملیات به دلیل شکست در بکاپ‌گیری متوقف شد.";
            isUpdating = false;
            runningScriptId = null;
            return;
        }
        lastUpdateLog += "✅ بکاپ گرفته شد.\n";
    }

    for (const scriptKey of scriptQueue) {
        const success = await runSingleScript(scriptKey);
        if (!success) break; // Stop sequence on error

        // If market update finished successfully, sync tables
        if (scriptKey === 'market' || scriptKey === 'shakhes') {
            try {
                const count = await syncSymbolsTable();
                lastUpdateLog += `\n✨ لیست جستجو بروز شد (${count} مورد جدید).`;
                
                // Only calc returns if market was updated (usually includes everything)
                if (scriptKey === 'market') {
                    lastUpdateLog += `\n🔄 در حال محاسبه بازدهی نمادهای منتخب...`;
                    const updated = await calculateAllAssetReturns();
                    lastUpdateLog += `\n✅ بازدهی ${updated} نماد محاسبه و ذخیره شد.`;
                }
            } catch (e) {
                lastUpdateLog += `\n⚠️ خطا در پردازش پس از آپدیت: ${e.message}`;
            }
        }
    }

    lastUpdateLog += `\n🏁 تمام عملیات‌های صف به پایان رسید.`;
    isUpdating = false;
    runningScriptId = null;
    scriptQueue = [];
};

cron.schedule('0 18 * * *', () => {
    console.log('⏰ Running scheduled daily update chain...');
    runUpdateProcess(['market', 'industry', 'shakhes']);
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

app.get('/api/stats', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const countQuery = `SELECT (SELECT COUNT(*) FROM symbols) as symbol_count, (SELECT MAX(date) FROM daily_prices) as last_date`;
    const result = await client.query(countQuery);
    
    // Check all scripts existence
    const scriptsStatus = Object.keys(SCRIPTS).reduce((acc, key) => {
        acc[key] = {
            exists: fs.existsSync(SCRIPTS[key].path),
            path: SCRIPTS[key].path,
            name: SCRIPTS[key].name,
            description: SCRIPTS[key].description
        };
        return acc;
    }, {});

    res.json({
      symbolCount: result.rows[0].symbol_count || 0,
      lastDate: result.rows[0].last_date,
      isUpdating,
      runningScriptId,
      isRestoring,
      lastLog: lastUpdateLog,
      scripts: scriptsStatus
    });
  } catch (err) {
    res.status(500).json({ error: 'Database Error' });
  } finally {
    client.release();
  }
});

app.post('/api/update', requireAuth, (req, res) => {
  const { script_id } = req.body; // If null, run full chain
  if (isUpdating) return res.status(400).json({ message: 'عملیات آپدیت هم‌اکنون در حال اجراست.' });
  if (isRestoring) return res.status(400).json({ message: 'عملیات بازیابی بکاپ در حال اجراست.' });
  
  const sequence = script_id ? [script_id] : ['market', 'industry', 'shakhes'];
  runUpdateProcess(sequence);
  res.json({ message: 'دستور شروع ارسال شد.', status: 'started' });
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
    lastUpdateLog += "\n⚠️ دستور توقف توسط کاربر صادر شد.";
    res.json({ message: 'دستور توقف ارسال شد.' });
});

// Assets & SEO Endpoints (Unchanged logic)
app.get('/api/assets', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT symbol, type, url, is_default, last_return FROM asset_groups ORDER BY symbol');
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/assets', requireAuth, async (req, res) => {
    const { symbol, type, url } = req.body;
    if (!symbol || !type || !url) return res.status(400).json({error: 'ورودی ناقص'});
    const client = await pool.connect();
    try {
        await client.query('INSERT INTO asset_groups (symbol, type, url) VALUES ($1, $2, $3) ON CONFLICT (symbol, type) DO UPDATE SET url = $3', [symbol, type, url]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.delete('/api/assets', requireAuth, async (req, res) => {
    const { symbol, type } = req.body;
    const client = await pool.connect();
    try {
        await client.query('DELETE FROM asset_groups WHERE symbol = $1 AND type = $2', [symbol, type]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.get('/api/seo', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query('SELECT * FROM seo_pages ORDER BY route');
        res.json(result.rows);
    } catch(e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.post('/api/seo', requireAuth, async (req, res) => {
    const { route, title, description, keywords } = req.body;
    const client = await pool.connect();
    try {
        await client.query(`INSERT INTO seo_pages (route, title, description, keywords) VALUES ($1, $2, $3, $4) ON CONFLICT (route) DO UPDATE SET title = $2, description = $3, keywords = $4`, [route, title, description, keywords]);
        res.json({ success: true });
    } catch(e) { res.status(500).json({ error: e.message }); } finally { client.release(); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🛡️ Admin Server running on http://0.0.0.0:${PORT}`);
});
