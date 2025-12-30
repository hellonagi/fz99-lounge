'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  UserPlus,
  Trophy,
  Gamepad2,
  AlertTriangle,
  Shield,
  MessageSquare,
  FileText,
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
      <CardContent className="pt-0">
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
      { name: 'Grandmaster V', mmrRange: '4000-4099' },
      { name: 'Grandmaster IV', mmrRange: '4100-4199' },
      { name: 'Grandmaster III', mmrRange: '4200-4299' },
      { name: 'Grandmaster II', mmrRange: '4300-4399' },
      { name: 'Grandmaster I', mmrRange: '4400+' },
    ],
  },
];


export default function RulesPage() {
  const t = useTranslations('rules');

  return (
    <div className="min-h-screen bg-gray-900">
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
          <Tabs defaultValue="general" id="rules-tabs">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
              <TabsTrigger value="ranking">{t('tabs.ranking')}</TabsTrigger>
              <TabsTrigger value="match">{t('tabs.match')}</TabsTrigger>
              <TabsTrigger value="penalty">{t('tabs.penalty')}</TabsTrigger>
              <TabsTrigger value="conduct">{t('tabs.conduct')}</TabsTrigger>
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

              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  <li>
                    <span className="text-red-300">{t('general.prohibition1')}</span>
                  </li>
                  <li>
                    <span className="text-red-300">{t('general.prohibition2')}</span> {t('general.prohibition2note')}
                  </li>
                </ul>
              </div>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {rank.tiers.map((tier) => (
                        <div
                          key={tier.name}
                          className="flex flex-col p-2 bg-gray-800/50 rounded text-center"
                        >
                          <span className="text-xs text-gray-300">{tier.name.split(' ')[1]}</span>
                          <span className="text-xs text-gray-500">{tier.mmrRange}</span>
                        </div>
                      ))}
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
                    <li>{t('match.whenStarts1')}</li>
                    <li>{t('match.whenStarts2')}</li>
                    <li>{t('match.whenStarts3')}</li>
                  </ul>
                </div>

                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 text-sm">
                    {t('match.passcodeWarning')}
                  </p>
                </div>

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
                <li>{t('match.submitting4')}</li>
              </ul>
            </RuleSection>

            <RuleSection title={t('match.disconnectionTitle')} icon={<AlertTriangle className="w-5 h-5" />}>
              <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>{t('match.disconnection1')}</li>
                <li>{t('match.disconnection2')}</li>
              </ul>
            </RuleSection>
          </TabsContent>

          {/* Penalty System */}
          <TabsContent value="penalty" className="space-y-6">
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <AlertDescription className="text-red-200">
                {t('penalty.strikeWarning')}
              </AlertDescription>
            </Alert>

            <RuleSection
              title={t('penalty.strikeTitle')}
              icon={<AlertTriangle className="w-5 h-5" />}
            >
              <p className="mb-4">
                {t('penalty.strikeDescription')}
              </p>

              <div className="space-y-3">
                <h4 className="font-semibold text-white">{t('penalty.punishmentsTitle')}</h4>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <Badge className="bg-yellow-500">{t('penalty.offense1')}</Badge>
                    <span className="text-gray-300">{t('penalty.offense1Penalty')}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <Badge className="bg-orange-500">{t('penalty.offense2')}</Badge>
                    <span className="text-gray-300">{t('penalty.offense2Penalty')}</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <Badge className="bg-red-500">{t('penalty.offense3')}</Badge>
                    <span className="text-gray-300">{t('penalty.offense3Penalty')}</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  {t('penalty.strikeResetNote')}
                </p>
              </div>
            </RuleSection>

            <RuleSection title={t('penalty.commonPenaltiesTitle')} icon={<Shield className="w-5 h-5" />}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">{t('penalty.violation')}</th>
                      <th className="text-left py-2 text-gray-400">{t('penalty.penaltyColumn')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    <tr>
                      <td className="py-2 text-gray-300">{t('penalty.penalty1')}</td>
                      <td className="py-2 text-red-400">{t('penalty.penalty1Value')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">{t('penalty.penalty2')}</td>
                      <td className="py-2 text-red-400">{t('penalty.penalty2Value')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">{t('penalty.penalty3')}</td>
                      <td className="py-2 text-red-400">{t('penalty.penalty3Value')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">{t('penalty.penalty4')}</td>
                      <td className="py-2 text-red-400">{t('penalty.penalty4Value')}</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">{t('penalty.penalty5')}</td>
                      <td className="py-2 text-red-400">{t('penalty.penalty5Value')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </RuleSection>
          </TabsContent>

          {/* Conduct */}
          <TabsContent value="conduct" className="space-y-6">
            <RuleSection
              title={t('conduct.codeTitle')}
              icon={<MessageSquare className="w-5 h-5" />}
            >
              <ol className="list-decimal list-inside space-y-3">
                <li>{t('conduct.code1')}</li>
                <li>{t('conduct.code2')}</li>
                <li>
                  <span className="text-white font-medium">{t('conduct.code3Title')}</span> {t('conduct.code3')}
                </li>
                <li>{t('conduct.code4')}</li>
                <li>{t('conduct.code5')}</li>
              </ol>
            </RuleSection>

            <RuleSection title={t('conduct.otherNotesTitle')} icon={<FileText className="w-5 h-5" />}>
              <ul className="list-disc list-inside space-y-3">
                <li>{t('conduct.otherNote1')}</li>
                <li>{t('conduct.otherNote2')}</li>
                <li>{t('conduct.otherNote3')}</li>
                <li>{t('conduct.otherNote4')}</li>
              </ul>
            </RuleSection>
          </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}
