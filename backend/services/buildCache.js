const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const CACHE_DIR = process.env.BUILD_CACHE_DIR || '/tmp/build-cache';
const MAX_CACHE_SIZE_GB = 10; // Maximum cache size in GB

class BuildCache {
    constructor() {
        this.ensureCacheDir();
    }

    async ensureCacheDir() {
        try {
            await fs.mkdir(CACHE_DIR, { recursive: true });
        } catch (error) {
            console.error('Failed to create cache directory:', error);
        }
    }

    /**
     * Generate hash from package.json and lock files
     */
    async generateCacheKey(buildPath) {
        try {
            const packageJsonPath = path.join(buildPath, 'package.json');
            const packageJson = await fs.readFile(packageJsonPath, 'utf8');

            // Include lock file if exists
            let lockFileContent = '';
            const lockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];

            for (const lockFile of lockFiles) {
                try {
                    const lockPath = path.join(buildPath, lockFile);
                    lockFileContent = await fs.readFile(lockPath, 'utf8');
                    break;
                } catch {
                    // Lock file doesn't exist, continue
                }
            }

            // Create hash from package.json + lock file
            const hash = crypto
                .createHash('sha256')
                .update(packageJson + lockFileContent)
                .digest('hex');

            return hash;
        } catch (error) {
            console.error('Failed to generate cache key:', error);
            return null;
        }
    }

    /**
     * Check if cache exists for this package configuration
     */
    async hasCache(cacheKey) {
        if (!cacheKey) return false;

        try {
            const cachePath = path.join(CACHE_DIR, cacheKey);
            await fs.access(cachePath);

            // Verify node_modules exists in cache
            await fs.access(path.join(cachePath, 'node_modules'));

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Restore cached node_modules to build directory
     */
    async restoreCache(cacheKey, buildPath) {
        if (!cacheKey) return false;

        try {
            const cachePath = path.join(CACHE_DIR, cacheKey, 'node_modules');
            const targetPath = path.join(buildPath, 'node_modules');

            console.log(`📦 Restoring cache from ${cachePath}`);

            // Use cp -r for faster copy (rsync if available for even faster)
            try {
                // Try rsync first (faster)
                await execAsync(`rsync -a "${cachePath}/" "${targetPath}/"`);
                console.log('✓ Cache restored using rsync');
            } catch {
                // Fallback to cp
                await execAsync(`cp -r "${cachePath}" "${targetPath}"`);
                console.log('✓ Cache restored using cp');
            }

            // Update access time for LRU cleanup
            await fs.utimes(path.join(CACHE_DIR, cacheKey), new Date(), new Date());

            return true;
        } catch (error) {
            console.error('Failed to restore cache:', error);
            return false;
        }
    }

    /**
     * Save node_modules to cache
     */
    async saveCache(cacheKey, buildPath) {
        if (!cacheKey) return false;

        try {
            const sourcePath = path.join(buildPath, 'node_modules');
            const cachePath = path.join(CACHE_DIR, cacheKey);

            // Check if node_modules exists
            try {
                await fs.access(sourcePath);
            } catch {
                console.log('⚠ No node_modules to cache');
                return false;
            }

            // Create cache directory
            await fs.mkdir(cachePath, { recursive: true });

            console.log(`💾 Saving cache to ${cachePath}`);

            // Copy node_modules to cache
            try {
                // Try rsync first
                await execAsync(`rsync -a "${sourcePath}/" "${cachePath}/node_modules/"`);
                console.log('✓ Cache saved using rsync');
            } catch {
                // Fallback to cp
                await execAsync(`cp -r "${sourcePath}" "${cachePath}/node_modules"`);
                console.log('✓ Cache saved using cp');
            }

            // Cleanup old caches if needed
            await this.cleanupOldCaches();

            return true;
        } catch (error) {
            console.error('Failed to save cache:', error);
            return false;
        }
    }

    /**
     * Clean up old caches if total size exceeds limit
     */
    async cleanupOldCaches() {
        try {
            // Get all cache directories with their access times
            const caches = await fs.readdir(CACHE_DIR);
            const cacheStats = [];

            for (const cache of caches) {
                const cachePath = path.join(CACHE_DIR, cache);
                const stats = await fs.stat(cachePath);

                // Get directory size
                const { stdout } = await execAsync(`du -sb "${cachePath}"`);
                const size = parseInt(stdout.split('\t')[0]);

                cacheStats.push({
                    path: cachePath,
                    accessTime: stats.atime,
                    size
                });
            }

            // Calculate total size
            const totalSize = cacheStats.reduce((sum, c) => sum + c.size, 0);
            const maxSizeBytes = MAX_CACHE_SIZE_GB * 1024 * 1024 * 1024;

            if (totalSize > maxSizeBytes) {
                console.log(`🧹 Cache size (${(totalSize / 1024 / 1024 / 1024).toFixed(2)}GB) exceeds limit (${MAX_CACHE_SIZE_GB}GB), cleaning up...`);

                // Sort by access time (oldest first)
                cacheStats.sort((a, b) => a.accessTime - b.accessTime);

                // Remove oldest caches until under limit
                let currentSize = totalSize;
                for (const cache of cacheStats) {
                    if (currentSize <= maxSizeBytes) break;

                    console.log(`Removing old cache: ${path.basename(cache.path)}`);
                    await execAsync(`rm -rf "${cache.path}"`);
                    currentSize -= cache.size;
                }

                console.log(`✓ Cache cleanup complete. New size: ${(currentSize / 1024 / 1024 / 1024).toFixed(2)}GB`);
            }
        } catch (error) {
            console.error('Failed to cleanup old caches:', error);
        }
    }

    /**
     * Get cache statistics
     */
    async getCacheStats() {
        try {
            const caches = await fs.readdir(CACHE_DIR);
            let totalSize = 0;

            for (const cache of caches) {
                const cachePath = path.join(CACHE_DIR, cache);
                const { stdout } = await execAsync(`du -sb "${cachePath}"`);
                totalSize += parseInt(stdout.split('\t')[0]);
            }

            return {
                cacheCount: caches.length,
                totalSizeGB: (totalSize / 1024 / 1024 / 1024).toFixed(2),
                cacheDir: CACHE_DIR
            };
        } catch {
            return {
                cacheCount: 0,
                totalSizeGB: 0,
                cacheDir: CACHE_DIR
            };
        }
    }
}

module.exports = new BuildCache();
