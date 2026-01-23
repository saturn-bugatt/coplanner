'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';

// Only create client if env vars exist
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

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
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Debug logging helper
  const log = useCallback((message: string) => {
    console.log(`[Booth] ${message}`);
    setDebugLog(prev => [...prev.slice(-19), `${new Date().toLocaleTimeString()}: ${message}`]);
  }, []);

  // Check if Supabase is configured
  useEffect(() => {
    if (!supabase) {
      log('ERROR: Supabase not configured - missing env vars');
      log(`SUPABASE_URL exists: ${!!supabaseUrl}`);
      log(`SUPABASE_KEY exists: ${!!supabaseKey}`);
      setError('Database not configured. Please check environment variables.');
    } else {
      log('Supabase client initialized successfully');
    }
  }, [log]);

  // Fetch queue
  const fetchQueue = useCallback(async () => {
    if (!supabase) {
      log('ERROR: Cannot fetch queue - Supabase not configured');
      return;
    }

    log('Fetching queue from database...');
    try {
      const { data, error: fetchError } = await supabase
        .from('queue')
        .select('*')
        .in('status', ['waiting', 'displaying'])
        .order('created_at', { ascending: true });

      if (fetchError) {
        log(`ERROR fetching queue: ${fetchError.message}`);
        setError(`Failed to fetch queue: ${fetchError.message}`);
        return;
      }

      log(`Fetched ${data?.length || 0} queue items`);
      if (data) {
        const waiting = data.filter(q => q.status === 'waiting').length;
        const displaying = data.filter(q => q.status === 'displaying').length;
        log(`Queue breakdown: ${waiting} waiting, ${displaying} displaying`);
        setQueue(data);
      }
    } catch (err: any) {
      log(`ERROR in fetchQueue: ${err.message || err}`);
      setError(`Queue fetch error: ${err.message || 'Unknown error'}`);
    }
  }, [log]);

  // Initial fetch and real-time subscription
  useEffect(() => {
    if (!supabase) {
      log('Skipping queue subscription - Supabase not configured');
      return;
    }

    log('Starting initial queue fetch...');
    fetchQueue();

    log('Setting up real-time subscription for queue changes...');
    try {
      const channel = supabase
        .channel('queue-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'queue' }, (payload) => {
          log(`Real-time event received: ${payload.eventType} on queue table`);
          fetchQueue();
        })
        .subscribe((status) => {
          log(`Real-time subscription status: ${status}`);
        });

      return () => {
        log('Cleaning up real-time subscription');
        supabase.removeChannel(channel);
      };
    } catch (err: any) {
      log(`ERROR setting up real-time subscription: ${err.message || err}`);
    }
  }, [fetchQueue, log]);

  // Join queue
  async function joinQueue() {
    if (!teamName.trim()) {
      log('Join cancelled: empty team name');
      return;
    }

    if (!supabase) {
      log('ERROR: Cannot join queue - Supabase not configured');
      setError('Database not configured');
      return;
    }

    setIsJoining(true);
    setError(null);
    log(`Attempting to join queue with team name: "${teamName.trim()}"`);

    try {
      const { data, error: insertError } = await supabase.from('queue').insert({
        team_name: teamName.trim(),
        status: 'waiting'
      }).select().single();

      if (insertError) {
        log(`ERROR inserting into queue: ${insertError.message}`);
        throw insertError;
      }

      log(`Successfully joined queue with ID: ${data?.id}`);
      setJoinSuccess(true);
      setTeamName('');
      setTimeout(() => {
        setJoinSuccess(false);
        log('Join success message cleared');
      }, 3000);
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      log(`ERROR in joinQueue: ${errorMsg}`);
      setError(`Failed to join queue: ${errorMsg}`);
    } finally {
      setIsJoining(false);
    }
  }

  // Handle mode change
  const handleModeChange = (newMode: 'queue' | 'display') => {
    log(`Switching mode from "${mode}" to "${newMode}"`);
    setMode(newMode);
  };

  // Process queue (for display mode)
  useEffect(() => {
    if (mode !== 'display') {
      return;
    }

    if (!supabase) {
      log('ERROR: Cannot process queue in display mode - Supabase not configured');
      return;
    }

    log('Display mode active - processing queue...');

    const processQueue = async () => {
      try {
        // Find next waiting team
        const waitingTeam = queue.find(q => q.status === 'waiting');
        if (!waitingTeam) {
          log('No waiting teams in queue');
          setCurrentTeam(null);
          setCurrentPhotos([]);
          return;
        }

        log(`Processing next team: "${waitingTeam.team_name}" (ID: ${waitingTeam.id})`);

        // Set as displaying
        log('Updating team status to "displaying"...');
        const { error: updateError } = await supabase
          .from('queue')
          .update({ status: 'displaying', displayed_at: new Date().toISOString() })
          .eq('id', waitingTeam.id);

        if (updateError) {
          log(`ERROR updating queue status: ${updateError.message}`);
        } else {
          log('Queue status updated to "displaying"');
        }

        setCurrentTeam(waitingTeam.team_name);

        // Fetch photos for this team
        log(`Fetching photos for team: "${waitingTeam.team_name}"`);
        const { data: photos, error: photosError } = await supabase
          .from('photos')
          .select('*')
          .ilike('team_name', waitingTeam.team_name)
          .order('created_at', { ascending: false });

        if (photosError) {
          log(`ERROR fetching photos: ${photosError.message}`);
        } else {
          log(`Fetched ${photos?.length || 0} photos for team`);
        }

        setCurrentPhotos(photos || []);
        setPhotoIndex(0);

        // After display duration, mark as done
        log(`Setting ${DISPLAY_DURATION}ms timer for display duration`);
        setTimeout(async () => {
          log(`Display time complete for "${waitingTeam.team_name}" - marking as done`);
          try {
            const { error: doneError } = await supabase
              .from('queue')
              .update({ status: 'done' })
              .eq('id', waitingTeam.id);

            if (doneError) {
              log(`ERROR marking team as done: ${doneError.message}`);
            } else {
              log('Team marked as done, fetching updated queue');
            }
            fetchQueue();
          } catch (err: any) {
            log(`ERROR in done callback: ${err.message || err}`);
          }
        }, DISPLAY_DURATION);
      } catch (err: any) {
        log(`ERROR in processQueue: ${err.message || err}`);
      }
    };

    // Check if we need to process next
    const displayingTeam = queue.find(q => q.status === 'displaying');
    if (!displayingTeam) {
      log('No team currently displaying - starting next team');
      processQueue();
    } else {
      log(`Team currently displaying: "${displayingTeam.team_name}"`);
      setCurrentTeam(displayingTeam.team_name);
      // Fetch photos
      log(`Fetching photos for currently displaying team: "${displayingTeam.team_name}"`);
      (async () => {
        try {
          const { data, error: photosError } = await supabase
            .from('photos')
            .select('*')
            .ilike('team_name', displayingTeam.team_name)
            .order('created_at', { ascending: false });

          if (photosError) {
            log(`ERROR fetching photos for displaying team: ${photosError.message}`);
          } else {
            log(`Fetched ${data?.length || 0} photos for displaying team`);
          }
          setCurrentPhotos(data || []);
        } catch (err: any) {
          log(`ERROR fetching displaying team photos: ${err.message || err}`);
        }
      })();
    }
  }, [mode, queue, fetchQueue, log]);

  // Cycle through photos
  useEffect(() => {
    if (mode !== 'display' || currentPhotos.length <= 1) return;

    log(`Starting photo cycle interval (${currentPhotos.length} photos, 4s each)`);
    const interval = setInterval(() => {
      setPhotoIndex(prev => {
        const next = (prev + 1) % currentPhotos.length;
        log(`Photo cycle: ${prev + 1} -> ${next + 1} of ${currentPhotos.length}`);
        return next;
      });
    }, 4000); // Change photo every 4 seconds

    return () => {
      log('Clearing photo cycle interval');
      clearInterval(interval);
    };
  }, [mode, currentPhotos.length, log]);

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
            onClick={() => handleModeChange('display')}
            className="btn-primary"
          >
            Switch to Display Mode
          </button>
        </div>

        <div className="max-w-lg mx-auto p-6">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

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
                disabled={isJoining || !teamName.trim() || !supabase}
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

          {/* Debug log */}
          {debugLog.length > 0 && (
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 mb-2">Debug Log:</p>
              <div className="text-xs font-mono text-gray-600 space-y-1 max-h-48 overflow-y-auto">
                {debugLog.map((entry, i) => (
                  <div key={i} className={entry.includes('ERROR') ? 'text-red-600' : ''}>
                    {entry}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Display mode (for the truck screen)
  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Back button (small, top corner) */}
      <button
        onClick={() => handleModeChange('queue')}
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
                onError={() => log(`ERROR loading image for ${currentTeam}`)}
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

      {/* Debug log overlay for display mode */}
      {debugLog.length > 0 && (
        <div className="absolute bottom-4 left-4 max-w-md bg-black/80 backdrop-blur rounded-lg p-3 z-40">
          <p className="text-xs font-medium text-white/50 mb-1">Debug Log:</p>
          <div className="text-xs font-mono text-white/70 space-y-0.5 max-h-32 overflow-y-auto">
            {debugLog.slice(-5).map((entry, i) => (
              <div key={i} className={entry.includes('ERROR') ? 'text-red-400' : ''}>
                {entry}
              </div>
            ))}
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
