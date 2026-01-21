'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

export default function RedeemPage() {
  const [teamName, setTeamName] = useState('');
  const [result, setResult] = useState<{ success: boolean; link?: string; error?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/leaderboard');
      const data = await response.json();

      if (data.success) {
        const team = data.data.scores.find(
          (s: { teamName: string }) =>
            s.teamName.toLowerCase() === teamName.toLowerCase().trim()
        );

        if (team) {
          setResult({
            success: true,
            link: team.repo
          });
        } else {
          setResult({
            success: false,
            error: `Team "${teamName}" not found. Please check the spelling and try again.`
          });
        }
      }
    } catch {
      setResult({
        success: false,
        error: 'Failed to lookup team. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1">
        {/* Page header */}
        <div className="page-header">
          <h1 className="page-title">Redeem Code</h1>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="max-w-md">
            <p className="text-gray-600 mb-6">
              Enter your team name to get your project link.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="teamName" className="form-label">
                  Team Name
                </label>
                <input
                  id="teamName"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Enter your team name"
                  className="form-input"
                  autoComplete="off"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !teamName.trim()}
                className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Looking up...
                  </span>
                ) : (
                  'Get Link'
                )}
              </button>
            </form>

            {/* Result */}
            {result && (
              <div className={`mt-6 p-4 rounded-lg ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}>
                {result.success ? (
                  <div>
                    <p className="text-green-800 font-medium mb-2">Team found!</p>
                    <a
                      href={result.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {result.link}
                    </a>
                  </div>
                ) : (
                  <p className="text-red-800">{result.error}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
