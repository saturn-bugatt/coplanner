'use client';

import { TeamScore } from '@/lib/rubric';

interface LeaderboardProps {
  scores: TeamScore[];
}

export default function Leaderboard({ scores }: LeaderboardProps) {
  const sortedScores = [...scores].sort((a, b) => b.total - a.total);

  return (
    <div className="bg-white min-h-screen">
      {/* Page header */}
      <div className="px-6 py-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">Leaderboard</h2>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors">
            <span>+</span>
            <span>Add Team</span>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search teams"
            className="bg-transparent border-none outline-none text-sm text-gray-600 placeholder-gray-400 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="w-16">Rank</th>
              <th>Team Name</th>
              <th>Track</th>
              <th className="text-center">Problem</th>
              <th className="text-center">Solution</th>
              <th className="text-center">Execution</th>
              <th className="text-center">Total</th>
              <th>Last Updated</th>
              <th className="text-center">Status</th>
              <th className="w-12"></th>
            </tr>
          </thead>
          <tbody>
            {sortedScores.length > 0 ? (
              sortedScores.map((score, index) => (
                <LeaderboardRow key={score.teamId} score={score} rank={index + 1} />
              ))
            ) : (
              <tr>
                <td colSpan={10} className="text-center py-12 text-gray-400">
                  No teams yet. Add a team to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaderboardRow({ score, rank }: { score: TeamScore; rank: number }) {
  const getScoreClass = (value: number) => {
    if (value >= 4) return 'text-green-600';
    if (value >= 3) return 'text-gray-900';
    if (value >= 2) return 'text-yellow-600';
    return 'text-gray-400';
  };

  const getTotalClass = (value: number) => {
    if (value >= 12) return 'text-green-600 font-semibold';
    if (value >= 9) return 'text-gray-900 font-semibold';
    if (value >= 6) return 'text-yellow-600 font-medium';
    return 'text-gray-400';
  };

  const getStatusInfo = (total: number) => {
    if (total >= 12) return { label: 'Excellent', dotClass: 'status-completed' };
    if (total >= 9) return { label: 'Good', dotClass: 'status-completed' };
    if (total >= 6) return { label: 'In Progress', dotClass: 'status-in-progress' };
    if (total > 0) return { label: 'Needs Work', dotClass: 'status-in-progress' };
    return { label: 'Not Started', dotClass: 'status-failed' };
  };

  const status = getStatusInfo(score.total);
  const formattedDate = score.lastUpdated
    ? new Date(score.lastUpdated).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';

  // Get initials for avatar
  const initials = score.teamName
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      {/* Rank */}
      <td className="text-gray-500 font-medium">{rank}</td>

      {/* Team Name with avatar */}
      <td>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-600">
            {initials}
          </div>
          <div>
            <a
              href={score.repo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 hover:text-blue-600 font-medium"
            >
              {score.teamName}
            </a>
          </div>
        </div>
      </td>

      {/* Track */}
      <td>
        <span className={`track-badge ${score.track === 1 ? 'track-1' : 'track-2'}`}>
          Track {score.track}
        </span>
      </td>

      {/* Scores */}
      <td className={`text-center ${getScoreClass(score.problem)}`}>{score.problem}</td>
      <td className={`text-center ${getScoreClass(score.solution)}`}>{score.solution}</td>
      <td className={`text-center ${getScoreClass(score.execution)}`}>{score.execution}</td>
      <td className={`text-center ${getTotalClass(score.total)}`}>{score.total}/15</td>

      {/* Last Updated */}
      <td className="text-gray-500 text-sm">{formattedDate}</td>

      {/* Status */}
      <td>
        <div className="flex items-center justify-center">
          <span className={`status-dot ${status.dotClass}`}></span>
          <span className="text-gray-700">{status.label}</span>
        </div>
      </td>

      {/* Actions menu */}
      <td>
        <button className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
