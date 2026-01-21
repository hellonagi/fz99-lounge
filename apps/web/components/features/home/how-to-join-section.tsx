import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LogIn, UserCog, Gamepad2, Send } from 'lucide-react';
import { LucideIcon } from 'lucide-react';
import { SiDiscord } from 'react-icons/si';

interface StepProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function Step({ icon: Icon, title, description }: StepProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm max-w-[200px]">{description}</p>
    </div>
  );
}

export function HowToJoinSection() {
  const t = useTranslations('landing.howToJoin');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  const steps = [
    {
      icon: LogIn,
      titleKey: 'steps.login.title',
      descriptionKey: 'steps.login.description',
    },
    {
      icon: UserCog,
      titleKey: 'steps.displayName.title',
      descriptionKey: 'steps.displayName.description',
    },
    {
      icon: Gamepad2,
      titleKey: 'steps.join.title',
      descriptionKey: 'steps.join.description',
    },
    {
      icon: Send,
      titleKey: 'steps.submit.title',
      descriptionKey: 'steps.submit.description',
    },
  ] as const;

  return (
    <section className="py-16 bg-gray-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('title')}
          </h2>
          <p className="text-gray-400">
            {t('subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {steps.map((step) => (
            <Step
              key={step.titleKey}
              icon={step.icon}
              title={t(step.titleKey)}
              description={t(step.descriptionKey)}
            />
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-300 mb-6">{t('cta')}</p>
          <Link
            href={`${baseUrl}/api/auth/discord`}
            className="inline-flex items-center justify-center bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold px-8 py-4 rounded-full transition-colors text-lg"
          >
            <SiDiscord className="w-5 h-5 mr-2" />
            {t('ctaButton')}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function DiscordCommunitySection() {
  const t = useTranslations('landing.howToJoin');

  return (
    <section className="py-16 bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <p className="text-gray-400 mb-6">{t('discordNotice')}</p>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <iframe
          src="https://discord.com/widget?id=1455513103692202098&theme=dark"
          width="350"
          height="400"
          allowtransparency="true"
          frameBorder="0"
          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
          className="mx-auto rounded-lg"
        />
      </div>
    </section>
  );
}
