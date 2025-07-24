import {
  ControlCheckboxInline,
  ControlCheckboxInputOther,
  ControlCheckboxStacked,
  ControlLinkInline,
  ControlLinkStacked,
} from '@/dashboard/onboarding/Controls';
import { useOnboardingLoaderData } from '@/routes/onboarding';
import {
  AIIcon,
  ArrowRightIcon,
  BlockIcon,
  DatabaseIcon,
  EducationIcon,
  PersonalIcon,
  SpinnerIcon,
  StarShineIcon,
  WorkIcon,
} from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { Button } from '@/shared/shadcn/ui/button';
import { Progress } from '@/shared/shadcn/ui/progress';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useRef } from 'react';
import { Link, useFetcher, useNavigate, useSearchParams } from 'react-router';
import { atom, useRecoilState, useSetRecoilState } from 'recoil';
import { z } from 'zod';
const FETCHER_KEY = 'onboarding-form-submission';
const NUM_FREE_PROMPTS = 12;

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
type QuestionProps = {
  title: string;
  subtitle?: string;
  optionsByValue: Record<string, string>;
};

export const questionStackIdsByUse: Record<string, string[]> = {
  work: ['use', 'work-role', 'languages[]', 'goals[]', 'final-prompts'],
  personal: ['use', 'personal-uses[]', 'languages[]', 'goals[]', 'final-prompts'],
  education: ['use', 'education-identity', 'education-subjects[]', 'languages[]', 'goals[]', 'final-prompts'],
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

  // Work
  'work-role': {
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

  // Personal
  'personal-uses[]': {
    title: 'What are you planning to use Quadratic for?',
    subtitle: 'Select all that apply',
    optionsByValue: {
      'personal-finance': 'Personal finance',
      'trading-investing': 'Trading / Investing',
      'side-projects-hobbies': 'Side projects / Hobbies',
      'learn-code': 'Learning to code',
      ai: 'Getting better at AI',
      other: 'Other',
    },
    Form: (props) => {
      const [other, setOther] = useRecoilState(otherCheckboxAtom);
      const [isValid, setIsValid] = useRecoilState(isValidFormAtom);

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm
            className="grid grid-cols-2 gap-2"
            onChange={(e) => {
              const form = e.currentTarget;
              const formData = new FormData(form);
              const values = Array.from(formData.entries());
              setIsValid(values.length > 0);
            }}
          >
            {Object.entries(props.optionsByValue).map(([value, label]) =>
              value === 'other' ? (
                <ControlCheckboxInputOther key={value} id={props.id} value={value} checked={other} onChange={setOther}>
                  {label}
                </ControlCheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={value} key={value}>
                  {label}
                </ControlCheckboxInline>
              )
            )}
            <QuestionFormFooter disabled={!isValid} />
          </QuestionForm>
        </Question>
      );
    },
  },

  // Education
  'education-identity': {
    title: 'What best describes you?',
    optionsByValue: {
      'university-student': 'University student',
      'high-school-student': 'High school student',
      'educator-professor': 'Educator / Professor',
      researcher: 'Researcher',
      'bootcamp-self-taught': 'Bootcamp / Self-taught',
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
                <Link
                  to={`./?${searchParams.toString()}&${props.id}=${value}`}
                  key={value}
                  onClick={() => setOther(false)}
                >
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
  'education-subjects[]': {
    title: 'What subject areas are you working in?',
    subtitle: 'Select all that apply',
    optionsByValue: {
      math: 'Math',
      'finance-economics': 'Finance / Economics',
      'physics-engineering': 'Physics / Engineering',
      'computer-science-ai': 'Computer Science / AI',
      'business-marketing': 'Business / Marketing',
      'social-sciences': 'Social Sciences',
      other: 'Other',
    },
    Form: (props) => {
      const [other, setOther] = useRecoilState(otherCheckboxAtom);
      const [isValid, setIsValid] = useRecoilState(isValidFormAtom);

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm
            className="grid grid-cols-2 gap-2"
            onChange={(e) => {
              const form = e.currentTarget;
              const formData = new FormData(form);
              const values = Array.from(formData.entries());
              setIsValid(values.length > 0);
            }}
          >
            {Object.entries(props.optionsByValue).map(([value, label]) =>
              value === 'other' ? (
                <ControlCheckboxInputOther key={value} id={props.id} value={value} checked={other} onChange={setOther}>
                  {label}
                </ControlCheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={value} key={value}>
                  {label}
                </ControlCheckboxInline>
              )
            )}
            <QuestionFormFooter disabled={!isValid} />
          </QuestionForm>
        </Question>
      );
    },
  },

  // Shared
  'languages[]': {
    title: 'Which languages are you proficient in?',
    subtitle: 'Select all that apply',
    optionsByValue: {
      formulas: 'Formulas',
      python: 'Python',
      javascript: 'JavaScript',
      sql: 'SQL',
      ai: 'AI / Vibe coding',
    },
    Form: (props) => {
      const languageClassName = 'h-10 w-10';
      const languageIconByValue: Record<string, React.ReactNode> = {
        formulas: <LanguageIcon language="formula" className={languageClassName} />,
        python: <LanguageIcon language="python" className={languageClassName} />,
        javascript: <LanguageIcon language="javascript" className={languageClassName} />,
        sql: <DatabaseIcon size="lg" className={cn(languageClassName, 'text-orange-500')} />,
        ai: <AIIcon size="lg" className={cn(languageClassName, 'text-green-500')} />,
        none: <BlockIcon size="lg" className={cn(languageClassName, 'text-red-500')} />,
      };
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="grid grid-cols-3 gap-2">
            {Object.entries(props.optionsByValue).map(([value, label]) => (
              <ControlCheckboxStacked name={props.id} value={value} key={value}>
                {languageIconByValue[value]}
                {label}
              </ControlCheckboxStacked>
            ))}

            {/* Allows submission of empty values */}
            <input type="hidden" name={props.id} value="" />

            <QuestionFormFooter />
          </QuestionForm>
        </Question>
      );
    },
  },
  'goals[]': {
    title: 'What are you looking to accomplish in Quadratic?',
    subtitle: 'Select all that apply',
    optionsByValue: {
      'ai-analysis': 'AI analysis',
      'db-connections': 'Database connections',
      'api-integrations': 'API integrations',
      'data-cleaning': 'Data cleaning',
      'data-analysis': 'Data analysis',
      'data-modeling': 'Data modeling',
      'data-visualization': 'Data visualization',
      other: 'Other',
    },
    Form: (props) => {
      const [other, setOther] = useRecoilState(otherCheckboxAtom);
      const [isValid, setIsValid] = useRecoilState(isValidFormAtom);
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm
            className="grid grid-cols-2 gap-1"
            onChange={(e) => {
              const form = e.currentTarget;
              const formData = new FormData(form);
              const values = Array.from(formData.entries());
              setIsValid(values.length > 0);
            }}
          >
            {Object.entries(props.optionsByValue).map(([value, label]) =>
              value === 'other' ? (
                <ControlCheckboxInputOther key={value} id={props.id} value={value} checked={other} onChange={setOther}>
                  {label}
                </ControlCheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={value} key={value}>
                  {label}
                </ControlCheckboxInline>
              )
            )}
            <QuestionFormFooter disabled={!isValid} />
          </QuestionForm>
          {isValid && <FreePromptsMsg isLastQuestion={true} />}
        </Question>
      );
    },
  },
  'final-prompts': {
    title: "Welcome to Quadratic! Let's get you started.",
    subtitle: 'Choose an example to try, connect your data, or start with a blank sheet.',
    optionsByValue: {
      'btc-eth-correlation': 'BTC/ETH Correlation',
      'google-analytics': 'Financial Analysis',
      blank: 'Start with a blank sheet',
    },
    Form: (props) => {
      const navigate = useNavigate();

      const promptsByValue: Record<string, string> = {
        'btc-eth-correlation': 'Find the correlation between BTC and ETH based on the data in the sheet.',
        'google-analytics': 'Analyze the things.',
        blank: '',
      };

      const handlePromptClick = (value: string) => {
        const prompt = promptsByValue[value];
        navigate(`/files/create?private=false${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ''}`);
      };

      const examplePrompts = ['btc-eth-correlation', 'google-analytics'];

      const blankOption = ['blank'];

      return (
        <div className="flex flex-col gap-10">
          <header className="flex flex-col gap-2">
            <h2 className="text-center text-4xl font-bold">{props.title}</h2>
            {props.subtitle && <p className="text-center text-lg text-muted-foreground">{props.subtitle}</p>}
          </header>

          <div className="flex gap-6">
            {/* Left side - YouTube Video (wider) */}
            <div className="flex flex-[2.5] flex-col">
              <div
                className="group relative min-h-[400px] flex-1 cursor-pointer overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-lg"
                onClick={() => window.open('https://www.youtube.com/watch?v=AGCyIjBa9hk', '_blank')}
              >
                <img
                  src="https://img.youtube.com/vi/DmN53iVKhQY/maxresdefault.jpg"
                  alt="Getting Started with Quadratic"
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-all group-hover:bg-black/30">
                  <div className="rounded-full bg-red-600 p-4 shadow-lg transition-transform group-hover:scale-110">
                    <svg className="ml-1 h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="rounded bg-black/70 px-3 py-2 backdrop-blur-sm">
                    <h3 className="text-sm font-medium text-white">Getting Started with Quadratic</h3>
                    <p className="text-xs text-white/80">Click to watch on YouTube</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side - Options */}
            <div className="flex flex-1 flex-col">
              {/* Try Examples Section */}
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-semibold">Start with an example</h3>
                <div className="space-y-2">
                  {examplePrompts.map((value) => (
                    <button
                      key={value}
                      onClick={() => handlePromptClick(value)}
                      className={cn(
                        'w-full rounded-lg border border-border p-3 text-left',
                        'transition-all hover:border-primary hover:shadow-md',
                        'group relative'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="mb-1 text-sm font-medium">{props.optionsByValue[value]}</h4>
                          <p className="text-xs text-muted-foreground">
                            {value === 'btc-eth-correlation' && 'Find the correlation.'}
                            {value === 'google-analytics' && 'Analyze the things.'}
                          </p>
                        </div>
                        <ArrowRightIcon className="ml-2 opacity-20 transition-all group-hover:text-primary group-hover:opacity-100" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connect Your Data Section */}
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-semibold">Start with your data</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => handlePromptClick('database-connection')}
                    className={cn(
                      'w-full rounded-lg border border-border p-3 text-left',
                      'transition-all hover:border-primary hover:shadow-md',
                      'group relative'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="mb-1 text-sm font-medium">Connect a database (PostgreSQL, BigQuery, etc.)</h4>
                      </div>
                      <ArrowRightIcon className="ml-2 opacity-20 transition-all group-hover:text-primary group-hover:opacity-100" />
                    </div>
                  </button>
                  <button
                    onClick={() => handlePromptClick('file-import')}
                    className={cn(
                      'w-full rounded-lg border border-border p-3 text-left',
                      'transition-all hover:border-primary hover:shadow-md',
                      'group relative'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="mb-1 text-sm font-medium">Import a file (CSV, Excel, Parquet)</h4>
                      </div>
                      <ArrowRightIcon className="ml-2 opacity-20 transition-all group-hover:text-primary group-hover:opacity-100" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Start Blank Section */}
              <div className="border-t pt-4">
                {blankOption.map((value) => (
                  <button
                    key={value}
                    onClick={() => handlePromptClick(value)}
                    className={cn(
                      'w-full rounded-lg border border-border p-3 text-left',
                      'transition-all hover:border-primary hover:shadow-md',
                      'group relative'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">{props.optionsByValue[value]}</h4>
                      <ArrowRightIcon className="ml-2 opacity-20 transition-all group-hover:text-primary group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
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
      <div
        className={cn('mx-auto flex flex-col gap-10 pt-24', currentId === 'final-prompts' ? 'max-w-4xl' : 'max-w-lg')}
      >
        <div
          className={cn('relative w-full transition-all', currentId === 'final-prompts' ? 'max-w-none' : 'max-w-xl')}
        >
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
      {isLastQuestion ? (
        <>
          You've unlocked <strong className="ml-1 font-semibold">{NUM_FREE_PROMPTS} free prompts</strong>!
        </>
      ) : (
        <>
          You'll be rewarded <strong className="mx-1 font-semibold">{NUM_FREE_PROMPTS} free prompts</strong> on
          completion!
        </>
      )}
    </aside>
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
        form.reset();
      }}
      className={className}
    >
      {children}
    </fetcher.Form>
  );
}
