/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RecordedAction {
  type: NormalizedActionType;
  timestamp: number;
  coordinates?: { x: number; y: number };
  endCoordinates?: { x: number; y: number };
  text?: string;
  key?: string;
  direction?: string;
  content?: string;
  screenshotIndex: number;
  screenDimensions: { width: number; height: number };
  scaleFactor: number;
}

export type NormalizedActionType =
  | 'click'
  | 'right_click'
  | 'double_click'
  | 'type'
  | 'hotkey'
  | 'press'
  | 'release'
  | 'scroll'
  | 'drag'
  | 'wait'
  | 'finished'
  | 'call_user';

export interface RecordingSession {
  id: string;
  instruction: string;
  startTime: number;
  endTime?: number;
  status: SessionStatus;
  actions: RecordedAction[];
  screenshots: Map<number, string>;
}

export type SessionStatus =
  | 'recording'
  | 'completed'
  | 'error'
  | 'user_stopped'
  | 'call_user';

export interface ExportOptions {
  cropSize?: number;
  waitMs?: number;
  searchTolerance?: number;
  sleepBetweenActions?: number;
}

export interface ExportResult {
  scriptContent: string;
  assets: Map<string, Buffer>;
}

export const ACTION_ALIAS_MAP: Record<string, NormalizedActionType> = {
  click: 'click',
  left_single: 'click',
  right_click: 'right_click',
  right_single: 'right_click',
  double_click: 'double_click',
  left_double: 'double_click',
  type: 'type',
  hotkey: 'hotkey',
  press: 'press',
  release: 'release',
  scroll: 'scroll',
  drag: 'drag',
  wait: 'wait',
  finished: 'finished',
  call_user: 'call_user',
};
