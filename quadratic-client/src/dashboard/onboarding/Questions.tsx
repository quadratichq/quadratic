import { BillingPlans } from '@/dashboard/billing/BillingPlans';
import {
  ControlCheckboxInputOther,
  ControlCheckboxStacked,
  ControlLinkInline,
  ControlLinkStacked,
} from '@/dashboard/onboarding/Controls';
import { useOnboardingLoaderData } from '@/routes/onboarding';
import { connectionsByType, potentialConnectionsByType } from '@/shared/components/connections/connectionsByType';
import {
  ArrowRightIcon,
  EducationIcon,
  PersonalIcon,
  SpinnerIcon,
  StarShineIcon,
  WorkIcon,
} from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { Progress } from '@/shared/shadcn/ui/progress';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useRef } from 'react';
import { Link, useFetcher, useNavigate, useSearchParams } from 'react-router';
import { atom, useRecoilState, useSetRecoilState } from 'recoil';
import { z } from 'zod';

const FETCHER_KEY = 'onboarding-form-submission';

const otherCheckboxAtom = atom<boolean>({
  key: 'onboardingOtherCheckboxAtom',
  default: false,
});
const isValidFormAtom = atom<boolean>({
  key: 'onboardingIsValidFormAtom',
  default: false,
});

export const OnboardingResponseV1Schema = z.object({
  __version: z.literal(1),
  __createdAt: z.string().datetime(),
  use: z.enum(['work', 'personal', 'education']),
  'work-role': z.string().optional(),
  'work-role-other': z.string().optional(),
  'personal-uses[]': z.array(z.string()).optional(),
  'personal-uses[]-other': z.string().optional(),
  'education-identity': z.string().optional(),
  'education-identity-other': z.string().optional(),
  'education-subjects[]': z.array(z.string()).optional(),
  'education-subjects[]-other': z.string().optional(),
  'languages[]': z.array(z.string()).optional(),
  'goals[]': z.array(z.string()),
  'goals[]-other': z.string().optional(),
});
export type OnboardingResponseV1 = z.infer<typeof OnboardingResponseV1Schema>;

export const OnboardingResponseV2Schema = z.object({
  __version: z.literal(2),
  __createdAt: z.string().datetime(),
  use: z.enum(['work', 'personal', 'education']),

  // Only for work/education
  'team-size': z.string().optional(),
  role: z.string().optional(),
  'role-other': z.string().optional(),

  'connections[]': z.array(z.string()).optional(),
  'connections[]-other': z.string().optional(),
  'team-name': z.string(),
  'team-invites[]': z.array(z.string()).optional(),
  'team-plan': z.literal('free').or(z.literal('pro')),
});
export type OnboardingResponseV2 = z.infer<typeof OnboardingResponseV1Schema>;

type QuestionProps = {
  title: string;
  subtitle?: string;
  optionsByValue: Record<string, string>;
};

export const questionStackIdsByUse: Record<string, string[]> = {
  work: ['use', 'team-size', 'role', 'connections[]', 'team-name', 'team-invites[]', 'team-plan'],
  personal: ['use', 'connections[]', 'team-name', 'team-invites[]', 'team-plan'],
  education: ['use', 'team-size', 'role', 'connections[]', 'team-name', 'team-invites[]', 'team-plan'],
};

export const questionsById: Record<
  string,
  QuestionProps & { Form: (props: QuestionProps & { id: string }) => React.ReactNode }
