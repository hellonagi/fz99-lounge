import type { Metadata } from 'next';
import { getAlternates } from '@/lib/metadata';
import ProfilePage from './profile-page';

type Props = {
  params: Promise<{ locale: string; profileId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, profileId } = await params;

  return {
    alternates: getAlternates(locale, `/profile/${profileId}`),
  };
}

export default function Page() {
  return <ProfilePage />;
}
