// Public pages already rendered in this document can be revisited until their server deadline.
// Nothing persists across a document reload; list snapshots separately own the reader's position.
import { UNSAFE_decodeViaTurboStream, type ClientLoaderFunctionArgs, type ShouldRevalidateFunction } from 'react-router';
import { currentLocale } from './locale.ts';

const pages = new Map<string, unknown>();
const pending = new Map<string, Promise<unknown>>();
const MAX_PAGES = 16;
const addressOf = (url: URL) => url.pathname + url.search;
const deadlineOf = (value: unknown) => (value as { expiresAt?: number } | null)?.expiresAt ?? 0;

export function hasFreshPage(url: URL): boolean {
  return deadlineOf(pages.get(`${currentLocale()}:${addressOf(url)}`)) > Date.now();
}

function remember(key: string, value: unknown) {
  pages.delete(key);
  pages.set(key, value);
  if (pages.size > MAX_PAGES) pages.delete(pages.keys().next().value!);
}

/** Private/no-store responses cannot use browser HTTP prefetch. Reuse a press's
 * loader data inside this document instead, bounded by the API's original deadline. */
export function prefetchPage(address: string, routeId: string): Promise<unknown> {
  const url = new URL(address, window.location.href);
  const held = `${currentLocale()}:${addressOf(url)}`;
  if (hasFreshPage(url)) return Promise.resolve(pages.get(held));
  const active = pending.get(held);
  if (active) return active;
  url.hash = '';
  url.pathname += url.pathname.endsWith('/') ? '_.data' : '.data';
  url.searchParams.set('_routes', routeId);
  const task = (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok || !response.body) return;
    const { value } = await UNSAFE_decodeViaTurboStream(response.body, window);
    const result = (value as Record<string, { data?: unknown }>)[routeId]?.data;
    if (deadlineOf(result) <= Date.now()) return;
    remember(held, result);
    return result;
  })().catch(() => undefined).finally(() => pending.delete(held));
  pending.set(held, task);
  return task;
}

/**
 * A page's client loader and the router hook that goes with it, made together so they agree on `key`.
 * `key` names the result an address reads, as the address that holds it. Addresses with one key share
 * that result (the tabs of a page that reads the same data) and only the first read asks the server.
 * By default every address has its own.
 */
export function pageReuse<T>(key: (url: URL) => string = addressOf) {
  const localizedKey = (url: URL) => `${currentLocale()}:${key(url)}`;
  async function clientLoader({ request, serverLoader }: ClientLoaderFunctionArgs) {
    const url = new URL(request.url);
    const held = localizedKey(url);
    const pressed = `${currentLocale()}:${addressOf(url)}`;
    let previous = pages.get(held) ?? pages.get(pressed);
    const pressing = pending.get(pressed);
    if (!previous && pressing) previous = await pressing;
    pages.delete(held);
    if (deadlineOf(previous) > Date.now()) {
      remember(held, previous);
      return previous as Awaited<ReturnType<typeof serverLoader<T>>>;
    }
    // On hydration this is the HTML's own result, without another HTTP request.
    const result = await serverLoader<T>();
    if (!request.signal.aborted && deadlineOf(result) > Date.now()) {
      remember(held, result);
    }
    return result;
  }
  clientLoader.hydrate = true as const;

  const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, defaultShouldRevalidate }) => {
    // Revalidator/retry, or tapping the current page again: ask for its data normally.
    if (defaultShouldRevalidate && addressOf(currentUrl) === addressOf(nextUrl)) pages.delete(localizedKey(nextUrl));
    // Moving between addresses that share a result still runs the loader, which keeps the result while it is fresh.
    return defaultShouldRevalidate || key(currentUrl) === key(nextUrl);
  };

  return { clientLoader, shouldRevalidate };
}
