'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UserPlus,
  Trophy,
  Gamepad2,
  AlertTriangle,
  Shield,
  FileText,
  Users,
} from 'lucide-react';

type RuleSectionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
};

function RuleSection({ title, icon, children }: RuleSectionProps) {
  return (
    <Card className="bg-gray-800/50 border-gray-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
            {icon}
          </div>
          <span className="text-white">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="sm:pt-2">
        <div className="text-gray-300 space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
}

type RankTier = {
  name: string;
  mmrRange: string;
};

type RankInfo = {
  name: string;
  color: string;
  tiers: RankTier[];
};

const ranks: RankInfo[] = [
  {
    name: 'Bronze',
    color: 'bg-amber-700',
    tiers: [
      { name: 'Bronze V', mmrRange: '0-199' },
      { name: 'Bronze IV', mmrRange: '200-399' },
      { name: 'Bronze III', mmrRange: '400-599' },
      { name: 'Bronze II', mmrRange: '600-799' },
      { name: 'Bronze I', mmrRange: '800-999' },
    ],
  },
  {
    name: 'Silver',
    color: 'bg-slate-400',
    tiers: [
      { name: 'Silver V', mmrRange: '1000-1199' },
      { name: 'Silver IV', mmrRange: '1200-1399' },
      { name: 'Silver III', mmrRange: '1400-1599' },
      { name: 'Silver II', mmrRange: '1600-1799' },
      { name: 'Silver I', mmrRange: '1800-1999' },
    ],
  },
  {
    name: 'Gold',
    color: 'bg-yellow-500',
    tiers: [
      { name: 'Gold V', mmrRange: '2000-2099' },
      { name: 'Gold IV', mmrRange: '2100-2199' },
      { name: 'Gold III', mmrRange: '2200-2299' },
      { name: 'Gold II', mmrRange: '2300-2399' },
      { name: 'Gold I', mmrRange: '2400-2499' },
    ],
  },
  {
    name: 'Platinum',
    color: 'bg-cyan-400',
    tiers: [
      { name: 'Platinum V', mmrRange: '2500-2599' },
      { name: 'Platinum IV', mmrRange: '2600-2699' },
      { name: 'Platinum III', mmrRange: '2700-2799' },
      { name: 'Platinum II', mmrRange: '2800-2899' },
      { name: 'Platinum I', mmrRange: '2900-2999' },
    ],
  },
  {
    name: 'Diamond',
    color: 'bg-violet-500',
    tiers: [
      { name: 'Diamond V', mmrRange: '3000-3099' },
      { name: 'Diamond IV', mmrRange: '3100-3199' },
      { name: 'Diamond III', mmrRange: '3200-3299' },
      { name: 'Diamond II', mmrRange: '3300-3399' },
      { name: 'Diamond I', mmrRange: '3400-3499' },
    ],
  },
  {
    name: 'Master',
    color: 'bg-emerald-500',
    tiers: [
      { name: 'Master V', mmrRange: '3500-3599' },
      { name: 'Master IV', mmrRange: '3600-3699' },
      { name: 'Master III', mmrRange: '3700-3799' },
      { name: 'Master II', mmrRange: '3800-3899' },
      { name: 'Master I', mmrRange: '3900-3999' },
    ],
  },
  {
    name: 'Grandmaster',
    color: 'bg-rose-500',
    tiers: [
      { name: 'Grandmaster', mmrRange: '4000+' },
    ],
  },
];


export default function RulesPage() {
  const t = useTranslations('rules');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-gray-900 to-gray-800 py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {t('title')}
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          {mounted ? (
          <Tabs defaultValue="general">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
              <TabsTrigger value="ranking">{t('tabs.ranking')}</TabsTrigger>
              <TabsTrigger value="match">{t('tabs.match')}</TabsTrigger>
              <TabsTrigger value="community">{t('tabs.community')}</TabsTrigger>
            </TabsList>

          {/* General Rules */}
          <TabsContent value="general" className="space-y-6">
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                {t('general.warning')}
              </AlertDescription>
            </Alert>

            <RuleSection
              title={t('general.joiningTitle')}
              icon={<UserPlus className="w-5 h-5" />}
            >
              <ol className="list-decimal list-inside space-y-3">
                <li>{t('general.joining1')}</li>
                <li>{t('general.joining2')}</li>
                <li>
                  {t('general.joining3')}
                  <ul className="list-disc list-inside ml-6 mt-2 text-gray-400">
                    <li>{t('general.joining3sub1')}</li>
                    <li>{t('general.joining3sub2')}</li>
                  </ul>
                </li>
              </ol>

              <Alert variant="danger" className="mt-6">
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-2">
                    <li>{t('general.prohibition1')}</li>
                    <li>{t('general.prohibition2')} {t('general.prohibition2note')}</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </RuleSection>

          </TabsContent>

          {/* Ranking System */}
          <TabsContent value="ranking" className="space-y-6">
            <RuleSection
              title={t('ranking.title')}
              icon={<Trophy className="w-5 h-5" />}
            >
              <div className="space-y-4">
                {ranks.map((rank) => (
                  <div key={rank.name} className="bg-gray-900/50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-4 h-4 rounded-full ${rank.color}`}></div>
                      <h4 className="text-white font-medium">{rank.name}</h4>
                    </div>
                    <div className={`grid gap-2 ${rank.tiers.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5'}`}>
                      {rank.tiers.map((tier) => {
                        const tierLabel = tier.name.split(' ')[1];
                        return (
                          <div
                            key={tier.name}
                            className="flex flex-col p-2 bg-gray-800/50 rounded text-center"
                          >
                            {tierLabel && <span className="text-xs text-gray-300">{tierLabel}</span>}
                            <span className="text-xs text-gray-500">{tier.mmrRange}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-gray-400 text-sm mt-4">
                {t('ranking.note')}
              </p>
            </RuleSection>

          </TabsContent>

          {/* Match Rules */}
          <TabsContent value="match" className="space-y-6">
            <RuleSection
              title={t('match.joiningTitle')}
              icon={<Gamepad2 className="w-5 h-5" />}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">{t('match.beforeMatch')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>{t('match.beforeMatch1')}</li>
                    <li>{t('match.beforeMatch2')}</li>
                    <li>{t('match.beforeMatch3')}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">{t('match.whenStarts')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>{t.rich('match.whenStarts1', {
                      discordLink: (chunks) => (
                        <a
                          href="https://discord.gg/Pxdxp8kH6c"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 underline"
                        >
                          {chunks}
                        </a>
                      ),
                    })}</li>
                    <li>{t('match.whenStarts2')}</li>
                    <li>{t('match.whenStarts3')}</li>
                  </ul>
                </div>

                <Alert variant="danger">
                  <AlertDescription>
                    {t('match.passcodeWarning')}
                  </AlertDescription>
                </Alert>

                <div>
                  <h4 className="text-white font-medium mb-2">{t('match.splitLobby')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>{t('match.splitLobby1')}</li>
                    <li>{t('match.splitLobby2')}</li>
                    <li>{t('match.splitLobby3')}</li>
                  </ul>
                </div>
              </div>
            </RuleSection>

            <RuleSection title={t('match.gameRulesTitle')} icon={<Shield className="w-5 h-5" />}>
              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">{t('match.classicMode')}</h4>
                  <ul className="list-disc list-inside text-gray-300">
                    <li>{t('match.classicRule1')}</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">{t('match.gpMode')}</h4>
                  <ul className="list-disc list-inside text-gray-300">
                    <li>{t('match.gpRule1')}</li>
                    <li>{t('match.gpRule2')}</li>
                  </ul>
                </div>
              </div>
            </RuleSection>

            <RuleSection title={t('match.submittingTitle')} icon={<FileText className="w-5 h-5" />}>
              <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>{t('match.submitting1')}</li>
                <li>{t('match.submitting2')}</li>
                <li>{t('match.submitting3')}</li>
              </ul>

              <div className="mt-6">
                <p className="text-gray-300 mb-4">{t('match.screenshotNotice')}</p>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-white font-medium mb-2">{t('match.screenshotExample1Title')}</h4>
                    <div className="relative w-full max-w-md">
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                        <Image
                          src="/rules/cmini_example_1.webp"
                          alt="Individual result screenshot example"
                          fill
                          sizes="(max-width: 768px) 100vw, 448px"
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-white font-medium mb-2">{t('match.screenshotExample2Title')}</h4>
                    <div className="relative w-full max-w-md">
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-800">
                        <Image
                          src="/rules/cmini_example_2.webp"
                          alt="Final score screenshot example"
                          fill
                          sizes="(max-width: 768px) 100vw, 448px"
                          className="object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </RuleSection>

            <RuleSection title={t('match.disconnectionTitle')} icon={<AlertTriangle className="w-5 h-5" />}>
              <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>{t('match.disconnection1')}</li>
                <li>{t('match.disconnection2')}</li>
              </ul>
            </RuleSection>
          </TabsContent>

          {/* Community */}
          <TabsContent value="community" className="space-y-6">
            <RuleSection
              title={t('community.discordTitle')}
              icon={<Users className="w-5 h-5" />}
            >
              <p className="text-gray-300 mb-4">{t('community.discordDesc')}</p>
              <iframe
                src="https://discord.com/widget?id=1455513103692202098&theme=dark"
                sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                className="w-full h-[400px] rounded-lg border-0"
              />
            </RuleSection>

            <RuleSection
              title={t('community.title')}
              icon={<Shield className="w-5 h-5" />}
            >
              <div className="space-y-6">
                <div>
                  <h4 className="text-white font-medium mb-2">{t('community.generalRulesTitle')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>{t('community.rule1')}</li>
                    <li>{t('community.rule2')}</li>
                    <li>{t('community.rule3')}</li>
                    <li>{t('community.rule4')}</li>
                    <li>{t('community.rule5')}</li>
                    <li>{t('community.rule6')}</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">{t('community.loungeRulesTitle')}</h4>
                  <p className="text-gray-300">{t('community.loungeRulesDesc')}</p>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">{t('community.moderationTitle')}</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>{t('community.moderation1')}</li>
                    <li>{t('community.moderation2')}</li>
                  </ul>
                </div>

                <p className="text-gray-400 text-sm italic">{t('community.agreement')}</p>
              </div>
            </RuleSection>
          </TabsContent>

          </Tabs>
          ) : (
            <div className="p-6 space-y-4">
              <div className="h-10 bg-gray-700/50 rounded animate-pulse w-full max-w-md" />
              <div className="h-64 bg-gray-700/30 rounded animate-pulse" />
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
