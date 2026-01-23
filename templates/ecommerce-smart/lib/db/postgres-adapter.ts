import { Pool, PoolClient } from 'pg';

export class PostgresAdapter {
    private pool: Pool;

    constructor(connectionString: string) {
        this.pool = new Pool({
            connectionString,
            max: 10, // Maximum pool size
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });

        // Test connection on init
        this.pool.on('error', (err) => {
            console.error('[PostgresAdapter] Unexpected pool error:', err);
        });
    }

    private async query(sql: string, params?: any[]) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(sql, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    async getAllProducts() {
        return this.query('SELECT * FROM products ORDER BY "createdAt" DESC');
    }

    async getProductById(id: string) {
        const rows = await this.query('SELECT * FROM products WHERE id = $1', [id]);
        return rows[0];
    }

    async createProduct(product: any) {
        const sql = `
      INSERT INTO products (id, name, price, image, description, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;
        const id = product.id || Date.now().toString();
        const rows = await this.query(sql, [
            id,
            product.name,
            product.price || 0,
            product.image || '',
            product.description || ''
        ]);
        return rows[0];
    }

    async updateProduct(id: string, updates: any) {
        const setClauses: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (updates.name !== undefined) {
            setClauses.push(`name = $${paramIndex++}`);
            values.push(updates.name);
        }
        if (updates.price !== undefined) {
            setClauses.push(`price = $${paramIndex++}`);
            values.push(updates.price);
        }
        if (updates.image !== undefined) {
            setClauses.push(`image = $${paramIndex++}`);
            values.push(updates.image);
        }
        if (updates.description !== undefined) {
            setClauses.push(`description = $${paramIndex++}`);
            values.push(updates.description);
        }

        setClauses.push(`"updatedAt" = NOW()`);
        values.push(id);

        const sql = `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
        const rows = await this.query(sql, values);
        return rows[0];
    }

    async deleteProduct(id: string) {
        await this.query('DELETE FROM products WHERE id = $1', [id]);
        return true;
    }

    async close() {
        await this.pool.end();
    }
}
