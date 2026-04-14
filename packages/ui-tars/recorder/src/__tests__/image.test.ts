/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

import { cropScreenshot } from '../utils/image';

/** Create a solid-color PNG of given dimensions and return as base64. */
async function createTestImage(width: number, height: number): Promise<string> {
  const buffer = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .png()
    .toBuffer();
  return buffer.toString('base64');
}

describe('cropScreenshot', () => {
  it('should crop a region around the center point', async () => {
    const base64 = await createTestImage(200, 200);
    const result = await cropScreenshot(base64, { x: 100, y: 100 }, 1, 50);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(50);
  });

  it('should clamp to image boundaries at top-left corner', async () => {
    const base64 = await createTestImage(200, 200);
    const result = await cropScreenshot(base64, { x: 0, y: 0 }, 1, 100);

    const meta = await sharp(result).metadata();
    // left = max(0, 0-50) = 0, so region starts at 0 and extends 100px
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it('should clamp to image boundaries at bottom-right corner', async () => {
    const base64 = await createTestImage(200, 200);
    const result = await cropScreenshot(base64, { x: 190, y: 190 }, 1, 100);

    const meta = await sharp(result).metadata();
    // left = max(0, 190-50)=140, width = min(100, 200-140) = 60
    expect(meta.width!).toBeLessThanOrEqual(100);
    expect(meta.height!).toBeLessThanOrEqual(100);
    expect(meta.width!).toBeGreaterThan(0);
    expect(meta.height!).toBeGreaterThan(0);
  });

  it('should apply scaleFactor to the coordinates', async () => {
    const base64 = await createTestImage(400, 400);
    // Point at (50, 50) with scaleFactor 2 → actual (100, 100)
    const result = await cropScreenshot(base64, { x: 50, y: 50 }, 2, 80);

    expect(result).toBeInstanceOf(Buffer);
    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(80);
    expect(meta.height).toBe(80);
  });

  it('should default cropSize to 100', async () => {
    const base64 = await createTestImage(300, 300);
    const result = await cropScreenshot(base64, { x: 150, y: 150 }, 1);

    const meta = await sharp(result).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it('should handle cropSize = 0 by clamping to minimum 1', async () => {
    const base64 = await createTestImage(200, 200);
    const result = await cropScreenshot(base64, { x: 100, y: 100 }, 1, 0);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);

    const meta = await sharp(result).metadata();
    expect(meta.width).toBeGreaterThanOrEqual(1);
    expect(meta.height).toBeGreaterThanOrEqual(1);
  });
});
