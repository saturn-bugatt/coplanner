'use client';

import { useState, useEffect, useCallback } from 'react';
import Header from '@/components/Header';
import Leaderboard from '@/components/Leaderboard';
import { TeamScore } from '@/lib/rubric';

interface LeaderboardData {
  scores: TeamScore[];
  commentary: { message: string; timestamp: string }[];
  lastRefresh: string;
}

const REFRESH_INTERVAL = 60000; // 1 minute

export default function Home() {
  const [data, setData] = useState<LeaderboardData>({
    scores: [],
    commentary: [],
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
    <main className="min-h-screen bg-white">
      <Header />
      {isLoading ? (
        <LoadingState />
      ) : (
        <Leaderboard scores={data.scores} />
      )}
    </main>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}
