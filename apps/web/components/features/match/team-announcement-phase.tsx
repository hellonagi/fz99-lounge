'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { MachineColorGuide } from './machine-color-guide';

interface TeamMember {
  userId: number;
  displayName: string | null;
  avatarHash: string | null;
}

interface Team {
  teamIndex: number;
  teamNumber: number;
  color: string;
  colorHex: string;
  members: TeamMember[];
}

interface TeamAnnouncementPhaseProps {
  teams: Team[];
  excludedUserIds: number[];
  excludedUsers: TeamMember[];
  currentUserId: number | null;
  isPasscodeRevealed?: boolean;
  totalParticipants: number;
  mvpUserIds?: Set<number>;
}

export function TeamAnnouncementPhase({
  teams,
  excludedUserIds,
  excludedUsers,
  currentUserId,
  isPasscodeRevealed = false,
  totalParticipants,
  mvpUserIds,
}: TeamAnnouncementPhaseProps) {
  const t = useTranslations('teamClassic');

  // Find user's team
  const userTeam = teams.find((team) =>
    team.members.some((m) => m.userId === currentUserId)
  );
  const isExcluded = excludedUserIds.includes(currentUserId || -1);

  return (
    <div className="space-y-4">
      {/* User's Team Info */}
      {userTeam && !isExcluded && (
        <>
          <Card>
            <CardHeader className="pb-1 sm:pb-1">
              <CardTitle className="text-center text-xl">
                {t('yourTeam')}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 sm:pt-0">
              <div className="text-center">
                <div
                  className="text-6xl font-bold"
                  style={{ color: userTeam.colorHex }}
                >
                  {String.fromCharCode(65 + userTeam.teamIndex)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Setup Guide */}
          <MachineColorGuide
            teams={teams}
            userTeamIndex={userTeam.teamIndex}
          />
        </>
      )}

      {/* Excluded User Notice */}
      {isExcluded && (
        <Card className="border-2 border-gray-600">
          <CardContent className="pt-6">
            <div className="text-center text-gray-400">
              <p className="text-lg">{t('excluded')}</p>
              <p className="text-sm mt-2">
                {t('excludedDescription', { count: totalParticipants })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Teams Grid */}
      <Card>
        <CardHeader>
          <CardTitle>{t('allTeams')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[...teams].sort((a, b) => a.teamIndex - b.teamIndex).map((team) => (
              <div
                key={team.teamIndex}
                className="p-3 rounded-lg border"
                style={{
                  borderColor: team.colorHex,
                  backgroundColor: `${team.colorHex}10`,
                }}
              >
                <div
                  className="text-xl font-bold text-center"
                  style={{ color: team.colorHex }}
                >
                  Team {String.fromCharCode(65 + team.teamIndex)}
                </div>
                <div className="space-y-1">
                  {team.members.map((member) => (
                    <div
                      key={member.userId}
                      className={`text-sm flex items-center gap-1 ${
                        member.userId === currentUserId
                          ? 'font-bold text-white'
                          : 'text-gray-300'
                      }`}
                    >
                      <span className="truncate">{member.displayName || 'Unknown'}</span>
                      {mvpUserIds?.has(member.userId) && (
                        <span className="text-xs text-amber-300 font-bold shrink-0">MVP</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


    </div>
  );
}
