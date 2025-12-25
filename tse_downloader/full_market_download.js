
import pg from 'pg';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import jalaali from 'jalaali-js';
import 'dotenv/config';

// --- Configuration ---
const CONCURRENCY = 3; 
const DELAY_MS = 500;  
const REQUEST_TIMEOUT = 40000; 

const dbConfig = {
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new pg.Pool(dbConfig);

// --- Utilities ---
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const toJalaliDate = (gregorianDateStr) => {
    try {
        if (!gregorianDateStr || gregorianDateStr.length !== 8) return null;
        const y = parseInt(gregorianDateStr.substring(0, 4));
        const m = parseInt(gregorianDateStr.substring(4, 6));
        const d = parseInt(gregorianDateStr.substring(6, 8));
        const j = jalaali.toJalaali(y, m, d);
        return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`;
    } catch (e) {
        return null;
    }
};

const formatDateForDB = (gregorianDateStr) => {
    if (!gregorianDateStr || gregorianDateStr.length !== 8) return null;
    const year = gregorianDateStr.substring(0, 4);
    // فیلتر کردن تاریخ‌های غیرمنطقی (مثلا دیتای اشتباه TSETMC برای سال‌های آینده)
    const currentYear = new Date().getFullYear();
    if (parseInt(year) > currentYear + 1 || parseInt(year) < 1380) return null;
    
    return `${year}-${gregorianDateStr.substring(4, 6)}-${gregorianDateStr.substring(6, 8)}`;
};

// --- Core Logic ---
async function fetchAllSymbols() {
    console.log("📥 در حال دریافت لیست کامل نمادها و صندوق‌ها از TSETMC...");
    try {
        // دریافت لیست از دیده بان بازار (شامل سهام و صندوق ها)
        const response = await axios.get('http://old.tsetmc.com/tsev2/data/MarketWatchInit.aspx?h=0&r=0', {
            timeout: 30000
        });
        
        const raw = response.data;
        const parts = raw.split('@');
        if (parts.length < 3) throw new Error("ساختار پاسخ نامعتبر است.");

        const dataBlock = parts[2];
        const rows = dataBlock.split(';');

        const symbols = [];
        for (const row of rows) {
            const cols = row.split(',');
            if (cols.length > 5) {
                const id = cols[0];
                const symbol = cols[2];
                const name = cols[3];
                
                // فیلتر نمادهای معتبر (حذف تست‌ها و شناسه‌های غیر عددی)
                if (symbol && id && /^\d+$/.test(id)) {
                    symbols.push({ id, symbol, name });
                }
            }
        }
        
        console.log(`✅ ${symbols.length} نماد و صندوق شناسایی شد.`);
        return symbols;
    } catch (error) {
        console.error("❌ خطا در دریافت لیست نمادها:", error.message);
        throw error;
    }
}

async function fetchHistory(tseId, symbol, name) {
    const url = `http://old.tsetmc.com/tsev2/data/Export-txt.aspx?t=i&a=1&b=0&i=${tseId}`;
    
    try {
        const response = await axios.get(url, { 
            timeout: REQUEST_TIMEOUT,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const csvContent = response.data;
        if (!csvContent || typeof csvContent !== 'string' || csvContent.trim().length < 50) {
            return [];
        }

        // پارس کردن با قابلیت تشخیص خودکار ستون‌ها
        const records = parse(csvContent, {
            columns: true, 
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true,
            bom: true // هندل کردن Byte Order Mark در فایل‌های TSETMC
        });

        if (records.length === 0) return [];

        const cleanRecords = records.map(r => {
             const keys = Object.keys(r);
             // پیدا کردن ستون‌ها با نام‌های احتمالی مختلف (با یا بدون < >)
             const dateKey = keys.find(k => k.includes('DTYYYYMMDD') || k.toLowerCase().includes('date'));
             const closeKey = keys.find(k => k.includes('CLOSE')); // قیمت تعدیل شده
             const lastKey = keys.find(k => k.includes('LAST'));   // آخرین قیمت
             const volKey = keys.find(k => k.includes('VOL'));
             const openKey = keys.find(k => k.includes('OPEN') || k.includes('FIRST'));
             const highKey = keys.find(k => k.includes('HIGH'));
             const lowKey = keys.find(k => k.includes('LOW'));

             if (!dateKey) return null;

             const dateStr = r[dateKey];
             const dbDate = formatDateForDB(dateStr);
             if (!dbDate) return null;

             return {
                 symbol: symbol,
                 name: name,
                 date: dbDate,
                 jalali_date: toJalaliDate(dateStr),
                 open: parseFloat(r[openKey] || 0),
                 high: parseFloat(r[highKey] || 0),
                 low: parseFloat(r[lowKey] || 0),
                 close: parseFloat(r[lastKey] || r[closeKey] || 0),
                 adj_close: parseFloat(r[closeKey] || r[lastKey] || 0),
                 volume: parseInt(r[volKey] || 0),
                 value: 0, 
                 count: 0,
                 yesterday: 0
             };
        }).filter(item => item !== null);

        return cleanRecords;

    } catch (error) {
        return null;
    }
}

async function saveToDatabase(client, data) {
    if (!data || data.length === 0) return;
    
    try {
        await client.query('BEGIN');

        for (const row of data) {
            const query = `
                INSERT INTO daily_prices 
                (symbol, name, date, jalali_date, open, high, low, close, adj_close, volume, value, count, yesterday)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (symbol, date) 
                DO UPDATE SET 
                    close = EXCLUDED.close, 
                    adj_close = EXCLUDED.adj_close, 
                    volume = EXCLUDED.volume;
            `;
            const values = [
                row.symbol, row.name, row.date, row.jalali_date,
                row.open, row.high, row.low, row.close, row.adj_close,
                row.volume, row.value, row.count, row.yesterday
            ];
            await client.query(query, values);
        }

        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
}

async function run() {
    console.log("🚀 شروع عملیات بروزرسانی پایگاه داده...");
    
    let symbols;
    try {
        symbols = await fetchAllSymbols();
    } catch (e) {
        process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
        const batch = symbols.slice(i, i + CONCURRENCY);
        process.stdout.write(`\r⏳ پیشرفت: ${i}/${symbols.length} (${((i/symbols.length)*100).toFixed(1)}%) | موفق: ${successCount} `);

        const promises = batch.map(async (sym) => {
            const data = await fetchHistory(sym.id, sym.symbol, sym.name);
            if (data && data.length > 0) {
                const dbClient = await pool.connect();
                try {
                    await saveToDatabase(dbClient, data);
                    successCount++;
                } catch (err) {
                    failCount++;
                } finally {
                    dbClient.release();
                }
            } else {
                failCount++;
            }
            await wait(DELAY_MS); 
        });

        await Promise.all(promises);
    }

    console.log(`\n✅ عملیات با موفقیت به پایان رسید.`);
    console.log(`📊 نتیجه نهایی: ${successCount} نماد آپدیت شد | ${failCount} خطا یا بدون دیتا.`);
    await pool.end();
}

run();
