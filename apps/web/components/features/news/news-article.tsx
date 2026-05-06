'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useFormatter, useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { ChevronLeft } from 'lucide-react';
import type { NewsArticle as NewsArticleType } from '@/lib/news';
import { NEWS_CHART_REGISTRY } from './charts';
import { CommentsSection } from './news-comments/comments-section';

interface NewsArticleProps {
  article: NewsArticleType;
  locale: string;
}

export function NewsArticle({ article, locale }: NewsArticleProps) {
  const format = useFormatter();
  const t = useTranslations('news');

  const dateLabel = format.dateTime(new Date(article.date), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <Link
        href={`/${locale}/news`}
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        {t('backToList')}
      </Link>

      <header className="mb-6 space-y-3">
        <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gray-500">
          {dateLabel}
        </div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
          {article.title}
        </h1>
      </header>

      {article.cover && (
        <div className="relative mb-6 aspect-[16/9] w-full overflow-hidden rounded-lg bg-gray-900">
          <Image
            src={article.cover}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <article className="prose prose-invert prose-sm max-w-none sm:prose-base prose-blockquote:text-gray-300 prose-blockquote:font-normal prose-blockquote:not-italic">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // eslint-disable-next-line @next/next/no-img-element
            img: ({ node: _node, ...props }) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img {...props} alt={props.alt || ''} style={{ maxWidth: '100%' }} />
            ),
            div: ({ node: _node, ...props }) => {
              const chartId = (props as { 'data-chart'?: string })['data-chart'];
              if (chartId && NEWS_CHART_REGISTRY[chartId]) {
                const Chart = NEWS_CHART_REGISTRY[chartId];
                return <Chart />;
              }
              return <div {...props} />;
            },
          }}
        >
          {article.content}
        </ReactMarkdown>
      </article>

      <CommentsSection newsSlug={article.slug} />

      <div className="mt-10 border-t border-gray-700 pt-6">
        <Link
          href={`/${locale}/news`}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          {t('backToList')}
        </Link>
      </div>
    </main>
  );
}
