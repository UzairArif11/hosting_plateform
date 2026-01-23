import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const MAX_ITEMS = parseInt(process.env.MAX_LISTINGS || '100'); // Default limit

// Ensure DB exists
if (!fs.existsSync(DB_PATH)) {
    if (!fs.existsSync(path.dirname(DB_PATH))) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify({ products: [] }, null, 2));
}

export class JsonAdapter {
    private get data() {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }

    private save(data: any) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }

    async getAllProducts() {
        return this.data.products;
    }

    async getProductById(id: string) {
        return this.data.products.find((p: any) => p.id === id);
    }

    async getItemCount() {
        return this.data.products.length;
    }

    async createProduct(product: any) {
        const data = this.data;

        // Enforce limit
        if (data.products.length >= MAX_ITEMS) {
            throw new Error(`Lite Mode limit reached. Maximum ${MAX_ITEMS} products allowed. Upgrade to Pro Mode for unlimited products.`);
        }

        const newProduct = { ...product, id: Date.now().toString(), createdAt: new Date().toISOString() };
        data.products.push(newProduct);
        this.save(data);
        return newProduct;
    }

    async updateProduct(id: string, updates: any) {
        const data = this.data;
        const index = data.products.findIndex((p: any) => p.id === id);
        if (index === -1) throw new Error('Product not found');

        data.products[index] = { ...data.products[index], ...updates, updatedAt: new Date().toISOString() };
        this.save(data);
        return data.products[index];
    }

    async deleteProduct(id: string) {
        const data = this.data;
        data.products = data.products.filter((p: any) => p.id !== id);
        this.save(data);
        return true;
    }
}
