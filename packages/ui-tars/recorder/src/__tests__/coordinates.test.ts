/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';

import { resolveCoordinates } from '../utils/coordinates';

describe('resolveCoordinates', () => {
  it('should resolve a centered box to screen coordinates', () => {
    // Box [0.5, 0.5, 0.5, 0.5] is center in [0..1] space
    // Screen 1920x1080 → center pixel (960, 540)
    const result = resolveCoordinates('[0.5, 0.5, 0.5, 0.5]', 1920, 1080);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(960, 0);
    expect(result!.y).toBeCloseTo(540, 0);
  });

  it('should resolve origin [0,0,0,0] to (0, 0)', () => {
    const result = resolveCoordinates('[0,0,0,0]', 1920, 1080);
    expect(result).not.toBeNull();
    expect(result!.x).toBe(0);
    expect(result!.y).toBe(0);
  });

  it('should resolve maximum [1,1,1,1] to screen edges', () => {
    const result = resolveCoordinates('[1,1,1,1]', 1920, 1080);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(1920, 0);
    expect(result!.y).toBeCloseTo(1080, 0);
  });

  it('should compute center for a rectangular box', () => {
    // Box [0.2, 0.3, 0.4, 0.5] → center (0.3, 0.4)
    // Scaled: 0.3 * 1920 = 576, 0.4 * 1080 = 432
    const result = resolveCoordinates('[0.2,0.3,0.4,0.5]', 1920, 1080);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(576, 0);
    expect(result!.y).toBeCloseTo(432, 0);
  });

  it('should handle two-coordinate box (point)', () => {
    // Box [0.5, 0.25] → treated as [0.5, 0.25, 0.5, 0.25]
    const result = resolveCoordinates('[0.5,0.25]', 1920, 1080);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(960, 0);
    expect(result!.y).toBeCloseTo(270, 0);
  });

  it('should return null for empty string', () => {
    expect(resolveCoordinates('', 1920, 1080)).toBeNull();
  });

  it('should return null for invalid coordinates', () => {
    expect(resolveCoordinates('[abc,def]', 1920, 1080)).toBeNull();
  });

  it('should respect custom factors', () => {
    // With factor [1, 1] the coords are treated as raw pixel values (0..1 range)
    const result = resolveCoordinates('[0.5,0.5,0.5,0.5]', 1920, 1080, [1, 1]);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(960, 0);
    expect(result!.y).toBeCloseTo(540, 0);
  });

  it('should return null for array with only 1 element', () => {
    expect(resolveCoordinates('[0.5]', 1920, 1080)).toBeNull();
  });
});
