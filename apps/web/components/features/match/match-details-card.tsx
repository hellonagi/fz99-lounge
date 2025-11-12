import {
  MatchCard,
  MatchCardHeader,
  MatchCardTitle,
  MatchCardContent,
} from '@/components/ui/match-card';

interface MatchDetailsCardProps {
  gameMode: string;
  leagueType: string;
  status: string;
  totalPlayers: number;
  startedAt: string;
  completedAt: string | null;
}

export function MatchDetailsCard({
  gameMode,
  leagueType,
  status,
  totalPlayers,
  startedAt,
  completedAt,
}: MatchDetailsCardProps) {
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONGOING':
        return 'bg-green-500/20 text-green-300 border-green-500/50';
      case 'COMPLETED':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
      case 'RESULTS_PENDING':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
      case 'PROVISIONALLY_CONFIRMED':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
      case 'ABORTED':
        return 'bg-red-500/20 text-red-300 border-red-500/50';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ONGOING':
        return '進行中';
      case 'COMPLETED':
        return '完了';
      case 'RESULTS_PENDING':
        return '結果待ち';
      case 'PROVISIONALLY_CONFIRMED':
        return '暫定確定';
      case 'ABORTED':
        return '中止';
      default:
        return status;
    }
  };

  return (
    <MatchCard>
      <MatchCardHeader>
        <MatchCardTitle>Match Details</MatchCardTitle>
      </MatchCardHeader>
      <MatchCardContent>
        {/* Basic Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Game Mode */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
          <p className="text-sm text-gray-400 mb-1">Game Mode</p>
          <p className="text-xl font-bold text-white">{gameMode}</p>
        </div>

        {/* League Type */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
          <p className="text-sm text-gray-400 mb-1">League</p>
          <p className="text-xl font-bold text-white">{leagueType}</p>
        </div>

        {/* Status */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
          <p className="text-sm text-gray-400 mb-1">Status</p>
          <span
            className={`inline-block px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
              status
            )}`}
          >
            {getStatusLabel(status)}
          </span>
        </div>

        {/* Total Players */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30">
          <p className="text-sm text-gray-400 mb-1">Total Players</p>
          <p className="text-xl font-bold text-white">{totalPlayers}</p>
        </div>

        {/* Started At */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30 md:col-span-2">
          <p className="text-sm text-gray-400 mb-1">Started At</p>
          <p className="text-lg font-semibold text-white">
            {formatDateTime(startedAt)}
          </p>
        </div>

        {/* Completed At */}
        {completedAt && (
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/30 md:col-span-2">
            <p className="text-sm text-gray-400 mb-1">Completed At</p>
            <p className="text-lg font-semibold text-white">
              {formatDateTime(completedAt)}
            </p>
          </div>
        )}
        </div>
      </MatchCardContent>
    </MatchCard>
  );
}
