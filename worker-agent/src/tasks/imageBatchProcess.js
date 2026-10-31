/**
 * Generates an uncompressed 24-bit BMP Buffer from raw RGB pixel data.
 * Zero external dependencies.
 */
function createBmpBuffer(width, height, pixelGenerator) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buf = Buffer.alloc(fileSize);

  // --- BMP Header (14 bytes) ---
  buf.write('BM', 0); // Signature
  buf.writeInt32LE(fileSize, 2); // File size
  buf.writeInt32LE(0, 6); // Reserved
  buf.writeInt32LE(54, 10); // Offset to pixel data

  // --- DIB Header (BITMAPINFOHEADER - 40 bytes) ---
  buf.writeInt32LE(40, 14); // Header size
  buf.writeInt32LE(width, 18); // Width
  buf.writeInt32LE(height, 22); // Height (positive = bottom-to-top)
  buf.writeInt16LE(1, 26); // Color planes
  buf.writeInt16LE(24, 28); // Bits per pixel (24-bit RGB)
  buf.writeInt32LE(0, 30); // Compression (0 = none)
  buf.writeInt32LE(pixelArraySize, 34); // Image size
  buf.writeInt32LE(2835, 38); // Horizontal resolution (72 DPI)
  buf.writeInt32LE(2835, 42); // Vertical resolution (72 DPI)
  buf.writeInt32LE(0, 46); // Color palette size
  buf.writeInt32LE(0, 50); // Important colors

  // --- Pixel Data (BGR format, bottom-to-top rows) ---
  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelGenerator(x, y, width, height);
      buf[offset++] = b; // Blue
      buf[offset++] = g; // Green
      buf[offset++] = r; // Red
    }
    // Padding to 4-byte boundary
    const padding = rowSize - width * 3;
    for (let p = 0; p < padding; p++) {
      buf[offset++] = 0;
    }
  }

  return buf;
}

/**
 * Procedurally generates and filters an image frame.
 * Applies multi-pass rendering (Mandelbrot/plasma/waves) and convolution filters (Sobel Edge, Sepia, Grayscale, etc.)
 */
function processSingleImage(imageIndex, filterType = 'EDGE_SOBEL', width = 160, height = 120) {
  const seed = (imageIndex + 1) * 137.5;

  // 1. Procedural generation (e.g. dynamic waves / plasma / fractals)
  const basePixels = new Uint8ClampedArray(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const nx = x / width;
      const ny = y / height;

      // Complex trigonometric plasma calculation (CPU-intensive)
      let v1 = Math.sin(nx * 10 + seed * 0.05);
      let v2 = Math.sin(10 * (nx * Math.sin(seed / 2) + ny * Math.cos(seed / 3)) + seed);
      let cx = nx + 0.5 * Math.sin(seed / 5);
      let cy = ny + 0.5 * Math.cos(seed / 3);
      let v3 = Math.sin(Math.sqrt(100 * (cx * cx + cy * cy) + 1) + seed);
      let v = (v1 + v2 + v3) / 3;

      basePixels[idx] = Math.floor(Math.sin(v * Math.PI) * 127 + 128); // R
      basePixels[idx + 1] = Math.floor(Math.cos(v * Math.PI) * 127 + 128); // G
      basePixels[idx + 2] = Math.floor(Math.sin(v * Math.PI + (2 * Math.PI) / 3) * 127 + 128); // B
    }
  }

  // 2. Multi-pass image filter & convolution kernel
  const processedPixels = new Uint8ClampedArray(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const r = basePixels[idx];
      const g = basePixels[idx + 1];
      const b = basePixels[idx + 2];

      if (filterType === 'EDGE_SOBEL') {
        // Sobel edge detection kernel
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          const getGray = (px, py) => {
            const i = (py * width + px) * 3;
            return 0.299 * basePixels[i] + 0.587 * basePixels[i + 1] + 0.114 * basePixels[i + 2];
          };

          const gx =
            -1 * getGray(x - 1, y - 1) +
            1 * getGray(x + 1, y - 1) +
            -2 * getGray(x - 1, y) +
            2 * getGray(x + 1, y) +
            -1 * getGray(x - 1, y + 1) +
            1 * getGray(x + 1, y + 1);

          const gy =
            -1 * getGray(x - 1, y - 1) +
            -2 * getGray(x, y - 1) +
            -1 * getGray(x + 1, y - 1) +
            1 * getGray(x - 1, y + 1) +
            2 * getGray(x, y + 1) +
            1 * getGray(x + 1, y + 1);

          const edge = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 1.5);
          processedPixels[idx] = edge > 80 ? 0 : 255;
          processedPixels[idx + 1] = edge > 80 ? Math.floor(edge) : 255;
          processedPixels[idx + 2] = edge > 80 ? 255 : 255;
        } else {
          processedPixels[idx] = 255;
          processedPixels[idx + 1] = 255;
          processedPixels[idx + 2] = 255;
        }
      } else if (filterType === 'SEPIA') {
        processedPixels[idx] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        processedPixels[idx + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        processedPixels[idx + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      } else {
        // Grayscale / Invert
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        processedPixels[idx] = 255 - gray;
        processedPixels[idx + 1] = 255 - gray;
        processedPixels[idx + 2] = 255 - gray;
      }
    }
  }

  // Generate Base64 BMP image preview
  const bmpBuffer = createBmpBuffer(width, height, (x, y) => {
    const idx = (y * width + x) * 3;
    return [processedPixels[idx], processedPixels[idx + 1], processedPixels[idx + 2]];
  });

  return {
    imageIndex,
    previewUrl: `data:image/bmp;base64,${bmpBuffer.toString('base64')}`,
    pixelsProcessed: width * height,
  };
}

/**
 * Task handler for IMAGE_BATCH_PROCESS
 */
export function runImageBatchProcess({ startIndex, count, filterType, width = 160, height = 120 }) {
  const images = [];
  let totalPixels = 0;

  for (let i = 0; i < count; i++) {
    const imgIdx = startIndex + i;
    const res = processSingleImage(imgIdx, filterType || 'EDGE_SOBEL', width, height);
    images.push(res);
    totalPixels += res.pixelsProcessed;
  }

  return {
    images,
    processedCount: count,
    totalPixels,
  };
}
