
import pg from 'pg';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import jalaali from 'jalaali-js';
import 'dotenv/config';

// --- Configuration ---
const CONCURRENCY = 4; // Reduced slightly to prevent server blocking
const DELAY_MS = 300;  // Increased delay
const REQUEST_TIMEOUT = 30000; // 30 Seconds

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
    // Input: YYYYMMDD (String)
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
    return `${gregorianDateStr.substring(0, 4)}-${gregorianDateStr.substring(4, 6)}-${gregorianDateStr.substring(6, 8)}`;
};

// --- Core Logic ---

async function fetchAllSymbols() {
    console.log("📥 در حال دریافت لیست نمادها از TSETMC...");
    try {
        const response = await axios.get('http://old.tsetmc.com/tsev2/data/MarketWatchInit.aspx?h=0&r=0', {
            timeout: 30000
        });
        
        const raw = response.data;
        const parts = raw.split('@');
        if (parts.length < 3) throw new Error("ساختار پاسخ TSETMC نامعتبر است.");

        const dataBlock = parts[2];
        const rows = dataBlock.split(';');

        const symbols = [];
        for (const row of rows) {
            const cols = row.split(',');
            if (cols.length > 5) {
                const id = cols[0];
                const code = cols[1];
                const symbol = cols[2];
                const name = cols[3];
                
                // Filter valid symbols
                if (symbol && id && !symbol.includes('Testing') && /^\d+$/.test(id)) {
                    symbols.push({ id, symbol, name });
                }
            }
        }
        
        console.log(`✅ ${symbols.length} نماد پیدا شد.`);
        return symbols;
    } catch (error) {
        console.error("❌ خطا در دریافت لیست نمادها:", error.message);
        throw error;
    }
}

async function fetchHistory(tseId, symbol, name) {
    // Using Export-txt endpoint which is cleaner for full history
    // t=i (Instrument), a=1 (Adjusted), b=0 (No header/format tweak), i={id}
    const url = `http://old.tsetmc.com/tsev2/data/Export-txt.aspx?t=i&a=1&b=0&i=${tseId}`;
    
    try {
        const response = await axios.get(url, { 
            timeout: REQUEST_TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                'Accept': 'text/plain, */*; q=0.01',
                'Connection': 'keep-alive'
            }
        });
        
        const csvContent = response.data;
        if (!csvContent || typeof csvContent !== 'string' || csvContent.trim().length === 0) {
            // console.log(`Empty data for ${symbol}`);
            return [];
        }

        // TSETMC Export Format typically:
        // <TICKER>,<DTYYYYMMDD>,<FIRST>,<HIGH>,<LOW>,<CLOSE>,<VALUE>,<VOL>,<OPENINT>,<PER>,<OPEN>,<LAST>
        // But the "Export-txt" usually returns CSV without strict headers or with specific headers.
        
        const records = parse(csvContent, {
            columns: true, 
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true
        });

        if (records.length === 0) return [];

        const cleanRecords = records.map(r => {
             // Find the date key (it might handle <DTYYYYMMDD> or just Date)
             const keys = Object.keys(r);
             const dateKey = keys.find(k => k.includes('DTYYYYMMDD') || k.toLowerCase() === 'date');
             const closeKey = keys.find(k => k.includes('CLOSE') || k.includes('Close')); // Adjusted Close
             const lastKey = keys.find(k => k.includes('LAST') || k.includes('Last'));   // Last Trade
             const volKey = keys.find(k => k.includes('VOL') || k.includes('Vol'));
             const firstKey = keys.find(k => k.includes('FIRST') || k.includes('First'));
             const highKey = keys.find(k => k.includes('HIGH') || k.includes('High'));
             const lowKey = keys.find(k => k.includes('LOW') || k.includes('Low'));
             const valueKey = keys.find(k => k.includes('VALUE') || k.includes('Value'));

             if (!dateKey || !closeKey) return null;

             const dateStr = r[dateKey];
             
             return {
                 symbol: symbol,
                 name: name,
                 date: formatDateForDB(dateStr),
                 jalali_date: toJalaliDate(dateStr),
                 open: parseFloat(r[firstKey] || 0),
                 high: parseFloat(r[highKey] || 0),
                 low: parseFloat(r[lowKey] || 0),
                 close: parseFloat(r[lastKey] || 0),      // Last Trade Price
                 adj_close: parseFloat(r[closeKey] || 0), // Adjusted Price (Final)
                 volume: parseInt(r[volKey] || 0),
                 value: parseInt(r[valueKey] || 0),
                 count: 0, // Export-txt usually doesn't have count
                 yesterday: 0
             };
        }).filter(item => item !== null && item.date !== null);

        return cleanRecords;

    } catch (error) {
        // Log detailed error to debug
        console.error(`[${symbol}] Download Error: ${error.message} (Status: ${error.response?.status})`);
        return null;
    }
}

async function saveToDatabase(client, data) {
    if (!data || data.length === 0) return;
    
    try {
        await client.query('BEGIN');

        for (const row of data) {
            // "ON CONFLICT DO NOTHING" ensures we keep old data and only add new dates
            const query = `
                INSERT INTO daily_prices 
                (symbol, name, date, jalali_date, open, high, low, close, adj_close, volume, value, count, yesterday)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (symbol, date) DO NOTHING;
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
    console.log("🚀 شروع عملیات دانلود بازار (Node.js Downloader - Improved)...");
    
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_prices (
                id BIGSERIAL PRIMARY KEY,
                symbol VARCHAR(50) NOT NULL,
                name VARCHAR(100),
                date DATE NOT NULL,
                jalali_date VARCHAR(10),
                open DOUBLE PRECISION,
                high DOUBLE PRECISION,
                low DOUBLE PRECISION,
                close DOUBLE PRECISION,
                adj_close DOUBLE PRECISION,
                volume BIGINT,
                value BIGINT,
                count INTEGER,
                yesterday DOUBLE PRECISION,
                CONSTRAINT uq_symbol_date UNIQUE (symbol, date)
            );
        `);
    } finally {
        client.release();
    }

    let symbols;
    try {
        symbols = await fetchAllSymbols();
    } catch (e) {
        console.error("Critical: Could not fetch symbols. Exiting.");
        process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;
    
    // Process in batches
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
        const batch = symbols.slice(i, i + CONCURRENCY);
        
        // Console Progress
        process.stdout.write(`\r⏳ پردازش: ${i}/${symbols.length} (${((i/symbols.length)*100).toFixed(1)}%) - موفق: ${successCount} `);

        const promises = batch.map(async (sym) => {
            const data = await fetchHistory(sym.id, sym.symbol, sym.name);
            
            if (data && data.length > 0) {
                const dbClient = await pool.connect();
                try {
                    await saveToDatabase(dbClient, data);
                    successCount++;
                } catch (err) {
                    console.error(`DB Error ${sym.symbol}:`, err.message);
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

    console.log(`\n✅ عملیات پایان یافت.`);
    console.log(`موفق: ${successCount} | ناموفق/خالی: ${failCount}`);
    await pool.end();
}

run();
