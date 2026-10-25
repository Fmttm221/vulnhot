import { currentLocale, languageCookie, type Locale } from '../../lib/locale';

export function LanguageSwitch() {
  const locale = currentLocale();
  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = languageCookie(next, window.location.protocol === 'https:');
    window.location.reload();
  }
  return (
    <div role="group" aria-label={locale === 'en' ? 'Interface language' : '界面语言'} className="flex min-w-0 items-center rounded-control border border-line bg-surface p-0.5 text-[12px]">
      {(['zh-CN', 'en'] as const).map((language) => (
        <button key={language} type="button" lang={language} aria-pressed={locale === language} onClick={() => choose(language)}
          className={`min-h-9 min-w-0 flex-1 rounded-mark px-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${locale === language ? 'bg-accent-soft font-semibold text-accent-ink' : 'text-ink-3 hover:bg-bg-sunk hover:text-ink'}`}>
          {language === 'en' ? 'English' : '中文'}
        </button>
      ))}
    </div>
  );
}
