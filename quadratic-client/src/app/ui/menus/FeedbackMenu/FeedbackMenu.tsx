import { editorInteractionStateShowFeedbackMenuAtom } from '@/app/atoms/editorInteractionStateAtom';
import { useRootRouteLoaderData } from '@/routes/_root';
import { apiClient } from '@/shared/api/apiClient';
import { useGlobalSnackbar } from '@/shared/components/GlobalSnackbarProvider';
import { CONTACT_URL } from '@/shared/constants/urls';
import useLocalStorage from '@/shared/hooks/useLocalStorage';
import { Button } from '@/shared/shadcn/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/shadcn/ui/dialog';
import { useCallback, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export const FeedbackMenu = () => {
  const [showFeedbackMenu, setShowFeedbackMenu] = useRecoilState(editorInteractionStateShowFeedbackMenuAtom);
  // We'll keep the user's state around unless they explicitly cancel or things submitted successfully
  const [value, setValue] = useLocalStorage('feedback-message', '');
  const formRef = useRef<HTMLFormElement>(null);
  const [hasValidationError, setHasValidationError] = useState<boolean>(false);
  const { addGlobalSnackbar } = useGlobalSnackbar();
  const { loggedInUser } = useRootRouteLoaderData();

  const closeMenu = useCallback(() => {
    setShowFeedbackMenu(false);
  }, [setShowFeedbackMenu]);

  const onSubmit = useCallback(async () => {
    const formData = new FormData(formRef.current as HTMLFormElement);
    const name = String(formData.get('name'));
    const feedback = String(formData.get('feedback'));
    const userEmail = loggedInUser?.email;

    if (feedback.length === 0) {
      setHasValidationError(true);
      return;
    }

    if (name.length > 0) {
      // Caught you bot!
      closeMenu();
      setValue('');
      return;
    }

    try {
      closeMenu();
      await apiClient.postFeedback({ feedback, userEmail });
      setValue('');
      addGlobalSnackbar('Feedback submitted! Thank you.');
    } catch (error) {
      addGlobalSnackbar('Failed to submit feedback. Please try again.', { severity: 'error' });
    }
  }, [addGlobalSnackbar, closeMenu, setValue, loggedInUser?.email]);

  if (!showFeedbackMenu) {
    return null;
  }

  return (
    <Dialog open={true} onOpenChange={closeMenu}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Provide feedback</DialogTitle>
          <DialogDescription>
            Or{' '}
            <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline hover:text-primary">
              contact us directly
            </a>{' '}
            with any questions, we’d love to hear from you!
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          id="feedback-form"
          ref={formRef}
        >
          <textarea
            name="feedback"
            aria-label="Feedback"
            placeholder="Please make Quadratic better by..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            rows={6}
            autoFocus
            defaultValue={value}
            onKeyDown={(event) => {
              // Allow submit via keyboard CMD + Enter
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                onSubmit();
              }
            }}
            onChange={(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              setValue(event.target.value);
            }}
          />
          {hasValidationError && <p className="mt-1 text-sm text-destructive">Required.</p>}
          <input type="text" name="name" className="hidden" />
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setValue('');
              closeMenu();
            }}
          >
            Cancel
          </Button>
          <Button form="feedback-form" type="submit">
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
