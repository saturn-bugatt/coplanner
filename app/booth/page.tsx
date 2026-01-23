'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Photo {
  id: string;
  team_name: string;
  image_url: string;
  created_at: string;
}

interface QueueItem {
  id: string;
  team_name: string;
  status: 'waiting' | 'displaying' | 'done';
  created_at: string;
}

const DISPLAY_DURATION = 25000; // 25 seconds per team

export default function BoothPage() {
  const [mode, setMode] = useState<'queue' | 'display'>('queue');
  const [teamName, setTeamName] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentTeam, setCurrentTeam] = useState<string | null>(null);
  const [currentPhotos, setCurrentPhotos] = useState<Photo[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);

  // Fetch queue
  const fetchQueue = useCallback(async () => {
    const { data } = await supabase
      .from('queue')
      .select('*')
      .in('status', ['waiting', 'displaying'])
      .order('created_at', { ascending: true });
    if (data) setQueue(data);
  }, []);

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel('queue-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, () => {
        fetchQueue();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  // Join queue
  async function joinQueue() {
    if (!teamName.trim()) return;

    setIsJoining(true);
    try {
      const { error } = await supabase.from('queue').insert({
        team_name: teamName.trim(),
        status: 'waiting'
      });

      if (error) throw error;

      setJoinSuccess(true);
      setTeamName('');
      setTimeout(() => setJoinSuccess(false), 3000);
    } catch (err) {
      console.error('Join queue error:', err);
      alert('Failed to join queue. Please try again.');
    } finally {
      setIsJoining(false);
    }
  }

  // Process queue (for display mode)
  useEffect(() => {
    if (mode !== 'display') return;

    const processQueue = async () => {
      // Find next waiting team
      const waitingTeam = queue.find(q => q.status === 'waiting');
      if (!waitingTeam) {
        setCurrentTeam(null);
        setCurrentPhotos([]);
        return;
      }

      // Set as displaying
      await supabase
        .from('queue')
        .update({ status: 'displaying', displayed_at: new Date().toISOString() })
        .eq('id', waitingTeam.id);

      setCurrentTeam(waitingTeam.team_name);

      // Fetch photos for this team
      const { data: photos } = await supabase
        .from('photos')
        .select('*')
        .ilike('team_name', waitingTeam.team_name)
        .order('created_at', { ascending: false });

      setCurrentPhotos(photos || []);
      setPhotoIndex(0);

      // After display duration, mark as done
      setTimeout(async () => {
        await supabase
          .from('queue')
          .update({ status: 'done' })
          .eq('id', waitingTeam.id);
        fetchQueue();
      }, DISPLAY_DURATION);
    };

    // Check if we need to process next
    const displayingTeam = queue.find(q => q.status === 'displaying');
    if (!displayingTeam) {
      processQueue();
    } else {
      setCurrentTeam(displayingTeam.team_name);
      // Fetch photos
      supabase
        .from('photos')
        .select('*')
        .ilike('team_name', displayingTeam.team_name)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          setCurrentPhotos(data || []);
        });
    }
  }, [mode, queue, fetchQueue]);

  // Cycle through photos
  useEffect(() => {
    if (mode !== 'display' || currentPhotos.length <= 1) return;

    const interval = setInterval(() => {
      setPhotoIndex(prev => (prev + 1) % currentPhotos.length);
    }, 4000); // Change photo every 4 seconds

    return () => clearInterval(interval);
  }, [mode, currentPhotos.length]);

  // Queue view (for participants to join)
  if (mode === 'queue') {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image src="/saturn-logo.svg" alt="Saturn" width={100} height={18} />
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Photo Booth Queue</span>
          </div>
          <button
            onClick={() => setMode('display')}
            className="btn-primary"
          >
            Switch to Display Mode
          </button>
        </div>

        <div className="max-w-lg mx-auto p-6">
          {/* Join form */}
          <div className="card p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Join the Queue</h2>
            <p className="text-gray-600 mb-4">
              Enter your team name to display your photos on the big screen!
            </p>

            {joinSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
                You&apos;re in the queue! Watch the screen for your turn.
              </div>
            )}

            <div className="flex gap-3">
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Your team name"
                className="form-input flex-1"
                onKeyDown={(e) => e.key === 'Enter' && joinQueue()}
              />
              <button
                onClick={joinQueue}
                disabled={isJoining || !teamName.trim()}
                className="btn-primary px-6 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                {isJoining ? '...' : 'Join'}
              </button>
            </div>
          </div>

          {/* Current queue */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
              Current Queue ({queue.filter(q => q.status === 'waiting').length} waiting)
            </h3>
            <div className="space-y-2">
              {queue.map((item, index) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-lg border ${
                    item.status === 'displaying'
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-medium">#{index + 1}</span>
                      <span className="font-medium">{item.team_name}</span>
                    </div>
                    {item.status === 'displaying' && (
                      <span className="text-sm text-blue-600 font-medium animate-pulse">
                        Now Showing
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {queue.length === 0 && (
                <p className="text-gray-400 text-center py-8">
                  No one in queue. Be the first!
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Display mode (for the truck screen)
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Back button (small, top corner) */}
      <button
        onClick={() => setMode('queue')}
        className="absolute top-4 left-4 z-50 text-white/50 hover:text-white text-sm"
      >
        ← Back to Queue
      </button>

      {currentTeam && currentPhotos.length > 0 ? (
        <>
          {/* Main photo display */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="relative w-full h-full animate-fade-in"
              key={currentPhotos[photoIndex]?.id}
            >
              <img
                src={currentPhotos[photoIndex]?.image_url}
                alt={currentTeam}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Team name overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black via-black/80 to-transparent p-8">
            <div className="max-w-4xl mx-auto flex items-end justify-between">
              <div>
                <p className="text-white/60 text-lg mb-2">Now Showing</p>
                <h1 className="text-5xl font-bold tracking-tight animate-slide-up">
                  {currentTeam}
                </h1>
              </div>
              <div className="text-right">
                <p className="text-white/60">
                  Photo {photoIndex + 1} of {currentPhotos.length}
                </p>
                <div className="flex gap-1 mt-2">
                  {currentPhotos.map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${
                        i === photoIndex ? 'bg-white' : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Queue preview */}
          {queue.filter(q => q.status === 'waiting').length > 0 && (
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur rounded-lg p-4">
              <p className="text-white/60 text-sm mb-2">Up Next</p>
              <div className="space-y-1">
                {queue
                  .filter(q => q.status === 'waiting')
                  .slice(0, 3)
                  .map((item, i) => (
                    <p key={item.id} className="text-sm">
                      {i + 1}. {item.team_name}
                    </p>
                  ))}
              </div>
            </div>
          )}
        </>
      ) : currentTeam ? (
        /* Team has no photos */
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-4">{currentTeam}</h1>
            <p className="text-white/60 text-xl">No photos uploaded yet!</p>
            <p className="text-white/40 mt-2">Scan the QR code to add photos</p>
          </div>
        </div>
      ) : (
        /* Idle state */
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Image
              src="/saturn-logo.svg"
              alt="Saturn"
              width={200}
              height={36}
              className="mx-auto mb-8 invert"
            />
            <h1 className="text-4xl font-bold mb-4">Photo Booth</h1>
            <p className="text-white/60 text-xl">Scan the QR code to join the queue</p>
            <p className="text-white/40 mt-2">Your photos will appear on this screen!</p>

            {queue.filter(q => q.status === 'waiting').length > 0 && (
              <div className="mt-8">
                <p className="text-white/60 mb-2">In Queue:</p>
                <p className="text-2xl font-medium">
                  {queue.filter(q => q.status === 'waiting').map(q => q.team_name).join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: scale(1.05); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
