'use client';

import { useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warn' | 'success';
  message: string;
  data?: unknown;
}

export default function RedeemPage() {
  const [teamName, setTeamName] = useState('');
  const [result, setResult] = useState<{ success: boolean; link?: string; error?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugLog, setDebugLog] = useState<LogEntry[]>([]);

  const log = useCallback((level: LogEntry['level'], message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = { timestamp, level, message, data };

    // Console logging with appropriate method
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data !== undefined ? data : '');

    // Add to debug log state
    setDebugLog(prev => [...prev, entry]);
  }, []);

  const clearDebugLog = useCallback(() => {
    setDebugLog([]);
    console.clear();
    console.log('[DEBUG] Log cleared');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    log('info', 'Form submitted', { teamName });

    if (!teamName.trim()) {
      log('warn', 'Empty team name submitted, aborting');
      return;
    }

    setIsLoading(true);
    setResult(null);
    log('info', 'Starting team lookup', { searchTerm: teamName.trim().toLowerCase() });

    try {
      log('info', 'Fetching leaderboard data from /api/leaderboard');
      const response = await fetch('/api/leaderboard');
      log('info', 'API response received', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}: ${response.statusText}`);
      }

      let data;
      try {
        data = await response.json();
        log('info', 'API response parsed successfully', {
          success: data.success,
          teamsCount: data.data?.scores?.length ?? 0
        });
      } catch (parseError) {
        log('error', 'Failed to parse API response as JSON', { error: parseError });
        throw new Error('Invalid response format from API');
      }

      if (data.success) {
        log('info', 'Leaderboard data retrieved successfully', {
          totalTeams: data.data.scores.length,
          teamNames: data.data.scores.map((s: { teamName: string }) => s.teamName)
        });

        const searchTerm = teamName.toLowerCase().trim();
        const team = data.data.scores.find(
          (s: { teamName: string }) =>
            s.teamName.toLowerCase() === searchTerm
        );

        if (team) {
          log('success', 'Team found!', {
            teamName: team.teamName,
            repo: team.repo,
            score: team.score
          });
          setResult({
            success: true,
            link: team.repo
          });
        } else {
          log('warn', 'Team not found in leaderboard', {
            searchTerm,
            availableTeams: data.data.scores.map((s: { teamName: string }) => s.teamName)
          });
          setResult({
            success: false,
            error: `Team "${teamName}" not found. Please check the spelling and try again.`
          });
        }
      } else {
        log('error', 'API returned success: false', { data });
        setResult({
          success: false,
          error: 'Failed to retrieve leaderboard data. Please try again.'
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      log('error', 'Exception during team lookup', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });
      setResult({
        success: false,
        error: `Failed to lookup team: ${errorMessage}`
      });
    } finally {
      setIsLoading(false);
      log('info', 'Team lookup completed', { isLoading: false });
    }
  };

  const getLogLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-600 bg-red-50';
      case 'warn': return 'text-yellow-700 bg-yellow-50';
      case 'success': return 'text-green-600 bg-green-50';
      default: return 'text-blue-600 bg-blue-50';
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

          {/* Debug Log Section */}
          {debugLog.length > 0 && (
            <div className="mt-8 max-w-4xl">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-800">Debug Log</h2>
                <button
                  onClick={clearDebugLog}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear Log
                </button>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
                {debugLog.map((entry, index) => (
                  <div key={index} className="mb-2 last:mb-0">
                    <div className="flex items-start gap-2">
                      <span className="text-gray-500 text-xs whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getLogLevelColor(entry.level)}`}>
                        {entry.level.toUpperCase()}
                      </span>
                      <span className="text-gray-200 flex-1">
                        {entry.message}
                      </span>
                    </div>
                    {entry.data !== undefined && (
                      <pre className="mt-1 ml-20 text-xs text-gray-400 overflow-x-auto">
                        {JSON.stringify(entry.data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
