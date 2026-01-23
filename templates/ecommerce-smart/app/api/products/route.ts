
import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET() {
    try {
        const products = await db.getAllProducts();
        return NextResponse.json({ success: true, products });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Basic validation
        if (!body.name || !body.price) {
            return NextResponse.json({ success: false, error: 'Name and Price required' }, { status: 400 });
        }

        const newProduct = await db.createProduct(body);
        return NextResponse.json({ success: true, product: newProduct });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
