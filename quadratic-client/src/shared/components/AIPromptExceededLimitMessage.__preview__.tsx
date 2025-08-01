import AIPromptExceededLimitMessage from '@/shared/components/AIPromptExceededLimitMessage';

export default function Preview() {
  return (
    <div className="flex max-w-sm flex-col gap-4">
      <AIPromptExceededLimitMessage action="set-limit" />
      <AIPromptExceededLimitMessage action="increase-limit" />
      <AIPromptExceededLimitMessage action="upgrade-plan" />
      <AIPromptExceededLimitMessage action="manage-usage-based-credits" />
      <AIPromptExceededLimitMessage action="contact-owner" />
    </div>
  );
}
