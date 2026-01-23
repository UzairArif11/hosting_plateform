const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const MIGRATED_PATH = path.join(process.cwd(), 'data', 'db.json.migrated');

async function migrate() {
    // 1. Check if we are in Pro Mode (Have DB)
    if (!process.env.DATABASE_URL) {
        console.log('[Migrate] No DATABASE_URL found. Staying in Lite Mode.');
        return;
    }

    // 2. Check if we have legacy data to migrate
    if (!fs.existsSync(DB_PATH)) {
        console.log('[Migrate] No local data found to migrate.');
        return;
    }

    // 3. Perform Migration
    console.log('🚀 [Migrate] Upgrading from Lite to Pro Mode...');

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        const rawData = fs.readFileSync(DB_PATH, 'utf-8');
        const data = JSON.parse(rawData);
        const productCount = data.products ? data.products.length : 0;

        if (productCount > 0) {
            console.log(`[Migrate] Found ${productCount} products in local JSON.`);

            // Create table if not exists
            await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(500) NOT NULL,
          price DECIMAL(10, 2) DEFAULT 0,
          image TEXT,
          description TEXT,
          "createdAt" TIMESTAMP DEFAULT NOW(),
          "updatedAt" TIMESTAMP DEFAULT NOW()
        )
      `);
            console.log('[Migrate] ✓ Products table ready');

            // Insert products
            let inserted = 0;
            for (const p of data.products) {
                try {
                    await pool.query(
                        `INSERT INTO products (id, name, price, image, description, "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (id) DO NOTHING`,
                        [
                            p.id,
                            p.name,
                            p.price || 0,
                            p.image || '',
                            p.description || '',
                            p.createdAt || new Date().toISOString(),
                            p.updatedAt || new Date().toISOString()
                        ]
                    );
                    inserted++;
                } catch (err) {
                    console.warn(`[Migrate] Failed to insert product ${p.id}:`, err.message);
                }
            }

            console.log(`[Migrate] ✅ Successfully migrated ${inserted}/${productCount} products to Postgres.`);
        }

        // 4. Mark as Migrated (Rename file so we don't do it again)
        fs.renameSync(DB_PATH, MIGRATED_PATH);
        console.log('[Migrate] 🏁 Migration complete. Local DB archived.');

    } catch (error) {
        console.error('[Migrate] ❌ Migration failed:', error);
        // Do not rename file if failed, so we retry next time
        throw error;
    } finally {
        await pool.end();
    }
}

// Run migration and exit with appropriate code
migrate()
    .then(() => {
        console.log('[Migrate] Exiting successfully');
        process.exit(0);
    })
    .catch((err) => {
        console.error('[Migrate] Exiting with error:', err);
        process.exit(1);
    });
