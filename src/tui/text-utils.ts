// CJK and fullwidth character width detection
export function charWidth(code: number): number {
  if (
    (code >= 0x1100 && code <= 0x115f) ||  // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) ||  // CJK Radicals
    (code >= 0x3040 && code <= 0x33bf) ||  // Hiragana/Katakana
    (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Ext A
    (code >= 0x4e00 && code <= 0x9fff) ||  // CJK Unified
    (code >= 0xac00 && code <= 0xd7af) ||  // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) ||  // CJK Compat
    (code >= 0xfe30 && code <= 0xfe6f) ||  // CJK Compat Forms
    (code >= 0xff01 && code <= 0xff60) ||  // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) ||  // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2fa1f)   // CJK Extensions
  ) {
    return 2;
  }
  return 1;
}

// Strip ANSI escape sequences
export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Get display width of a string (CJK-aware, strips ANSI)
export function displayWidth(str: string): number {
  const plain = stripAnsi(str);
  let width = 0;
  for (const char of plain) {
    const code = char.codePointAt(0) ?? 0;
    width += charWidth(code);
  }
  return width;
}

// Truncate string to max display width
export function truncateToWidth(str: string, maxWidth: number, ellipsis = '...'): string {
  if (displayWidth(str) <= maxWidth) {
    return str;
  }

  const ellipsisWidth = displayWidth(ellipsis);
  const targetWidth = maxWidth - ellipsisWidth;

  let width = 0;
  let result = '';

  for (const char of str) {
    const code = char.codePointAt(0) ?? 0;
    const cw = charWidth(code);
    if (width + cw > targetWidth) {
      break;
    }
    width += cw;
    result += char;
  }

  return result + ellipsis;
}

// Right-pad string to display width
export function padToWidth(str: string, width: number, char = ' '): string {
  const current = displayWidth(str);
  const padding = width - current;
  if (padding <= 0) return str;
  return str + char.repeat(padding);
}

// Center string within display width
export function centerToWidth(str: string, width: number): string {
  const current = displayWidth(str);
  const padding = width - current;
  if (padding <= 0) return str;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
}
