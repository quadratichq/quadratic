import { YOUTUBE_CHANNEL } from '@/shared/constants/urls';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useEffect, useRef, useState } from 'react';

export function OnboardingVideo({ onClose }: { onClose: () => void }) {
  const [startedPlaying, setStartedPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fire event if this component mounts
  useEffect(() => {
    trackEvent('[OnboardingVideo].loaded');
  }, []);

  return (
    <div className="grid h-full w-full place-items-center overflow-auto px-4 py-8">
      <div className="flex w-full max-w-7xl flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold">Getting started in 90 seconds</h1>
          <p className="text-center text-lg text-muted-foreground">
            You can always find more instructional videos on{' '}
            <a
              href={YOUTUBE_CHANNEL}
              target="_blank"
              rel="noreferrer"
              className="underline"
              onClick={() => trackEvent('[OnboardingVideo].clickedYouTubeChannel')}
            >
              our YouTube channel
            </a>
          </p>
        </div>
        <video
          ref={videoRef}
          onEnded={() => {
            trackEvent('[OnboardingVideo].completedPlaying');
          }}
          onPlay={() => {
            if (!startedPlaying) {
              setStartedPlaying(true);
              trackEvent('[OnboardingVideo].startedPlaying');
              console.log('startedPlaying');
            }
          }}
          controls
          width="800"
          height="450"
          // TODO: do we want the poster from youtube?
          // and where do we want to host the video?
          poster="https://img.youtube.com/vi/tyS9H0exaj8/maxresdefault.jpg"
          className="w-full max-w-5xl rounded-lg border border-border shadow-xl"
        >
          <source src="https://cdn.jim-nielsen.com/shared/onboarding-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              trackEvent('[OnboardingVideo].skipped');
              onClose();
            }}
            className="h-12 w-40 px-8 text-base"
          >
            Skip
          </Button>
          <Button
            onClick={() => {
              if (!startedPlaying) {
                videoRef.current?.play();
              } else {
                onClose();
              }
            }}
            className="h-12 w-40 px-8 text-base"
          >
            {startedPlaying ? 'Get started' : 'Play video'}
          </Button>
        </div>
      </div>
    </div>
  );
}
