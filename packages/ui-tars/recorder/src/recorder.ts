/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { randomUUID } from 'node:crypto';

import type {
  Conversation,
  GUIAgentData,
  PredictionParsed,
} from '@ui-tars/shared/types';
import { StatusEnum } from '@ui-tars/shared/types';

import type {
  NormalizedActionType,
  RecordedAction,
  RecordingSession,
  SessionStatus,
} from './types';
import { ACTION_ALIAS_MAP } from './types';
import { resolveCoordinates } from './utils/coordinates';

/**
 * Maps a GUIAgentData.status to the recorder's SessionStatus.
 */
function toSessionStatus(status: string): SessionStatus | null {
  switch (status) {
    case StatusEnum.END:
      return 'completed';
    case StatusEnum.CALL_USER:
      return 'call_user';
    case StatusEnum.USER_STOPPED:
      return 'user_stopped';
    case StatusEnum.ERROR:
      return 'error';
    default:
      return null;
  }
}

export class ScriptRecorder {
  private session: RecordingSession | null = null;
  private screenshotCounter = 0;

  startSession(instruction: string): void {
    this.session = {
      id: randomUUID(),
      instruction,
      startTime: Date.now(),
      status: 'recording',
      actions: [],
      screenshots: new Map(),
    };
    this.screenshotCounter = 0;
  }

  processStep(data: GUIAgentData): void {
    if (!this.session || this.session.status !== 'recording') {
      return;
    }

    // Treat data.conversations as a delta — process ALL conversations each call
    for (const conversation of data.conversations) {
      const currentIndex = this.screenshotCounter++;

      // Store screenshot if present
      if (conversation.screenshotBase64) {
        this.session.screenshots.set(
          currentIndex,
          conversation.screenshotBase64,
        );
      }

      // Process parsed predictions
      if (conversation.predictionParsed?.length) {
        if (!conversation.screenshotContext) {
          console.warn(
            '[recorder] screenshotContext ausente para conversation com ações — coordenadas podem ser imprecisas',
          );
        }
        this.processConversationActions(conversation, currentIndex);
      }
    }

    // Update session status based on agent status
    const mappedStatus = toSessionStatus(data.status);
    if (mappedStatus) {
      this.session.status = mappedStatus;
      if (mappedStatus !== 'recording') {
        this.session.endTime = Date.now();
      }
    }
  }

  getSession(): RecordingSession | null {
    return this.session;
  }

  canExport(): boolean {
    return this.session?.status === 'completed';
  }

  clear(): void {
    this.session = null;
    this.screenshotCounter = 0;
  }

  private processConversationActions(
    conversation: Conversation,
    conversationIndex: number,
  ): void {
    if (!this.session) return;

    const screenWidth = conversation.screenshotContext?.size.width ?? 0;
    const screenHeight = conversation.screenshotContext?.size.height ?? 0;
    const scaleFactor = conversation.screenshotContext?.scaleFactor ?? 1;

    // Find the most recent screenshot index for this action
    const screenshotIndex = this.findNearestScreenshotIndex(conversationIndex);

    for (const parsed of conversation.predictionParsed ?? []) {
      const normalizedType = this.normalizeActionType(parsed.action_type);
      if (!normalizedType) continue;

      const action = this.buildRecordedAction(
        parsed,
        normalizedType,
        screenshotIndex,
        screenWidth,
        screenHeight,
        scaleFactor,
      );
      this.session.actions.push(action);
    }
  }

  private normalizeActionType(actionType: string): NormalizedActionType | null {
    return ACTION_ALIAS_MAP[actionType] ?? null;
  }

  private findNearestScreenshotIndex(conversationIndex: number): number {
    if (!this.session) return -1;

    // Walk backward from the current conversation to find the nearest screenshot
    for (let i = conversationIndex; i >= 0; i--) {
      if (this.session.screenshots.has(i)) {
        return i;
      }
    }
    return -1;
  }

  private buildRecordedAction(
    parsed: PredictionParsed,
    type: NormalizedActionType,
    screenshotIndex: number,
    screenWidth: number,
    screenHeight: number,
    scaleFactor: number,
  ): RecordedAction {
    const inputs = parsed.action_inputs;

    // Prefer start_coords (already resolved by action parser, in physical pixels)
    // Divide by scaleFactor to get logical screen coordinates
    const coordinates = (() => {
      if (inputs.start_coords && inputs.start_coords.length === 2) {
        return {
          x: inputs.start_coords[0] / scaleFactor,
          y: inputs.start_coords[1] / scaleFactor,
        };
      }
      if (inputs.start_box) {
        return (
          resolveCoordinates(inputs.start_box, screenWidth, screenHeight) ??
          undefined
        );
      }
      return undefined;
    })();

    const endCoordinates = (() => {
      if (inputs.end_coords && inputs.end_coords.length === 2) {
        return {
          x: inputs.end_coords[0] / scaleFactor,
          y: inputs.end_coords[1] / scaleFactor,
        };
      }
      if (inputs.end_box) {
        return (
          resolveCoordinates(inputs.end_box, screenWidth, screenHeight) ??
          undefined
        );
      }
      return undefined;
    })();

    return {
      type,
      timestamp: Date.now(),
      coordinates,
      endCoordinates,
      text: inputs.content,
      key: inputs.key ?? inputs.hotkey,
      direction: inputs.direction,
      content: inputs.content,
      screenshotIndex,
      screenDimensions: { width: screenWidth, height: screenHeight },
      scaleFactor,
    };
  }
}
