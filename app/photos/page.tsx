'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '@/components/Sidebar';

// Only create client if env vars exist
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

interface Photo {
  id: string;
  team_name: string;
  email: string | null;
  image_url: string;
  created_at: string;
}

export default function PhotosPage() {
  const [activeTab, setActiveTab] = useState<'upload' | 'wall'>('upload');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [teamName, setTeamName] = useState('');
  const [email, setEmail] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Debug logging helper
  const log = (message: string) => {
    console.log(`[PhotoBooth] ${message}`);
    setDebugLog(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Check if Supabase is configured
  useEffect(() => {
    if (!supabase) {
      log('ERROR: Supabase not configured - missing env vars');
      setError('Database not configured. Please contact support.');
    } else {
      log('Supabase client initialized');
    }
  }, []);

  // Fetch photos
  useEffect(() => {
    if (!supabase) return;

    fetchPhotos();

    // Subscribe to real-time updates
    log('Setting up real-time subscription...');
    const channel = supabase
      .channel('photos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos' }, (payload) => {
        log(`New photo received via realtime: ${payload.new.team_name}`);
        setPhotos(prev => [payload.new as Photo, ...prev]);
      })
      .subscribe((status) => {
        log(`Realtime subscription status: ${status}`);
      });

    return () => {
      log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPhotos() {
    if (!supabase) return;

    log('Fetching photos from database...');
    try {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        log(`ERROR fetching photos: ${error.message}`);
        throw error;
      }

      log(`Fetched ${data?.length || 0} photos`);
      if (data) setPhotos(data);
    } catch (err) {
      log(`ERROR in fetchPhotos: ${err}`);
    }
  }

  // Camera functions
  async function startCamera() {
    log('Starting camera...');
    setError(null);

    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available. Please use HTTPS or localhost.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      log('Camera stream obtained');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
        log('Camera active');
      }
    } catch (err: any) {
      const errorMsg = err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera permissions and refresh.'
        : err.name === 'NotFoundError'
        ? 'No camera found on this device.'
        : `Camera error: ${err.message}`;

      log(`ERROR starting camera: ${errorMsg}`);
      setError(errorMsg);
    }
  }

  function stopCamera() {
    log('Stopping camera');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function capturePhoto() {
    log('Capturing photo...');
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      log(`Canvas size: ${canvas.width}x${canvas.height}`);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.85);
        log(`Image captured, size: ${Math.round(imageData.length / 1024)}KB`);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  }

  function retakePhoto() {
    log('Retaking photo');
    setCapturedImage(null);
    setError(null);
    startCamera();
  }

  async function uploadPhoto() {
    if (!capturedImage || !teamName.trim()) {
      log('Upload cancelled: missing image or team name');
      return;
    }

    if (!supabase) {
      setError('Database not configured');
      return;
    }

    setIsUploading(true);
    setUploadSuccess(false);
    setError(null);

    log(`Starting upload for team: ${teamName}`);

    try {
      // Step 1: Convert base64 to blob
      log('Converting image to blob...');
      const base64Data = capturedImage.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/jpeg' });

      log(`Blob created, size: ${Math.round(blob.size / 1024)}KB`);

      // Step 2: Generate unique filename
      const timestamp = Date.now();
      const sanitizedName = teamName.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const fileName = `${timestamp}-${sanitizedName}.jpg`;
      log(`Uploading to storage as: ${fileName}`);

      // Step 3: Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        log(`ERROR uploading to storage: ${JSON.stringify(uploadError)}`);
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      log(`Storage upload successful: ${uploadData.path}`);

      // Step 4: Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      log(`Public URL: ${urlData.publicUrl}`);

      // Step 5: Save to photos table
      log('Saving to photos table...');
      const { data: dbData, error: dbError } = await supabase.from('photos').insert({
        team_name: teamName.trim(),
        email: email.trim() || null,
        image_url: urlData.publicUrl
      }).select().single();

      if (dbError) {
        log(`ERROR saving to database: ${JSON.stringify(dbError)}`);
        throw new Error(`Database save failed: ${dbError.message}`);
      }

      log(`Database save successful, ID: ${dbData?.id}`);

      // Success!
      setUploadSuccess(true);
      setCapturedImage(null);
      setTeamName('');
      setEmail('');
      log('Upload complete!');

      setTimeout(() => setUploadSuccess(false), 5000);

    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error occurred';
      log(`UPLOAD FAILED: ${errorMsg}`);
      setError(`Upload failed: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1">
        {/* Page header */}
        <div className="page-header">
          <h1 className="page-title">Photo Booth</h1>
        </div>

        {/* Tabs */}
        <div className="tabs">
          <div
            className={`tab cursor-pointer ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Take Photo
          </div>
          <div
            className={`tab cursor-pointer ${activeTab === 'wall' ? 'active' : ''}`}
            onClick={() => setActiveTab('wall')}
          >
            Photo Wall ({photos.length})
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'upload' ? (
            <div className="max-w-xl mx-auto">
              {/* Success message */}
              {uploadSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                  ✅ Photo uploaded successfully! Check the Photo Wall.
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  ❌ {error}
                </div>
              )}

              {/* Camera / Preview */}
              <div className="mb-6 bg-gray-100 rounded-lg overflow-hidden aspect-video relative">
                {!cameraActive && !capturedImage && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <button
                      onClick={startCamera}
                      className="btn-primary px-8 py-3"
                    >
                      <svg className="w-5 h-5 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Open Camera
                    </button>
                  </div>
                )}

                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${cameraActive ? '' : 'hidden'}`}
                />

                {capturedImage && (
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                )}

                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Camera controls */}
              {cameraActive && (
                <div className="mb-6 flex justify-center gap-4">
                  <button
                    onClick={capturePhoto}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                  >
                    📸 Capture
                  </button>
                  <button
                    onClick={stopCamera}
                    className="btn-primary px-8 py-3"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {capturedImage && (
                <div className="mb-6 flex justify-center gap-4">
                  <button
                    onClick={retakePhoto}
                    className="btn-primary px-6 py-2"
                  >
                    🔄 Retake
                  </button>
                </div>
              )}

              {/* Form */}
              {capturedImage && (
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Team Name *</label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="Enter your team name"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">Email (optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="form-input"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      Remember this to view your photos at the truck!
                    </p>
                  </div>
                  <button
                    onClick={uploadPhoto}
                    disabled={isUploading || !teamName.trim()}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUploading ? '⏳ Uploading...' : '📤 Upload Photo'}
                  </button>
                </div>
              )}

              {/* Debug log (only show if there are errors) */}
              {(error || debugLog.length > 0) && (
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-500 mb-2">Debug Log:</p>
                  <div className="text-xs font-mono text-gray-600 space-y-1">
                    {debugLog.map((log, i) => (
                      <div key={i} className={log.includes('ERROR') ? 'text-red-600' : ''}>
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Photo Wall */
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group"
                  >
                    <img
                      src={photo.image_url}
                      alt={photo.team_name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        log(`Image load error for ${photo.team_name}`);
                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ddd" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999">Error</text></svg>';
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <p className="text-white font-medium text-sm">{photo.team_name}</p>
                      <p className="text-white/70 text-xs">
                        {new Date(photo.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {photos.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  No photos yet. Be the first to upload!
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
