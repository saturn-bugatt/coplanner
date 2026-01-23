'use client';

import { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import Leaderboard from '@/components/Leaderboard';
import { Score } from '@/lib/supabase';

interface LeaderboardData {
  scores: Score[];
  lastRefresh: string;
}

const REFRESH_INTERVAL = 60000;

export default function Home() {
  const [data, setData] = useState<LeaderboardData>({
    scores: [],
    lastRefresh: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <Leaderboard scores={data.scores} />
        )}
      </main>
    </div>
  );
}
