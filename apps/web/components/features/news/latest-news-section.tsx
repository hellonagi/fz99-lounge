'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight } from 'lucide-react';
import { NewsCard } from './news-card';
import type { NewsMeta } from '@/lib/news';

interface LatestNewsSectionProps {
  articles: NewsMeta[];
  locale: string;
}

export function LatestNewsSection({ articles, locale }: LatestNewsSectionProps) {
  const t = useTranslations('news');

  if (articles.length === 0) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="mb-4 flex items-end justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          {t('latestNews')}
        </h2>
        <Link
          href={`/${locale}/news`}
          className="inline-flex items-center gap-1 text-sm font-medium text-gray-300 hover:text-white"
        >
          {t('viewAll')}
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3">
        {articles.map((article) => (
          <NewsCard key={article.slug} article={article} locale={locale} />
        ))}
      </div>
    </section>
  );
}
