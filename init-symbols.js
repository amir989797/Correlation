
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Database Config (Matches server.js)
const dbConfig = {
  user: process.env.DB_USER || 'tseuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tsetmc',
  password: process.env.DB_PASSWORD || 'YourStrongPass123',
  port: parseInt(process.env.DB_PORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

const pool = new Pool(dbConfig);

const migrate = async () => {
  const client = await pool.connect();
  console.log(`🔌 Connected to database for migration...`);

  try {
    // 1. Create the symbols table
    console.log('🔨 Creating "symbols" table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS symbols (
        id SERIAL PRIMARY KEY,
        symbol VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255)
      );
    `);
    
    // 2. Add index for faster search
    console.log('⚡ Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_symbols_search_symbol ON symbols(symbol);
      CREATE INDEX IF NOT EXISTS idx_symbols_search_name ON symbols(name);
    `);

    // 3. Populate from daily_prices
    console.log('📥 Extracting unique symbols from daily_prices...');
    const insertQuery = `
      INSERT INTO symbols (symbol, name)
      SELECT symbol, MAX(name) as name
      FROM daily_prices
      GROUP BY symbol
      ON CONFLICT (symbol) DO NOTHING;
    `;
    const res = await client.query(insertQuery);
    console.log(`✅ Stocks Processed: ${res.rowCount} new symbols.`);

    // 4. Populate from index_prices
    console.log('📥 Extracting unique symbols from index_prices...');
    try {
        const insertIndices = `
          INSERT INTO symbols (symbol, name)
          SELECT symbol, MAX(name) as name
          FROM index_prices
          GROUP BY symbol
          ON CONFLICT (symbol) DO NOTHING;
        `;
        const resIndex = await client.query(insertIndices);
        console.log(`✅ Indices Processed: ${resIndex.rowCount} new symbols.`);
    } catch (e) {
        console.log('⚠️ Could not sync indices (table might be missing or empty):', e.message);
    }

  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    client.release();
    pool.end();
  }
};

migrate();
