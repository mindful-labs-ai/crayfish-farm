#!/usr/bin/env python3
"""
Crawfish sprite generator.
Reads 20 PNGs from assets/crayfish/, generates src/tui/crawfish-art.ts
Requires: pip3 install Pillow numpy
"""

import json
import math
import os
import sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:
    print("Error: Required packages missing. Run: pip3 install Pillow numpy", file=sys.stderr)
    sys.exit(1)

# ─── Constants ────────────────────────────────────────────────────────────────

LEVELS = [(1, "baby"), (2, "juvenile"), (3, "adult"), (4, "warrior"), (5, "king")]
STATES = ["idle", "working", "complete", "sleeping"]
NUM_FRAMES = 4

# Compact widths in characters (each char = 2 pixel rows + ANSI color)
COMPACT_WIDTHS = {
    "baby": 30, "juvenile": 30,
    "adult": 40, "warrior": 40, "king": 40,
}

# Hires widths in characters
HIRES_WIDTHS = {
    "baby": 80, "juvenile": 80,
    "adult": 100, "warrior": 100, "king": 100,
}

DENSITY_CHARS = " .·:;+x%#@█"

SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
ASSETS_DIR = PROJECT_ROOT / "assets" / "crayfish"
OUTPUT_FILE = PROJECT_ROOT / "src" / "tui" / "crawfish-art.ts"

# ─── Step 1: Load and Normalize ───────────────────────────────────────────────

def load_images() -> dict[tuple[str, str], np.ndarray]:
    """Load all 20 PNGs as RGBA numpy arrays keyed by (level_name, state)."""
    images = {}
    for _, level_name in LEVELS:
        for state in STATES:
            path = ASSETS_DIR / f"{level_name}_{state}.png"
            if not path.exists():
                print(f"Warning: missing {path}", file=sys.stderr)
                # Create a 32x32 placeholder
                arr = np.zeros((32, 32, 4), dtype=np.uint8)
                images[(level_name, state)] = arr
                continue
            img = Image.open(path).convert("RGBA")
            images[(level_name, state)] = np.array(img, dtype=np.uint8)
    return images


def normalize_per_level(images: dict) -> dict:
    """For each level, find max W/H across all 4 states, center-pad all to that size."""
    normalized = {}
    for _, level_name in LEVELS:
        max_w = max(images[(level_name, s)].shape[1] for s in STATES)
        max_h = max(images[(level_name, s)].shape[0] for s in STATES)

        for state in STATES:
            src = images[(level_name, state)]
            h, w = src.shape[:2]
            if h == max_h and w == max_w:
                normalized[(level_name, state)] = src
                continue

            # Center-pad with transparent pixels
            pad = np.zeros((max_h, max_w, 4), dtype=np.uint8)
            y_off = (max_h - h) // 2
            x_off = (max_w - w) // 2
            pad[y_off:y_off + h, x_off:x_off + w] = src
            normalized[(level_name, state)] = pad

    return normalized

# ─── Step 2: Animation Helpers ────────────────────────────────────────────────

def shift_row(pixels: np.ndarray, w: int, h: int, y: int, dx: float) -> np.ndarray:
    """Shift a row by dx pixels, filling with transparent."""
    row = pixels[y].copy()
    idxi = int(round(dx))
    if idxi == 0:
        return row
    result = np.zeros_like(row)
    if idxi > 0:
        result[idxi:] = row[:w - idxi]
    else:
        result[:w + idxi] = row[-idxi:]
    return result


def animate_idle(pixels: np.ndarray, w: int, h: int, phase: float) -> np.ndarray:
    """Antenna/claw sway. Top rows move more."""
    result = pixels.copy()
    for y in range(h):
        weight = max(0.0, 1.0 - y / h)
        dx = math.sin(phase + y * 0.15) * 2 * weight
        result[y] = shift_row(pixels, w, h, y, dx)
    return result


def animate_working(pixels: np.ndarray, w: int, h: int, phase: float) -> np.ndarray:
    """Bounce + wave."""
    bounce = int(round(math.sin(phase) * 2))
    result = np.zeros_like(pixels)
    for y in range(h):
        amplitude = 1.5 + math.sin(y * 0.2) * 0.5
        dx = math.sin(phase + y * 0.25) * amplitude
        src_y = y + bounce
        if 0 <= src_y < h:
            result[y] = shift_row(pixels, w, h, src_y, dx)
    return result


