/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect, beforeEach } from 'vitest';

import type {
  GUIAgentData,
  Conversation,
  PredictionParsed,
} from '@ui-tars/shared/types';
import { StatusEnum } from '@ui-tars/shared/types';

import { ScriptRecorder } from '../recorder';

function makePrediction(
  actionType: string,
  inputs: PredictionParsed['action_inputs'] = {},
): PredictionParsed {
  return {
    action_type: actionType,
    action_inputs: inputs,
    reflection: null,
    thought: 'test thought',
  };
}

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    from: 'gpt' as const,
    value: '',
    ...overrides,
  };
}

function makeGUIAgentData(
  conversations: Conversation[],
  status: StatusEnum = StatusEnum.RUNNING,
): GUIAgentData {
  return {
    version: '2.0' as never,
    instruction: 'Test instruction',
    systemPrompt: '',
    modelName: 'test-model',
    logTime: Date.now(),
    status,
    conversations,
  };
}

describe('ScriptRecorder', () => {
  let recorder: ScriptRecorder;

  beforeEach(() => {
    recorder = new ScriptRecorder();
  });

  it('should start a session with correct initial state', () => {
    recorder.startSession('Do something');
    const session = recorder.getSession();

    expect(session).not.toBeNull();
    expect(session!.instruction).toBe('Do something');
    expect(session!.status).toBe('recording');
    expect(session!.actions).toHaveLength(0);
    expect(session!.screenshots.size).toBe(0);
    expect(session!.id).toBeTruthy();
  });

  it('should return null session before starting', () => {
    expect(recorder.getSession()).toBeNull();
  });

  it('should not export when status is not completed', () => {
    recorder.startSession('test');
    expect(recorder.canExport()).toBe(false);
  });

  it('should process a step with a click action', () => {
    recorder.startSession('Click test');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'human',
        value: '<image>',
        screenshotBase64: 'fakebase64',
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
      makeConversation({
        from: 'gpt',
        predictionParsed: [
          makePrediction('click', { start_box: '[0.5,0.5,0.5,0.5]' }),
        ],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));

    const session = recorder.getSession();
    expect(session!.actions).toHaveLength(1);
    expect(session!.actions[0]!.type).toBe('click');
    expect(session!.actions[0]!.coordinates).toBeDefined();
    expect(session!.actions[0]!.coordinates!.x).toBeCloseTo(960, 0);
    expect(session!.actions[0]!.coordinates!.y).toBeCloseTo(540, 0);
  });

  it('should normalize action type aliases', () => {
    recorder.startSession('Alias test');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [
          makePrediction('left_double', { start_box: '[0.1,0.1,0.1,0.1]' }),
          makePrediction('right_single', { start_box: '[0.2,0.2,0.2,0.2]' }),
          makePrediction('left_single', { start_box: '[0.3,0.3,0.3,0.3]' }),
        ],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));

    const session = recorder.getSession();
    expect(session!.actions).toHaveLength(3);
    expect(session!.actions[0]!.type).toBe('double_click');
    expect(session!.actions[1]!.type).toBe('right_click');
    expect(session!.actions[2]!.type).toBe('click');
  });

  it('should store screenshots from conversations', () => {
    recorder.startSession('Screenshot test');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'human',
        value: '<image>',
        screenshotBase64: 'screenshot_data_here',
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));

    const session = recorder.getSession();
    expect(session!.screenshots.get(0)).toBe('screenshot_data_here');
  });

  it('should update status to completed on END', () => {
    recorder.startSession('End test');
    recorder.processStep(makeGUIAgentData([], StatusEnum.END));

    const session = recorder.getSession();
    expect(session!.status).toBe('completed');
    expect(session!.endTime).toBeDefined();
    expect(recorder.canExport()).toBe(true);
  });

  it('should update status to error on ERROR', () => {
    recorder.startSession('Error test');
    recorder.processStep(makeGUIAgentData([], StatusEnum.ERROR));

    expect(recorder.getSession()!.status).toBe('error');
    expect(recorder.canExport()).toBe(false);
  });

  it('should update status to call_user on CALL_USER', () => {
    recorder.startSession('Call user test');
    recorder.processStep(makeGUIAgentData([], StatusEnum.CALL_USER));

    expect(recorder.getSession()!.status).toBe('call_user');
    expect(recorder.canExport()).toBe(false);
  });

  it('should update status to user_stopped on USER_STOPPED', () => {
    recorder.startSession('User stopped test');
    recorder.processStep(makeGUIAgentData([], StatusEnum.USER_STOPPED));

    expect(recorder.getSession()!.status).toBe('user_stopped');
    expect(recorder.canExport()).toBe(false);
  });

  it('should process multiple predictions in the same conversation', () => {
    recorder.startSession('Multi prediction');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [
          makePrediction('click', { start_box: '[0.1,0.1,0.1,0.1]' }),
          makePrediction('type', { content: 'hello world' }),
          makePrediction('hotkey', { key: 'ctrl+s' }),
        ],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 2,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));

    const session = recorder.getSession();
    expect(session!.actions).toHaveLength(3);
    expect(session!.actions[0]!.type).toBe('click');
    expect(session!.actions[1]!.type).toBe('type');
    expect(session!.actions[1]!.text).toBe('hello world');
    expect(session!.actions[2]!.type).toBe('hotkey');
    expect(session!.actions[2]!.key).toBe('ctrl+s');
  });

  it('should handle delta conversations across multiple calls', () => {
    recorder.startSession('Delta test');

    // First call: SDK sends only the first conversation (delta)
    const delta1: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [
          makePrediction('click', { start_box: '[0.1,0.1,0.1,0.1]' }),
        ],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(delta1, StatusEnum.RUNNING));
    expect(recorder.getSession()!.actions).toHaveLength(1);

    // Second call: SDK sends only the NEW conversation (delta, not accumulated)
    const delta2: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [makePrediction('type', { content: 'new text' })],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(delta2, StatusEnum.RUNNING));
    expect(recorder.getSession()!.actions).toHaveLength(2);
  });

  it('should clear session state', () => {
    recorder.startSession('Clear test');
    recorder.processStep(makeGUIAgentData([], StatusEnum.END));
    expect(recorder.getSession()).not.toBeNull();

    recorder.clear();
    expect(recorder.getSession()).toBeNull();
    expect(recorder.canExport()).toBe(false);
  });

  it('should ignore processStep when no session exists', () => {
    // Should not throw
    recorder.processStep(makeGUIAgentData([], StatusEnum.RUNNING));
    expect(recorder.getSession()).toBeNull();
  });

  it('should ignore unknown action types', () => {
    recorder.startSession('Unknown action test');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [makePrediction('unknown_action' as string, {})],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));
    expect(recorder.getSession()!.actions).toHaveLength(0);
  });

  it('should use start_coords when available (physical pixels / scaleFactor)', () => {
    recorder.startSession('Coords test');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [
          makePrediction('click', {
            start_box: '[0.5,0.5,0.5,0.5]',
            start_coords: [1920, 1080], // physical pixels at 2x scale
          }),
        ],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 2,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));

    const session = recorder.getSession();
    expect(session!.actions).toHaveLength(1);
    // start_coords [1920, 1080] / scaleFactor 2 = logical [960, 540]
    expect(session!.actions[0]!.coordinates!.x).toBe(960);
    expect(session!.actions[0]!.coordinates!.y).toBe(540);
  });

  it('should use end_coords when available for drag actions', () => {
    recorder.startSession('End coords test');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [
          makePrediction('drag', {
            start_box: '[0.1,0.1,0.1,0.1]',
            start_coords: [384, 216],
            end_box: '[0.9,0.9,0.9,0.9]',
            end_coords: [3456, 1944],
          }),
        ],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 2,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));

    const session = recorder.getSession();
    expect(session!.actions).toHaveLength(1);
    expect(session!.actions[0]!.coordinates!.x).toBe(192);
    expect(session!.actions[0]!.coordinates!.y).toBe(108);
    expect(session!.actions[0]!.endCoordinates!.x).toBe(1728);
    expect(session!.actions[0]!.endCoordinates!.y).toBe(972);
  });

  it('should fall back to start_box when start_coords is empty', () => {
    recorder.startSession('Fallback test');

    const conversations: Conversation[] = [
      makeConversation({
        from: 'gpt',
        predictionParsed: [
          makePrediction('click', {
            start_box: '[0.5,0.5,0.5,0.5]',
            start_coords: [], // empty — should fall back to start_box
          }),
        ],
        screenshotContext: {
          size: { width: 1920, height: 1080 },
          scaleFactor: 1,
        },
      }),
    ];

    recorder.processStep(makeGUIAgentData(conversations, StatusEnum.RUNNING));

    const session = recorder.getSession();
    expect(session!.actions[0]!.coordinates!.x).toBeCloseTo(960, 0);
    expect(session!.actions[0]!.coordinates!.y).toBeCloseTo(540, 0);
  });

  it('should track screenshots across delta calls with correct indices', () => {
    recorder.startSession('Delta screenshot test');

    // First delta: human with screenshot
    recorder.processStep(
      makeGUIAgentData(
        [
          makeConversation({
            from: 'human',
            screenshotBase64: 'screenshot_1',
            screenshotContext: {
              size: { width: 1920, height: 1080 },
              scaleFactor: 1,
            },
          }),
        ],
        StatusEnum.RUNNING,
      ),
    );

    // Second delta: gpt with prediction (uses screenshot from first delta)
    recorder.processStep(
      makeGUIAgentData(
        [
          makeConversation({
            from: 'gpt',
            predictionParsed: [
              makePrediction('click', { start_box: '[0.5,0.5,0.5,0.5]' }),
            ],
            screenshotContext: {
              size: { width: 1920, height: 1080 },
              scaleFactor: 1,
            },
          }),
        ],
        StatusEnum.RUNNING,
      ),
    );

    const session = recorder.getSession();
    expect(session!.screenshots.get(0)).toBe('screenshot_1');
    expect(session!.actions).toHaveLength(1);
    // Action's screenshotIndex should find screenshot at index 0
    expect(session!.actions[0]!.screenshotIndex).toBe(0);
  });
});
