export function RecentMatches() {
  return (
    <div className="bg-gray-800 shadow-lg overflow-hidden sm:rounded-md">
      <div className="px-4 py-3 sm:px-6 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-100">Recent Matches</h3>
      </div>
      <div className="p-8 text-center text-gray-400">
        No match history yet
      </div>
    </div>
  );
}
