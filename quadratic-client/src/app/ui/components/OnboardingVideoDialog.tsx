import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

const ONBOARDING_VIDEO_MANIFEST_URL =
  'https://customer-ia5m0yvds0jb4gxr.cloudflarestream.com/6ca8c5bde0049926eb96ae6db577bf7c/manifest/video.m3u8';

interface OnboardingVideoDialogProps {
  close: () => void;
  complete: () => void;
}

export const OnboardingVideoDialog = ({ close, complete }: OnboardingVideoDialogProps) => {
  const [startedPlaying, setStartedPlaying] = useState(false);
  const [videoKey, setVideoKey] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls>(null);

  // Update video key when dialog opens to force remount
  useEffect(() => {
    setVideoKey((prev) => prev + 1);
    setStartedPlaying(false);
  }, []);

  // Initialize video when element mounts (remounts on each dialog open due to key)
  useEffect(() => {
    if (!videoRef.current) return;

    const video = videoRef.current;

    const playVideo = () => {
      video.play().catch((error) => {
        console.error('Error playing video', error);
      });
    };

    // Set up video source and play
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = ONBOARDING_VIDEO_MANIFEST_URL;
      video.addEventListener('loadeddata', playVideo, { once: true });
    } else if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        startLevel: -1,
      });
      hlsRef.current.attachMedia(video);
      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
        playVideo();
      });
      hlsRef.current.loadSource(ONBOARDING_VIDEO_MANIFEST_URL);
    }

    return () => {
      video.removeEventListener('loadeddata', playVideo);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoKey]); // Re-run when video remounts

  return (
    <Dialog open={true} onOpenChange={close}>
      <DialogHeader className="sr-only">
        <DialogTitle>Onboarding Video</DialogTitle>
        <DialogDescription>Watch the Quadratic 101 tutorial video</DialogDescription>
      </DialogHeader>
      <DialogContent
        onClick={() => {
          close();
        }}
        className="flex h-screen max-h-none w-screen max-w-none translate-y-0 items-center justify-center rounded-none bg-background/0 p-0"
      >
        <video
          key={videoKey}
          ref={videoRef}
          onClick={(e) => {
            e.stopPropagation();
          }}
          onPlay={() => {
            if (startedPlaying) return;
            trackEvent('[OnboardingVideo].startedPlaying');
            setStartedPlaying(true);
          }}
          onEnded={() => {
            trackEvent('[OnboardingVideo].completedPlaying');
            complete();
          }}
          controls
          autoPlay
          crossOrigin="anonymous"
          width={800}
          height={450}
          style={{ width: '100%', height: 'auto' }}
          className="w-full max-w-6xl rounded-lg border border-border shadow-xl"
        />
      </DialogContent>
    </Dialog>
  );
};
