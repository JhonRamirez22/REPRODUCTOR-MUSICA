import { describe, expect, it } from 'vitest';
import { readableAccent } from './accent-color.js';

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    ?.map((channel) => Number.parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error('Expected an RGB hex color.');
  const [red = 0, green = 0, blue = 0] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

describe('readableAccent', () => {
  it.each([
    [240, 52, 64],
    [28, 78, 183],
    [28, 28, 28],
    [245, 232, 212],
  ])('keeps a visible accent over the player surface for %j', (red, green, blue) => {
    const accent = readableAccent(red, green, blue);
    const foreground = relativeLuminance(accent);
    const background = relativeLuminance('#0b0b0c');
    const ratio = (foreground + 0.05) / (background + 0.05);

    expect(accent).toMatch(/^#[\da-f]{6}$/);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
