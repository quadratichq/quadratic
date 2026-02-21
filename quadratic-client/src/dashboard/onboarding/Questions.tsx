import { FreePlan } from '@/dashboard/billing/FreePlan';
import { ProPlan } from '@/dashboard/billing/ProPlan';
import {
  ControlCheckboxInputOther,
  // ControlCheckboxStacked,
  ControlLinkInline,
  ControlLinkStacked,
} from '@/dashboard/onboarding/Controls';
import { useOnboardingLoaderData } from '@/routes/teams.$teamUuid.onboarding';
// import { connectionsByType, potentialConnectionsByType } from '@/shared/components/connections/connectionsByType';
import { ArrowRightIcon, DesktopIcon, EducationIcon, PersonalIcon, WorkIcon } from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { trackEvent } from '@/shared/utils/analyticsEvents';
import { useEffect, useMemo, useRef, useState } from 'react';
import { isMobile } from 'react-device-detect';
import { Link, useFetcher, useNavigate, useSearchParams } from 'react-router';
import { atom, useRecoilState, useSetRecoilState } from 'recoil';

const FETCHER_KEY = 'onboarding-form-submission';
const RESET_FORM_DELAY = 600;

const roleOptionsByValue = {
  'data-analytics': 'Data / Analytics',
  product: 'Product',
  finance: 'Finance',
  'c-suite-management': 'C-Suite / Management',
  marketing: 'Marketing',
  sales: 'Sales',
  'software-development': 'Software Development',
  engineering: 'Engineering',
  'ml-ai': 'Machine Learning / AI',
  other: 'Other',
};

const referralSourceOptionsByValue = {
  search: 'Search engine (e.g. Google)',
  youtube: 'YouTube',
  'twitter-x': 'Twitter (X)',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  'word-of-mouth': 'Word of Mouth / Referral',
  email: 'Email',
  'paid-advertising': 'Paid advertising',
  other: 'Other',
};

const otherCheckboxAtom = atom<boolean>({
  key: 'onboardingOtherCheckboxAtom',
  default: false,
});
const isValidFormAtom = atom<boolean>({
  key: 'onboardingIsValidFormAtom',
  default: false,
});

type QuestionProps = {
  title: string;
  subtitle?: string;
  excludeForUse?: string[];
};

export const questionsById: Record<
  string,
  QuestionProps & { Form: (props: QuestionProps & { id: string }) => React.ReactNode }
