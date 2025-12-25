
import axios from 'axios';
import pg from 'pg';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';

const { Pool } = pg;

// شناسه TSETMC نماد فولاد (مبارکه اصفهان)
const FOOLAD_ID = '46348559193224090'; 
// تغییر تاریخ هدف به 20241223 (معادل 3 دی 1403)
const TARGET_DATE_RAW = '20241223'; 

const dbConfig = {
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

const formatDateForDB = (dateStr) => {
    // تبدیل 20231222 به 2023-12-22
    if (!dateStr || dateStr.length !== 8) return null;
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
};

const runTest = async () => {
    console.log(`🚀 در حال اتصال به TSETMC برای دریافت دیتای «فولاد» (ID: ${FOOLAD_ID})...`);
    console.log(`🔍 جستجو برای تاریخ هدف: ${TARGET_DATE_RAW} (3 دی 1403)`);
    
    try {
        // دانلود فایل CSV کامل
        const url = `http://old.tsetmc.com/tsev2/data/Export-txt.aspx?t=i&a=1&b=0&i=${FOOLAD_ID}`;
        const response = await axios.get(url, {
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const csvContent = response.data;
        if (!csvContent) {
            console.error('❌ دیتایی از TSETMC دریافت نشد.');
            return;
        }

        console.log(`📦 حجم دیتای دریافتی: ${csvContent.length} کاراکتر`);

        // پارس کردن CSV
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true
        });

        if (records.length > 0) {
            // مرتب‌سازی بر اساس تاریخ نزولی (جدیدترین اول)
            const sortedRecords = records.sort((a, b) => {
                const dateA = a['<DTYYYYMMDD>'] || '';
                const dateB = b['<DTYYYYMMDD>'] || '';
                return dateB.localeCompare(dateA);
            });

            const latest = sortedRecords[0];
            console.log('\n📅 --- وضعیت آخرین داده موجود ---');
            console.log(`آخرین تاریخ موجود: ${latest['<DTYYYYMMDD>']}`);
            console.log(`آخرین قیمت پایانی: ${latest['<CLOSE>']}`);
            console.log(`آخرین حجم معاملات: ${latest['<VOL>']}`);
            console.log('----------------------------------\n');
        } else {
            console.log('⚠️ هیچ رکوردی در فایل CSV یافت نشد.');
            return;
        }

        // بررسی وجود تاریخ مورد نظر
        const targetRecord = records.find(r => r['<DTYYYYMMDD>'] === TARGET_DATE_RAW);

        if (targetRecord) {
            console.log(`✅ تاریخ هدف ${TARGET_DATE_RAW} پیدا شد!`);
            console.log('📋 جزئیات رکورد:', targetRecord);
            
            // تلاش برای درج در دیتابیس
            const client = await pool.connect();
            try {
                const dateDB = formatDateForDB(TARGET_DATE_RAW); 
                const close = parseFloat(targetRecord['<CLOSE>'] || targetRecord['<LAST>'] || 0);
                const vol = parseInt(targetRecord['<VOL>'] || 0);
                
                console.log(`💾 در حال درج در دیتابیس: ${dateDB} - قیمت: ${close}`);

                const query = `
                    INSERT INTO daily_prices 
                    (symbol, name, date, close, adj_close, volume, value, open, high, low, count, yesterday)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0)
                    ON CONFLICT (symbol, date) 
                    DO UPDATE SET close = EXCLUDED.close, volume = EXCLUDED.volume;
                `;

                const values = [
                    'فولاد', 
                    'فولاد مبارکه اصفهان', 
                    dateDB, 
                    close, 
                    close, 
                    vol, 
                    0, 0, 0, 0 
                ];

                await client.query(query, values);
                console.log('✅ رکورد با موفقیت در دیتابیس ذخیره/آپدیت شد.');

            } catch (dbErr) {
                console.error('❌ خطا در دیتابیس:', dbErr.message);
            } finally {
                client.release();
            }

        } else {
            console.log(`❌ تاریخ هدف ${TARGET_DATE_RAW} در فایل دانلودی وجود ندارد.`);
            console.log('نکته: احتمالا روز تعطیل بوده است یا دیتای TSETMC ناقص است.');
        }

    } catch (err) {
        console.error('❌ خطا در ارتباط با TSETMC:', err.message);
    } finally {
        await pool.end();
    }
};

runTest();
