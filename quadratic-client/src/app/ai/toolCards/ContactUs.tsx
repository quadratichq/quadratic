import { editorInteractionStateShowFeedbackMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { MailIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { AITool, aiToolsSpec } from 'quadratic-shared/ai/specs/aiToolsSpec';
import type { AIToolCall } from 'quadratic-shared/typesAndSchemasAI';
import { memo, useCallback, useEffect, useState } from 'react';
import { useSetRecoilState } from 'recoil';
import type { z } from 'zod';
import { ToolCard } from './ToolCard';

type ContactUsResponse = z.infer<(typeof aiToolsSpec)[AITool.ContactUs]['responseSchema']>;

export const ContactUs = memo(
  ({ toolCall: { arguments: args, loading }, className }: { toolCall: AIToolCall; className: string }) => {
    const [toolArgs, setToolArgs] = useState<z.SafeParseReturnType<ContactUsResponse, ContactUsResponse>>();
    const setShowFeedbackMenu = useSetRecoilState(editorInteractionStateShowFeedbackMenuAtom);

    useEffect(() => {
      if (loading) {
        setToolArgs(undefined);
        return;
      }

      try {
        const json = JSON.parse(args);
        setToolArgs(aiToolsSpec[AITool.ContactUs].responseSchema.safeParse(json));
      } catch (error) {
        setToolArgs(undefined);
        console.error('[ContactUs] Failed to parse args: ', error);
      }
    }, [args, loading]);

    const handleContactClick = useCallback(() => {
      trackEvent('[AI].contact-us-clicked');
      setShowFeedbackMenu(true);
    }, [setShowFeedbackMenu]);

    const icon = <MailIcon />;
    const label = 'Contact Support';

    if (loading) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    if (!!toolArgs && !toolArgs.success) {
      return <ToolCard icon={icon} label={label} hasError className={className} />;
    } else if (!toolArgs || !toolArgs.data) {
      return <ToolCard icon={icon} label={label} isLoading className={className} />;
    }

    return (
      <ToolCard
        icon={icon}
        label={label}
        description="Get help from the Quadratic team"
        className={className}
        actions={
          <Button size="sm" variant="default" onClick={handleContactClick}>
            Contact us
          </Button>
        }
      />
    );
  }
);
