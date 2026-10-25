import { currentLocale } from '../../lib/locale';
import { useLocation } from 'react-router';

export function OriginalLanguageNote() {
  const { pathname } = useLocation();
  if (currentLocale() !== 'en' || !/^\/(?:featured|all|hot|daily|weekly|monthly|topics|starred|items|story|changelog|terms|privacy)(?:\/|$)/.test(pathname)) return null;
  return <p className="my-3 rounded-control border border-line bg-surface px-3 py-2 text-[12px] leading-relaxed text-ink-3">Interface language: English. Editorial content and original documents remain in their original language, usually Chinese.</p>;
}
