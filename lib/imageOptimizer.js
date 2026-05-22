const sharp = require("sharp")

/**
 * Resizes and compresses an image to WebP format.
 * If the input is not a valid image, it falls back to returning the original buffer.
 * @param {Buffer} buffer - Original image buffer
 * @param {number} maxWidth - Maximum width (default: 1200)
 * @param {number} quality - WebP compression quality (default: 80)
 * @returns {Promise<Buffer>} Optimized image buffer
 */
async function optimizeImage(buffer, maxWidth = 1200, quality = 80) {
  if (!buffer) return buffer
  try {
    return await sharp(buffer)
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
        fit: "inside"
      })
      .webp({ quality })
      .toBuffer()
  } catch (error) {
    console.error("Error optimizing image with sharp:", error)
    return buffer
  }
}

module.exports = {
  optimizeImage
}
