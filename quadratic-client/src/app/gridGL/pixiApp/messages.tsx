import { DOCUMENTATION_NEGATIVE_OFFSETS } from '@/shared/constants/urls';

export const messages: Record<string, JSX.Element | string> = {
  negative_offsets: (
    <span>
      Quadratic no longer supports zero or negative rows and columns. The data in your file was shifted. You may need to
      update Python or Javascript code to reflect this change. See{' '}
      <a
        className="underline"
        href={DOCUMENTATION_NEGATIVE_OFFSETS}
        target="_blank"
        rel="noreferrer"
        title="Information on removal of negative offsets"
      >
        this blog post
      </a>{' '}
      for more information.
    </span>
  ),
};
