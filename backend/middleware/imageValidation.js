/**
 * Image Validation Middleware
 * 
 * Validates image uploads based on template resource limits:
 * - Max image size (MB)
 * - Max image resolution (width x height)
 * - Auto-resize if needed
 */

const multer = require('multer');
const sharp = require('sharp');

/**
 * Create image validator based on template limits
 * @param {Object} template - Template document with resourceLimits
 * @returns {multer.Multer} Configured multer instance
 */
function createImageValidator(template) {
    const limits = template?.resourceLimits || {};
    const maxSizeMB = limits.maxImageSize || 5; // Default 5MB
    const maxWidth = limits.maxImageResolution?.width || 1920;
    const maxHeight = limits.maxImageResolution?.height || 1080;

    return multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: maxSizeMB * 1024 * 1024 // Convert MB to bytes
        },
        fileFilter: async (req, file, cb) => {
            // Check file type
            if (!file.mimetype.startsWith('image/')) {
                return cb(new Error(`Only image files allowed. Received: ${file.mimetype}`));
            }

            // Validate image format
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!allowedTypes.includes(file.mimetype)) {
                return cb(new Error(`Image type not allowed. Allowed: ${allowedTypes.join(', ')}`));
            }

            cb(null, true);
        }
    });
}

/**
 * Validate and optionally resize image
 * @param {Buffer} imageBuffer - Image file buffer
 * @param {Object} limits - Resource limits from template
 * @returns {Promise<{buffer: Buffer, metadata: Object}>} Processed image
 */
async function validateAndResizeImage(imageBuffer, limits = {}) {
    const maxWidth = limits.maxImageResolution?.width || 1920;
    const maxHeight = limits.maxImageResolution?.height || 1080;
    const maxSizeMB = limits.maxImageSize || 5;

    try {
        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();

        // Check resolution
        if (metadata.width > maxWidth || metadata.height > maxHeight) {
            // Auto-resize to fit within limits (maintain aspect ratio)
            const resizedBuffer = await sharp(imageBuffer)
                .resize(maxWidth, maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 85 }) // Convert to JPEG for smaller size
                .toBuffer();

            // Check final size
            const finalSizeMB = resizedBuffer.length / (1024 * 1024);
            if (finalSizeMB > maxSizeMB) {
                // Further compress if still too large
                const quality = Math.max(50, 85 - Math.ceil((finalSizeMB / maxSizeMB) * 20));
                return {
                    buffer: await sharp(resizedBuffer)
                        .jpeg({ quality })
                        .toBuffer(),
                    metadata: await sharp(resizedBuffer).metadata(),
                    resized: true
                };
            }

            return {
                buffer: resizedBuffer,
                metadata: await sharp(resizedBuffer).metadata(),
                resized: true
            };
        }

        // Check size without resizing
        const sizeMB = imageBuffer.length / (1024 * 1024);
        if (sizeMB > maxSizeMB) {
            // Compress to reduce size
            const quality = Math.max(50, 85 - Math.ceil((sizeMB / maxSizeMB) * 20));
            const compressedBuffer = await sharp(imageBuffer)
                .jpeg({ quality })
                .toBuffer();

            return {
                buffer: compressedBuffer,
                metadata: await sharp(compressedBuffer).metadata(),
                resized: false,
                compressed: true
            };
        }

        return {
            buffer: imageBuffer,
            metadata,
            resized: false,
            compressed: false
        };

    } catch (error) {
        throw new Error(`Image validation failed: ${error.message}`);
    }
}

/**
 * Express middleware to validate image uploads
 * @param {Object} template - Template document
 * @param {string} fieldName - Form field name (default: 'image')
 */
function imageUploadMiddleware(template, fieldName = 'image') {
    const upload = createImageValidator(template);

    return async (req, res, next) => {
        upload.single(fieldName)(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    success: false,
                    error: err.message
                });
            }

            if (!req.file) {
                return next();
            }

            try {
                // Validate and resize if needed
                const result = await validateAndResizeImage(
                    req.file.buffer,
                    template?.resourceLimits
                );

                // Replace file buffer with processed image
                req.file.buffer = result.buffer;
                req.file.size = result.buffer.length;
                req.file.processed = {
                    resized: result.resized,
                    compressed: result.compressed,
                    originalSize: req.file.size,
                    finalSize: result.buffer.length
                };

                next();
            } catch (error) {
                return res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        });
    };
}

module.exports = {
    createImageValidator,
    validateAndResizeImage,
    imageUploadMiddleware
};
