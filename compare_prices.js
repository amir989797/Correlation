
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// --- تنظیمات ورودی ---
const SYMBOL = 'فولاد'; // نام نماد
const DATE_1 = '10.12.2023'; // تاریخ اول (DD.MM.YYYY)
const DATE_2 = '22.12.2023'; // تاریخ دوم (DD.MM.YYYY)
// نکته: چون تاریخ‌های ۲۰۲۵ در آینده هستند، برای تست از ۲۰۲۳ استفاده شده است.
// شما می‌توانید تاریخ‌های ۲۰۲۵ را جایگزین کنید.

// --- تنظیمات دیتابیس ---
const dbConfig = {
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

// تبدیل فرمت DD.MM.YYYY به YYYY-MM-DD برای دیتابیس
const formatDate = (dateStr) => {
    const parts = dateStr.split('.');
    if (parts.length !== 3) return null;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

const runComparison = async () => {
    const d1 = formatDate(DATE_1);
    const d2 = formatDate(DATE_2);

    console.log(`🔍 در حال جستجوی نماد «${SYMBOL}» برای تاریخ‌های ${d1} و ${d2}...`);

    const client = await pool.connect();
    try {
        const query = `
            SELECT date, close, adj_close, volume
            FROM daily_prices
            WHERE symbol = $1 
            AND date IN ($2, $3)
            ORDER BY date ASC;
        `;
        
        const res = await client.query(query, [SYMBOL, d1, d2]);

        if (res.rows.length === 0) {
            console.log('❌ هیچ داده‌ای برای این تاریخ‌ها یافت نشد.');
            console.log('نکته: مطمئن شوید که تاریخ‌ها روز تعطیل نیستند و دیتابیس آپدیت شده است.');
            return;
        }

        console.log('\n📊 نتایج یافت شده:');
        console.table(res.rows.map(row => ({
            Date: row.date.toISOString().split('T')[0],
            Close: row.close,
            AdjClose: row.adj_close,
            Volume: new Intl.NumberFormat().format(row.volume)
        })));

        if (res.rows.length === 2) {
            const first = res.rows[0];
            const second = res.rows[1];

            const priceDiff = second.adj_close - first.adj_close;
            const pricePercent = ((priceDiff / first.adj_close) * 100).toFixed(2);
            
            const volDiff = second.volume - first.volume;
            const volPercent = ((volDiff / first.volume) * 100).toFixed(2);

            console.log('\n📈 تحلیل مقایسه‌ای:');
            console.log('-----------------------------------');
            console.log(`تغییر قیمت: ${priceDiff > 0 ? '+' : ''}${priceDiff} ریال (${pricePercent}%)`);
            console.log(`تغییر حجم:  ${volDiff > 0 ? '+' : ''}${new Intl.NumberFormat().format(volDiff)} (${volPercent}%)`);
            console.log('-----------------------------------');
        } else {
            console.log('\n⚠️ یکی از تاریخ‌ها در دیتابیس موجود نبود (احتمالا روز تعطیل).');
        }

    } catch (err) {
        console.error('❌ خطا در اجرای کوئری:', err.message);
    } finally {
        client.release();
        pool.end();
    }
};

runComparison();