> = {
  use: {
    title: 'How will you use Quadratic?',
    subtitle: 'Your answers help personalize your experience.',
    optionsByValue: {
      work: 'Work',
      personal: 'Personal',
      education: 'Education',
    },
    Form: (props) => {
      const iconsByValue: Record<string, React.ReactNode> = {
        work: <WorkIcon size="lg" className="text-primary" />,
        personal: <PersonalIcon size="lg" className="text-primary" />,
        education: <EducationIcon size="lg" className="text-primary" />,
      };

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="grid grid-cols-3 gap-2">
            {Object.entries(props.optionsByValue).map(([value, label]) => (
              <Link key={value} to={`./?${props.id}=${value}`}>
                <ControlLinkStacked>
                  {iconsByValue[value]}
                  <span className="relative flex items-center">
                    {label}
                    <ArrowRightIcon className="absolute left-full top-1/2 -translate-y-1/2 opacity-20 group-hover:text-primary group-hover:opacity-100" />
                  </span>
                </ControlLinkStacked>
              </Link>
            ))}
          </QuestionForm>
          <FreePromptsMsg isLastQuestion={false} />
        </Question>
      );
    },
  },

  // Work / Education
  role: {
    title: 'What best describes your role?',
    optionsByValue: {
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
    },
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const [other, setOther] = useRecoilState(otherCheckboxAtom);

      return (
        <Question title={props.title}>
          <QuestionForm className="grid grid-cols-2 gap-2">
            {Object.entries(props.optionsByValue).map(([value, label]) =>
              value === 'other' ? (
                <ControlCheckboxInputOther key={value} id={props.id} value={value} checked={other} onChange={setOther}>
                  {label}
                </ControlCheckboxInputOther>
              ) : (
                <Link to={`./?${searchParams.toString()}&${props.id}=${value}`} key={value}>
                  <ControlLinkInline>{label}</ControlLinkInline>
                </Link>
              )
            )}
            <QuestionFormFooter disabled={!other} />
          </QuestionForm>
        </Question>
      );
    },
  },
  'team-size': {
    title: 'How many people are on your team?',
    optionsByValue: {
      '1': 'Just me',
      '2-5': '2-5',
      '5-20': '5-20',
      '20-250': '20-250',
      '250-10000': '250-10,000',
      '10000+': '10,000+',
    },
    Form: (props) => {
      const [searchParams] = useSearchParams();
      return (
        <Question title={props.title}>
          <QuestionForm className="grid grid-cols-2 gap-2">
            {Object.entries(props.optionsByValue).map(([value, label]) => (
              <Link to={`./?${searchParams.toString()}&${props.id}=${value}`} key={value}>
                <ControlLinkInline key={value}>{label}</ControlLinkInline>
              </Link>
            ))}
            <QuestionFormFooter />
          </QuestionForm>
        </Question>
      );
    },
  },

  // Shared
  'connections[]': {
    title: 'Which data sources would you want to connect to?',
    subtitle: 'Select any option you’d be interested in.',
    optionsByValue: {
      // TODO: pull from our list
      ...Object.keys(connectionsByType).reduce(
        (acc, key) => ({
          ...acc,
          // TODO: fix type
          // @ts-expect-error - we know this is a valid key
          [key]: connectionsByType[key].name,
        }),
        {}
      ),
      ...Object.keys(potentialConnectionsByType).reduce(
        (acc, key) => ({
          ...acc,
          // TODO: fix type
          // @ts-expect-error - we know this is a valid key
          [key]: potentialConnectionsByType[key].name,
        }),
        {}
      ),
      // other: 'Other…',
    },
    Form: (props) => {
      const languageClassName = 'h-10 w-10';
      const [other, setOther] = useRecoilState(otherCheckboxAtom);
      // const [isValid, setIsValid] = useRecoilState(isValidFormAtom);
      // const languageIconByValue: Record<string, React.ReactNode> = {
      //   formulas: <LanguageIcon language="formula" className={languageClassName} />,
      //   python: <LanguageIcon language="python" className={languageClassName} />,
      //   javascript: <LanguageIcon language="javascript" className={languageClassName} />,
      //   sql: <DatabaseIcon size="lg" className={cn(languageClassName, 'text-orange-500')} />,
      //   ai: <AIIcon size="lg" className={cn(languageClassName, 'text-green-500')} />,
      //   none: <BlockIcon size="lg" className={cn(languageClassName, 'text-red-500')} />,
      // };
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="grid grid-cols-3 gap-2">
            {Object.entries(props.optionsByValue).map(([value, label]) =>
              /* we don't have a stacked 'other' right now... */
              value === 'OTHER' ? (
                <ControlCheckboxInputOther key={value} id={props.id} value={value} checked={other} onChange={setOther}>
                  <LanguageIcon language={value} className={languageClassName} />
                  {label}
                </ControlCheckboxInputOther>
              ) : (
                <ControlCheckboxStacked name={props.id} value={value} key={value}>
                  <LanguageIcon language={value} className={languageClassName} />
                  {label}
                </ControlCheckboxStacked>
              )
            )}

            {/* Allows submission of empty values */}
            <input type="hidden" name={props.id} value="" />

            <QuestionFormFooter />
          </QuestionForm>
        </Question>
      );
    },
  },
  'team-name': {
    title: 'What would you like to name your team?',
    subtitle: 'This will appear as your workspace in the app.',
    optionsByValue: {
      // TODO: consider making this optional
      'team-name': 'Team name',
    },
    Form: (props) => {
      const [isValid, setIsValid] = useRecoilState(isValidFormAtom);
      const inputRef = useRef<HTMLInputElement>(null);

      useEffect(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, []);
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="">
            <Input
              ref={inputRef}
              className="h-12 w-full text-lg"
              type="text"
              name={props.id}
              placeholder="Enter a name"
              autoFocus
              onChange={(e) => {
                setIsValid(e.target.value.length > 0);
              }}
            />
            <QuestionFormFooter disabled={!isValid} />
          </QuestionForm>

          {isValid && false /* TODO: put on last step */ && <FreePromptsMsg isLastQuestion={true} />}
        </Question>
      );
    },
  },
  'team-invites[]': {
    title: 'Who would you like to invite to your team?',
    subtitle: 'Quadratic is better with your team. We’ll send them an invite.',
    // TODO: maybe don't need these?
    optionsByValue: {
      'team-invites[]': 'Team invites',
    },
    Form: (props) => {
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="flex flex-col gap-2">
            <Input key={1} className="h-12 w-full text-lg" type="text" name={props.id} placeholder="john@example.com" />
            <Input key={2} className="h-12 w-full text-lg" type="text" name={props.id} placeholder="jane@example.com" />
            <Input key={3} className="h-12 w-full text-lg" type="text" name={props.id} placeholder="john@example.com" />
            <QuestionFormFooter />
          </QuestionForm>
        </Question>
      );
    },
  },
  'team-plan': {
    title: 'Which plan would you like?',
    subtitle: 'Get started for free, or subscribe for full access.',
    optionsByValue: {
      free: 'Free',
      pro: 'Pro',
    },
    Form: (props) => {
      const [searchParams] = useSearchParams();
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          {/* Need the team UUID here */}
          <BillingPlans isOnPaidPlan={false} canManageBilling={true} teamUuid="123" eventSource="onboarding" />
          <QuestionForm className="-mt-6 grid grid-cols-2 gap-4">
            {Object.entries(props.optionsByValue).map(([value, label]) => (
              <Link to={`./?${searchParams.toString()}&${props.id}=${value}`} key={value}>
                <ControlLinkInline>{label}</ControlLinkInline>
              </Link>
            ))}

            <QuestionFormFooter />
          </QuestionForm>
        </Question>
      );
    },
  },
};

