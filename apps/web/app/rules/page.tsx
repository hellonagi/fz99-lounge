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

type RankInfo = {
  name: string;
  mmrRange: string;
  color: string;
};

const ranks: RankInfo[] = [
  { name: 'Bronze', mmrRange: '0-999', color: 'bg-amber-700' },
  { name: 'Silver', mmrRange: '1000-1999', color: 'bg-slate-400' },
  { name: 'Gold', mmrRange: '2000-2499', color: 'bg-yellow-500' },
  { name: 'Platinum', mmrRange: '2500-2999', color: 'bg-cyan-400' },
  { name: 'Diamond', mmrRange: '3000-3499', color: 'bg-violet-500' },
  { name: 'Master', mmrRange: '3500-3999', color: 'bg-emerald-500' },
  { name: 'Grandmaster', mmrRange: '4000+', color: 'bg-rose-500' },
];


export default function RulesPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-gray-900 to-gray-800 py-16">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-purple-900/20 to-pink-900/20"></div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              FZ99 Lounge Official Ruleset
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Please read all rules carefully before participating in Lounge matches.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card>
          <Tabs defaultValue="general">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="match">Match Rules</TabsTrigger>
              <TabsTrigger value="penalty">Penalties</TabsTrigger>
              <TabsTrigger value="conduct">Conduct</TabsTrigger>
            </TabsList>

          {/* General Rules */}
          <TabsContent value="general" className="space-y-6">
            <Alert className="bg-yellow-500/10 border-yellow-500/30">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <AlertDescription className="text-yellow-200">
                Please read all rules before participating in Lounge. Rule violations may result in warnings or penalties.
              </AlertDescription>
            </Alert>

            <RuleSection
              title="Joining the Lounge"
              icon={<UserPlus className="w-5 h-5" />}
            >
              <ol className="list-decimal list-inside space-y-3">
                <li>
                  A Discord account is required to join the Lounge.
                </li>
                <li>
                  Log in with Discord on this website to complete your registration.
                </li>
                <li>
                  On your first login, you can set your country and nickname.
                  <ul className="list-disc list-inside ml-6 mt-2 text-gray-400">
                    <li>Your nickname should be the name you use in-game</li>
                    <li>Nicknames must be between 2-16 characters</li>
                  </ul>
                </li>
              </ol>

              <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <ul className="list-disc list-inside space-y-2 text-gray-300">
                  <li>
                    <span className="text-red-300">Vulgar language or impersonation of other users is strictly prohibited.</span>
                  </li>
                  <li>
                    <span className="text-red-300">Creating alternate accounts is forbidden.</span> Violations will result in severe penalties.
                  </li>
                </ul>
              </div>
            </RuleSection>

          </TabsContent>

          {/* Ranking System */}
          <TabsContent value="ranking" className="space-y-6">
            <RuleSection
              title="Ranking System"
              icon={<Trophy className="w-5 h-5" />}
            >
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
                {ranks.map((rank) => (
                  <div
                    key={rank.name}
                    className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg"
                  >
                    <div className={`w-3 h-3 rounded-full ${rank.color}`}></div>
                    <div>
                      <div className="text-sm font-medium text-white">{rank.name}</div>
                      <div className="text-xs text-gray-400">{rank.mmrRange} MMR</div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-gray-400 text-sm">
                Rankings are reset each season. GP Mode and Classic Mode have independent rankings.
              </p>
            </RuleSection>

          </TabsContent>

          {/* Match Rules */}
          <TabsContent value="match" className="space-y-6">
            <RuleSection
              title="Joining a Match"
              icon={<Gamepad2 className="w-5 h-5" />}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">Before the Match</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>Log in with Discord and join from the home page (first come, first served)</li>
                    <li>Minimum players: Classic = 12, GP = 40 (match cancelled if not met)</li>
                    <li>You can cancel freely before the match starts</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">When the Match Starts</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>You will be redirected to the match page (push notification sent)</li>
                    <li>If not redirected, navigate manually from the home page</li>
                    <li>Use the passcode on the match page to join the in-game room</li>
                  </ul>
                </div>

                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <p className="text-red-300 text-sm">
                    <span className="font-medium">Passcode:</span> Do not share with anyone. If streaming, hide it from view.
                  </p>
                </div>

                <div>
                  <h4 className="text-white font-medium mb-2">If Split Lobby Occurs</h4>
                  <ul className="list-disc list-inside space-y-1 text-gray-300">
                    <li>Press the &quot;Split&quot; button on the match page</li>
                    <li>Once 1/3 of players press the button, a new passcode will be generated</li>
                    <li>Join the room using the new passcode</li>
                  </ul>
                </div>
              </div>
            </RuleSection>

            <RuleSection title="Game Rules" icon={<Shield className="w-5 h-5" />}>
              <div className="space-y-4">
                <div>
                  <h4 className="text-white font-medium mb-2">Classic Mode</h4>
                  <ul className="list-disc list-inside text-gray-300">
                    <li>No reverse driving</li>
                  </ul>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">GP Mode</h4>
                  <ul className="list-disc list-inside text-gray-300">
                    <li>No reverse driving</li>
                    <li>No blue bumpers - if you become a blue bumper, do not control and self-destruct immediately</li>
                  </ul>
                </div>
              </div>
            </RuleSection>

            <RuleSection title="Submitting Scores" icon={<FileText className="w-5 h-5" />}>
              <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>After the match ends, submit your score from the match page</li>
                <li>Enter your placement for each race</li>
                <li>If you crashed out or ranked out, check the corresponding box and enter the race number where it happened. Do not enter placements for races after that.</li>
                <li>The 1st place player must upload a screenshot of the final results screen (page 1 showing places 1-11)</li>
              </ul>
            </RuleSection>

            <RuleSection title="Disconnections" icon={<AlertTriangle className="w-5 h-5" />}>
              <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>If you disconnect during a match, check &quot;Disconnected&quot; for that race when submitting your score</li>
                <li>All races after the disconnection will be treated as 0 points</li>
              </ul>
            </RuleSection>
          </TabsContent>

          {/* Penalty System */}
          <TabsContent value="penalty" className="space-y-6">
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <AlertDescription className="text-red-200">
                Strikes expire after 30 days. Players have a limit of 3 strikes.
              </AlertDescription>
            </Alert>

            <RuleSection
              title="Strike System"
              icon={<AlertTriangle className="w-5 h-5" />}
            >
              <p className="mb-4">
                Players who receive MMR penalties for quitting matches, trolling, joining late,
                targeting specific players, or teaming will also receive a strike.
              </p>

              <div className="space-y-3">
                <h4 className="font-semibold text-white">Punishments for reaching 3 strikes:</h4>
                <div className="grid gap-3">
                  <div className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <Badge className="bg-yellow-500">1st offense</Badge>
                    <span className="text-gray-300">7 day mute</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                    <Badge className="bg-orange-500">2nd offense</Badge>
                    <span className="text-gray-300">14 day mute</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <Badge className="bg-red-500">3rd offense</Badge>
                    <span className="text-gray-300">28 day mute</span>
                  </div>
                </div>
                <p className="text-gray-400 text-sm mt-2">
                  Strike limits are reset each season.
                </p>
              </div>
            </RuleSection>

            <RuleSection title="Common Penalties" icon={<Shield className="w-5 h-5" />}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left py-2 text-gray-400">Violation</th>
                      <th className="text-left py-2 text-gray-400">Penalty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    <tr>
                      <td className="py-2 text-gray-300">Dropping after match starts</td>
                      <td className="py-2 text-red-400">-100 MMR + Strike</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">Joining room late</td>
                      <td className="py-2 text-red-400">-50 MMR + Strike</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">Name/tag rule violation</td>
                      <td className="py-2 text-red-400">-50 MMR</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">Dropping before match starts</td>
                      <td className="py-2 text-red-400">-100 MMR + Strike</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-gray-300">Trolling/Targeting</td>
                      <td className="py-2 text-red-400">-100 MMR + Strike</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </RuleSection>
          </TabsContent>

          {/* Conduct */}
          <TabsContent value="conduct" className="space-y-6">
            <RuleSection
              title="Code of Conduct"
              icon={<MessageSquare className="w-5 h-5" />}
            >
              <ol className="list-decimal list-inside space-y-3">
                <li>
                  Players who consistently cause disruptions such as trolling, flaming (including in DMs or outside the server),
                  or spamming will receive a chat restriction, mute, or temporary timeout.
                </li>
                <li>
                  Players who cause disruptions in matches such as trolling, targeting specific players,
                  or intentionally losing may receive a mute of varying length.
                </li>
                <li>
                  <span className="text-white font-medium">Targeting is defined as:</span> Disrupting another player's race
                  through excessive item use, significantly impacting their score or placement.
                </li>
                <li>
                  Any NSFW content will be promptly deleted and the user will receive an indefinite media restriction.
                </li>
                <li>
                  Players who abuse specific features may receive restrictions from those features.
                </li>
              </ol>
            </RuleSection>

            <RuleSection title="Other Notes" icon={<FileText className="w-5 h-5" />}>
              <ul className="list-disc list-inside space-y-3">
                <li>
                  Chat restriction, mute, and other restricted roles are for punishments only and are not available upon request.
                </li>
                <li>
                  Penalties may be more severe at the discretion of Lounge Staff based on severity and history.
                </li>
                <li>
                  Lounge Staff will make decisions in the event of unexpected circumstances not listed here.
                </li>
                <li>
                  Players who have received indefinite sanctions must wait at least 90 days before appealing.
                </li>
              </ul>
            </RuleSection>
          </TabsContent>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}
