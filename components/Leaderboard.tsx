'use client';

import { TeamScore } from '@/lib/rubric';

interface LeaderboardProps {
  scores: TeamScore[];
}

export default function Leaderboard({ scores }: LeaderboardProps) {
  const sortedScores = [...scores].sort((a, b) => b.total - a.total);

  return (
    <div className="flex-1 bg-white">
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Leaderboard</h1>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className="tab active">All Teams</div>
        <div className="tab">Track 1</div>
        <div className="tab">Track 2</div>
      </div>

      {/* Search */}
      <div className="search-container">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search teams..."
          className="search-input"
        />
      </div>

      {/* Table */}
      <table className="saturn-table">
        <thead>
          <tr>
            <th style={{ width: 60 }}></th>
            <th>Team Name</th>
            <th>Track</th>
            <th>Problem</th>
            <th>Solution</th>
            <th>Execution</th>
            <th>Total</th>
            <th>Last Updated</th>
            <th>Status</th>
            <th style={{ width: 40 }}></th>
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
  );
}

function LeaderboardRow({ score, rank }: { score: TeamScore; rank: number }) {
  const getStatusInfo = (total: number) => {
    if (total >= 12) return { label: 'Excellent', dotClass: 'green' };
    if (total >= 9) return { label: 'Good', dotClass: 'green' };
    if (total >= 6) return { label: 'In Progress', dotClass: 'blue' };
    if (total > 0) return { label: 'Needs Work', dotClass: 'yellow' };
    return { label: 'Not Started', dotClass: 'red' };
  };

  const status = getStatusInfo(score.total);

  const formattedDate = score.lastUpdated
    ? new Date(score.lastUpdated).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : '-';

  const initials = score.teamName
    .split(' ')
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <tr>
      <td className="text-gray-400 font-medium">{rank}</td>
      <td>
        <div className="flex items-center gap-3">
          <div className="avatar">{initials}</div>
          <a
            href={score.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-900 hover:text-blue-600"
          >
            {score.teamName}
          </a>
        </div>
      </td>
      <td>
        <span className={`badge ${score.track === 1 ? 'badge-blue' : 'badge-purple'}`}>
          Track {score.track}
        </span>
      </td>
      <td>{score.problem}</td>
      <td>{score.solution}</td>
      <td>{score.execution}</td>
      <td className="font-medium">{score.total}/15</td>
      <td className="text-gray-500">{formattedDate}</td>
      <td>
        <div className="status">
          <span className={`status-dot ${status.dotClass}`}></span>
          <span>{status.label}</span>
        </div>
      </td>
      <td>
        <button className="p-1 hover:bg-gray-100 rounded">
          <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="6" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="18" r="1.5" />
          </svg>
        </button>
      </td>
    </tr>
  );
}
