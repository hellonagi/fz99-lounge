'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useFormatter } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import type { NewsMeta } from '@/lib/news';

interface NewsCardProps {
  article: NewsMeta;
  locale: string;
}

export function NewsCard({ article, locale }: NewsCardProps) {
  const format = useFormatter();
  const dateLabel = format.dateTime(new Date(article.date), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Link
      href={`/${locale}/news/${article.slug}`}
      className="group block transition hover:-translate-y-0.5"
    >
      <Card className="h-full overflow-hidden border-gray-700 transition group-hover:border-gray-500">
        {article.cover && (
          <div className="relative hidden aspect-[16/9] w-full bg-gray-900 md:block">
            <Image
              src={article.cover}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover"
            />
          </div>
        )}
        <CardContent className="space-y-2 p-4 sm:p-5 sm:pt-5">
          <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gray-500">
            {dateLabel}
          </div>
          <h3 className="text-base font-semibold leading-snug text-white group-hover:text-blue-300 md:text-lg">
            {article.title}
          </h3>
        </CardContent>
      </Card>
    </Link>
  );
}
