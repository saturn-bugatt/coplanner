'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Score {
  id: string;
  team_name: string;
  repo: string;
  track: number;
  problem: number;
  solution: number;
  execution: number;
  total: number;
  lines_of_code: number;
  commentary: string | null;
  description: string;
  pros: string[];
  cons: string[];
  suggestions: string[];
  last_updated: string;
  twitter: string[];
  members: string[];
  image: string | null;
}

function formatScore(score: number): string {
  return score.toFixed(1);
}

function getTeamImage(team: Score): string {
  if (team.image) return team.image;
  const match = team.repo.match(/github\.com\/([^\/]+)/);
  if (match) return `https://github.com/${match[1]}.png`;
  return '/saturn.svg';
}

const DETAIL_ROTATION_INTERVAL = 10000; // 10 seconds
const ITEMS_PER_PAGE = 4;

export default function LeaderboardPage() {
  const [scores, setScores] = useState<Score[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDetailIndex, setCurrentDetailIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);

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
    const fetchInterval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(fetchInterval);
  }, []);

  // Handle transition when index changes
  useEffect(() => {
    if (currentDetailIndex !== displayIndex) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setDisplayIndex(currentDetailIndex);
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [currentDetailIndex, displayIndex]);

  // Auto-rotate detail view
  useEffect(() => {
    if (scores.length === 0) return;

    const rotationTimer = setInterval(() => {
      setCurrentDetailIndex((prev) => (prev + 1) % scores.length);
    }, DETAIL_ROTATION_INTERVAL);

    return () => clearInterval(rotationTimer);
  }, [scores.length]);

  const currentTeam = scores[displayIndex];

  // Calculate which page of leaderboard to show based on current detail
  const currentPage = Math.floor(currentDetailIndex / ITEMS_PER_PAGE);
  const startIndex = currentPage * ITEMS_PER_PAGE;
  const visibleScores = scores.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(scores.length / ITEMS_PER_PAGE);

  return (
    <main className="relative h-screen bg-white overflow-hidden flex">
      {/* Left side - Leaderboard */}
      <div className="w-1/2 h-full flex flex-col border-r border-gray-200">
        {/* Title */}
        <div className="bg-white pt-6 pb-4 px-8 border-b border-gray-100">
          <h1 className="font-beton text-5xl tracking-[0.2em] text-gray-900 font-medium text-center">
            LEADERBOARD
          </h1>
        </div>

        {/* List */}
        <div className="flex-1 px-6 py-6 flex flex-col justify-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-16 h-16 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {visibleScores.map((team, index) => {
                const globalIndex = startIndex + index;
                return (
                  <div
                    key={team.id}
                    onClick={() => setCurrentDetailIndex(globalIndex)}
                    className={`flex items-center gap-5 p-5 rounded-2xl cursor-pointer transition-all duration-300 ${
                      globalIndex === currentDetailIndex
                        ? 'bg-gray-900 text-white scale-[1.02]'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    {/* Rank */}
                    <span className={`font-geist-mono font-light text-6xl w-16 text-center ${
                      globalIndex === currentDetailIndex ? 'text-gray-500' : 'text-gray-300'
                    }`}>
                      {globalIndex + 1}
                    </span>

                    {/* Team Image */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                      <img
                        src={getTeamImage(team)}
                        alt={team.team_name}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/saturn.svg'; }}
                      />
                    </div>

                    {/* Team Name */}
                    <div className="flex-1 min-w-0">
                      <h2 className={`font-beton font-medium text-3xl truncate ${
                        globalIndex === currentDetailIndex ? 'text-white' : 'text-gray-900'
                      }`}>
                        {team.team_name}
                      </h2>
                    </div>

                    {/* Score */}
                    <div className="text-right flex-shrink-0">
                      <span className={`font-geist-mono font-bold text-5xl ${
                        globalIndex === currentDetailIndex ? 'text-white' : 'text-gray-900'
                      }`}>
                        {formatScore(team.total)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Page indicators and Saturn logo */}
        <div className="py-4 flex flex-col items-center gap-4 border-t border-gray-100">
          {totalPages > 1 && (
            <div className="flex gap-3">
              {Array.from({ length: totalPages }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i === currentPage ? 'bg-gray-800 w-8' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
          <Image src="/saturn.svg" alt="Saturn" width={120} height={40} className="h-10 w-auto" priority />
        </div>
      </div>

      {/* Right side - Detail View */}
      <div className="w-1/2 h-full bg-gray-50 flex flex-col overflow-hidden">
        {currentTeam ? (
          <>
            {/* Big Team Image */}
            <div className="h-[45%] w-full overflow-hidden bg-gray-200 relative">
              <img
                src={getTeamImage(currentTeam)}
                alt={currentTeam.team_name}
                className={`w-full h-full object-cover transition-all duration-300 ease-in-out ${
                  isTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
                }`}
                onError={(e) => { (e.target as HTMLImageElement).src = '/saturn.svg'; }}
              />
            </div>

            {/* Team Details */}
            <div className={`flex-1 p-6 overflow-y-auto transition-all duration-300 ease-in-out ${
              isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-beton font-medium text-5xl text-gray-900">{currentTeam.team_name}</h2>
                  <div className="flex items-center gap-4 mt-2 text-xl text-gray-500">
                    {currentTeam.members && currentTeam.members.length > 0 && (
                      <span>{currentTeam.members.join(', ')}</span>
                    )}
                    {currentTeam.twitter && currentTeam.twitter.length > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        {currentTeam.twitter.join(' ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex items-baseline gap-2">
                  <span className="font-geist-mono font-bold text-7xl text-gray-900">
                    {formatScore(currentTeam.total)}
                  </span>
                  <span className="text-gray-400 text-2xl">/15</span>
                </div>
              </div>

              {/* Score breakdown - inline */}
              <div className="flex gap-6 mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-geist-mono font-bold text-3xl">{formatScore(currentTeam.problem)}</span>
                  <span className="text-gray-400 text-lg">Problem</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-geist-mono font-bold text-3xl">{formatScore(currentTeam.solution)}</span>
                  <span className="text-gray-400 text-lg">Solution</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-geist-mono font-bold text-3xl">{formatScore(currentTeam.execution)}</span>
                  <span className="text-gray-400 text-lg">Execution</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-2xl leading-relaxed text-gray-600">
                {currentTeam.description && currentTeam.description.trim().length > 0
                  ? currentTeam.description
                  : 'No description provided yet.'}
              </p>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="w-16 h-16 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </main>
  );
}
