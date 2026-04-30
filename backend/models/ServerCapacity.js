const mongoose = require('mongoose');

/**
 * Server Capacity Schema
 * Tracks total resources and limits to prevent overselling
 */
const serverCapacitySchema = new mongoose.Schema({
    serverName: {
        type: String,
        required: true,
        unique: true
        // No enum – supports any dynamically-added server key (EC2, EC3, EC4 …)
    },

    // Total physical resources
    totalResources: {
        cpu: {
            type: Number,
            required: true, // Total OCPU cores
            default: 4
        },
        ram: {
            type: Number,
            required: true, // Total GB RAM
            default: 24
        },
        storage: {
            type: Number,
            required: true, // Total GB storage
            default: 200
        },
        bandwidth: {
            type: Number,
            required: true, // Total GB/month
            default: 5000
        }
    },

    // Reserved for system/admin use
    reservedResources: {
        cpu: {
            type: Number,
            default: 0.5 // System overhead
        },
        ram: {
            type: Number,
            default: 2 // System overhead
        },
        storage: {
            type: Number,
            default: 20 // System files
        },
        bandwidth: {
            type: Number,
            default: 500
        }
    },

    // Current allocation
    allocatedResources: {
        cpu: {
            type: Number,
            default: 0
        },
        ram: {
            type: Number,
            default: 0
        },
        storage: {
            type: Number,
            default: 0
        },
        bandwidth: {
            type: Number,
            default: 0
        }
    },

    // Global limits per plan type
    planLimits: [{
        planName: String,        // 'free', 'pro', 'enterprise'
        maxUsers: {
            type: Number,
            default: -1            // -1 = unlimited
        },
        currentUsers: {
            type: Number,
            default: 0
        },
        priority: {
            type: Number,
            default: 5             // Higher priority = allocated first
        }
    }],

    // Overselling settings
    overselling: {
        enabled: {
            type: Boolean,
            default: false
        },
        cpuMultiplier: {
            type: Number,
            default: 1.0,          // 1.5 = allow 150% allocation
            min: 1.0,
            max: 3.0
        },
        ramMultiplier: {
            type: Number,
            default: 1.0,
            min: 1.0,
            max: 2.0
        }
    },

    // Warning thresholds
    warningThresholds: {
        cpu: {
            type: Number,
            default: 80            // % usage
        },
        ram: {
            type: Number,
            default: 85
        },
        storage: {
            type: Number,
            default: 90
        }
    },

    isActive: {
        type: Boolean,
        default: true
    },

    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Calculate available resources
serverCapacitySchema.virtual('availableResources').get(function () {
    const multiplier = this.overselling.enabled ? this.overselling.cpuMultiplier : 1.0;
    const ramMultiplier = this.overselling.enabled ? this.overselling.ramMultiplier : 1.0;

    return {
        cpu: (this.totalResources.cpu * multiplier) - this.reservedResources.cpu - this.allocatedResources.cpu,
        ram: (this.totalResources.ram * ramMultiplier) - this.reservedResources.ram - this.allocatedResources.ram,
        storage: this.totalResources.storage - this.reservedResources.storage - this.allocatedResources.storage,
        bandwidth: this.totalResources.bandwidth - this.reservedResources.bandwidth - this.allocatedResources.bandwidth
    };
});

// Calculate usage percentages
serverCapacitySchema.virtual('usagePercentage').get(function () {
    return {
        cpu: (this.allocatedResources.cpu / this.totalResources.cpu * 100).toFixed(1),
        ram: (this.allocatedResources.ram / this.totalResources.ram * 100).toFixed(1),
        storage: (this.allocatedResources.storage / this.totalResources.storage * 100).toFixed(1),
        bandwidth: (this.allocatedResources.bandwidth / this.totalResources.bandwidth * 100).toFixed(1)
    };
});

// Check if resource allocation is possible
serverCapacitySchema.methods.canAllocate = function (resourceRequirements) {
    const available = this.availableResources;

    return {
        canAllocate: (
            available.cpu >= resourceRequirements.cpu &&
            available.ram >= resourceRequirements.ram &&
            available.storage >= resourceRequirements.storage &&
            available.bandwidth >= resourceRequirements.bandwidth
        ),
        available,
        required: resourceRequirements,
        shortfall: {
            cpu: Math.max(0, resourceRequirements.cpu - available.cpu),
            ram: Math.max(0, resourceRequirements.ram - available.ram),
            storage: Math.max(0, resourceRequirements.storage - available.storage),
            bandwidth: Math.max(0, resourceRequirements.bandwidth - available.bandwidth)
        }
    };
};

// Allocate resources
serverCapacitySchema.methods.allocate = function (resources) {
    this.allocatedResources.cpu += resources.cpu;
    this.allocatedResources.ram += resources.ram;
    this.allocatedResources.storage += resources.storage;
    this.allocatedResources.bandwidth += resources.bandwidth;
    this.lastUpdated = new Date();
    return this.save();
};

// Deallocate resources
serverCapacitySchema.methods.deallocate = function (resources) {
    this.allocatedResources.cpu = Math.max(0, this.allocatedResources.cpu - resources.cpu);
    this.allocatedResources.ram = Math.max(0, this.allocatedResources.ram - resources.ram);
    this.allocatedResources.storage = Math.max(0, this.allocatedResources.storage - resources.storage);
    this.allocatedResources.bandwidth = Math.max(0, this.allocatedResources.bandwidth - resources.bandwidth);
    this.lastUpdated = new Date();
    return this.save();
};

// Get warnings
serverCapacitySchema.methods.getWarnings = function () {
    const usage = this.usagePercentage;
    const warnings = [];

    if (parseFloat(usage.cpu) >= this.warningThresholds.cpu) {
        warnings.push({ type: 'cpu', level: 'warning', message: `CPU usage at ${usage.cpu}%` });
    }
    if (parseFloat(usage.ram) >= this.warningThresholds.ram) {
        warnings.push({ type: 'ram', level: 'warning', message: `RAM usage at ${usage.ram}%` });
    }
    if (parseFloat(usage.storage) >= this.warningThresholds.storage) {
        warnings.push({ type: 'storage', level: 'critical', message: `Storage usage at ${usage.storage}%` });
    }

    return warnings;
};

// Static method to calculate capacity for plan
serverCapacitySchema.statics.calculatePlanCapacity = async function (serverName, planResources) {
    const server = await this.findOne({ serverName, isActive: true });
    if (!server) return { error: 'Server not found' };

    const available = server.availableResources;

    // Calculate max users that can fit
    const maxUsers = {
        byCpu: Math.floor(available.cpu / planResources.cpu),
        byRam: Math.floor(available.ram / planResources.ram),
        byStorage: Math.floor(available.storage / planResources.storage),
        byBandwidth: Math.floor(available.bandwidth / planResources.bandwidth)
    };

    // Limiting factor
    const maxPossible = Math.min(
        maxUsers.byCpu,
        maxUsers.byRam,
        maxUsers.byStorage,
        maxUsers.byBandwidth
    );

    return {
        success: true,
        maxUsers: maxPossible,
        limitedBy: Object.keys(maxUsers).find(key => maxUsers[key] === maxPossible),
        breakdown: maxUsers,
        available,
        planResources
    };
};

module.exports = mongoose.model('ServerCapacity', serverCapacitySchema);
