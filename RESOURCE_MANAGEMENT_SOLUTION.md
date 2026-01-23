# Resource Management Solution - Best Practices

## ✅ Complete Solution for Pro Features Without Server Exhaustion

### Main Goal
Give users pro features while protecting server resources by:
1. **Offloading to user infrastructure** (their own database, storage)
2. **Admin-configurable limits** per template
3. **Image size/resolution limits**
4. **Smart cleanup** on deployment deletion

---

## 1. Database Strategy

### ✅ Recommendation: MongoDB (Same as Platform)

**Why MongoDB**:
- ✅ You already use MongoDB for platform data
- ✅ Users familiar with MongoDB
- ✅ Better for scaling (horizontal scaling)
- ✅ Better for document-based data (products, listings, etc.)
- ✅ NoSQL flexibility for user data

**SQLite vs MongoDB**:
- ❌ SQLite: File-based, single-server, limited scaling
- ✅ MongoDB: Cloud-based, scales horizontally, better for production

**Implementation**:
- Users connect their own MongoDB (MongoDB Atlas, Railway, etc.)
- Via `DATABASE_URL` environment variable
- Platform data stays in our MongoDB
- User application data in their MongoDB

---

## 2. Database Cleanup on Deployment Deletion

### ✅ Best Solution: User's Responsibility + Optional Platform Cleanup

**Strategy**:
1. **Platform Data**: Automatically cleaned up (our MongoDB)
   - Deployment record deleted
   - Project data cleaned up
   - Environment variables removed

2. **User's Database**: User's responsibility
   - User owns their database
   - User manages their data
   - Platform doesn't touch user's database

3. **Optional Cleanup**: If user wants platform to clean their DB
   - Add option: "Delete application data on deployment deletion"
   - Only if user explicitly requests it
   - Requires DATABASE_URL to be set

**Implementation**:
```javascript
// On deployment deletion
async function deleteDeployment(deploymentId, options = {}) {
    // 1. Clean platform data (automatic)
    await Deployment.findByIdAndDelete(deploymentId);
    await cleanupNginxConfig(deploymentId);
    await cleanupPM2Process(deploymentId);
    
    // 2. Optional: Clean user's database (if requested)
    if (options.cleanUserDatabase && project.environmentVariables?.DATABASE_URL) {
        await cleanupUserDatabase(project.environmentVariables.DATABASE_URL);
    }
    
    // 3. Clean build files (automatic)
    await cleanupBuildFiles(deploymentId);
}
```

---

## 3. Template Resource Limits (Admin Configurable)

### ✅ Admin Sets Limits Per Template

**Template Model** (`backend/models/Template.js`):
```javascript
resourceLimits: {
    maxListings: Number,        // null = unlimited (user uses their DB)
    maxImageSize: Number,        // in MB (default: 5MB)
    maxImageResolution: {
        width: Number,           // default: 1920px
        height: Number           // default: 1080px
    },
    maxStoragePerProject: Number, // in MB (default: 100MB)
    maxFilesPerProject: Number   // default: 1000
}
```

**How It Works**:
1. **Admin creates template** → Sets resource limits
2. **User deploys template** → Limits enforced
3. **User uses their own DB** → Unlimited listings (offloaded)
4. **Platform enforces limits** → Prevents server exhaustion

**Example**:
```javascript
Template {
    name: "Ecommerce Starter",
    resourceLimits: {
        maxListings: null,        // Unlimited (user's DB)
        maxImageSize: 5,          // 5MB max per image
        maxImageResolution: {
            width: 1920,
            height: 1080
        },
        maxStoragePerProject: 100 // 100MB total storage
    }
}
```

---

## 4. Image Size & Resolution Limits

### ✅ Validation Middleware

**Create**: `backend/middleware/imageValidation.js`
```javascript
const multer = require('multer');
const sharp = require('sharp');

function createImageValidator(template) {
    const limits = template.resourceLimits || {};
    
    return multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: (limits.maxImageSize || 5) * 1024 * 1024 // MB to bytes
        },
        fileFilter: async (req, file, cb) => {
            // Check file type
            if (!file.mimetype.startsWith('image/')) {
                return cb(new Error('Only image files allowed'));
            }
            
            // Check resolution
            try {
                const metadata = await sharp(file.buffer).metadata();
                const maxWidth = limits.maxImageResolution?.width || 1920;
                const maxHeight = limits.maxImageResolution?.height || 1080;
                
                if (metadata.width > maxWidth || metadata.height > maxHeight) {
                    return cb(new Error(
                        `Image resolution too large. Max: ${maxWidth}x${maxHeight}px`
                    ));
                }
                
                // Resize if needed (optional - auto-resize)
                if (metadata.width > maxWidth || metadata.height > maxHeight) {
                    file.buffer = await sharp(file.buffer)
                        .resize(maxWidth, maxHeight, { fit: 'inside' })
                        .toBuffer();
                }
                
                cb(null, true);
            } catch (error) {
                cb(new Error('Invalid image file'));
            }
        }
    });
}
```

