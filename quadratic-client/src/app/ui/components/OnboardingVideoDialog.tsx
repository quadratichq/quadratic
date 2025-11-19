import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/shadcn/ui/dialog';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';

const ONBOARDING_VIDEO_MANIFEST_URL =
  'https://customer-ia5m0yvds0jb4gxr.cloudflarestream.com/6ca8c5bde0049926eb96ae6db577bf7c/manifest/video.m3u8';

interface OnboardingVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OnboardingVideoDialog = ({ open, onOpenChange }: OnboardingVideoDialogProps) => {
  const [startedPlaying, setStartedPlaying] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls>(null);
  useEffect(() => {
    if (!videoRef.current) return;
    if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = ONBOARDING_VIDEO_MANIFEST_URL;
    } else if (Hls.isSupported()) {
      hlsRef.current = new Hls({
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        startLevel: -1,
      });
      hlsRef.current.attachMedia(videoRef.current);
      hlsRef.current.loadSource(ONBOARDING_VIDEO_MANIFEST_URL);
    }

    videoRef.current.play().catch((error) => {
      console.error('Error playing video', error);
    });
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Onboarding Video</DialogTitle>
        <DialogDescription>Watch the Quadratic 101 tutorial video</DialogDescription>
      </DialogHeader>
      <DialogContent
        onClick={() => {
          onOpenChange(false);
        }}
        className="flex h-screen max-h-none w-screen max-w-none translate-y-0 items-center justify-center rounded-none bg-background/0 p-0"
      >
        <video
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