> = {
  use: {
    title: 'How will you use Quadratic?',
    subtitle: 'Your answers help personalize your experience.',
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const options = [
        { value: 'work', label: 'Work', icon: <WorkIcon size="lg" className="text-primary" /> },
        { value: 'personal', label: 'Personal', icon: <PersonalIcon size="lg" className="text-primary" /> },
        { value: 'education', label: 'Education', icon: <EducationIcon size="lg" className="text-primary" /> },
      ];

      if (isMobile) {
        return (
          <Question title="Welcome to Quadratic!">
            <QuestionForm>
              <div className="flex flex-col items-center gap-4 px-6 text-center">
                <DesktopIcon size="2xl" className="text-muted-foreground" />
                <p className="text-lg text-muted-foreground">Quadratic is view only on mobile.</p>
                <p className="text-lg text-muted-foreground">Please switch to a laptop or desktop to get started.</p>
              </div>
              <input type="hidden" name={props.id} value="" />
            </QuestionForm>
          </Question>
        );
      }

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <div className="grid grid-cols-3 gap-2">
              {options.map(({ value, label, icon }) => (
                <Link
                  key={value}
                  to={`./?${searchParams.toString()}&${props.id}=${value}`}
                  onClick={() => trackNextQuestionClick(props.id)}
                  // Hardcoding `onboarding-btn-use-personal` here for future ease of cmd+f
                  data-testid={`onboarding-btn-use-${value}`}
                >
                  <ControlLinkStacked>
                    {icon}
                    <span className="relative flex items-center">
                      {label}
                      <ArrowRightIcon className="absolute left-full top-1/2 -translate-y-1/2 opacity-20 group-hover:text-primary group-hover:opacity-100" />
                    </span>
                  </ControlLinkStacked>
                </Link>
              ))}
            </div>
          </QuestionForm>
        </Question>
      );
    },
  },

  // Work / Education
  role: {
    title: 'What best describes your role?',
    excludeForUse: ['personal'],
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const [other, setOther] = useRecoilState(otherCheckboxAtom);

      // Randomize options order (keeping 'other' last) once per mount
      const shuffledOptions = useMemo(() => shuffleOptionsKeepOtherLast(Object.entries(roleOptionsByValue)), []);

      return (
        <Question title={props.title}>
          <QuestionForm>
            <div className="grid grid-cols-2 gap-2">
              {shuffledOptions.map(([value, label]) =>
                value === 'other' ? (
                  <ControlCheckboxInputOther
                    key={value}
                    id={props.id}
                    value={value}
                    checked={other}
                    onChange={setOther}
                  >
                    {label}
                  </ControlCheckboxInputOther>
                ) : (
                  <Link
                    to={`./?${searchParams.toString()}&${props.id}=${value}`}
                    key={value}
                    onClick={() => trackNextQuestionClick(props.id)}
                  >
                    <ControlLinkInline>{label}</ControlLinkInline>
                  </Link>
                )
              )}
            </div>
            <QuestionFormFooter>
              <BackButton />
              <Button type="submit" size="lg" disabled={!other} onClick={() => trackNextQuestionClick(props.id)}>
                Next
              </Button>
            </QuestionFormFooter>
          </QuestionForm>
        </Question>
      );
    },
  },
  'team-size': {
    title: 'How many people are on your team?',
    excludeForUse: ['personal'],
    Form: (props) => {
      const optionsByValue = {
        '1-5': '1-5',
        '6-20': '6-20',
        '21-100': '21-100',
        '101-250': '101-250',
        '251-1000': '251-1,000',
        '1000-or-more': '1,001+',
      };
      const [searchParams] = useSearchParams();
      return (
        <Question title={props.title}>
          <QuestionForm>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(optionsByValue).map(([value, label]) => (
                <Link
                  to={`./?${searchParams.toString()}&${props.id}=${value}`}
                  key={value}
                  onClick={() => trackNextQuestionClick(props.id)}
                >
                  <ControlLinkInline key={value}>{label}</ControlLinkInline>
                </Link>
              ))}
            </div>
            <QuestionFormFooter>
              <BackButton />
            </QuestionFormFooter>
          </QuestionForm>
        </Question>
      );
    },
  },

  // Shared
  // 'connections[]': {
  //   title: 'What data sources are you interested in connecting to?',
  //   // subtitle: 'Select all you are interested in.',
  //   Form: (props) => {
  //     const [other, setOther] = useRecoilState(otherCheckboxAtom);
  //     const [searchParams] = useSearchParams();

  //     // Build options array with proper type inference
  //     const options: Array<{
  //       name: string;
  //       value: string;
  //       Logo: React.ComponentType;
  //     }> = [
  //       ...(Object.keys(connectionsByType) as Array<keyof typeof connectionsByType>).map((key) => ({
  //         name: connectionsByType[key].name,
  //         value: key,
  //         Logo: connectionsByType[key].Logo,
  //       })),
  //       ...(Object.keys(potentialConnectionsByType) as Array<keyof typeof potentialConnectionsByType>).map((key) => ({
  //         name: potentialConnectionsByType[key].name,
  //         value: key,
  //         Logo: potentialConnectionsByType[key].Logo,
  //       })),
  //     ];

  //     // This is a bit messy, but we just want to move mixpanel to being down by
  //     // the other SaaS options, so put it right before Salesforce.
  //     const mixpanelIndex = options.findIndex((opt) => opt.value === 'MIXPANEL');
  //     const salesforceIndex = options.findIndex((opt) => opt.value === 'SALESFORCE');
  //     const optionsSorted = [...options];
  //     if (mixpanelIndex !== -1 && salesforceIndex !== -1) {
  //       const mixpanel = optionsSorted.splice(mixpanelIndex, 1)[0];
  //       const newSalesforceIndex = optionsSorted.findIndex((opt) => opt.value === 'SALESFORCE');
  //       optionsSorted.splice(newSalesforceIndex, 0, mixpanel);
  //     }

  //     return (
  //       <Question title={props.title} subtitle={props.subtitle}>
  //         <QuestionForm>
  //           <p className="flex items-center justify-center pb-4">
  //             <Button variant="link" size="lg" asChild>
  //               <Link to={`./?${searchParams.toString()}&${props.id}=`}>Skip, i'm not interested in any of these.</Link>
  //             </Button>
  //           </p>

  //           <div className="grid grid-cols-3 gap-2">
  //             {optionsSorted.map(({ name, value, Logo }) => {
  //               return value === 'OTHER' ? (
  //                 <ControlCheckboxInputOther
  //                   key={value}
  //                   id={props.id}
  //                   value={value.toLowerCase()}
  //                   checked={other}
  //                   onChange={setOther}
  //                   stacked
  //                 >
  //                   <Logo />
  //                 </ControlCheckboxInputOther>
  //               ) : (
  //                 <ControlCheckboxStacked name={props.id} value={value} key={value}>
  //                   <Logo />
  //                 </ControlCheckboxStacked>
  //               );
  //             })}
  //           </div>

  //           {/* Allows submission of empty values */}
  //           <input type="hidden" name={props.id} value="" />

  //           <QuestionFormFooter>
  //             <BackButton />
  //             <Button
  //               type="submit"
  //               size="lg"
  //               data-testid="onboarding-btn-connections-next"
  //               onClick={() => trackNextQuestionClick(props.id)}
  //             >
  //               Next
  //             </Button>
  //           </QuestionFormFooter>
  //         </QuestionForm>
  //       </Question>
  //     );
  //   },
  // },
  'team-name': {
    title: 'What’s your team name?',
    subtitle: 'This will appear as the name of your workspace in the app.',
    Form: (props) => {
      const { username } = useOnboardingLoaderData();
      const defaultTeamName = getDefaultUsername(username);
      const [isValid, setIsValid] = useState(Boolean(defaultTeamName));
      const inputRef = useRef<HTMLInputElement>(null);

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <Input
              data-testid="onboarding-input-team-name"
              ref={inputRef}
              className="h-12 w-full text-lg"
              type="text"
              name={props.id}
              defaultValue={defaultTeamName}
              autoFocus
              placeholder="e.g. Acme Corp."
              onChange={(e) => {
                setIsValid(e.target.value.length > 0);
              }}
            />
            <QuestionFormFooter>
              <BackButton />
              <Button
                type="submit"
                size="lg"
                disabled={!isValid}
                data-testid="onboarding-btn-team-name-next"
                onClick={() => trackNextQuestionClick(props.id)}
              >
                Next
              </Button>
            </QuestionFormFooter>
          </QuestionForm>
        </Question>
      );
    },
  },
  'team-invites[]': {
    title: 'Who would you like to invite to your team?',
    subtitle: 'Quadratic is better with your team. We’ll send them an invite.',
    Form: (props) => {
      const [values, setValues] = useState<string[]>(Array(4).fill(''));
      const [searchParams] = useSearchParams();

      // Reset the form values when search params change (navigating to next question)
      // We have to do this manually because form values are controlled not uncontrolled
      useEffect(() => {
        setTimeout(() => {
          setValues(Array(4).fill(''));
        }, RESET_FORM_DELAY);
      }, [searchParams]);

      const handleInputChange = (index: number, value: string) => {
        const newValues = [...values];
        newValues[index] = value;

        // Count how many fields have values
        const filledCount = newValues.filter((v) => v.trim().length > 0).length;
        const emptyCount = newValues.length - filledCount;

        // If there are no more empty fields, add 2 more
        if (emptyCount < 1) {
          setValues([...newValues, '', '']);
        } else {
          setValues(newValues);
        }
      };

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <div className="flex flex-col gap-2 md:grid md:grid-cols-2">
              {values.map((value, index) => (
                <Input
                  key={index}
                  className="h-12 w-full text-lg placeholder:text-muted-foreground/70"
                  type="email"
                  name={props.id}
                  placeholder={index === 0 ? 'john@example.com' : ''}
                  value={value}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                />
              ))}
            </div>
            <QuestionFormFooter>
              <BackButton />
              <Button
                type="submit"
                size="lg"
                data-testid="onboarding-btn-team-invites-next"
                onClick={() => trackNextQuestionClick(props.id)}
              >
                Next
              </Button>
            </QuestionFormFooter>
          </QuestionForm>
        </Question>
      );
    },
  },
  'referral-source': {
    title: 'How did you hear about Quadratic?',
    Form: (props) => {
      const [other, setOther] = useRecoilState(otherCheckboxAtom);
      const [searchParams] = useSearchParams();

      // Randomize options order (keeping 'other' last) once per mount
      const shuffledOptions = useMemo(
        () => shuffleOptionsKeepOtherLast(Object.entries(referralSourceOptionsByValue)),
        []
      );

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <div className="grid grid-cols-2 gap-2">
              {shuffledOptions.map(([value, label]) =>
                value === 'other' ? (
                  <ControlCheckboxInputOther
                    key={value}
                    id={props.id}
                    value={value}
                    checked={other}
                    onChange={setOther}
                  >
                    {label}
                  </ControlCheckboxInputOther>
                ) : (
                  <Link
                    to={`./?${searchParams.toString()}&${props.id}=${value}`}
                    key={value}
                    data-testid={`onboarding-btn-source-${value}`}
                    onClick={() => trackNextQuestionClick(props.id)}
                  >
                    <ControlLinkInline>{label}</ControlLinkInline>
                  </Link>
                )
              )}
              <input type="hidden" name={props.id} value="" />
            </div>
            <QuestionFormFooter>
              <BackButton />
              <Button type="submit" size="lg" onClick={() => trackNextQuestionClick(props.id)}>
                Next
              </Button>
            </QuestionFormFooter>
          </QuestionForm>
        </Question>
      );
    },
  },
  'team-plan': {
    title: 'Which plan would you like?',
    subtitle: 'Get started for free, or subscribe for full access.',
    Form: (props) => {
      const fetcher = useFetcher({ key: FETCHER_KEY });
      const isSubmitting = fetcher.state !== 'idle';
      const formActionUrl = fetcher.formAction || '';
      const isSubmittingFree = formActionUrl.includes(`${props.id}=free`);
      const isSubmittingPro = formActionUrl.includes(`${props.id}=pro`);
      const className = cn(
        'flex flex-col h-full w-full group relative rounded shadow-sm border border-border p-4 enabled:hover:border-primary enabled:hover:shadow-md'
      );

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="grid grid-cols-2 gap-4">
            <FreePlan className={className}>
              <Button
                data-testid="onboarding-btn-team-plan-free"
                type="submit"
                name={props.id}
                value="free"
                size="lg"
                className="mt-auto w-full"
                disabled={isSubmitting}
                loading={isSubmittingFree}
                onClick={() => trackNextQuestionClick(props.id)}
              >
                Use Quadratic for free
              </Button>
            </FreePlan>
            <ProPlan className={className}>
              <Button
                type="submit"
                name={props.id}
                value="pro"
                size="lg"
                variant="secondary"
                className="mt-4 w-full"
                disabled={isSubmitting}
                loading={isSubmittingPro}
                onClick={() => trackNextQuestionClick(props.id)}
              >
                Subscribe now
              </Button>
            </ProPlan>
          </QuestionForm>
        </Question>
      );
    },
  },
};

