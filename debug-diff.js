
import pg from 'pg';
import 'dotenv/config';

const dbConfig = {
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new pg.Pool(dbConfig);

async function debugData() {
    const SYMBOL = 'فولاد'; // می توانید این را به نمادی که مشکل دارد تغییر دهید
    console.log(`🔍 در حال بررسی داده‌ها برای نماد: ${SYMBOL}`);
    
    const client = await pool.connect();
    try {
        // 1. دریافت 5 رکورد جدید (داده‌های اسکریپت جدید)
        console.log('\n🆕 --- 5 رکورد جدید (New Data) ---');
        const newRes = await client.query(`
            SELECT id, symbol, date, to_char(date, 'YYYYMMDD') as formatted_date, close, adj_close, volume 
            FROM daily_prices 
            WHERE symbol = $1 
            ORDER BY date DESC 
            LIMIT 5
        `, [SYMBOL]);
        console.table(newRes.rows);

        // 2. دریافت 5 رکورد قدیمی (داده‌های قبلی)
        console.log('\n👴 --- 5 رکورد قدیمی (Old Data) ---');
        const oldRes = await client.query(`
            SELECT id, symbol, date, to_char(date, 'YYYYMMDD') as formatted_date, close, adj_close, volume 
            FROM daily_prices 
            WHERE symbol = $1 
            ORDER BY date ASC 
            LIMIT 5 OFFSET 100
        `, [SYMBOL]);
        console.table(oldRes.rows);

        console.log('\n📊 --- مقایسه تایپ داده‌ها ---');
        const typeRes = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'daily_prices';
        `);
        // فقط ستون‌های مهم را نشان بده
        const importantCols = ['date', 'close', 'adj_close', 'volume'];
        console.table(typeRes.rows.filter(r => importantCols.includes(r.column_name)));

    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        client.release();
        pool.end();
    }
}

debugData();
