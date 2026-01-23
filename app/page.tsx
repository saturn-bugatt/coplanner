'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from '@/components/Sidebar';
import Leaderboard from '@/components/Leaderboard';
import { Score } from '@/lib/supabase';

interface LeaderboardData {
  scores: Score[];
  lastRefresh: string;
}

interface DebugLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  data?: unknown;
}

const REFRESH_INTERVAL = 60000;

export default function Home() {
  const [data, setData] = useState<LeaderboardData>({
    scores: [],
    lastRefresh: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [debugLog, setDebugLog] = useState<DebugLogEntry[]>([]);
  const [isDebugExpanded, setIsDebugExpanded] = useState(false);
  const fetchCountRef = useRef(0);
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // Debug logging helper function
  const log = useCallback((level: DebugLogEntry['level'], message: string, data?: unknown) => {
    const timestamp = new Date().toISOString();
    const entry: DebugLogEntry = { timestamp, level, message, data };

    // Log to console with appropriate method
    const consoleData = data !== undefined ? [message, data] : [message];
    switch (level) {
      case 'error':
        console.error(`[${timestamp}]`, ...consoleData);
        break;
      case 'warn':
        console.warn(`[${timestamp}]`, ...consoleData);
        break;
      case 'success':
        console.log(`[${timestamp}] SUCCESS:`, ...consoleData);
        break;
      default:
        console.log(`[${timestamp}]`, ...consoleData);
    }

    // Store in debug log state (keep last 100 entries)
    setDebugLog(prev => [...prev.slice(-99), entry]);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    const fetchId = ++fetchCountRef.current;
    log('info', `Starting leaderboard fetch #${fetchId}`);

    try {
      log('info', `Fetch #${fetchId}: Making request to /api/leaderboard`);
      const startTime = performance.now();

      const response = await fetch('/api/leaderboard');
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      log('info', `Fetch #${fetchId}: Response received in ${duration}ms`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        log('error', `Fetch #${fetchId}: HTTP error`, {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Failed to fetch leaderboard: HTTP ${response.status} - ${response.statusText}`);
      }

      let result;
      try {
        result = await response.json();
        log('info', `Fetch #${fetchId}: JSON parsed successfully`, {
          success: result.success,
          hasData: !!result.data,
          scoresCount: result.data?.scores?.length ?? 0,
        });
      } catch (parseError) {
        log('error', `Fetch #${fetchId}: Failed to parse JSON response`, parseError);
        throw new Error('Failed to parse leaderboard response as JSON');
      }

      if (result.success) {
        log('success', `Fetch #${fetchId}: Leaderboard updated successfully`, {
          scoresCount: result.data.scores.length,
          lastRefresh: result.data.lastRefresh,
        });
        setData(result.data);
      } else {
        log('warn', `Fetch #${fetchId}: API returned success=false`, result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      const errorStack = err instanceof Error ? err.stack : undefined;
      log('error', `Fetch #${fetchId}: Error fetching leaderboard`, {
        message: errorMessage,
        stack: errorStack,
        error: err,
      });
    } finally {
      setIsLoading(false);
      log('info', `Fetch #${fetchId}: Fetch completed, isLoading set to false`);
    }
  }, [log]);

  useEffect(() => {
    log('info', 'Component mounted, initializing leaderboard');
    log('info', `Refresh interval configured: ${REFRESH_INTERVAL}ms (${REFRESH_INTERVAL / 1000} seconds)`);

    // Initial fetch
    fetchLeaderboard();

    // Set up interval
    log('info', 'Setting up auto-refresh interval');
    intervalIdRef.current = setInterval(() => {
      log('info', 'Auto-refresh interval triggered');
      fetchLeaderboard();
    }, REFRESH_INTERVAL);

    // Cleanup
    return () => {
      log('info', 'Component unmounting, clearing interval');
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [fetchLeaderboard, log]);

  // Helper to get log entry color based on level
  const getLogColor = (level: DebugLogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-600';
      case 'warn': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <Leaderboard scores={data.scores} />
          )}
        </div>

        {/* Debug Log Panel */}
        {debugLog.length > 0 && (
          <div className="border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => setIsDebugExpanded(!isDebugExpanded)}
              className="w-full px-4 py-2 text-left text-xs font-mono text-gray-500 hover:bg-gray-100 flex items-center justify-between"
            >
              <span>Debug Log ({debugLog.length} entries)</span>
              <span>{isDebugExpanded ? '[-]' : '[+]'}</span>
            </button>

            {isDebugExpanded && (
              <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                {debugLog.map((entry, index) => (
                  <div key={index} className="text-xs font-mono flex gap-2">
                    <span className="text-gray-400 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`uppercase font-semibold w-12 ${getLogColor(entry.level)}`}>
                      [{entry.level}]
                    </span>
                    <span className="text-gray-700 flex-1">
                      {entry.message}
                      {entry.data !== undefined && (
                        <span className="text-gray-400 ml-2">
                          {JSON.stringify(entry.data)}
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