def animate_complete(pixels: np.ndarray, w: int, h: int, phase: float) -> np.ndarray:
    """Pulse scale +/-4%."""
    scale = 1.0 + math.sin(phase) * 0.04
    result = np.zeros_like(pixels)
    cx = w / 2
    cy = h / 2
    for y in range(h):
        for x in range(w):
            # Inverse-map through scale transform
            src_x = int(round((x - cx) / scale + cx))
            src_y = int(round((y - cy) / scale + cy))
            if 0 <= src_x < w and 0 <= src_y < h:
                result[y, x] = pixels[src_y, src_x]
    return result


def animate_sleeping(pixels: np.ndarray, w: int, h: int, phase: float) -> np.ndarray:
    """Breath +/-3% from bottom + subtle horizontal drift."""
    breath = 1.0 + math.sin(phase) * 0.03
    result = np.zeros_like(pixels)
    for y in range(h):
        # Map from bottom
        src_y = int(round(h - (h - y) * breath))
        src_y = max(0, min(h - 1, src_y))
        dx = math.sin(phase * 0.5 + y * 0.05) * 1
        result[y] = shift_row(pixels, w, h, src_y, dx)
    return result


def generate_frames(pixels: np.ndarray, state: str) -> list[np.ndarray]:
    """Generate 4 animation frames for the given state."""
    h, w = pixels.shape[:2]
    anim_fn = {
        "idle":     animate_idle,
        "working":  animate_working,
        "complete": animate_complete,
        "sleeping": animate_sleeping,
    }[state]

    frames = []
    for i in range(NUM_FRAMES):
        phase = (i / NUM_FRAMES) * 2 * math.pi
        frames.append(anim_fn(pixels, w, h, phase))
    return frames

# ─── Step 3: COMPACT rendering (halfblock) ────────────────────────────────────

def resize_for_compact(pixels: np.ndarray, level_name: str, target_w: int) -> np.ndarray:
    """Resize to target_w pixels wide, proportional height (ensured even)."""
    h, w = pixels.shape[:2]
    scale = target_w / w
    new_h = max(2, int(h * scale))
    if new_h % 2 != 0:
        new_h += 1
    img = Image.fromarray(pixels, "RGBA")
    img = img.resize((target_w, new_h), Image.LANCZOS)
    return np.array(img, dtype=np.uint8)


def ansi_fg(r: int, g: int, b: int) -> str:
    return f"\x1b[38;2;{r};{g};{b}m"


def ansi_bg(r: int, g: int, b: int) -> str:
    return f"\x1b[48;2;{r};{g};{b}m"


RESET = "\x1b[0m"


def render_compact(pixels: np.ndarray) -> str:
    """Each output character = 2 vertical pixels using Unicode halfblocks."""
    h, w = pixels.shape[:2]
    ALPHA_THRESH = 128
    lines = []

    for row in range(0, h, 2):
        line = ""
        for x in range(w):
            top = pixels[row, x]
            bot = pixels[row + 1, x] if row + 1 < h else np.array([0, 0, 0, 0])

            top_vis = top[3] >= ALPHA_THRESH
            bot_vis = bot[3] >= ALPHA_THRESH

            if top_vis and bot_vis:
                line += (
                    ansi_fg(int(top[0]), int(top[1]), int(top[2]))
                    + ansi_bg(int(bot[0]), int(bot[1]), int(bot[2]))
                    + "▀"
                    + RESET
                )
            elif top_vis:
                line += ansi_fg(int(top[0]), int(top[1]), int(top[2])) + "▀" + RESET
            elif bot_vis:
                line += ansi_fg(int(bot[0]), int(bot[1]), int(bot[2])) + "▄" + RESET
            else:
                line += " "
        lines.append(line)

    return "\n".join(lines)

# ─── Step 4: HIRES rendering (ASCII density) ──────────────────────────────────

def resize_for_hires(pixels: np.ndarray, target_w: int) -> np.ndarray:
    """Resize to target_w wide, compress height by 0.5 (terminal char ratio)."""
    h, w = pixels.shape[:2]
    scale = target_w / w
    new_h = max(1, int(h * scale * 0.5))
    img = Image.fromarray(pixels, "RGBA")
    img = img.resize((target_w, new_h), Image.LANCZOS)
    return np.array(img, dtype=np.uint8)


def render_hires(pixels: np.ndarray) -> str:
    """ASCII density with truecolor fg for each pixel."""
    h, w = pixels.shape[:2]
    ALPHA_THRESH = 128
    n_density = len(DENSITY_CHARS)
    lines = []

    for y in range(h):
        line = ""
        for x in range(w):
            px = pixels[y, x]
            if px[3] < ALPHA_THRESH:
                line += " "
            else:
                r, g, b = int(px[0]), int(px[1]), int(px[2])
                lum = 0.299 * r + 0.587 * g + 0.114 * b
                idx = int(lum / 255 * (n_density - 1))
                ch = DENSITY_CHARS[idx]
                line += ansi_fg(r, g, b) + ch + RESET
        lines.append(line)

    return "\n".join(lines)

