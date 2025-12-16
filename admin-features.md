# Admin Panel - Dynamic Resource & Plan Management 🎛️

## 🔧 Admin Dashboard Features

### 1. Resource Management (Live Editing)
```javascript
// Admin can modify any user's resources in real-time
User Resource Editor:
├─ CPU Allocation: 0.5 - 4 OCPU (slider)
├─ RAM Allocation: 1GB - 24GB (input field)
├─ Storage Limit: 10GB - 200GB (slider)
├─ Bandwidth Limit: 1TB - 10TB (dropdown)
├─ Container Count: 1 - 10 (input)
└─ Apply Changes: Instant container resize
```

### 2. Plan Management System
```javascript
Dynamic Plan Editor:
├─ Create New Plans (Custom pricing)
├─ Edit Existing Plans (Price, resources)
├─ Assign Custom Plans to Users
├─ Bulk Plan Migrations
├─ Temporary Resource Boosts
└─ Plan Expiry Management
```

### 3. User Management Interface
```javascript
User Control Panel:
├─ View All Users (Search, Filter, Sort)
├─ Individual User Editor:
│  ├─ Current Plan: [Dropdown to change]
│  ├─ Custom Resources: [Override plan limits]
│  ├─ Billing Status: [Active/Suspended/Trial]
│  ├─ Container Status: [Running/Stopped/Limited]
│  └─ Actions: [Suspend/Resume/Delete/Reset]
├─ Bulk Operations:
│  ├─ Mass Plan Updates
│  ├─ Resource Adjustments
│  └─ Billing Actions
```

## 🏗️ Admin Panel Structure

### Frontend Admin Components (Next.js)
```
admin-dashboard/
├─ users/
│  ├─ UserList.jsx          # All users table
│  ├─ UserEditor.jsx        # Individual user editor
│  ├─ ResourceSliders.jsx   # CPU/RAM/Storage controls
│  └─ PlanAssigner.jsx      # Plan assignment interface
├─ plans/
│  ├─ PlanList.jsx          # All plans management
│  ├─ PlanEditor.jsx        # Create/edit plans
│  └─ PricingCalculator.jsx # Dynamic pricing
├─ resources/
│  ├─ ServerMonitor.jsx     # Oracle server usage
│  ├─ ContainerManager.jsx  # Docker container control
│  └─ ResourceAllocator.jsx # Resource distribution
└─ analytics/
   ├─ RevenueTracker.jsx    # Earnings dashboard
   ├─ UsageMetrics.jsx      # Server utilization
   └─ CustomerMetrics.jsx   # User activity stats
```

### Backend Admin APIs (Express.js)
```javascript
// User Management APIs
PUT /api/admin/users/:userId/resources
PUT /api/admin/users/:userId/plan
POST /api/admin/users/:userId/actions (suspend/resume/reset)
GET /api/admin/users (with filters)

// Plan Management APIs
POST /api/admin/plans (create new plan)
PUT /api/admin/plans/:planId (edit plan)
DELETE /api/admin/plans/:planId
GET /api/admin/plans

// Resource Management APIs
PUT /api/admin/containers/:containerId/resources
GET /api/admin/servers/usage
POST /api/admin/servers/:serverId/allocate
GET /api/admin/analytics/revenue
```

## 🎛️ Admin Panel Features

### 1. Live User Editor
```javascript
// Real-time user resource editing
const UserResourceEditor = () => {
  const [user, setUser] = useState(null);
  const [resources, setResources] = useState({
    cpu: 1,        // OCPU allocation
    ram: 4,        // GB allocation  
    storage: 50,   // GB allocation
    containers: 1, // Container count
    bandwidth: 1   // TB/month
  });

  const updateResources = async () => {
    // API call to update container resources instantly
    await api.put(`/admin/users/${user.id}/resources`, resources);
    // Real-time container resize happens here
    resizeUserContainers(user.id, resources);
  };

  return (
    <div className="resource-editor">
      <h3>Edit Resources for {user.email}</h3>
      
      <div className="resource-controls">
        <Slider 
          label="CPU (OCPU)" 
          min={0.5} max={4} step={0.5}
          value={resources.cpu}
          onChange={(cpu) => setResources({...resources, cpu})}
        />
        
        <Input
          label="RAM (GB)"
          type="number" min={1} max={24}
          value={resources.ram}
          onChange={(ram) => setResources({...resources, ram})}
        />
        
        <Slider
          label="Storage (GB)"
          min={10} max={200} step={10}
          value={resources.storage}
          onChange={(storage) => setResources({...resources, storage})}
        />
        
        <button onClick={updateResources}>
          Apply Changes Instantly
        </button>
      </div>
    </div>
  );
};
```

