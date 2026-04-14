/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';

import {
  AutoItExporter,
  convertHotkeyToAutoIt,
  escapeSendText,
} from '../exporters/autoit';
import type { RecordingSession, RecordedAction } from '../types';

/** Create a small valid PNG base64 for asset generation tests. */
async function createTestScreenshot(): Promise<string> {
  const buffer = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: { r: 100, g: 100, b: 100 },
    },
  })
    .png()
    .toBuffer();
  return buffer.toString('base64');
}

function makeAction(overrides: Partial<RecordedAction>): RecordedAction {
  return {
    type: 'click',
    timestamp: Date.now(),
    screenshotIndex: 0,
    screenDimensions: { width: 1920, height: 1080 },
    scaleFactor: 1,
    ...overrides,
  };
}

function makeSession(
  actions: RecordedAction[],
  screenshots?: Map<number, string>,
): RecordingSession {
  return {
    id: 'test-session',
    instruction: 'Test instruction',
    startTime: Date.now(),
    endTime: Date.now() + 10000,
    status: 'completed',
    actions,
    screenshots: screenshots ?? new Map(),
  };
}

describe('escapeSendText', () => {
  it('should escape special AutoIt Send() characters', () => {
    expect(escapeSendText('Hello!')).toBe('Hello{!}');
    expect(escapeSendText('a+b')).toBe('a{+}b');
    expect(escapeSendText('^test')).toBe('{^}test');
    expect(escapeSendText('#tag')).toBe('{#}tag');
    expect(escapeSendText('{key}')).toBe('{{}key{}}');
  });

  it('should not escape regular characters', () => {
    expect(escapeSendText('hello world')).toBe('hello world');
    expect(escapeSendText('abc123')).toBe('abc123');
  });

  it('should escape double quotes', () => {
    expect(escapeSendText('say "hello"')).toBe('say ""hello""');
    expect(escapeSendText('"')).toBe('""');
  });
});

describe('convertHotkeyToAutoIt', () => {
  it('should convert ctrl+c to ^c', () => {
    expect(convertHotkeyToAutoIt('ctrl+c')).toBe('^c');
  });

  it('should convert alt+f4 to !{F4}', () => {
    expect(convertHotkeyToAutoIt('alt+f4')).toBe('!{F4}');
  });

  it('should convert shift+a to +a', () => {
    expect(convertHotkeyToAutoIt('shift+a')).toBe('+a');
  });

  it('should convert ctrl+shift+s to ^+s', () => {
    expect(convertHotkeyToAutoIt('ctrl+shift+s')).toBe('^+s');
  });

  it('should convert win+d to #d', () => {
    expect(convertHotkeyToAutoIt('win+d')).toBe('#d');
  });

  it('should wrap multi-char keys in braces', () => {
    expect(convertHotkeyToAutoIt('enter')).toBe('{ENTER}');
    expect(convertHotkeyToAutoIt('tab')).toBe('{TAB}');
    expect(convertHotkeyToAutoIt('escape')).toBe('{ESCAPE}');
  });

  it('should handle ctrl+alt+delete', () => {
    expect(convertHotkeyToAutoIt('ctrl+alt+delete')).toBe('^!{DELETE}');
  });

  it('should handle hotkeys with space as separator', () => {
    expect(convertHotkeyToAutoIt('ctrl c')).toBe('^c');
    expect(convertHotkeyToAutoIt('alt f4')).toBe('!{F4}');
    expect(convertHotkeyToAutoIt('ctrl shift s')).toBe('^+s');
  });

  it('should handle mixed space and plus separators', () => {
    expect(convertHotkeyToAutoIt('ctrl+shift a')).toBe('^+a');
  });

  it('should normalize named keys via NAMED_KEY_MAP', () => {
    expect(convertHotkeyToAutoIt('space')).toBe('{SPACE}');
    expect(convertHotkeyToAutoIt('tab')).toBe('{TAB}');
    expect(convertHotkeyToAutoIt('escape')).toBe('{ESCAPE}');
    expect(convertHotkeyToAutoIt('backspace')).toBe('{BACKSPACE}');
    expect(convertHotkeyToAutoIt('delete')).toBe('{DELETE}');
    expect(convertHotkeyToAutoIt('enter')).toBe('{ENTER}');
    expect(convertHotkeyToAutoIt('return')).toBe('{ENTER}');
  });

  it('should uppercase function keys', () => {
    expect(convertHotkeyToAutoIt('f1')).toBe('{F1}');
    expect(convertHotkeyToAutoIt('f12')).toBe('{F12}');
  });
});

