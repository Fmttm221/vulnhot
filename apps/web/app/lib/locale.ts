export type Locale = 'zh-CN' | 'en';
export const LANGUAGE_COOKIE = 'vulnhot-language';

/** Cookie wins; otherwise use the browser's first supported preference, including q weights. */
export function requestLocale(request: Request): Locale {
  if (/^\/admin(?:\/|$)/.test(new URL(request.url).pathname)) return 'zh-CN';
  const saved = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${LANGUAGE_COOKIE}=`))?.slice(LANGUAGE_COOKIE.length + 1);
  if (saved === 'en' || saved === 'zh-CN') return saved;
  const preferred = (request.headers.get('accept-language') ?? '').split(',')
    .map((part, index) => {
      const [language, ...parameters] = part.trim().split(';');
      const quality = parameters.find((p) => p.trim().startsWith('q='));
      return { language: language?.toLowerCase() ?? '', quality: quality ? Number(quality.trim().slice(2)) : 1, index };
    })
    .filter((part) => Number.isFinite(part.quality) && part.quality > 0 && part.quality <= 1)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)[0]?.language;
  return preferred === 'en' || preferred?.startsWith('en-') ? 'en' : 'zh-CN';
}

// The reader is installed once by entry.server. Its value lives in AsyncLocalStorage,
// never in a mutable process-wide locale, so concurrent SSR requests stay isolated.
let serverLocale: () => Locale = () => 'zh-CN';
export function installServerLocaleReader(reader: () => Locale): void { serverLocale = reader; }
export function currentLocale(): Locale {
  return typeof document === 'undefined' ? serverLocale() : document.documentElement.lang === 'en' ? 'en' : 'zh-CN';
}

export function languageCookie(locale: Locale, secure = false): string {
  return `${LANGUAGE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? '; Secure' : ''}`;
}