### 2. Dynamic Plan Creator
```javascript
const PlanManager = () => {
  const [plans, setPlans] = useState([]);
  const [editingPlan, setEditingPlan] = useState({
    name: '',
    price: {
      usd: 0,
      pkr: 0
    },
    resources: {
      cpu: 1,
      ram: 4,
      storage: 50,
      bandwidth: 1
    },
    features: []
  });

  const savePlan = async () => {
    if (editingPlan.id) {
      // Update existing plan
      await api.put(`/admin/plans/${editingPlan.id}`, editingPlan);
      // Auto-migrate existing users if needed
    } else {
      // Create new plan
      await api.post('/admin/plans', editingPlan);
    }
    refreshPlans();
  };

  return (
    <div className="plan-manager">
      <h3>Plan Management</h3>
      
      {/* Plan List */}
      <div className="plan-list">
        {plans.map(plan => (
          <div key={plan.id} className="plan-card">
            <h4>{plan.name}</h4>
            <p>Price: ${plan.price.usd}/month</p>
            <p>Users: {plan.userCount}</p>
            <button onClick={() => setEditingPlan(plan)}>
              Edit Plan
            </button>
          </div>
        ))}
      </div>
      
      {/* Plan Editor */}
      <div className="plan-editor">
        <input 
          placeholder="Plan Name"
          value={editingPlan.name}
          onChange={(e) => setEditingPlan({...editingPlan, name: e.target.value})}
        />
        
        <div className="pricing">
          <input 
            type="number" 
            placeholder="USD Price"
            value={editingPlan.price.usd}
            onChange={(e) => setEditingPlan({
              ...editingPlan, 
              price: {...editingPlan.price, usd: e.target.value}
            })}
          />
          <input 
            type="number" 
            placeholder="PKR Price" 
            value={editingPlan.price.pkr}
            onChange={(e) => setEditingPlan({
              ...editingPlan,
              price: {...editingPlan.price, pkr: e.target.value}
            })}
          />
        </div>
        
        <button onClick={savePlan}>
          {editingPlan.id ? 'Update Plan' : 'Create Plan'}
        </button>
      </div>
    </div>
  );
};
```

### 3. Server Resource Monitor
```javascript
const ServerMonitor = () => {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);

  return (
    <div className="server-monitor">
      <h3>Oracle Server Management</h3>
      
      {servers.map(server => (
        <div key={server.id} className="server-card">
          <h4>Oracle Account {server.name}</h4>
          <div className="usage-bars">
            <div className="usage-bar">
              <label>CPU Usage</label>
              <div className="bar">
                <div 
                  className="fill" 
                  style={{width: `${server.cpu_usage}%`}}
                />
              </div>
              <span>{server.cpu_usage}% ({server.cpu_used}/{server.cpu_total} OCPU)</span>
            </div>
            
            <div className="usage-bar">
              <label>RAM Usage</label>
              <div className="bar">
                <div 
                  className="fill" 
                  style={{width: `${server.ram_usage}%`}}
                />
              </div>
              <span>{server.ram_usage}% ({server.ram_used}/{server.ram_total} GB)</span>
            </div>
            
            <div className="usage-bar">
              <label>Storage Usage</label>
              <div className="bar">
                <div 
                  className="fill" 
                  style={{width: `${server.storage_usage}%`}}
                />
              </div>
              <span>{server.storage_usage}% ({server.storage_used}/{server.storage_total} GB)</span>
            </div>
          </div>
          
          <div className="server-actions">
            <button onClick={() => addNewServer()}>
              Add New Oracle Account
            </button>
            <button onClick={() => optimizeResources(server.id)}>
              Optimize Resources
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
```

## 🔄 Live Resource Management Features

### Instant Changes
- **CPU/RAM adjustments**: Apply immediately via Docker API
- **Storage expansion**: Extend container volumes in real-time  
- **Plan migrations**: Move users between plans instantly
- **Container scaling**: Add/remove containers on demand

### Bulk Operations
- **Mass plan updates**: Update 100s of users at once
- **Resource rebalancing**: Optimize server utilization
- **Billing adjustments**: Apply discounts or credits
- **Server migrations**: Move users between Oracle accounts

### Analytics & Insights  
- **Revenue tracking**: Real-time earnings per server
- **Resource optimization**: Suggest optimal resource allocation
- **User behavior**: Track usage patterns
- **Cost efficiency**: Maximize profit per Oracle account

This gives you complete control over your hosting platform with zero manual work!
