// Longest tokens first so e.g. YYYY matches before YY
const MOMENT_TOKENS: [string, string][] = [
  ['YYYY', '\\d{4}'],
  ['SSS', '\\d{3}'],
  ['YY', '\\d{2}'],
  ['MM', '\\d{2}'],
  ['DD', '\\d{2}'],
  ['HH', '\\d{2}'],
  ['hh', '\\d{2}'],
  ['mm', '\\d{2}'],
  ['ss', '\\d{2}'],
  ['M', '\\d{1,2}'],
  ['D', '\\d{1,2}'],
  ['H', '\\d{1,2}'],
  ['h', '\\d{1,2}'],
  ['m', '\\d{1,2}'],
  ['s', '\\d{1,2}'],
  ['X', '\\d+'],
  ['x', '\\d+']
];

export function momentFormatToRegex(format: string): RegExp {
  let pattern = '';
  let i = 0;
  while (i < format.length) {
    let matched = false;
    for (const [token, re] of MOMENT_TOKENS) {
      if (format.startsWith(token, i)) {
        pattern += re;
        i += token.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      pattern += (format[i] ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      i++;
    }
  }
  return new RegExp(`^${pattern}\\s*`);
}

export function buildStripRegex(
  mode: 'simple' | 'advanced',
  stripFormat: string,
  stripPattern: string
): RegExp | null {
  try {
    return mode === 'simple' ? momentFormatToRegex(stripFormat) : new RegExp(stripPattern);
  } catch {
    return null;
  }
}

export function applyStrip(
  basename: string,
  mode: 'simple' | 'advanced',
  stripFormat: string,
  stripPattern: string
): string {
  try {
    const regex = mode === 'simple'
      ? momentFormatToRegex(stripFormat)
      : new RegExp(stripPattern);
    const stripped = basename.replace(regex, '').trim();
    return stripped.length > 0 ? stripped : basename;
  } catch {
    return basename;
  }
}

export function testMatch(basename: string, matchPattern: string): boolean {
  if (!matchPattern) return true;
  try {
    return new RegExp(matchPattern).test(basename);
  } catch {
    return false;
  }
}
