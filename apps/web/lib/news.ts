import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const NEWS_DIR = path.join(process.cwd(), 'content', 'news');
const SUPPORTED_LOCALES = ['en', 'ja'] as const;
const DEFAULT_LOCALE = 'en';

export type NewsLocale = (typeof SUPPORTED_LOCALES)[number];

export interface NewsMeta {
  slug: string;
  title: string;
  date: string;
  author: string;
  summary: string;
  cover?: string;
  locale: NewsLocale;
}

export interface NewsArticle extends NewsMeta {
  content: string;
}

interface FrontMatter {
  title?: string;
  date?: string | Date;
  author?: string;
  summary?: string;
  cover?: string;
}

function resolveLocale(locale: string): NewsLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale)
    ? (locale as NewsLocale)
    : DEFAULT_LOCALE;
}

function listFiles(): string[] {
  if (!fs.existsSync(NEWS_DIR)) return [];
  return fs.readdirSync(NEWS_DIR).filter((name) => name.endsWith('.md'));
}

export function getNewsSlugs(): string[] {
  const slugs = new Set<string>();
  for (const file of listFiles()) {
    const match = file.match(/^(.+)\.(en|ja)\.md$/);
    if (match) slugs.add(match[1]);
  }
  return Array.from(slugs);
}

function readArticleFile(slug: string, locale: NewsLocale): NewsArticle | null {
  const filePath = path.join(NEWS_DIR, `${slug}.${locale}.md`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const fm = data as FrontMatter;
  if (!fm.title || !fm.date || !fm.author || !fm.summary) return null;
  const dateStr = fm.date instanceof Date
    ? fm.date.toISOString().slice(0, 10)
    : String(fm.date);
  return {
    slug,
    title: fm.title,
    date: dateStr,
    author: fm.author,
    summary: fm.summary,
    cover: fm.cover,
    locale,
    content,
  };
}

export function getNewsArticle(slug: string, locale: string): NewsArticle | null {
  const target = resolveLocale(locale);
  return readArticleFile(slug, target) ?? readArticleFile(slug, DEFAULT_LOCALE);
}

export function getNewsList(locale: string, limit?: number): NewsMeta[] {
  const target = resolveLocale(locale);
  const items = getNewsSlugs()
    .map((slug) => readArticleFile(slug, target) ?? readArticleFile(slug, DEFAULT_LOCALE))
    .filter((a): a is NewsArticle => a !== null)
    .map<NewsMeta>(({ content: _content, ...meta }) => meta)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return typeof limit === 'number' ? items.slice(0, limit) : items;
}
