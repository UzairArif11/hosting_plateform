# 🌐 SERVER & DNS MANAGEMENT FOR ADMIN PANEL

## 📋 **NEW API ENDPOINTS**

### **1. Get Server Information**

**Endpoint:** `GET /api/settings/servers`  
**Access:** Admin only  
**Purpose:** Get all server IPs and DNS instructions

#### **Request:**
```bash
curl http://localhost:5000/api/settings/servers \
  -H "Authorization: Bearer <admin-token>"
```

#### **Response:**
```json
{
  "servers": {
    "EC2": {
      "domain": "ec2.foodpanda.site",
      "ip": "13.127.45.123",
      "sshKey": "Configured",
      "status": "active"
    },
    "EC3": {
      "domain": "foodpanda.site",
      "ip": "129.154.255.90",
      "sshKey": "Configured",
      "status": "active"
    },
    "EC4": {
      "domain": "ec4.foodpanda.site",
      "ip": "Not configured",
      "sshKey": "Not configured",
      "status": "inactive"
    },
    "EC5": {
      "domain": "ec5.foodpanda.site",
      "ip": "Not configured",
      "sshKey": "Not configured",
      "status": "inactive"
    }
  },
  "dnsInstructions": {
    "EC2": {
      "domain": "ec2.foodpanda.site",
      "ip": "13.127.45.123",
      "records": [
        {
          "type": "A",
          "name": "ec2",
          "value": "13.127.45.123",
          "ttl": 3600
        },
        {
          "type": "A",
          "name": "www.ec2",
          "value": "13.127.45.123",
          "ttl": 3600
        }
      ]
    },
    "EC3": {
      "domain": "foodpanda.site",
      "ip": "129.154.255.90",
      "records": [
        {
          "type": "A",
          "name": "@",
          "value": "129.154.255.90",
          "ttl": 3600
        },
        {
          "type": "A",
          "name": "www.@",
          "value": "129.154.255.90",
          "ttl": 3600
        }
      ]
    }
  },
  "sslEmail": "admin@foodpanda.site",
  "protocol": "https"
}
```

---

### **2. Verify DNS Configuration**

**Endpoint:** `POST /api/settings/verify-dns`  
**Access:** Admin only  
**Purpose:** Check if DNS is correctly configured before domain migration

#### **Request:**
```bash
curl -X POST http://localhost:5000/api/settings/verify-dns \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "serverKey": "EC3",
    "domain": "newdomain.com"
  }'
```

#### **Response (DNS Configured Correctly):**
```json
{
  "verified": true,
  "message": "DNS is correctly configured for newdomain.com",
  "domain": "newdomain.com",
  "expectedIP": "129.154.255.90",
  "foundIPs": ["129.154.255.90"],
  "ready": true
}
```

#### **Response (DNS Not Configured):**
```json
{
  "verified": false,
  "message": "DNS lookup failed for newdomain.com. Make sure DNS records are added.",
  "domain": "newdomain.com",
  "error": "ENOTFOUND",
  "ready": false
}
```

#### **Response (DNS Points to Wrong IP):**
```json
{
  "verified": false,
  "message": "DNS points to 1.2.3.4 but should point to 129.154.255.90",
  "domain": "newdomain.com",
  "expectedIP": "129.154.255.90",
  "foundIPs": ["1.2.3.4"],
  "ready": false
}
```

---

## 🎨 **ADMIN PANEL UI DESIGN**

### **Server Management Page:**

```
┌─────────────────────────────────────────────────────────────┐
│  🖥️ SERVER MANAGEMENT                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📊 Active Servers                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EC2 - ec2.foodpanda.site                    ✅ Active│  │
│  │  IP: 13.127.45.123                                    │  │
│  │  SSH: Configured                                      │  │
│  │  [View DNS Instructions]                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EC3 - foodpanda.site                        ✅ Active│  │
│  │  IP: 129.154.255.90                                   │  │
│  │  SSH: Configured                                      │  │
│  │  [View DNS Instructions]                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EC4 - ec4.foodpanda.site                  ⚠️ Inactive│  │
│  │  IP: Not configured                                   │  │
│  │  SSH: Not configured                                  │  │
│  │  [Configure Server]                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

### **Domain Migration Page:**

```
┌─────────────────────────────────────────────────────────────┐
│  🌐 DOMAIN MIGRATION                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Step 1: Configure New Domains                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  EC2 Domain:  [ec2.newdomain.com        ]                  │
│  EC3 Domain:  [newdomain.com            ]                  │
│  EC4 Domain:  [ec4.newdomain.com        ]                  │
│                                                              │
│  [Next: View DNS Instructions]                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Step 2: DNS Configuration Required                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠️ Before migrating, add these DNS records:               │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EC2 - ec2.newdomain.com                             │  │
│  │  ────────────────────────────────────────────────────│  │
│  │  Type: A                                              │  │
│  │  Name: ec2                                            │  │
│  │  Value: 13.127.45.123                                │  │
│  │  TTL: 3600                                            │  │
│  │                                                        │  │
│  │  Type: A                                              │  │
│  │  Name: www.ec2                                        │  │
│  │  Value: 13.127.45.123                                │  │
│  │  TTL: 3600                                            │  │
│  │                                                        │  │
│  │  [Verify DNS] ⚠️ Not Verified                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  EC3 - newdomain.com                                 │  │
│  │  ────────────────────────────────────────────────────│  │
│  │  Type: A                                              │  │
│  │  Name: @                                              │  │
│  │  Value: 129.154.255.90                               │  │
│  │  TTL: 3600                                            │  │
│  │                                                        │  │
│  │  Type: A                                              │  │
│  │  Name: www                                            │  │
│  │  Value: 129.154.255.90                               │  │
│  │  TTL: 3600                                            │  │
│  │                                                        │  │
│  │  [Verify DNS] ✅ Verified                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Back] [Next: Start Migration]                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Step 3: Migration Options                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ⚠️ DNS Verification Status:                               │
│  EC2: ⚠️ Not Verified                                      │
│  EC3: ✅ Verified                                          │
│                                                              │
│  Migration Type:                                            │
│  ○ Automatic (Recommended) - Updates everything            │
│  ○ Manual - Database only, manual server update            │
│                                                              │
│  ⚠️ Warning: EC2 DNS is not verified. Migration may fail.  │
│                                                              │
│  [Cancel] [Start Migration Anyway] [Verify DNS First]      │
└─────────────────────────────────────────────────────────────┘
```

---

## 💻 **FRONTEND IMPLEMENTATION EXAMPLE**

### **React Component:**

```typescript
// components/ServerManagement.tsx
import { useState, useEffect } from 'react';

