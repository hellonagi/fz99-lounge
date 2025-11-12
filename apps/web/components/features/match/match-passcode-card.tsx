import { MatchCard, MatchCardContent } from '@/components/ui/match-card';

interface MatchPasscodeCardProps {
  passcode: string | null;
}

export function MatchPasscodeCard({ passcode }: MatchPasscodeCardProps) {
  if (!passcode) {
    return null;
  }

  return (
    <MatchCard className="bg-gradient-to-r from-indigo-900/30 via-purple-900/30 to-pink-900/30 border-indigo-500/30">
      <MatchCardContent className="text-center">
        <p className="text-sm text-gray-400 mb-2">Passcode</p>
        <p className="text-5xl font-black text-white tracking-wider font-mono">
          {passcode}
        </p>
      </MatchCardContent>
    </MatchCard>
  );
}