**Usage in Routes**:
```javascript
router.post('/projects/:id/upload', 
    requireAuth,
    async (req, res) => {
        const project = await Project.findById(req.params.id);
        const template = await Template.findById(project.metadata?.deployedFromTemplate);
        
        const upload = createImageValidator(template);
        upload.single('image')(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }
            // Process image...
        });
    }
);
```

---

## 5. Resource Management Architecture

### ✅ Three-Tier Strategy

```
┌─────────────────────────────────────────────────────────┐
│              Platform Resources (Our Server)             │
│  (Limited - Protected by Template Limits)                │
├─────────────────────────────────────────────────────────┤
│  • Build files (temporary)                               │
│  • Deployment artifacts (limited by maxStoragePerProject)│
│  • Static assets (limited by maxFilesPerProject)         │
│  • Images (limited by maxImageSize & resolution)         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│           User's Database (User's Infrastructure)       │
│  (Unlimited - Offloaded from Platform)                   │
├─────────────────────────────────────────────────────────┤
│  • Listings/Products (unlimited if maxListings = null)   │
│  • User-generated content                                │
│  • Application data                                       │
│  • Connected via DATABASE_URL                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│        User's Storage (User's Infrastructure)            │
│  (Unlimited - Offloaded from Platform)                   │
├─────────────────────────────────────────────────────────┤
│  • Large files (via S3, Cloudinary, etc.)               │
│  • User uploads (via STORAGE_URL env var)                │
│  • Media files                                           │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Plan

### Phase 1: Template Limits (Admin UI)

**File**: `frontend/app/admin/templates/page.tsx`

Add "Resource Limits" tab:
- Max Listings (null = unlimited)
- Max Image Size (MB)
- Max Image Resolution (width x height)
- Max Storage Per Project (MB)
- Max Files Per Project

### Phase 2: Image Validation

**File**: `backend/middleware/imageValidation.js` (NEW)
- Validate image size
- Validate resolution
- Auto-resize if needed
- Enforce template limits

### Phase 3: Database Cleanup

**File**: `backend/routes/deployments.js`
- Add optional cleanup option
- Clean user's database if requested
- Clear platform data (automatic)

### Phase 4: Resource Enforcement

**File**: `backend/middleware/resourceLimits.js` (NEW)
- Check template limits
- Enforce on uploads
- Track usage per project
- Block if limits exceeded

---

## 7. Best Practices Summary

### ✅ Database
- **Platform**: MongoDB (our server)
- **User Apps**: MongoDB (user's infrastructure)
- **Why**: Consistency, scalability, familiarity

### ✅ Cleanup
- **Platform Data**: Automatic cleanup
- **User Database**: User's responsibility (optional platform cleanup)
- **Build Files**: Automatic cleanup

### ✅ Limits
- **Admin Sets**: Per-template limits
- **User's DB**: Unlimited listings (offloaded)
- **Platform Storage**: Limited (protected)
- **Images**: Size & resolution limits

### ✅ Resource Protection
- **Offload Heavy Operations**: Database, large files to user infrastructure
- **Limit Platform Resources**: Storage, files, images
- **Enforce Limits**: Middleware validation
- **Track Usage**: Monitor per project

---

## 8. Example: Ecommerce Template

**Template Configuration**:
```javascript
{
    name: "Ecommerce Starter",
    resourceLimits: {
        maxListings: null,           // Unlimited (user's MongoDB)
        maxImageSize: 5,             // 5MB per image
        maxImageResolution: {
            width: 1920,
            height: 1080
        },
        maxStoragePerProject: 100,   // 100MB platform storage
        maxFilesPerProject: 1000     // 1000 files max
    },
    environmentVariables: [
        {
            key: "DATABASE_URL",
            description: "MongoDB connection URL (your own database)",
            isRequired: false
        },
        {
            key: "STORAGE_URL",
            description: "S3/Cloudinary URL for large files (optional)",
            isRequired: false
        }
    ]
}
```

**User Deployment**:
- Connects their MongoDB → Unlimited products/listings
- Uses their storage → Unlimited file storage
- Platform enforces → Image size/resolution limits
- Platform tracks → Storage usage (100MB limit)

**Result**:
- ✅ User gets unlimited listings (their DB)
- ✅ User gets unlimited storage (their infrastructure)
- ✅ Platform protected (limited resources)
- ✅ Server not exhausted

---

## Status

✅ **Solution Designed**:
- ✅ MongoDB for user apps (same as platform)
- ✅ Template limits (admin configurable)
- ✅ Image validation (size & resolution)
- ✅ Smart cleanup (platform auto, user optional)
- ✅ Resource offloading (user infrastructure)

**Ready for Implementation**: ✅ Yes
