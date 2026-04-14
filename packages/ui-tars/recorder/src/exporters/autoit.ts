/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  ExportOptions,
  ExportResult,
  RecordedAction,
  RecordingSession,
} from '../types';
import { cropScreenshot } from '../utils/image';
import {
  AUTOIT_FIND_AND_CLICK,
  AUTOIT_FIND_AND_DOUBLE_CLICK,
  AUTOIT_FIND_AND_RIGHT_CLICK,
  AUTOIT_HEADER_TEMPLATE,
} from './autoit-template';

const DEFAULT_CROP_SIZE = 100;
const DEFAULT_WAIT_MS = 500;
const DEFAULT_SEARCH_TOLERANCE = 20;
const DEFAULT_SLEEP_BETWEEN = 300;

/** Only allow safe characters in key names to prevent AutoIt code injection. */
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9_ ]+$/;

/**
 * Sanitize a string for safe embedding in AutoIt string literals.
 * Removes line breaks (which would inject code) and escapes double quotes.
 */
function sanitizeAutoItString(raw: string, maxLen: number = 200): string {
  return raw
    .replace(/[\r\n]/g, ' ')
    .replace(/"/g, "'")
    .slice(0, maxLen);
}

/** Modifier key mapping for AutoIt Send() */
const MODIFIER_MAP: Record<string, string> = {
  ctrl: '^',
  control: '^',
  alt: '!',
  shift: '+',
  win: '#',
  meta: '#',
};

/** Named key normalization for AutoIt Send() */
const NAMED_KEY_MAP: Record<string, string> = {
  space: '{SPACE}',
  tab: '{TAB}',
  escape: '{ESCAPE}',
  esc: '{ESCAPE}',
  backspace: '{BACKSPACE}',
  delete: '{DELETE}',
  del: '{DELETE}',
  enter: '{ENTER}',
  return: '{ENTER}',
};

/** Characters that need escaping inside AutoIt Send() */
const SEND_SPECIAL_CHARS = /[!+^#{}]/g;

/**
 * Escape a text string for use with AutoIt Send().
 * Double quotes are escaped as "" (AutoIt convention).
 * Special characters are wrapped in braces: `!` → `{!}`
 */
export function escapeSendText(text: string): string {
  return text
    .replace(/"/g, '""')
    .replace(SEND_SPECIAL_CHARS, (ch) => `{${ch}}`);
}

/**
 * Convert a hotkey string like "ctrl+c" to AutoIt Send() format "^c".
 *
 * Rules:
 * - Modifier keys (ctrl, alt, shift, win/meta) map to ^, !, +, #
 * - Function keys (F1..F12) and named keys are wrapped in braces: {F4}
 * - Multiple modifiers are concatenated: ctrl+shift+a → ^+a
 */
export function convertHotkeyToAutoIt(key: string): string {
  const parts = key
    .split(/[\s+]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  let modifiers = '';
  const regularKeys: string[] = [];

  for (const part of parts) {
    const mod = MODIFIER_MAP[part];
    if (mod) {
      modifiers += mod;
    } else {
      regularKeys.push(part);
    }
  }

  const keyStr = regularKeys
    .map((k) => {
      // Check named key map first
      const named = NAMED_KEY_MAP[k];
      if (named) return named;
      // Function keys → wrap in braces
      if (/^f\d{1,2}$/i.test(k)) {
        return `{${k.toUpperCase()}}`;
      }
      // Other multi-char keys → wrap in braces with title case
      if (k.length > 1) {
        return `{${k.charAt(0).toUpperCase() + k.slice(1)}}`;
      }
      return k;
    })
    .join('');

  return modifiers + keyStr;
}

export class AutoItExporter {
  async export(
    session: RecordingSession,
    options?: ExportOptions,
  ): Promise<ExportResult> {
    if (session.status !== 'completed') {
      throw new Error(
        `Cannot export session with status "${session.status}". Only completed sessions can be exported.`,
      );
    }

    const cropSize = options?.cropSize ?? DEFAULT_CROP_SIZE;
    const waitMs = options?.waitMs ?? DEFAULT_WAIT_MS;
    const tolerance = options?.searchTolerance ?? DEFAULT_SEARCH_TOLERANCE;
    const sleepBetween = options?.sleepBetweenActions ?? DEFAULT_SLEEP_BETWEEN;

    const assets = new Map<string, Buffer>();

    // Build header
    let script = AUTOIT_HEADER_TEMPLATE.replace(
      '{{DATE}}',
      new Date().toISOString(),
    )
      .replace('{{INSTRUCTION}}', session.instruction.replace(/\r?\n/g, ' '))
      .replace('{{ACTION_COUNT}}', String(session.actions.length))
      .replace('{{TOLERANCE}}', String(tolerance))
      .replace('{{SLEEP}}', String(sleepBetween))
      .replace('{{WAIT_MS}}', String(waitMs));

    // Append helper functions
    script += AUTOIT_FIND_AND_CLICK;
    script += AUTOIT_FIND_AND_RIGHT_CLICK;
    script += AUTOIT_FIND_AND_DOUBLE_CLICK;

    // Main execution
    script += '; ============================================\n';
    script += '; Execução principal\n';
    script += '; ============================================\n\n';

    for (let i = 0; i < session.actions.length; i++) {
      const action = session.actions[i]!;
      const actionNum = i + 1;

      script += `; --- Ação ${actionNum}: ${action.type} ---\n`;
      script += await this.generateActionCode(
        action,
        actionNum,
        session,
        assets,
        cropSize,
      );
      script += '\n';
    }

    return { scriptContent: script, assets };
  }

  async exportToFiles(
    session: RecordingSession,
    outputDir: string,
    options?: ExportOptions,
  ): Promise<void> {
    const result = await this.export(session, options);

    await mkdir(join(outputDir, 'assets'), { recursive: true });
    await writeFile(
      join(outputDir, 'script.au3'),
      result.scriptContent,
      'utf-8',
    );

    const writePromises: Promise<void>[] = [];
    for (const [name, buffer] of result.assets) {
      writePromises.push(writeFile(join(outputDir, 'assets', name), buffer));
    }
    await Promise.all(writePromises);
  }

  private async generateActionCode(
    action: RecordedAction,
    actionNum: number,
    session: RecordingSession,
    assets: Map<string, Buffer>,
    cropSize: number,
  ): Promise<string> {
    const x = action.coordinates?.x ?? -1;
    const y = action.coordinates?.y ?? -1;

    switch (action.type) {
      case 'click': {
        const assetName = `element_${String(actionNum).padStart(3, '0')}_click.png`;
        await this.tryCreateAsset(assetName, action, session, assets, cropSize);
        return `_FindAndClick("${assetName}", "Ação ${actionNum}", ${x}, ${y})\n`;
      }

      case 'right_click': {
        const assetName = `element_${String(actionNum).padStart(3, '0')}_right_click.png`;
        await this.tryCreateAsset(assetName, action, session, assets, cropSize);
        return `_FindAndRightClick("${assetName}", "Ação ${actionNum}", ${x}, ${y})\n`;
      }

      case 'double_click': {
        const assetName = `element_${String(actionNum).padStart(3, '0')}_double_click.png`;
        await this.tryCreateAsset(assetName, action, session, assets, cropSize);
        return `_FindAndDoubleClick("${assetName}", "Ação ${actionNum}", ${x}, ${y})\n`;
      }

      case 'type': {
        let text = action.text ?? '';
        let trailingEnter = false;

        // SDK convention: \n at end of content means "submit" (press Enter)
        if (text.endsWith('\\n')) {
          text = text.slice(0, -2);
          trailingEnter = true;
        } else if (text.endsWith('\n')) {
          text = text.slice(0, -1);
          trailingEnter = true;
        }

        // Handle mid-text newlines with AutoIt @CRLF concatenation
        const parts = text.split(/\\n|\n/);
        let sendLine: string;
        if (parts.length > 1) {
          const joined = parts
            .map((p) => escapeSendText(p))
            .join('" & @CRLF & "');
          sendLine = `Send("${joined}")\n`;
        } else {
          sendLine = `Send("${escapeSendText(text)}")\n`;
        }

        let result = sendLine;
        if (trailingEnter) {
          result += `Send("{ENTER}")\n`;
        }
        result += `Sleep(200)\n`;
        return result;
      }

      case 'hotkey': {
        const autoitKey = convertHotkeyToAutoIt(action.key ?? '');
        return `Send("${autoitKey}")\nSleep(200)\n`;
      }

      case 'press': {
        const keyName = (action.key ?? '').trim();
        if (!SAFE_KEY_PATTERN.test(keyName)) {
          return `; AVISO: chave inválida ignorada (press): ${keyName.replace(/["\r\n]/g, '')}\n`;
        }
        return `Send("{${keyName} down}")\n`;
      }

      case 'release': {
        const keyName = (action.key ?? '').trim();
        if (!SAFE_KEY_PATTERN.test(keyName)) {
          return `; AVISO: chave inválida ignorada (release): ${keyName.replace(/["\r\n]/g, '')}\n`;
        }
        return `Send("{${keyName} up}")\n`;
      }

      case 'scroll': {
        const dir = action.direction ?? 'down';
        if (dir === 'left' || dir === 'right') {
          return `; AVISO: Scroll horizontal não suportado nativamente pelo AutoIt\n; Direção solicitada: ${dir}\nMouseMove(${x}, ${y})\nSleep(300)\n`;
        }
        return `MouseMove(${x}, ${y})\nMouseWheel("${dir}", 3)\nSleep(300)\n`;
      }

      case 'drag': {
        const ex = action.endCoordinates?.x ?? x;
        const ey = action.endCoordinates?.y ?? y;
        const startAsset = `element_${String(actionNum).padStart(3, '0')}_drag_start.png`;
        const endAsset = `element_${String(actionNum).padStart(3, '0')}_drag_end.png`;
        await this.tryCreateAsset(
          startAsset,
          action,
          session,
          assets,
          cropSize,
        );
        if (action.endCoordinates) {
          await this.tryCreateAssetAtPoint(
            endAsset,
            action.endCoordinates,
            action,
            session,
            assets,
            cropSize,
          );
        }
        return `MouseClickDrag("left", ${x}, ${y}, ${ex}, ${ey})\nSleep(300)\n`;
      }

      case 'wait':
        return `Sleep($WAIT_MS)\n`;

      case 'finished': {
        const msg = sanitizeAutoItString(action.content ?? 'Task completed');
        return `; === SESSION FINISHED: ${msg} ===\nMsgBox($MB_ICONINFORMATION, "Concluído", "${msg}")\n`;
      }

      case 'call_user': {
        const msg = sanitizeAutoItString(
          action.content ?? 'User action required',
        );
        return `MsgBox($MB_ICONWARNING, "Ação Manual Necessária", "${msg}")\n`;
      }

      default:
        return `; Ação desconhecida: ${action.type}\n`;
    }
  }

  private async tryCreateAsset(
    assetName: string,
    action: RecordedAction,
    session: RecordingSession,
    assets: Map<string, Buffer>,
    cropSize: number,
  ): Promise<void> {
    if (!action.coordinates) return;
    await this.tryCreateAssetAtPoint(
      assetName,
      action.coordinates,
      action,
      session,
      assets,
      cropSize,
    );
  }

  private async tryCreateAssetAtPoint(
    assetName: string,
    point: { x: number; y: number },
    action: RecordedAction,
    session: RecordingSession,
    assets: Map<string, Buffer>,
    cropSize: number,
  ): Promise<void> {
    const screenshot = session.screenshots.get(action.screenshotIndex);
    if (!screenshot) return;

    try {
      const buffer = await cropScreenshot(
        screenshot,
        point,
        action.scaleFactor,
        cropSize,
      );
      assets.set(assetName, buffer);
    } catch (err) {
      console.warn(
        `[recorder] asset generation skipped for "${assetName}":`,
        err instanceof Error ? err.message : err,
      );
    }
  }
}
