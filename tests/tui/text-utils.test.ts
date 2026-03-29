import { describe, it, expect } from 'vitest';
import {
  charWidth,
  stripAnsi,
  displayWidth,
  truncateToWidth,
  padToWidth,
  centerToWidth,
} from '../../src/tui/text-utils.js';

describe('text-utils', () => {
  describe('charWidth', () => {
    it('returns 2 for a Korean Hangul syllable (가)', () => {
      expect(charWidth('가'.codePointAt(0)!)).toBe(2);
    });

    it('returns 2 for a CJK unified ideograph (中)', () => {
      expect(charWidth('中'.codePointAt(0)!)).toBe(2);
    });

    it('returns 2 for a Japanese Hiragana character (あ)', () => {
      expect(charWidth('あ'.codePointAt(0)!)).toBe(2);
    });

    it('returns 1 for an ASCII character (a)', () => {
      expect(charWidth('a'.codePointAt(0)!)).toBe(1);
    });

    it('returns 1 for a digit (0)', () => {
      expect(charWidth('0'.codePointAt(0)!)).toBe(1);
    });

    it('returns 1 for a space character', () => {
      expect(charWidth(' '.codePointAt(0)!)).toBe(1);
    });

    it('returns 2 for a Hangul Jamo character (ᄀ, U+1100)', () => {
      expect(charWidth(0x1100)).toBe(2);
    });

    it('returns 2 for a fullwidth form character (U+FF01 !)', () => {
      expect(charWidth(0xff01)).toBe(2);
    });
  });

  describe('stripAnsi', () => {
    it('removes simple color escape sequences', () => {
      expect(stripAnsi('\x1b[32mhello\x1b[0m')).toBe('hello');
    });

    it('removes bold escape sequence', () => {
      expect(stripAnsi('\x1b[1mbold\x1b[0m')).toBe('bold');
    });

    it('removes multi-param escape sequence', () => {
      expect(stripAnsi('\x1b[1;32mgreen bold\x1b[0m')).toBe('green bold');
    });

    it('leaves plain strings unchanged', () => {
      expect(stripAnsi('plain text')).toBe('plain text');
    });

    it('handles empty string', () => {
      expect(stripAnsi('')).toBe('');
    });

    it('strips ANSI from mixed content', () => {
      expect(stripAnsi('a\x1b[31mb\x1b[0mc')).toBe('abc');
    });
  });

  describe('displayWidth', () => {
    it('counts ASCII characters as 1 each', () => {
      expect(displayWidth('hello')).toBe(5);
    });

    it('counts CJK characters as 2 each', () => {
      expect(displayWidth('한국')).toBe(4);
    });

    it('counts mixed ASCII and CJK correctly', () => {
      // 'A' = 1, '한' = 2 => total 3
      expect(displayWidth('A한')).toBe(3);
    });

    it('strips ANSI codes before counting', () => {
      expect(displayWidth('\x1b[32mhello\x1b[0m')).toBe(5);
    });

    it('returns 0 for empty string', () => {
      expect(displayWidth('')).toBe(0);
    });
  });

  describe('truncateToWidth', () => {
    it('returns the original string if within maxWidth', () => {
      expect(truncateToWidth('hello', 10)).toBe('hello');
    });

    it('truncates and appends ellipsis when exceeding maxWidth', () => {
      const result = truncateToWidth('hello world', 8);
      expect(displayWidth(result)).toBeLessThanOrEqual(8);
      expect(result).toContain('...');
    });

    it('truncates CJK string correctly', () => {
      // '가나다라' = 8 wide, truncate to 5
      const result = truncateToWidth('가나다라', 5);
      expect(displayWidth(result)).toBeLessThanOrEqual(5);
    });

    it('handles maxWidth equal to string width (no truncation)', () => {
      expect(truncateToWidth('hi', 2)).toBe('hi');
    });

    it('uses custom ellipsis when provided', () => {
      const result = truncateToWidth('abcdefgh', 5, '…');
      expect(result).toContain('…');
      expect(displayWidth(result)).toBeLessThanOrEqual(5);
    });
  });

  describe('padToWidth', () => {
    it('pads ASCII string to target width with spaces', () => {
      const result = padToWidth('hi', 5);
      expect(result).toBe('hi   ');
      expect(displayWidth(result)).toBe(5);
    });

    it('pads CJK string accounting for double-width chars', () => {
      // '가' = width 2, pad to 5 => 3 spaces
      const result = padToWidth('가', 5);
      expect(displayWidth(result)).toBe(5);
    });

    it('returns string unchanged when already at target width', () => {
      expect(padToWidth('hello', 5)).toBe('hello');
    });

    it('returns string unchanged when wider than target', () => {
      expect(padToWidth('hello world', 5)).toBe('hello world');
    });

    it('uses custom pad character when provided', () => {
      const result = padToWidth('hi', 5, '-');
      expect(result).toBe('hi---');
    });
  });

  describe('centerToWidth', () => {
    it('centers a string within the given width', () => {
      const result = centerToWidth('hi', 6);
      // 'hi' is width 2, padding = 4, left = 2, right = 2
      expect(result).toBe('  hi  ');
    });

    it('returns string unchanged when wider than target', () => {
      expect(centerToWidth('hello world', 5)).toBe('hello world');
    });

    it('handles odd padding (floor left, ceil right)', () => {
      const result = centerToWidth('a', 4);
      // total padding = 3, left = 1, right = 2
      expect(result).toBe(' a  ');
    });
  });
});
