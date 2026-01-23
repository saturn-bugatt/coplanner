'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Sidebar from '@/components/Sidebar';
import Image from 'next/image';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch photos
  useEffect(() => {
    fetchPhotos();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('photos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'photos' }, (payload) => {
        setPhotos(prev => [payload.new as Photo, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPhotos() {
    const { data } = await supabase
      .from('photos')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPhotos(data);
  }

  // Camera functions
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      alert('Could not access camera. Please allow camera permissions.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function capturePhoto() {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        setCapturedImage(imageData);
        stopCamera();
      }
    }
  }

  function retakePhoto() {
    setCapturedImage(null);
    startCamera();
  }

  async function uploadPhoto() {
    if (!capturedImage || !teamName.trim()) return;

    setIsUploading(true);
    setUploadSuccess(false);

    try {
      // Convert base64 to blob
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${teamName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photos')
        .upload(fileName, blob, { contentType: 'image/jpeg' });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(fileName);

      // Save to photos table
      const { error: dbError } = await supabase.from('photos').insert({
        team_name: teamName.trim(),
        email: email.trim() || null,
        image_url: urlData.publicUrl
      });

      if (dbError) throw dbError;

      setUploadSuccess(true);
      setCapturedImage(null);
      setTeamName('');
      setEmail('');

      setTimeout(() => setUploadSuccess(false), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload photo. Please try again.');
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
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Take Photo
          </div>
          <div
            className={`tab ${activeTab === 'wall' ? 'active' : ''}`}
            onClick={() => setActiveTab('wall')}
          >
            Photo Wall ({photos.length})
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'upload' ? (
            <div className="max-w-xl mx-auto">
              {uploadSuccess && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
                  Photo uploaded successfully! Check the Photo Wall.
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Open Camera</span>
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
                    className="btn-primary px-8 py-3 bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
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
                    Retake
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
                    className="btn-primary w-full justify-center py-3 bg-blue-600 text-white border-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Photo'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Photo Wall */
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
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-medium text-sm">{photo.team_name}</p>
                    <p className="text-white/70 text-xs">
                      {new Date(photo.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {photos.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400">
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
