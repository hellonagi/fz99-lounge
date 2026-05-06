import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';
import { getAlternates } from '@/lib/metadata';
import { ClientLayout } from '@/components/layout/client-layout';
import Footer from '@/components/layout/footer';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });
  const ogLocale = locale === 'ja' ? 'ja_JP' : 'en_US';
  const alternateLocale = locale === 'ja' ? 'en_US' : 'ja_JP';

  return {
    title: { absolute: t('title') },
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('description'),
      url: `https://fz99lounge.com/${locale}`,
      siteName: 'FZ99 Lounge',
      type: 'website',
      locale: ogLocale,
      alternateLocale: [alternateLocale],
      images: [
        {
          url: '/fz99lounge.jpg',
          width: 1200,
          height: 630,
          type: 'image/jpeg',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('description'),
      images: ['/fz99lounge.jpg'],
    },
    alternates: getAlternates(locale),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ClientLayout locale={locale}>{children}</ClientLayout>
      <Footer />
    </NextIntlClientProvider>
  );
}
