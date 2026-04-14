/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AutoIt script header template.
 *
 * Placeholders: {{DATE}}, {{INSTRUCTION}}, {{ACTION_COUNT}},
 * {{TOLERANCE}}, {{SLEEP}}, {{WAIT_MS}}
 */
export const AUTOIT_HEADER_TEMPLATE = `#RequireAdmin
#include <ImageSearch.au3>
#include <MsgBoxConstants.au3>

; ============================================
; Script gerado automaticamente via UI-TARS Recorder
; Data: {{DATE}}
; Instrução: {{INSTRUCTION}}
; Total de ações: {{ACTION_COUNT}}
; ============================================

Global $ASSETS_PATH = @ScriptDir & "\\assets\\"
Global $SEARCH_TOLERANCE = {{TOLERANCE}}
Global $SLEEP_BETWEEN = {{SLEEP}}
Global $WAIT_MS = {{WAIT_MS}}

`;

/**
 * Helper function: find image on screen and left-click.
 */
export const AUTOIT_FIND_AND_CLICK = `Func _FindAndClick($imageFile, $description, $fallbackX = -1, $fallbackY = -1)
    Local $pos = _ImageSearch($ASSETS_PATH & $imageFile, 1, $SEARCH_TOLERANCE)
    If IsArray($pos) Then
        MouseClick("left", $pos[0], $pos[1])
        Sleep($SLEEP_BETWEEN)
        Return True
    ElseIf $fallbackX >= 0 And $fallbackY >= 0 Then
        MouseClick("left", $fallbackX, $fallbackY)
        Sleep($SLEEP_BETWEEN)
        Return True
    Else
        MsgBox($MB_ICONERROR, "Erro", "Elemento não encontrado: " & $description)
        Return False
    EndIf
EndFunc

`;

/**
 * Helper function: find image on screen and right-click.
 */
export const AUTOIT_FIND_AND_RIGHT_CLICK = `Func _FindAndRightClick($imageFile, $description, $fallbackX = -1, $fallbackY = -1)
    Local $pos = _ImageSearch($ASSETS_PATH & $imageFile, 1, $SEARCH_TOLERANCE)
    If IsArray($pos) Then
        MouseClick("right", $pos[0], $pos[1])
        Sleep($SLEEP_BETWEEN)
        Return True
    ElseIf $fallbackX >= 0 And $fallbackY >= 0 Then
        MouseClick("right", $fallbackX, $fallbackY)
        Sleep($SLEEP_BETWEEN)
        Return True
    Else
        MsgBox($MB_ICONERROR, "Erro", "Elemento não encontrado: " & $description)
        Return False
    EndIf
EndFunc

`;

/**
 * Helper function: find image on screen and double-click.
 */
export const AUTOIT_FIND_AND_DOUBLE_CLICK = `Func _FindAndDoubleClick($imageFile, $description, $fallbackX = -1, $fallbackY = -1)
    Local $pos = _ImageSearch($ASSETS_PATH & $imageFile, 1, $SEARCH_TOLERANCE)
    If IsArray($pos) Then
        MouseClick("left", $pos[0], $pos[1], 2)
        Sleep($SLEEP_BETWEEN)
        Return True
    ElseIf $fallbackX >= 0 And $fallbackY >= 0 Then
        MouseClick("left", $fallbackX, $fallbackY, 2)
        Sleep($SLEEP_BETWEEN)
        Return True
    Else
        MsgBox($MB_ICONERROR, "Erro", "Elemento não encontrado: " & $description)
        Return False
    EndIf
EndFunc

`;
