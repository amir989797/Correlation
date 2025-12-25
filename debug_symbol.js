
import pg from 'pg';
import axios from 'axios';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';

// تنظیمات تست
const TEST_SYMBOL = 'عیار';
const TEST_ID = '24673392348633355'; // شناسه اختصاصی عیار در TSETMC

const dbConfig = {
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432')
};

const pool = new pg.Pool(dbConfig);

async function debug() {
    console.log(`🔍 شروع تست عیب‌یابی برای نماد: ${TEST_SYMBOL}`);
    
    try {
        const url = `http://old.tsetmc.com/tsev2/data/Export-txt.aspx?t=i&a=1&b=0&i=${TEST_ID}`;
        console.log(`🌐 فراخوانی آدرس: ${url}`);
        
        const response = await axios.get(url);
        const csv = response.data;
        
        if (!csv) {
            console.error("❌ هیچ داده‌ای از سرور TSETMC دریافت نشد.");
            return;
        }

        console.log(`📦 طول دیتای دریافتی: ${csv.length} کاراکتر`);
        
        const records = parse(csv, {
            columns: true,
            skip_empty_lines: true,
            bom: true
        });

        console.log(`📊 تعداد رکوردهای یافت شده در فایل: ${records.length}`);
        
        if (records.length > 0) {
            const sample = records[0];
            const keys = Object.keys(sample);
            console.log("🔑 ستون‌های شناسایی شده:", keys);
            
            // نمایش ۵ روز آخر
            console.log("\n📅 ۵ روز آخر در فایل TSETMC:");
            records.slice(0, 5).forEach(r => {
                const dateKey = keys.find(k => k.includes('DTYYYYMMDD'));
                const closeKey = keys.find(k => k.includes('CLOSE'));
                console.log(`تاریخ: ${r[dateKey]} | قیمت: ${r[closeKey]}`);
            });

            // تست ذخیره در دیتابیس
            console.log("\n💾 تست ذخیره آخرین روز در دیتابیس...");
            const client = await pool.connect();
            try {
                const lastRecord = records[0];
                const dateKey = keys.find(k => k.includes('DTYYYYMMDD'));
                const closeKey = keys.find(k => k.includes('CLOSE'));
                
                const rawDate = lastRecord[dateKey];
                const dbDate = `${rawDate.substring(0, 4)}-${rawDate.substring(4, 6)}-${rawDate.substring(6, 8)}`;
                const price = parseFloat(lastRecord[closeKey]);

                await client.query(`
                    INSERT INTO daily_prices (symbol, name, date, close, adj_close, volume)
                    VALUES ($1, $2, $3, $4, $4, 100)
                    ON CONFLICT (symbol, date) DO UPDATE SET close = EXCLUDED.close;
                `, [TEST_SYMBOL, 'صندوق طلا عیار', dbDate, price]);
                
                console.log(`✅ دیتای تاریخ ${dbDate} با موفقیت در دیتابیس ذخیره شد.`);
                
                const check = await client.query(`SELECT * FROM daily_prices WHERE symbol = $1 AND date = $2`, [TEST_SYMBOL, dbDate]);
                console.log("🔎 تایید نهایی از دیتابیس (SELECT):", check.rows[0]);

            } finally {
                client.release();
            }
        }

    } catch (err) {
        console.error("❌ خطا در اجرای تست:", err.message);
    } finally {
        await pool.end();
    }
}

debug();
