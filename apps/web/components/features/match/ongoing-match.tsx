import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OngoingMatchProps {
  league: string;
  totalPlayers: number;
  participants: string[];
}

export function OngoingMatch({ league, totalPlayers, participants }: OngoingMatchProps) {
  const displayParticipants = participants.slice(0, 4);
  const remainingCount = totalPlayers - displayParticipants.length;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Ongoing Match
          <Badge variant="live">LIVE</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-purple-400 mb-4">
          {league} · {totalPlayers} Players
        </p>

        <h4 className="text-sm font-medium text-gray-300 mb-3">Participants</h4>
        <div className="flex flex-wrap gap-2 text-xs">
          {displayParticipants.map((name) => (
            <Badge key={name} variant="default">
              {name}
            </Badge>
          ))}
          {remainingCount > 0 && (
            <Badge variant="default">... +{remainingCount} others</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
