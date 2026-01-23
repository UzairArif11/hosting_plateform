import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
    try {
        const db = getDb();

        // For JSON adapter (Lite Mode)
        if ('getItemCount' in db) {
            const count = await db.getItemCount();
            const limit = parseInt(process.env.MAX_LISTINGS || '100');
            const percentage = Math.round((count / limit) * 100);

            // Warning levels
            let warning = null;
            if (percentage >= 90) {
                warning = {
                    level: 'critical',
                    message: `You're using ${count} of ${limit} products (${percentage}%). Upgrade to Pro Mode for unlimited products.`
                };
            } else if (percentage >= 75) {
                warning = {
                    level: 'warning',
                    message: `You're using ${count} of ${limit} products (${percentage}%). Consider upgrading to Pro Mode.`
                };
            } else if (percentage >= 50) {
                warning = {
                    level: 'info',
                    message: `You're using ${count} of ${limit} products (${percentage}%).`
                };
            }

            return NextResponse.json({
                mode: 'lite',
                itemCount: count,
                limit,
                percentage,
                warning
            });
        }

        // For Postgres (Pro Mode)
        return NextResponse.json({
            mode: 'pro',
            itemCount: null,
            limit: null,
            percentage: 0,
            warning: null
        });

    } catch (error) {
        return NextResponse.json({ error: 'Failed to get limit status' }, { status: 500 });
    }
}
