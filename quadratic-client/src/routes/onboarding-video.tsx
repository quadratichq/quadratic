import { YOUTUBE_CHANNEL } from '@/shared/constants/urls';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

const ONBOARDING_VIDEO_MANIFEST_URL =
  'https://customer-ia5m0yvds0jb4gxr.cloudflarestream.com/6ca8c5bde0049926eb96ae6db577bf7c/manifest/video.m3u8';

export const Component = () => {
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
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, []);

  // Fire event if this component mounts
  useEffect(() => {
    trackEvent('[OnboardingVideo].loaded');
  }, []);

  useRemoveInitialLoadingUI();

  const btnClassName = 'h-12 w-40 px-8 text-base';

  return (
    <div className="grid h-full w-full place-items-center overflow-auto px-2 py-4">
      <div className="flex w-full max-w-7xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold">Get started in ~90 seconds</h1>

          <p className="text-center text-lg text-muted-foreground">
            {'Find more instructional videos on '}
            <a
              href={YOUTUBE_CHANNEL}
              target="_blank"
              rel="noreferrer"
              className="underline"
              onClick={() => trackEvent('[OnboardingVideo].clickedYouTubeChannel')}
            >
              our YouTube channel
            </a>
            .
          </p>
        </div>

        <video
          ref={videoRef}
          onPlay={() => {
            if (startedPlaying) return;
            trackEvent('[OnboardingVideo].startedPlaying');
            setStartedPlaying(true);
          }}
          onEnded={() => {
            trackEvent('[OnboardingVideo].completedPlaying');
          }}
          controls
          crossOrigin="anonymous"
          width={800}
          height={450}
          style={{ width: '100%', height: 'auto' }}
          className="w-full max-w-5xl rounded-lg border border-border shadow-xl"
        />

        <div className="mb-8 flex justify-center gap-2">
          <Button
            asChild
            variant="outline"
            onClick={() => {
              trackEvent('[OnboardingVideo].skipped');
            }}
            className={btnClassName}
          >
            <Link to="/files/create" reloadDocument>
              Skip
            </Link>
          </Button>

          {startedPlaying ? (
            <Button asChild className={btnClassName}>
              <Link to="/files/create" reloadDocument>
                Get started
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() => {
                videoRef.current?.play();
              }}
              className={btnClassName}
            >
              Play video
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
