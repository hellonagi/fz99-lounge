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
      <div className="max-w-6xl mx-auto sm:px-6 lg:px-8">
        {/* Title */}
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-6 text-center px-4 sm:px-0">
          {t('title')}
        </h2>

        <div className="border border-white/[.07] bg-white/[.05] sm:rounded-lg overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 px-5 sm:px-8 py-8 md:py-10">
            {/* Left: Join steps */}
            <div>
              <p className="text-sm text-gray-400 text-center md:text-left mb-6">
                {t('subtitle')}
              </p>

              <div className="space-y-5">
                {steps.map((step) => (
                  <div key={step.number} className="flex items-start gap-3">
                    <span className="font-mono tabular-nums text-[11px] font-extrabold tracking-[.1em] px-2 py-1 border border-indigo-500/40 text-indigo-300 rounded-[3px] bg-indigo-500/10 shrink-0">
                      {String(step.number).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-gray-100 mb-0.5">
                        {t(step.titleKey)}
                      </h3>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {t(step.descriptionKey)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <div className="flex justify-center md:justify-start mt-8">
                <a
                  href={`${baseUrl}/api/auth/discord`}
                  className="inline-flex items-center justify-center bg-[#5865F2] hover:bg-[#4752C4] text-white font-extrabold tracking-[.08em] px-6 py-3 rounded-[5px] transition-colors text-sm"
                >
                  <SiDiscord className="w-4 h-4 mr-2" />
                  {t('ctaButton')}
                </a>
              </div>
            </div>

            {/* Right: Discord Widget */}
            <div className="flex flex-col items-center md:justify-center">
              <span className="text-[11px] font-extrabold tracking-[.15em] uppercase text-gray-400 mb-2 md:hidden">
                {t('discord.title')}
              </span>
              <p className="text-sm text-gray-400 text-center mb-4">
                {t('discord.description')}
              </p>
              <iframe
                src="https://discord.com/widget?id=1455513103692202098&theme=dark"
                height="400"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                className="rounded-[5px] border-0 w-full max-w-[375px]"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
