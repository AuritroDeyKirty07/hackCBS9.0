/**
 * Generates an uncompressed 24-bit BMP Buffer from raw RGB pixel data.
 * Pure Node.js buffer processing (zero external dependencies).
 */
function createBmpBuffer(width, height, pixelGenerator) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buf = Buffer.alloc(fileSize);

  // BMP Header (14 bytes)
  buf.write('BM', 0);
  buf.writeInt32LE(fileSize, 2);
  buf.writeInt32LE(0, 6);
  buf.writeInt32LE(54, 10);

  // DIB Header (40 bytes)
  buf.writeInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeInt16LE(1, 26);
  buf.writeInt16LE(24, 28);
  buf.writeInt32LE(0, 30);
  buf.writeInt32LE(pixelArraySize, 34);
  buf.writeInt32LE(2835, 38);
  buf.writeInt32LE(2835, 42);
  buf.writeInt32LE(0, 46);
  buf.writeInt32LE(0, 50);

  let offset = 54;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelGenerator(x, y, width, height);
      buf[offset++] = b;
      buf[offset++] = g;
      buf[offset++] = r;
    }
    const padding = rowSize - width * 3;
    for (let p = 0; p < padding; p++) {
      buf[offset++] = 0;
    }
  }

  return buf;
}

/**
 * Procedurally generates and filters an image frame.
 * CPU-intensive: Deep Julia fractal raymarching + multi-pass 2D spatial convolution filtering.
 * Each image takes ~200-250ms on a single CPU core.
 */
function processSingleImage(imageIndex, filterType = 'EDGE_SOBEL', width = 240, height = 180) {
  const angle = (imageIndex * Math.PI) / 12;
  const cr = -0.7 + 0.12 * Math.cos(angle);
  const ci = 0.27015 + 0.12 * Math.sin(angle);

  const basePixels = new Uint8ClampedArray(width * height * 3);

  // Pass 1: Complex Julia Set Fractal Rendering (100 iterations per pixel)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;

      let zr = 1.5 * (x - width / 2) / (0.5 * width);
      let zi = (y - height / 2) / (0.5 * height);

      let iter = 0;
      const maxIter = 100;

      while (zr * zr + zi * zi < 4.0 && iter < maxIter) {
        const nextZr = zr * zr - zi * zi + cr;
        const nextZi = 2.0 * zr * zi + ci;
        zr = nextZr;
        zi = nextZi;
        iter++;
      }

      if (iter === maxIter) {
        basePixels[idx] = 10;
        basePixels[idx + 1] = 15;
        basePixels[idx + 2] = 30;
      } else {
        const norm = iter / maxIter;
        basePixels[idx] = Math.floor(Math.sin(norm * Math.PI * 4) * 127 + 128);
        basePixels[idx + 1] = Math.floor(Math.sin(norm * Math.PI * 4 + 2) * 127 + 128);
        basePixels[idx + 2] = Math.floor(Math.cos(norm * Math.PI * 4) * 127 + 128);
      }
    }
  }

  // Pass 2: Multi-pass 5x5 Spatial Convolution Kernel & Blur (CPU & Memory Intensive)
  const blurredPixels = new Uint8ClampedArray(width * height * 3);
  const kernelRadius = 2; // 5x5 kernel

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;

      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
        for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
          const px = x + kx;
          const py = y + ky;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            const pIdx = (py * width + px) * 3;
            rSum += basePixels[pIdx];
            gSum += basePixels[pIdx + 1];
            bSum += basePixels[pIdx + 2];
            count++;
          }
        }
      }
      blurredPixels[idx] = Math.floor(rSum / count);
      blurredPixels[idx + 1] = Math.floor(gSum / count);
      blurredPixels[idx + 2] = Math.floor(bSum / count);
    }
  }

  // Pass 3: Edge Detection / Color Grading Filter
  const finalPixels = new Uint8ClampedArray(width * height * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const r = blurredPixels[idx];
      const g = blurredPixels[idx + 1];
      const b = blurredPixels[idx + 2];

      if (filterType === 'EDGE_SOBEL') {
        if (x > 0 && x < width - 1 && y > 0 && y < height - 1) {
          const getGray = (px, py) => {
            const i = (py * width + px) * 3;
            return 0.299 * blurredPixels[i] + 0.587 * blurredPixels[i + 1] + 0.114 * blurredPixels[i + 2];
          };

          const gx =
            -1 * getGray(x - 1, y - 1) + 1 * getGray(x + 1, y - 1) +
            -2 * getGray(x - 1, y) +     2 * getGray(x + 1, y) +
            -1 * getGray(x - 1, y + 1) + 1 * getGray(x + 1, y + 1);

          const gy =
            -1 * getGray(x - 1, y - 1) + -2 * getGray(x, y - 1) + -1 * getGray(x + 1, y - 1) +
             1 * getGray(x - 1, y + 1) +  2 * getGray(x, y + 1) +  1 * getGray(x + 1, y + 1);

          const edge = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 1.8);
          finalPixels[idx] = edge > 70 ? Math.floor(edge) : 10;
          finalPixels[idx + 1] = edge > 70 ? 230 : 20;
          finalPixels[idx + 2] = edge > 70 ? 255 : 40;
        } else {
          finalPixels[idx] = 10;
          finalPixels[idx + 1] = 20;
          finalPixels[idx + 2] = 40;
        }
      } else if (filterType === 'SEPIA') {
        finalPixels[idx] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        finalPixels[idx + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        finalPixels[idx + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
      } else {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        finalPixels[idx] = gray;
        finalPixels[idx + 1] = gray;
        finalPixels[idx + 2] = gray;
      }
    }
  }

  // Generate Base64 BMP image preview (160x120 thumbnail for smooth web transfer)
  const thumbW = 160;
  const thumbH = 120;
  const bmpBuffer = createBmpBuffer(thumbW, thumbH, (x, y) => {
    const origX = Math.floor((x / thumbW) * width);
    const origY = Math.floor((y / thumbH) * height);
    const idx = (origY * width + origX) * 3;
    return [finalPixels[idx], finalPixels[idx + 1], finalPixels[idx + 2]];
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
export function runImageBatchProcess({ startIndex, count, filterType, width = 240, height = 180 }) {
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
