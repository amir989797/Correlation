
import pg from 'pg';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import jalaali from 'jalaali-js';
import 'dotenv/config';

// --- Configuration ---
const CONCURRENCY = 5; // Number of parallel downloads
const DELAY_MS = 200;  // Delay between requests to avoid IP ban

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
        const y = parseInt(gregorianDateStr.substring(0, 4));
        const m = parseInt(gregorianDateStr.substring(4, 6));
        const d = parseInt(gregorianDateStr.substring(6, 8));
        const j = jalaali.toJalaali(y, m, d);
        return `${j.jy}-${String(j.jm).padStart(2, '0')}-${String(j.jd).padStart(2, '0')}`; // YYYY-MM-DD
    } catch (e) {
        return null;
    }
};

const formatDateForDB = (gregorianDateStr) => {
    // Input YYYYMMDD -> Output YYYY-MM-DD for Postgres Date type
    return `${gregorianDateStr.substring(0, 4)}-${gregorianDateStr.substring(4, 6)}-${gregorianDateStr.substring(6, 8)}`;
};

// --- Core Logic ---

async function fetchAllSymbols() {
    console.log("📥 در حال دریافت لیست نمادها از TSETMC...");
    try {
        // MarketWatchInit contains all active symbols loaded in the market watch
        const response = await axios.get('http://old.tsetmc.com/tsev2/data/MarketWatchInit.aspx?h=0&r=0', {
            timeout: 30000
        });
        
        const raw = response.data;
        // The format is complex: ... @ DataBlock ...
        const parts = raw.split('@');
        if (parts.length < 3) throw new Error("Invalid TSETMC response structure");

        const dataBlock = parts[2]; // Usually the index 2 has the symbol list
        const rows = dataBlock.split(';');

        const symbols = [];
        for (const row of rows) {
            const cols = row.split(',');
            if (cols.length > 5) {
                // Structure: Id, Code, Symbol, Name, ...
                const id = cols[0];
                const code = cols[1];
                const symbol = cols[2];
                const name = cols[3];
                
                // Filter out strange symbols (numerical or too long) to clean up
                if (symbol && id && !symbol.includes('Testing')) {
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
    // A=1 means Adjusted Data
    const url = `http://members.tsetmc.com/tsev2/data/InstTradeHistory.aspx?i=${tseId}&Top=999999&A=1`;
    try {
        const response = await axios.get(url, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        const csvContent = response.data;
        if (!csvContent || csvContent.trim().length === 0) return [];

        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        /*
            Typical TSETMC CSV Columns:
            Date,First,High,Low,Close,Value,Vol,Openint,Per,Open,Last
            
            Mapping:
            Date -> date
            First -> open
            High -> high
            Low -> low
            Close -> adj_close (Final Price)
            Last -> close (Last Trade)
            Vol -> volume
            Value -> value
            Count -> count (sometimes missing in CSV, might need calculation or set to 0)
        */

        return records.map(r => {
             // Clean date
             const dateStr = r['Date'];
             
             return {
                 symbol: symbol,
                 name: name,
                 date: formatDateForDB(dateStr), // YYYY-MM-DD
                 jalali_date: toJalaliDate(dateStr),
                 open: parseFloat(r['First']),
                 high: parseFloat(r['High']),
                 low: parseFloat(r['Low']),
                 close: parseFloat(r['Last']), // Last Trade
                 adj_close: parseFloat(r['Close']), // Final Price (Adjusted)
                 volume: parseInt(r['Vol']),
                 value: parseInt(r['Value']),
                 count: parseInt(r['Count'] || 0),
                 yesterday: 0 // CSV often doesn't have yesterday, can be calculated but keeping 0 for now
             };
        });

    } catch (error) {
        // console.error(`Failed to download ${symbol}: ${error.message}`);
        return null;
    }
}

async function saveToDatabase(client, data) {
    if (!data || data.length === 0) return;
    
    // We use a transaction for batch insert
    try {
        await client.query('BEGIN');

        for (const row of data) {
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
    console.log("🚀 شروع عملیات دانلود بازار (Node.js Downloader)...");
    
    // 1. Ensure Table Exists
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

    // 2. Fetch Symbols
    let symbols;
    try {
        symbols = await fetchAllSymbols();
    } catch (e) {
        console.error("Critical: Could not fetch symbols. Exiting.");
        process.exit(1);
    }

    let successCount = 0;
    let failCount = 0;
    
    // 3. Loop and Download with Concurrency Control
    // Simple batch processing
    for (let i = 0; i < symbols.length; i += CONCURRENCY) {
        const batch = symbols.slice(i, i + CONCURRENCY);
        const promises = batch.map(async (sym) => {
            // Log progress
            if (Math.random() > 0.9) {
                 process.stdout.write(`\r⏳ پیشرفت: ${(i / symbols.length * 100).toFixed(1)}% `);
            }

            const data = await fetchHistory(sym.id, sym.symbol, sym.name);
            
            if (data && data.length > 0) {
                const dbClient = await pool.connect();
                try {
                    await saveToDatabase(dbClient, data);
                    successCount++;
                } catch (err) {
                    // console.error(`DB Error ${sym.symbol}:`, err.message);
                    failCount++;
                } finally {
                    dbClient.release();
                }
            } else {
                failCount++;
            }
            
            await wait(DELAY_MS); // throttle
        });

        await Promise.all(promises);
    }

    console.log(`\n✅ عملیات پایان یافت.`);
    console.log(`موفق: ${successCount} | ناموفق/خالی: ${failCount}`);
    await pool.end();
}

run();