interface Server {
  domain: string;
  ip: string;
  sshKey: string;
  status: 'active' | 'inactive';
}

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  ttl: number;
}

export default function ServerManagement() {
  const [servers, setServers] = useState<Record<string, Server>>({});
  const [dnsInstructions, setDnsInstructions] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    const response = await fetch('/api/settings/servers', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    const data = await response.json();
    setServers(data.servers);
    setDnsInstructions(data.dnsInstructions);
    setLoading(false);
  };

  const verifyDNS = async (serverKey: string, domain: string) => {
    const response = await fetch('/api/settings/verify-dns', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ serverKey, domain })
    });
    const result = await response.json();
    
    if (result.verified) {
      alert(`✅ DNS verified for ${domain}`);
    } else {
      alert(`⚠️ ${result.message}`);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Server Management</h1>
      
      {Object.entries(servers).map(([serverKey, server]) => (
        <div key={serverKey} className="border rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold">{serverKey} - {server.domain}</h3>
              <p className="text-gray-600">IP: {server.ip}</p>
              <p className="text-gray-600">SSH: {server.sshKey}</p>
            </div>
            <span className={`px-3 py-1 rounded ${
              server.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {server.status === 'active' ? '✅ Active' : '⚠️ Inactive'}
            </span>
          </div>
          
          {dnsInstructions[serverKey] && (
            <div className="mt-4 bg-gray-50 p-3 rounded">
              <h4 className="font-semibold mb-2">DNS Records:</h4>
              {dnsInstructions[serverKey].records.map((record: DNSRecord, idx: number) => (
                <div key={idx} className="text-sm mb-2">
                  <code>
                    {record.type} | {record.name} | {record.value} | TTL: {record.ttl}
                  </code>
                </div>
              ))}
              <button
                onClick={() => verifyDNS(serverKey, server.domain)}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Verify DNS
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## 📋 **USAGE WORKFLOW**

### **Before Domain Migration:**

```
1. Admin goes to Server Management page
   ↓
2. Clicks "Change Domain"
   ↓
3. Enters new domains for each server
   ↓
4. System shows DNS instructions:
   - Server IPs
   - Required A records
   - TTL values
   ↓
5. Admin adds DNS records at domain registrar
   ↓
6. Admin clicks "Verify DNS" for each server
   ↓
7. System checks if DNS points to correct IP
   ↓
8. If verified ✅: Can proceed with migration
   If not verified ⚠️: Shows warning, can still proceed
   ↓
9. Admin clicks "Start Migration"
   ↓
10. System migrates (automatic or manual)
```

---

## ✅ **BENEFITS:**

1. **✅ Clear Instructions** - Admin knows exactly what DNS records to add
2. **✅ Server IPs Visible** - No need to check .env or SSH
3. **✅ DNS Verification** - Check if DNS is ready before migration
4. **✅ Prevents Errors** - Warns if DNS not configured
5. **✅ Better UX** - Step-by-step guided process

---

## 🎯 **SUMMARY:**

**New API Endpoints:**
- ✅ `GET /api/settings/servers` - Get all server info & DNS instructions
- ✅ `POST /api/settings/verify-dns` - Verify DNS configuration

**Admin Panel Should Show:**
- ✅ Server list with IPs
- ✅ DNS instructions for each server
- ✅ DNS verification status
- ✅ Warning if DNS not ready
- ✅ Step-by-step migration wizard

**This ensures admin knows:**
- ✅ Which IPs to point DNS to
- ✅ What DNS records to add
- ✅ If DNS is ready before migration
- ✅ Prevents migration failures

**Ready to implement in admin panel!** 🚀