describe('AutoItExporter', () => {
  const exporter = new AutoItExporter();

  it('should throw for non-completed sessions', async () => {
    const session = makeSession([]);
    session.status = 'error';

    await expect(exporter.export(session)).rejects.toThrow(
      'Cannot export session with status "error"',
    );
  });

  it('should generate script header with helper functions', async () => {
    const session = makeSession([]);
    const result = await exporter.export(session);

    expect(result.scriptContent).toContain('#RequireAdmin');
    expect(result.scriptContent).toContain('#include <ImageSearch.au3>');
    expect(result.scriptContent).toContain('Func _FindAndClick');
    expect(result.scriptContent).toContain('Func _FindAndRightClick');
    expect(result.scriptContent).toContain('Func _FindAndDoubleClick');
    expect(result.scriptContent).toContain('Test instruction');
  });

  it('should generate click action code', async () => {
    const session = makeSession([
      makeAction({
        type: 'click',
        coordinates: { x: 960, y: 540 },
      }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('_FindAndClick(');
    expect(result.scriptContent).toContain('element_001_click.png');
    expect(result.scriptContent).toContain('960, 540');
  });

  it('should generate right_click action code', async () => {
    const session = makeSession([
      makeAction({ type: 'right_click', coordinates: { x: 100, y: 200 } }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('_FindAndRightClick(');
    expect(result.scriptContent).toContain('element_001_right_click.png');
  });

  it('should generate double_click action code', async () => {
    const session = makeSession([
      makeAction({ type: 'double_click', coordinates: { x: 100, y: 200 } }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('_FindAndDoubleClick(');
    expect(result.scriptContent).toContain('element_001_double_click.png');
  });

  it('should generate type action with escaped text', async () => {
    const session = makeSession([
      makeAction({ type: 'type', text: 'Hello! World+1' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("Hello{!} World{+}1")');
    expect(result.scriptContent).toContain('Sleep(200)');
  });

  it('should generate type action with escaped double quotes', async () => {
    const session = makeSession([
      makeAction({ type: 'type', text: 'say "hello"' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("say ""hello""")');
  });

  it('should handle trailing \\n in type action (literal backslash-n)', async () => {
    const session = makeSession([
      makeAction({ type: 'type', text: 'search query\\n' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("search query")');
    expect(result.scriptContent).toContain('Send("{ENTER}")');
    expect(result.scriptContent).toContain('Sleep(200)');
  });

  it('should handle trailing actual newline in type action', async () => {
    const session = makeSession([
      makeAction({ type: 'type', text: 'search query\n' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("search query")');
    expect(result.scriptContent).toContain('Send("{ENTER}")');
  });

  it('should handle mid-text \\n with AutoIt @CRLF concatenation', async () => {
    const session = makeSession([
      makeAction({ type: 'type', text: 'line1\\nline2' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("line1" & @CRLF & "line2")');
  });

  it('should handle mid-text actual newline with @CRLF concatenation', async () => {
    const session = makeSession([
      makeAction({ type: 'type', text: 'line1\nline2' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("line1" & @CRLF & "line2")');
  });

  it('should generate hotkey action', async () => {
    const session = makeSession([
      makeAction({ type: 'hotkey', key: 'ctrl+c' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("^c")');
  });

  it('should generate press and release actions', async () => {
    const session = makeSession([
      makeAction({ type: 'press', key: 'shift' }),
      makeAction({ type: 'release', key: 'shift' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("{shift down}")');
    expect(result.scriptContent).toContain('Send("{shift up}")');
  });

  it('should generate scroll action', async () => {
    const session = makeSession([
      makeAction({
        type: 'scroll',
        coordinates: { x: 500, y: 300 },
        direction: 'up',
      }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('MouseMove(500, 300)');
    expect(result.scriptContent).toContain('MouseWheel("up", 3)');
    expect(result.scriptContent).toContain('Sleep(300)');
  });

  it('should generate warning comment for horizontal scroll', async () => {
    const session = makeSession([
      makeAction({
        type: 'scroll',
        coordinates: { x: 500, y: 300 },
        direction: 'left',
      }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      '; AVISO: Scroll horizontal não suportado nativamente pelo AutoIt',
    );
    expect(result.scriptContent).not.toContain('MouseWheel');
  });

  it('should generate warning comment for horizontal scroll right', async () => {
    const session = makeSession([
      makeAction({
        type: 'scroll',
        coordinates: { x: 500, y: 300 },
        direction: 'right',
      }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      '; AVISO: Scroll horizontal não suportado nativamente pelo AutoIt',
    );
  });

  it('should generate drag action', async () => {
    const session = makeSession([
      makeAction({
        type: 'drag',
        coordinates: { x: 100, y: 100 },
        endCoordinates: { x: 500, y: 500 },
      }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      'MouseClickDrag("left", 100, 100, 500, 500)',
    );
  });

  it('should generate wait action', async () => {
    const session = makeSession([makeAction({ type: 'wait' })]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Sleep($WAIT_MS)');
  });

  it('should generate finished action', async () => {
    const session = makeSession([
      makeAction({ type: 'finished', content: 'Task done' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      '; === SESSION FINISHED: Task done ===',
    );
    expect(result.scriptContent).toContain(
      'MsgBox($MB_ICONINFORMATION, "Concluído", "Task done")',
    );
  });

  it('should generate call_user action', async () => {
    const session = makeSession([
      makeAction({ type: 'call_user', content: 'Please help' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      'MsgBox($MB_ICONWARNING, "Ação Manual Necessária", "Please help")',
    );
  });

  it('should generate assets for click actions when screenshot exists', async () => {
    const screenshot = await createTestScreenshot();
    const screenshots = new Map<number, string>([[0, screenshot]]);

    const session = makeSession(
      [
        makeAction({
          type: 'click',
          coordinates: { x: 960, y: 540 },
          screenshotIndex: 0,
          scaleFactor: 1,
        }),
      ],
      screenshots,
    );

    const result = await exporter.export(session);
    expect(result.assets.size).toBe(1);
    expect(result.assets.has('element_001_click.png')).toBe(true);
    expect(result.assets.get('element_001_click.png')!.length).toBeGreaterThan(
      0,
    );
  });

  it('should generate two assets for drag action', async () => {
    const screenshot = await createTestScreenshot();
    const screenshots = new Map<number, string>([[0, screenshot]]);

    const session = makeSession(
      [
        makeAction({
          type: 'drag',
          coordinates: { x: 100, y: 100 },
          endCoordinates: { x: 500, y: 500 },
          screenshotIndex: 0,
          scaleFactor: 1,
        }),
      ],
      screenshots,
    );

    const result = await exporter.export(session);
    expect(result.assets.has('element_001_drag_start.png')).toBe(true);
    expect(result.assets.has('element_001_drag_end.png')).toBe(true);
  });

  it('should respect custom export options', async () => {
    const session = makeSession([makeAction({ type: 'wait' })]);
    const result = await exporter.export(session, {
      waitMs: 1000,
      searchTolerance: 50,
      sleepBetweenActions: 500,
    });

    expect(result.scriptContent).toContain('$SEARCH_TOLERANCE = 50');
    expect(result.scriptContent).toContain('$SLEEP_BETWEEN = 500');
    expect(result.scriptContent).toContain('$WAIT_MS = 1000');
  });

  it('should handle session with mixed action types', async () => {
    const session = makeSession([
      makeAction({ type: 'click', coordinates: { x: 100, y: 100 } }),
      makeAction({ type: 'type', text: 'hello' }),
      makeAction({ type: 'hotkey', key: 'ctrl+s' }),
      makeAction({
        type: 'scroll',
        coordinates: { x: 500, y: 300 },
        direction: 'down',
      }),
      makeAction({ type: 'wait' }),
      makeAction({ type: 'finished', content: 'Done' }),
    ]);

    const result = await exporter.export(session);

    expect(result.scriptContent).toContain('_FindAndClick(');
    expect(result.scriptContent).toContain('Send("hello")');
    expect(result.scriptContent).toContain('Send("^s")');
    expect(result.scriptContent).toContain('MouseWheel("down", 3)');
    expect(result.scriptContent).toContain('Sleep($WAIT_MS)');
    expect(result.scriptContent).toContain('SESSION FINISHED');
  });

  it('should emit warning comment for press with key containing " and \\n', async () => {
    const session = makeSession([
      makeAction({ type: 'press', key: 'bad"key\ninjected' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      '; AVISO: chave inválida ignorada (press)',
    );
    // Must not generate a Send() command — only a comment
    expect(result.scriptContent).not.toContain('Send("{bad');
    expect(result.scriptContent).not.toMatch(/Send\("\{.*down\}"\)/);
  });

  it('should emit warning comment for release with key containing special chars', async () => {
    const session = makeSession([
      makeAction({ type: 'release', key: 'evil"\ncode' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      '; AVISO: chave inválida ignorada (release)',
    );
    expect(result.scriptContent).not.toContain('Send("{evil"');
  });

  it('should allow valid key names in press/release', async () => {
    const session = makeSession([
      makeAction({ type: 'press', key: 'shift' }),
      makeAction({ type: 'release', key: 'shift' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('Send("{shift down}")');
    expect(result.scriptContent).toContain('Send("{shift up}")');
  });

  it('should sanitize finished content containing newlines', async () => {
    const session = makeSession([
      makeAction({ type: 'finished', content: 'line1\nline2\rline3' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain(
      '; === SESSION FINISHED: line1 line2 line3 ===',
    );
    expect(result.scriptContent).not.toContain('\nline2');
  });

  it('should sanitize call_user content containing newlines', async () => {
    const session = makeSession([
      makeAction({ type: 'call_user', content: 'please\ndo\nthis' }),
    ]);

    const result = await exporter.export(session);
    expect(result.scriptContent).toContain('"please do this"');
    expect(result.scriptContent).not.toContain('\ndo');
  });
});

describe('convertHotkeyToAutoIt edge cases', () => {
  it('should return empty string for empty input', () => {
    expect(convertHotkeyToAutoIt('')).toBe('');
  });
});
