/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import sharp from 'sharp';

/**
 * Crop a region around a point from a base64 screenshot.
 *
 * The point is expected in logical coordinates; it is scaled
 * by `scaleFactor` to match the physical pixel space of the image.
 */
export async function cropScreenshot(
  screenshotBase64: string,
  point: { x: number; y: number },
  scaleFactor: number,
  cropSize: number = 100,
): Promise<Buffer> {
  const imageBuffer = Buffer.from(screenshotBase64, 'base64');
  const metadata = await sharp(imageBuffer).metadata();
  const imgWidth = metadata.width ?? 0;
  const imgHeight = metadata.height ?? 0;

  const clampedCrop = Math.max(1, cropSize);
  const actualX = Math.round(point.x * scaleFactor);
  const actualY = Math.round(point.y * scaleFactor);

  const halfCrop = Math.round(clampedCrop / 2);

  let left = Math.max(0, actualX - halfCrop);
  let top = Math.max(0, actualY - halfCrop);
  let width = clampedCrop;
  let height = clampedCrop;

  if (left + width > imgWidth) {
    width = Math.max(1, imgWidth - left);
  }
  if (top + height > imgHeight) {
    height = Math.max(1, imgHeight - top);
  }

  const result = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return result;
}
