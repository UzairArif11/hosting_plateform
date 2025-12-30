#!/bin/bash

echo "========================================"
echo "ADMIN PANEL VERIFICATION SCRIPT"
echo "========================================"
echo ""

echo "✅ Checking Frontend Files..."
echo ""

# Check if plans page exists
if [ -f "frontend/app/admin/plans/page.tsx" ]; then
    echo "✓ Plan Management page exists: frontend/app/admin/plans/page.tsx"
else
    echo "✗ Plan Management page NOT FOUND"
fi

# Check if InfraScanner exists
if [ -f "frontend/app/admin/servers/InfraScanner.tsx" ]; then
    echo "✓ Infrastructure Scanner exists: frontend/app/admin/servers/InfraScanner.tsx"
else
    echo "✗ Infrastructure Scanner NOT FOUND"
fi

# Check admin dashboard
if [ -f "frontend/app/admin/page.tsx" ]; then
    echo "✓ Admin Dashboard exists: frontend/app/admin/page.tsx"
    
    # Check if it has Plan Management link
    if grep -q "Plan Management" "frontend/app/admin/page.tsx"; then
        echo "  ✓ Contains Plan Management link"
    else
        echo "  ✗ Missing Plan Management link"
    fi
fi

echo ""
echo "✅ Checking Backend Routes..."
echo ""

if [ -f "backend/routes/admin.js" ]; then
    echo "✓ Admin routes file exists: backend/routes/admin.js"
    
    # Check for Plan routes
    if grep -q "router.get('/plans'" backend/routes/admin.js; then
        echo "  ✓ GET /plans route exists"
    fi
    
    if grep -q "router.put('/plans/:id'" backend/routes/admin.js; then
        echo "  ✓ PUT /plans/:id route exists"
    fi
    
    if grep -q "router.post('/plans/:id/sync'" backend/routes/admin.js; then
        echo "  ✓ POST /plans/:id/sync route exists"
    fi
    
    # Check for Infrastructure routes
    if grep -q "router.get('/infra/scan'" backend/routes/admin.js; then
        echo "  ✓ GET /infra/scan route exists"
    fi
    
    # Check for Protection routes
    if grep -q "router.put('/users/:id/protection'" backend/routes/admin.js; then
        echo "  ✓ PUT /users/:id/protection route exists"
    fi
fi

echo ""
echo "✅ Checking Database Models..."
echo ""

if [ -f "backend/models/User.js" ]; then
    if grep -q "isProtected" backend/models/User.js; then
        echo "✓ User.isProtected field exists"
    fi
fi

if [ -f "backend/models/Project.js" ]; then
    if grep -q "isProtected" backend/models/Project.js; then
        echo "✓ Project.isProtected field exists"
    fi
fi

echo ""
echo "========================================"
echo "VERIFICATION COMPLETE"
echo "========================================"
echo ""
echo "📋 Next Steps:"
echo "1. Navigate to: http://localhost:3000/admin"
echo "2. Click on 'Plan Management' card"
echo "3. You should see the plan management interface"
echo ""
echo "If the page shows 404:"
echo "- Check frontend console for errors"
echo "- Restart frontend: npm run dev"
echo "- Clear browser cache: Ctrl+Shift+R"
echo ""
