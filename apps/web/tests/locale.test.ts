import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { after, before, test } from 'node:test';
import { en, zh } from '../app/lib/i18n/messages.ts';
import { t, ui } from '../app/lib/i18n.ts';
import { currentLocale, installServerLocaleReader, languageCookie, requestLocale, type Locale } from '../app/lib/locale.ts';
import { displayMonthDay, displayWeekday, relativeTime } from '../app/lib/format.ts';
import { FIXTURE_AT, fakeApi, feedItem, itemDetail, startWebServer, type WebServer } from './web-server.ts';
import { chromium } from '@playwright/test';

const request = (accept = '', cookie = '', path = '/') => new Request(`http://localhost${path}`, { headers: { 'accept-language': accept, cookie } });

test('manual language wins; otherwise the first browser preference selects English or Chinese', () => {
  assert.equal(requestLocale(request('en-US,en;q=0.9')), 'en');
  assert.equal(requestLocale(request('zh-CN,en;q=0.9')), 'zh-CN');
  assert.equal(requestLocale(request('fr-FR,en;q=0.8')), 'zh-CN');
  assert.equal(requestLocale(request('zh;q=0.5,en-GB;q=1')), 'en');
  assert.equal(requestLocale(request('en;q=0')), 'zh-CN');
  assert.equal(requestLocale(request()), 'zh-CN');
  assert.equal(requestLocale(request('en', 'vulnhot-language=zh-CN')), 'zh-CN');
  assert.equal(requestLocale(request('zh', 'other=1; vulnhot-language=en')), 'en');
  assert.equal(requestLocale(request('en', 'vulnhot-language=invalid')), 'en');
  assert.equal(requestLocale(request('en', 'vulnhot-language=en', '/admin/login')), 'zh-CN');
  assert.match(languageCookie('en', true), /Max-Age=31536000; SameSite=Lax; Secure$/);
});

test('both dictionaries cover the same keys and preserve interpolation fields', () => {
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  for (const key of Object.keys(zh) as Array<keyof typeof zh>) {
    const placeholders = (s: string) => [...s.matchAll(/\{(?:\d+|sources|start|end)\}/g)].map((m) => m[0]).sort();
    assert.deepEqual(placeholders(en[key]), placeholders(zh[key]), key);
  }
  assert.equal(t('搜索：{0}', ['日报'], 'en'), 'Search: 日报', 'editorial values are kept verbatim');
  assert.equal(ui('最新或指定月份的漏洞月报', 'en'), 'Latest monthly report or a specific month');
  assert.equal(ui('一篇含月份的未知说明', 'en'), '一篇含月份的未知说明', 'short date templates must not corrupt other copy');
});

test('concurrent locale scopes and Beijing date formatting are isolated', async () => {
  const contexts = new AsyncLocalStorage<Locale>();
  installServerLocaleReader(() => contexts.getStore() ?? 'zh-CN');
  try {
    const result = await Promise.all((['en', 'zh-CN', 'en', 'zh-CN'] as const).map((locale) => contexts.run(locale, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return [currentLocale(), t('观测台')];
    })));
    assert.deepEqual(result, [['en', 'Observatory'], ['zh-CN', '观测台'], ['en', 'Observatory'], ['zh-CN', '观测台']]);
    contexts.run('en', () => {
      assert.equal(displayMonthDay('2026-10-25'), 'Oct 25');
      assert.equal(displayWeekday('2026-10-25'), 'Sunday');
      assert.equal(relativeTime('2026-10-24T23:58:00Z', Date.parse('2026-10-25T00:00:00Z')), '2 minutes ago');
    });
    contexts.run('zh-CN', () => assert.equal(displayMonthDay('2026-10-25'), '10月25日'));
  } finally { installServerLocaleReader(() => 'zh-CN'); }
});

