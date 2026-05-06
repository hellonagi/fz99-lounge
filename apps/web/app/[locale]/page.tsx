import { getNewsList } from '@/lib/news';
import { HomePage } from './home-page';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;
  const latestNews = getNewsList(locale, 3);
  return <HomePage latestNews={latestNews} />;
}