export function Questions() {
  const { currentId, currentIndex, currentQuestionStackIds } = useOnboardingLoaderData();
  const setOther = useSetRecoilState(otherCheckboxAtom);
  const setIsValid = useSetRecoilState(isValidFormAtom);
  const [searchParams] = useSearchParams();

  // Whenever the search params change, that means a new form is being rendered
  // so we want to reset any state used to represent the current active form
  useEffect(() => {
    setOther((prev) => (prev === true ? false : prev));
    setIsValid((prev) => (prev === true ? false : prev));
  }, [searchParams, setOther, setIsValid]);

  const questionIds = Object.keys(questionsById);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-10 pt-16">
        <Logo />

        <div className="relative w-full max-w-xl transition-all">
          <div className="relative min-h-[4rem]">
            {questionIds.map((id) => {
              const { Form, ...props } = questionsById[id];
              const isASubsequentQuestion =
                currentId === 'use' ? true : currentQuestionStackIds.indexOf(id) > currentIndex;
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

function QuestionFormFooter({ disabled }: { disabled?: boolean }) {
  const navigate = useNavigate();
  const fetcher = useFetcher({ key: FETCHER_KEY });
  const { currentId, currentQuestionNumber, currentQuestionsTotal } = useOnboardingLoaderData();
  const btnClassName = 'select-none';
  const isSubmitting = fetcher.state !== 'idle';

  return (
    <div
      className={cn(
        'col-span-full grid grid-cols-2 items-center justify-between gap-4 pt-10 transition-opacity delay-300 duration-300 ease-in-out'
      )}
    >
      <div
        className={cn(
          'flex select-none items-center gap-2 text-sm text-muted-foreground',
          currentId === 'use' && 'invisible opacity-0'
        )}
      >
        <Progress value={(currentQuestionNumber / currentQuestionsTotal) * 100} className="h-3 w-1/3 transition-none" />{' '}
        Question {currentQuestionNumber} / {currentQuestionsTotal}
      </div>
      <div className="flex items-center justify-end gap-2">
        {isSubmitting ? (
          <SpinnerIcon className="mr-4 text-primary" />
        ) : (
          <Button
            type="reset"
            onClick={(e) => {
              navigate(-1);
            }}
            size="lg"
            variant="ghost"
            className={cn(btnClassName, 'text-muted-foreground')}
          >
            Back
          </Button>
        )}
        <Button type="submit" className={cn(btnClassName)} size="lg" disabled={disabled || isSubmitting}>
          {currentQuestionNumber === currentQuestionsTotal ? 'Done' : 'Next'}
        </Button>
      </div>
    </div>
  );
}

function FreePromptsMsg({ isLastQuestion }: { isLastQuestion: boolean }) {
  return (
    <aside className="mx-auto flex items-center justify-center rounded-full bg-accent px-4 py-2 text-muted-foreground">
      <StarShineIcon className="mr-2" />
      {isLastQuestion ? <>You've unlocked free prompts!</> : <>You'll be rewarded free prompts on completion!</>}
    </aside>
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
        <header className="flex flex-col gap-2">
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
        // Give the animation time to complete first so we don't see the reset
        // TODO: consider a better way to do this
        setTimeout(() => {
          form.reset();
        }, 1000);
      }}
      className={className}
    >
      {children}
    </fetcher.Form>
  );
}
