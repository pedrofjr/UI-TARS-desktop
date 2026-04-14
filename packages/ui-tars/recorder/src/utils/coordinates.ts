/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

export type Factors = [number, number];

const DEFAULT_FACTORS: Factors = [1000, 1000];

/**
 * Parse box string to screen coordinates.
 *
 * Reimplementation of parseBoxToScreenCoords from @ui-tars/sdk,
 * which is not publicly exported.
 *
 * @example
 *   resolveCoordinates('[0.131,0.25,0.131,0.25]', 2560, 1440)
 *   // => { x: 335.36, y: 360 }
 */
export function resolveCoordinates(
  startBox: string,
  screenWidth: number,
  screenHeight: number,
  factors: Factors = DEFAULT_FACTORS,
): { x: number; y: number } | null {
  if (!startBox) {
    return null;
  }

  const coords = startBox
    .replace('[', '')
    .replace(']', '')
    .split(',')
    .map((num) => parseFloat(num.trim()));

  if (coords.length < 2) return null;

  const [x1, y1, x2 = x1, y2 = y1] = coords;

  if (
    [x1, y1, x2, y2].some(
      (v) => v === undefined || v === null || Number.isNaN(v),
    )
  ) {
    return null;
  }

  const [widthFactor, heightFactor] = factors;

  return {
    x: Math.round(((x1 + x2) / 2) * screenWidth * widthFactor) / widthFactor,
    y: Math.round(((y1 + y2) / 2) * screenHeight * heightFactor) / heightFactor,
  };
}