# ─── Step 5: Generate TypeScript ──────────────────────────────────────────────

def generate_typescript(
    compact_data: dict[tuple[int, str, str], list[str]],
    hires_data: dict[tuple[int, str, str], list[str]],
) -> str:
    """
    Produces the full .ts file.
    compact_data / hires_data keys: (level_int, state, frame_idx) -> rendered string
    Structure: level -> state -> frame -> string
    """
    # Build nested dicts
    def build_nested(data: dict) -> dict:
        result: dict = {}
        for (level, state, frame_idx), frames in data.items():
            if level not in result:
                result[level] = {}
            if state not in result[level]:
                result[level][state] = {}
            for fi, s in enumerate(frames):
                result[level][state][fi] = s
        return result

    compact_nested = build_nested(compact_data)
    hires_nested = build_nested(hires_data)

    def render_record(nested: dict, var_name: str) -> str:
        lines = [f"export const {var_name}: Record<number, Record<string, Record<number, string>>> = {{"]
        for level in sorted(nested.keys()):
            lines.append(f"  {level}: {{")
            for state in STATES:
                if state not in nested[level]:
                    continue
                lines.append(f"    {json.dumps(state)}: {{")
                frames_dict = nested[level][state]
                for fi in sorted(frames_dict.keys()):
                    escaped = json.dumps(frames_dict[fi])
                    lines.append(f"      {fi}: {escaped},")
                lines.append("    },")
            lines.append("  },")
        lines.append("};")
        return "\n".join(lines)

    compact_ts = render_record(compact_nested, "COMPACT")
    hires_ts = render_record(hires_nested, "HIRES")

    ts = f"""\
// AUTO-GENERATED by scripts/generate-sprites.py — DO NOT EDIT

{compact_ts}

{hires_ts}

/**
 * Get compact (halfblock) crawfish art.
 * @param level  1-5
 * @param state  'idle' | 'working' | 'complete' | 'sleeping'
 * @param frame  0-3
 */
export function getCrawfishArt(level: number, state: string, frame: number): string {{
  return COMPACT[level]?.[state]?.[frame] ?? COMPACT[1]?.['idle']?.[0] ?? '';
}}

/**
 * Get hires (ASCII density) crawfish art.
 * @param level  1-5
 * @param state  'idle' | 'working' | 'complete' | 'sleeping'
 * @param frame  0-3
 */
export function getCrawfishHires(level: number, state: string, frame: number): string {{
  return HIRES[level]?.[state]?.[frame] ?? HIRES[1]?.['idle']?.[0] ?? '';
}}
"""
    return ts

# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    print("Loading sprites from", ASSETS_DIR)

    if not ASSETS_DIR.exists():
        print(f"Error: assets directory not found: {ASSETS_DIR}", file=sys.stderr)
        sys.exit(1)

    # Step 1
    print("Step 1: Loading and normalizing images...")
    images = load_images()
    normalized = normalize_per_level(images)

    # Step 2 + 3 + 4
    compact_data: dict = {}
    hires_data: dict = {}

    print("Step 2-4: Generating frames and rendering...")
    for level_int, level_name in LEVELS:
        compact_w = COMPACT_WIDTHS[level_name]
        hires_w = HIRES_WIDTHS[level_name]

        for state in STATES:
            pixels = normalized[(level_name, state)]
            frames = generate_frames(pixels, state)

            compact_frames = []
            hires_frames = []
            for frame_pixels in frames:
                # Compact
                resized_c = resize_for_compact(frame_pixels, level_name, compact_w)
                compact_frames.append(render_compact(resized_c))

                # Hires
                resized_h = resize_for_hires(frame_pixels, hires_w)
                hires_frames.append(render_hires(resized_h))

            compact_data[(level_int, state, 0)] = compact_frames
            hires_data[(level_int, state, 0)] = hires_frames

    # Step 5
    print("Step 5: Generating TypeScript output...")
    ts_content = generate_typescript(compact_data, hires_data)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(ts_content, encoding="utf-8")
    print(f"Done! Output written to {OUTPUT_FILE}")
    print(f"  Compact entries: {len(compact_data)}")
    print(f"  Hires entries:   {len(hires_data)}")


if __name__ == "__main__":
    main()