function BackButton() {
  const navigate = useNavigate();
  const fetcher = useFetcher({ key: FETCHER_KEY });
  const isSubmitting = fetcher.state !== 'idle';
  return (
    <Button type="reset" variant="secondary" size="lg" onClick={() => navigate(-1)} disabled={isSubmitting}>
      Back
    </Button>
  );
}

export function Questions() {
  const { currentId, currentIndex, currentQuestionStackIds } = useOnboardingLoaderData();
  const setOther = useSetRecoilState(otherCheckboxAtom);
  const setIsValid = useSetRecoilState(isValidFormAtom);
  const [searchParams] = useSearchParams();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Whenever the search params change, that means a new form is being rendered
  // so we want to reset any state used to represent the current active form
  useEffect(() => {
    setOther((prev) => (prev === true ? false : prev));
    setIsValid((prev) => (prev === true ? false : prev));

    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [searchParams, setOther, setIsValid]);

  const questionIds = Object.keys(questionsById);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex max-w-xl flex-col gap-8 pt-8">
        <Logo />

        <div className="relative w-full transition-all">
          <div className="relative min-h-[4rem]">
            {questionIds.map((id) => {
              const { Form, ...props } = questionsById[id];
              const isASubsequentQuestion =
                currentIndex === 0 ? true : currentQuestionStackIds.indexOf(id) > currentIndex;
              return (
                <div
                  key={id}
                  className={cn(
                    'absolute inset-0 transition-all duration-500 ease-in-out',
                    'transform',
                    // Current question
                    id === currentId
                      ? 'z-10 translate-x-0 opacity-100'
                      : // Next question(s)
                        isASubsequentQuestion
                        ? 'invisible z-0 translate-x-1/3 opacity-0'
                        : // Previous question(s)
                          'invisible z-0 -translate-x-1/3 opacity-0'
                  )}
                >
                  <Form id={id} {...props} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Logo() {
  const className = 'h-5 w-5 bg-border transition-colors';
  return (
    <div className="inline-grid grid-cols-2 justify-center gap-0.5">
      <div className={cn(className, 'justify-self-end', 'bg-[#CB8999]')} />
      <div className={cn(className, 'bg-[#8ECB89]')} />
      <div className={cn(className, 'justify-self-end', 'bg-[#5D576B]')} />
      <div className={cn(className, 'bg-[#6CD4FF]')} />
      <div className={cn(className, 'col-start-2', 'bg-[#FFC800]')} />
    </div>
  );
}

function Question({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-10">
      {title && (
        <header className="flex flex-col gap-1">
          <h2 className="text-center text-4xl font-bold">{title}</h2>
          {subtitle && <p className="text-center text-lg text-muted-foreground">{subtitle}</p>}
        </header>
      )}
      {children}
    </div>
  );
}

function QuestionForm({
  children,
  className,
  onChange,
}: {
  children: React.ReactNode;
  className?: string;
  onChange?: (e: React.FormEvent<HTMLFormElement>) => void;
}) {
  const fetcher = useFetcher({ key: FETCHER_KEY });
  const formRef = useRef<HTMLFormElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLastQuestion } = useOnboardingLoaderData();

  return (
    <fetcher.Form
      ref={formRef}
      onChange={(e) => {
        if (onChange) onChange(e);
      }}
      onSubmit={(e) => {
        e.preventDefault();

        // Get the current form's data
        const form = e.currentTarget as HTMLFormElement;
        const formData = new FormData(form);
        const values = Array.from(formData.entries());

        // If the button that was clicked was a submit button, append the name/value
        const submitButton = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (submitButton && submitButton.name && submitButton.value) {
          values.push([submitButton.name, submitButton.value]);
        }

        // Create a new version of the search params appending the old to the new
        const newSearchParams = new URLSearchParams(searchParams.toString());
        values.forEach(([key, value]) => {
          if (newSearchParams.has(key)) {
            newSearchParams.append(key, value as string);
          } else {
            newSearchParams.set(key, value as string);
          }
        });

        // If it's the last question, submit to our action
        if (isLastQuestion) {
          fetcher.submit(null, {
            method: 'POST',
            action: `./?${newSearchParams.toString()}`,
          });
          return;
        }

        // Otherwise update the search params and reset the current form
        setSearchParams(newSearchParams);
        setTimeout(() => {
          form.reset();
        }, RESET_FORM_DELAY);
      }}
      className={className}
    >
      {children}
    </fetcher.Form>
  );
}

function QuestionFormFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full items-center justify-center gap-2 pb-10 pt-10">{children}</div>;
}

/**
 * We use this to track whenever the user clicks an action in the onboading flow
 * that will advance them to the next question.
 */
function trackNextQuestionClick(questionId: string) {
  trackEvent('[Onboarding].clickedToNextQuestion', { questionId });
}

function getDefaultUsername(username: string) {
  let out = '';
  let usernameParts = username.split(' ');
  let firstName = usernameParts[0];
  if (firstName) {
    if (firstName.endsWith('s')) {
      out = `${firstName}’ Team`;
    } else {
      out = `${firstName}’s Team`;
    }
  }
  return out;
}

/**
 * Fisher-Yates shuffle algorithm to randomize an array
 */
function shuffleArray<T>(array: T[]) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Shuffles options but keeps 'other' at the end
 */
function shuffleOptionsKeepOtherLast(entries: [string, string][]) {
  const other = entries.find(([key]) => key === 'other');
  const rest = entries.filter(([key]) => key !== 'other');
  const shuffled = shuffleArray(rest);
  return other ? [...shuffled, other] : shuffled;
}
