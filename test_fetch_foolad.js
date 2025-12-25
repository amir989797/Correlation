
import axios from 'axios';
import pg from 'pg';
import { parse } from 'csv-parse/sync';
import 'dotenv/config';

const { Pool } = pg;

// شناسه TSETMC نماد فولاد (مبارکه اصفهان)
const FOOLAD_ID = '46348559193224090'; 
const TARGET_DATE_RAW = '20231222'; // تاریخی که دنبالش هستیم (فرمت TSETMC)

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

        // بررسی وجود تاریخ در متن خام
        if (csvContent.includes(TARGET_DATE_RAW)) {
            console.log(`✅ تاریخ ${TARGET_DATE_RAW} در فایل خام CSV پیدا شد!`);
        } else {
            console.log(`❌ تاریخ ${TARGET_DATE_RAW} در فایل خام CSV وجود ندارد.`);
            console.log('نکته: اگر تاریخ تعطیل رسمی بوده، عدم وجود آن طبیعی است.');
            return; // اگر نیست، کاری نمی‌توان کرد
        }

        // پارس کردن CSV
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            relax_column_count: true
        });

        // پیدا کردن رکورد خاص
        const targetRecord = records.find(r => r['<DTYYYYMMDD>'] === TARGET_DATE_RAW || Object.values(r).includes(TARGET_DATE_RAW));

        if (targetRecord) {
            console.log('📋 جزئیات رکورد پیدا شده:', targetRecord);
            
            // تلاش برای درج در دیتابیس
            const client = await pool.connect();
            try {
                const dateDB = formatDateForDB(TARGET_DATE_RAW); // 2023-12-22
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

                // مقادیر ساده‌سازی شده برای تست
                const values = [
                    'فولاد', 
                    'فولاد مبارکه اصفهان', 
                    dateDB, 
                    close, 
                    close, // فرض بر adjusted بودن
                    vol, 
                    0, 0, 0, 0 // سایر مقادیر صفر برای تست
                ];

                await client.query(query, values);
                console.log('✅ رکورد با موفقیت در دیتابیس ذخیره/آپدیت شد.');

            } catch (dbErr) {
                console.error('❌ خطا در دیتابیس:', dbErr.message);
            } finally {
                client.release();
            }

        } else {
            console.log('⚠️ رکورد در پارسر پیدا نشد (با وجود اینکه در متن خام بود). مشکل از CSV Header است.');
        }

    } catch (err) {
        console.error('❌ خطا در ارتباط با TSETMC:', err.message);
    } finally {
        await pool.end();
    }
};

runTest();
