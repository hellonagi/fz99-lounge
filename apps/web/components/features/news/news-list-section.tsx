'use client';

import { useTranslations } from 'next-intl';
import { NewsCard } from './news-card';
import type { NewsMeta } from '@/lib/news';

interface NewsListSectionProps {
  articles: NewsMeta[];
  locale: string;
}

export function NewsListSection({ articles, locale }: NewsListSectionProps) {
  const t = useTranslations('news');

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight text-white md:text-4xl">
        {t('allNews')}
      </h1>
      {articles.length === 0 ? (
        <p className="text-gray-400">{t('noNews')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <NewsCard key={article.slug} article={article} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}
