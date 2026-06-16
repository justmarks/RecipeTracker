const KEY = 'mrb:keepAwake';

export function readKeepAwake(): boolean {
  try {
    const val = localStorage.getItem(KEY);
    return val === null ? true : val === 'true';
  } catch {
    return true;
  }
}

export function writeKeepAwake(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, String(enabled));
  } catch {
    // private browsing / storage quota — silently ignore
  }
}
