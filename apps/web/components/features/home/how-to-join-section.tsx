import { useTranslations } from 'next-intl';
import { SiDiscord } from 'react-icons/si';

export function HowToJoinSection() {
  const t = useTranslations('landing.howToJoin');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';

  const steps = [
    { number: 1, titleKey: 'steps.login.title', descriptionKey: 'steps.login.description' },
    { number: 2, titleKey: 'steps.displayName.title', descriptionKey: 'steps.displayName.description' },
    { number: 3, titleKey: 'steps.join.title', descriptionKey: 'steps.join.description' },
    { number: 4, titleKey: 'steps.submit.title', descriptionKey: 'steps.submit.description' },
  ] as const;

  return (
    <section className="pt-4 pb-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('title')}
          </h2>
        </div>

        {/* 2-column layout */}
        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          {/* Left: Join steps */}
          <div className="flex justify-center">
            <div className="space-y-6">
              <p className="text-gray-400 text-center">{t('subtitle')}</p>

              {steps.map((step) => (
                <div key={step.number} className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">{step.number}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{t(step.titleKey)}</h3>
                    <p className="text-gray-400 text-sm">{t(step.descriptionKey)}</p>
                  </div>
                </div>
              ))}

              {/* CTA Button */}
              <div className="flex justify-center mt-12">
                <a
                  href={`${baseUrl}/api/auth/discord`}
                  className="inline-flex items-center justify-center bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold px-8 py-4 rounded-full transition-colors text-lg"
                >
                  <SiDiscord className="w-5 h-5 mr-2" />
                  {t('ctaButton')}
                </a>
              </div>
            </div>
          </div>

          {/* Right: Discord Widget */}
          <div className="flex flex-col items-center md:justify-center mt-12 md:mt-0">
            <h3 className="text-xl font-semibold text-white mb-2 md:hidden">{t('discord.title')}</h3>
            <p className="text-gray-400 text-center mb-4">{t('discord.description')}</p>
            <iframe
              src="https://discord.com/widget?id=1455513103692202098&theme=dark"
              height="400"
              sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
              className="rounded-lg border-0 w-full max-w-[375px]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
