function hslToRgb(hue: number, saturation: number, lightness: number): [number, number, number] {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  let channels: [number, number, number];

  if (section < 1) channels = [chroma, secondary, 0];
  else if (section < 2) channels = [secondary, chroma, 0];
  else if (section < 3) channels = [0, chroma, secondary];
  else if (section < 4) channels = [0, secondary, chroma];
  else if (section < 5) channels = [secondary, 0, chroma];
  else channels = [chroma, 0, secondary];

  const offset = lightness - chroma / 2;
  return channels.map((channel) => Math.round((channel + offset) * 255)) as [
    number,
    number,
    number,
  ];
}

function luminance([red, green, blue]: [number, number, number]): number {
  const linear = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return linear(red) * 0.2126 + linear(green) * 0.7152 + linear(blue) * 0.0722;
}

function contrast(first: [number, number, number], second: [number, number, number]): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

function toHsl([red, green, blue]: [number, number, number]): [number, number, number] {
  const normalized = [red, green, blue].map((value) => value / 255);
  const maximum = Math.max(...normalized);
  const minimum = Math.min(...normalized);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta !== 0) {
    if (maximum === normalized[0])
      hue = 60 * (((normalized[1] ?? 0) - (normalized[2] ?? 0)) / delta);
    else if (maximum === normalized[1])
      hue = (60 * ((normalized[2] ?? 0) - (normalized[0] ?? 0))) / delta + 120;
    else hue = (60 * ((normalized[0] ?? 0) - (normalized[1] ?? 0))) / delta + 240;
  }
  if (hue < 0) hue += 360;

  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return [hue, saturation, lightness];
}

export function readableAccent(red: number, green: number, blue: number): string {
  const [hue, originalSaturation, originalLightness] = toHsl([red, green, blue]);
  const saturation = Math.min(0.78, Math.max(0.46, originalSaturation));
  const background: [number, number, number] = [11, 11, 12];
  let lightness = Math.min(0.78, Math.max(0.48, originalLightness));
  let result = hslToRgb(hue, saturation, lightness);

  while (contrast(result, background) < 4.5 && lightness < 0.92) {
    lightness += 0.02;
    result = hslToRgb(hue, saturation, lightness);
  }

  return `#${result.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export async function dominantAccent(imageUrl: string): Promise<string | null> {
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = imageUrl;
    await image.decode();

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const buckets = Array.from({ length: 12 }, () => ({ red: 0, green: 0, blue: 0, count: 0 }));

    for (let offset = 0; offset < data.length; offset += 4) {
      if ((data[offset + 3] ?? 0) < 180) continue;
      const red = data[offset] ?? 0;
      const green = data[offset + 1] ?? 0;
      const blue = data[offset + 2] ?? 0;
      const [hue, saturation, lightness] = toHsl([red, green, blue]);
      if (saturation < 0.22 || lightness < 0.08 || lightness > 0.9) continue;
      const bucket = buckets[Math.floor(hue / 30) % buckets.length];
      if (!bucket) continue;
      bucket.red += red;
      bucket.green += green;
      bucket.blue += blue;
      bucket.count += 1;
    }

    const dominant = buckets.reduce((best, bucket) => (bucket.count > best.count ? bucket : best));
    if (dominant.count === 0) return null;
    return readableAccent(
      Math.round(dominant.red / dominant.count),
      Math.round(dominant.green / dominant.count),
      Math.round(dominant.blue / dominant.count),
    );
  } catch {
    return null;
  }
}
