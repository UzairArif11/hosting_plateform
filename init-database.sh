#!/bin/bash

###############################################################################
# INITIALIZE DATABASE - Run seeders
# Run this once after first deployment
###############################################################################

echo "╔══════════════════════════════════════════════════════════"
echo "║  DATABASE INITIALIZATION - Running Seeders"
echo "╚══════════════════════════════════════════════════════════"
echo ""

cd backend

echo "→ Running migrations (removing old validators)..."
node migrations/remove-plan-validator.js

echo ""
echo "→ Seeding subscription plans..."
node seeders/planSeeder.js

echo ""
echo "→ Seeding server capacity..."
node seeders/capacitySeeder.js

cd ..

echo ""
echo "╔══════════════════════════════════════════════════════════"
echo "║  ✅ DATABASE INITIALIZED!"
echo "╚══════════════════════════════════════════════════════════"
echo ""
echo "Created:"
echo "  • 3 Subscription Plans (Free, Pro, Enterprise)"
echo "  • 2 Server Capacity configs (EC2, EC3)"
echo ""
echo "Optional: Create admin user"
echo "  cd backend && node make-admin.js your@email.com"