let web: WebServer;
const originalTitle = '日报';
const api = fakeApi((url) => {
  if (url.pathname === '/api/site/timeline') return { filters: { channel: 'all', category: url.searchParams.get('category'), tag: null }, cards: [{ key: 'locale-original', anchorAt: FIXTURE_AT, item: feedItem({ id: 'locale-original', title: originalTitle }), group: null }], nextCursor: null, dayCounts: { '2026-10-04': 1 }, hot: null };
  if (url.pathname === '/api/site/pool') return { filters: { channel: 'all', category: url.searchParams.get('category'), tag: null, q: null, tab: 'time' }, items: [feedItem({ id: 'locale-original', title: originalTitle })], page: 1, pageCount: 1, total: 1, todayCount: 1, freshness: FIXTURE_AT };
  if (url.pathname === '/api/site/items/locale-original') return itemDetail({ id: 'locale-original', title: originalTitle });
});
before(async () => { web = await startWebServer(api); });
after(() => web.stop());

test('SSR, metadata, errors and route data honor language without sharing personalized responses', async () => {
  await Promise.all(Array.from({ length: 8 }, async (_, i) => {
    const locale = i % 2 ? 'zh-CN' : 'en';
    const response = await fetch(web.origin + '/', { headers: { 'accept-language': 'fr', cookie: `vulnhot-language=${locale}` } });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${locale}"`));
    assert.match(response.headers.get('Cache-Control')!, /private, no-store/);
    assert.equal(response.headers.get('X-Accel-Expires'), '0');
    assert.ok(html.includes(locale === 'en' ? '<title>Observatory' : '<title>观测台'));
    assert.ok(html.includes(locale === 'en' ? '>Total intelligence<' : '>情报总数<'));
  }));
  const error = await fetch(web.origin + '/missing-page', { headers: { 'accept-language': 'en' } });
  assert.equal(error.status, 404);
  assert.match(await error.text(), /<html lang="en"/);
  const data = await fetch(web.origin + '/featured.data', { headers: { cookie: 'vulnhot-language=en' } });
  assert.match(data.headers.get('Cache-Control')!, /private, no-store/);
  const article = await fetch(web.origin + '/items/locale-original', { headers: { 'accept-language': 'en' } });
  const body = await article.text();
  assert.equal(article.status, 200);
  assert.ok(body.includes('<title>日报 · VulnHOT</title>'));
  assert.ok(body.includes('固定正文'));
});

test('desktop and phone switches persist language, keep the address and preserve original articles', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  try {
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(web.origin + '/?window=24#main');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    assert.equal(new URL(page.url()).search, '?window=24');
    assert.equal(new URL(page.url()).hash, '#main');
    assert.equal((await context.cookies()).find((cookie) => cookie.name === 'vulnhot-language')?.value, 'zh-CN');
    const reopened = await context.newPage();
    await reopened.goto(web.origin + '/');
    assert.equal(await reopened.locator('html').getAttribute('lang'), 'zh-CN');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.goto(web.origin + '/all?category=advisory#main');
    assert.ok(await page.getByRole('link', { name: originalTitle, exact: true }).isVisible());
    assert.ok(await page.getByRole('navigation', { name: 'Filters', exact: true }).getByRole('link', { name: 'Advisories', exact: true }).isVisible());
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    assert.equal(new URL(page.url()).searchParams.get('category'), 'advisory');
    assert.equal(new URL(page.url()).hash, '#main');
    await page.getByRole('button', { name: 'English', exact: true }).click();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    await page.getByRole('link', { name: 'About', exact: true }).click();
    await page.waitForURL('**/about');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await page.goto(web.origin + '/items/locale-original');
    assert.equal(await page.locator('[data-page-title]').innerText(), originalTitle);
    assert.ok((await page.locator('body').innerText()).includes('固定正文'));
    assert.deepEqual(errors, []);

    const phone = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const mobile = await phone.newPage();
    await mobile.goto(web.origin + '/more');
    const chinese = mobile.getByRole('button', { name: '中文', exact: true });
    assert.ok(await chinese.isVisible());
    await chinese.focus();
    await mobile.keyboard.press('Enter');
    await mobile.waitForFunction(() => document.documentElement.lang === 'zh-CN');
    assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  } finally { await browser.close(); }
});
