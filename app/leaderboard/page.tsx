'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Score {
  id: string;
  team_name: string;
  total: number;
  commentary: string | null;
}

export default function LeaderboardPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const response = await fetch('/api/leaderboard');
        const result = await response.json();
        if (result.success) {
          setScores(result.data.scores);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      {/* Left pillar - hidden on mobile, visible on md+ */}
      <div className="hidden md:block fixed left-0 top-0 h-full z-0 pointer-events-none">
        <img
          src="/pillar.svg"
          alt="Decorative pillar"
          className="h-full w-auto max-w-none"
          style={{ marginLeft: '-50px' }}
        />
      </div>

      {/* Right pillar - hidden on mobile, visible on md+ */}
      <div className="hidden md:flex fixed right-0 top-0 h-full z-0 pointer-events-none justify-end">
        <img
          src="/pillar.svg"
          alt="Decorative pillar"
          className="h-full w-auto max-w-none scale-x-[-1]"
          style={{ marginRight: '-50px' }}
        />
      </div>

      {/* Fixed Title at top */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white pt-6 md:pt-8 lg:pt-10 pb-4">
        <h1 className="font-beton text-2xl md:text-3xl lg:text-4xl tracking-[0.3em] text-gray-900 font-medium text-center">
          LEADERBOARD
        </h1>
      </div>

      {/* Content container */}
      <div className="relative z-10 flex flex-col items-center min-h-screen px-4 md:px-8 pt-20 md:pt-24 lg:pt-28">
        {/* Scrollable leaderboard area */}
        <div className="relative flex-1 w-full max-w-xl md:max-w-2xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="h-full overflow-y-auto pb-48 md:pb-56 pr-2 scrollbar-hide">
              {scores.map((team, index) => (
                <div
                  key={team.id}
                  className="flex items-start py-3 md:py-4 border-b border-gray-100 last:border-b-0"
                >
                  {/* Rank number */}
                  <span className="font-geist-mono font-thin text-3xl md:text-4xl lg:text-5xl w-10 md:w-14 text-gray-400 leading-none">
                    {index + 1}
                  </span>

                  {/* Team info */}
                  <div className="flex-1 ml-2 md:ml-4 min-w-0">
                    <h2 className="font-beton font-medium text-lg md:text-xl lg:text-2xl text-gray-900 truncate">
                      {team.team_name}
                    </h2>
                    {team.commentary && (
                      <p className="font-geist font-medium text-xs md:text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {team.commentary}
                      </p>
                    )}
                  </div>

                  {/* Score */}
                  <span className="font-geist-mono font-medium text-xl md:text-2xl lg:text-3xl text-gray-800 ml-4 tabular-nums">
                    {team.total}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Fade overlay at bottom of scroll area */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 md:h-52 bg-gradient-to-t from-white via-white to-transparent" />
        </div>
      </div>

      {/* Saturn logo - fixed at bottom */}
      <div className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-20">
        <Image
          src="/saturn.svg"
          alt="Saturn"
          width={120}
          height={40}
          className="w-24 md:w-32 lg:w-36 h-auto"
          priority
        />
      </div>
    </main>
  );
}
