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
import {
  ControlCheckboxInline,
  ControlCheckboxInputOther,
  ControlCheckboxStacked,
  ControlLinkInline,
  ControlLinkStacked,
} from './Controls';
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
  use: z.enum(['work', 'personal', 'education']),
  'work-role': z.string().optional(),
  'work-role-other': z.string().optional(),
  'personal-uses[]': z.array(z.string()).optional(),
  'personal-uses-other': z.string().optional(),
  'education-identity': z.string().optional(),
  'education-identity-other': z.string().optional(),
  'education-subjects[]': z.array(z.string()).optional(),
  'languages[]': z.array(z.string()).optional(),
  'goals[]': z.array(z.string()),
});

export type OnboardingResponseV1 = z.infer<typeof OnboardingResponseV1Schema>;
type QuestionFormProps = {
  id: string;
  appliesToUse?: string;
  title: string;
  subtitle?: string;
  options: Array<{ value: string; label: string }>;
};

// Note: these are in a specific order for a reason. They represent the order
// of the questions in the onboarding flow. Any with `use` will be filtered out
// based on the value of `use` in the search params.
export const allQuestions: Array<QuestionFormProps & { Form: (props: QuestionFormProps) => React.ReactNode }> = [
  {
    id: 'use',
    title: 'How will you use Quadratic?',
    subtitle: 'Your answers help personalize your experience.',
    options: [
      { value: 'work', label: 'Work' },
      { value: 'personal', label: 'Personal' },
      { value: 'education', label: 'Education' },
    ],
    Form: (props) => {
      const iconsByValue: Record<string, React.ReactNode> = {
        work: <WorkIcon size="lg" className="text-primary" />,
        personal: <PersonalIcon size="lg" className="text-primary" />,
        education: <EducationIcon size="lg" className="text-primary" />,
      };

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="grid grid-cols-3 gap-2">
            {props.options.map((option) => (
              <Link key={option.value} to={`./?${props.id}=${option.value}`}>
                <ControlLinkStacked>
                  {iconsByValue[option.value]}
                  <span className="relative flex items-center">
                    {option.label}
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
  {
    id: 'work-role',
    appliesToUse: 'work',
    title: 'What best describes your role?',
    options: [
      { value: 'data-analytics', label: 'Data / Analytics' },
      { value: 'software-development', label: 'Software Development' },
      { value: 'engineering', label: 'Engineering' },
      { value: 'sales', label: 'Sales' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'product', label: 'Product' },
      { value: 'c-suite-management', label: 'C-Suite / Management' },
      { value: 'ml-ai', label: 'Machine Learning / AI' },
      { value: 'finance', label: 'Finance' },
      { value: 'other', label: 'Other' },
    ],
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const [other, setOther] = useRecoilState(otherCheckboxAtom);

      return (
        <Question title={props.title}>
          <QuestionForm className="grid grid-cols-2 gap-2">
            {props.options.map((option) =>
              option.value === 'other' ? (
                <ControlCheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </ControlCheckboxInputOther>
              ) : (
                <Link to={`./?${searchParams.toString()}&${props.id}=${option.value}`} key={option.value}>
                  <ControlLinkInline>{option.label}</ControlLinkInline>
                </Link>
              )
            )}
            <QuestionFormFooter id={props.id} disabled={!other} />
          </QuestionForm>
        </Question>
      );
    },
  },

  // Personal
  {
    id: 'personal-uses[]',
    appliesToUse: 'personal',
    title: 'What are you planning to use Quadratic for?',
    subtitle: 'Select all that apply',
    options: [
      { value: 'personal-finance', label: 'Personal finance' },
      { value: 'trading-investing', label: 'Trading / Investing' },
      { value: 'side-projects-hobbies', label: 'Side projects / Hobbies' },
      { value: 'learn-code', label: 'Learning to code' },
      { value: 'ai', label: 'Getting better at AI' },
      { value: 'other', label: 'Other' },
    ],
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
            {props.options.map((option) =>
              option.value === 'other' ? (
                <ControlCheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </ControlCheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={option.value} key={option.value}>
                  {option.label}
                </ControlCheckboxInline>
              )
            )}
            <QuestionFormFooter id={props.id} disabled={!isValid} />
          </QuestionForm>
        </Question>
      );
    },
  },

  // Education
  {
    id: 'education-identity',
    appliesToUse: 'education',
    title: 'What best describes you?',
    options: [
      { value: 'university-student', label: 'University student' },
      { value: 'high-school-student', label: 'High school student' },
      { value: 'educator-professor', label: 'Educator / Professor' },
      { value: 'researcher', label: 'Researcher' },
      { value: 'bootcamp-self-taught', label: 'Bootcamp / Self-taught' },
      { value: 'other', label: 'Other' },
    ],
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const [other, setOther] = useRecoilState(otherCheckboxAtom);

      return (
        <Question title={props.title}>
          <QuestionForm className="grid grid-cols-2 gap-2">
            {props.options.map((option) =>
              option.value === 'other' ? (
                <ControlCheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </ControlCheckboxInputOther>
              ) : (
                <Link
                  to={`./?${searchParams.toString()}&${props.id}=${option.value}`}
                  key={option.value}
                  onClick={() => setOther(false)}
                >
                  <ControlLinkInline>{option.label}</ControlLinkInline>
                </Link>
              )
            )}
            <QuestionFormFooter id={props.id} disabled={!other} />
          </QuestionForm>
        </Question>
      );
    },
  },
  {
    id: 'education-subjects[]',
    appliesToUse: 'education',
    title: 'What subject areas are you working in?',
    subtitle: 'Select all that apply',
    options: [
      { value: 'math', label: 'Math' },
      { value: 'finance-economics', label: 'Finance / Economics' },
      { value: 'physics-engineering', label: 'Physics / Engineering' },
      { value: 'computer-science-ai', label: 'Computer Science / AI' },
      { value: 'business-marketing', label: 'Business / Marketing' },
      { value: 'social-sciences', label: 'Social Sciences' },
      { value: 'other', label: 'Other' },
    ],
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
            {props.options.map((option) =>
              option.value === 'other' ? (
                <ControlCheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </ControlCheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={option.value} key={option.value}>
                  {option.label}
                </ControlCheckboxInline>
              )
            )}
            <QuestionFormFooter id={props.id} disabled={!isValid} />
          </QuestionForm>
        </Question>
      );
    },
  },

  // Shared
  {
    id: 'languages[]',
    title: 'Which languages are you proficient in?',
    subtitle: 'Select all that apply',
    options: [
      { value: 'formulas', label: 'Formulas' },
      { value: 'python', label: 'Python' },
      { value: 'javascript', label: 'JavaScript' },
      { value: 'sql', label: 'SQL' },
      { value: 'ai', label: 'AI / Vibe coding' },
    ],
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
            {props.options.map((option) => (
              <ControlCheckboxStacked name={props.id} value={option.value} key={option.value}>
                {languageIconByValue[option.value]}
                {option.label}
              </ControlCheckboxStacked>
            ))}

            {/* Allows submission of empty values */}
            <input type="hidden" name={props.id} value="" />

            <QuestionFormFooter id={props.id} />
          </QuestionForm>
        </Question>
      );
    },
  },
  {
    id: 'goals[]',
    title: 'What are you looking to accomplish in Quadratic?',
    subtitle: 'Select all that apply',
    options: [
      { value: 'db-connections', label: 'Database connections' },
      { value: 'api-integrations', label: 'API integrations' },
      { value: 'data-cleaning', label: 'Data cleaning' },
      { value: 'data-analysis', label: 'Data analysis' },
      { value: 'data-modeling', label: 'Data modeling' },
      { value: 'data-visualization', label: 'Data visualization' },
      { value: 'ai-analysis', label: 'AI analysis' },
      { value: 'other', label: 'Other' },
    ],
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
            {props.options.map((option) =>
              option.value === 'other' ? (
                <ControlCheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </ControlCheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={option.value} key={option.value}>
                  {option.label}
                </ControlCheckboxInline>
              )
            )}
            <QuestionFormFooter id={props.id} disabled={!isValid} />
          </QuestionForm>
          {isValid && <FreePromptsMsg isLastQuestion={true} />}
        </Question>
      );
    },
  },
];

export function Questions() {
  const { currentId } = useOnboardingLoaderData();
  const setOther = useSetRecoilState(otherCheckboxAtom);
  const setIsValid = useSetRecoilState(isValidFormAtom);
  const [searchParams] = useSearchParams();

  // Whenever the search params change, that means a new form is being rendered
  // so we want to reset any state used to represent the current active form
  useEffect(() => {
    setOther((prev) => (prev === true ? false : prev));
    setIsValid((prev) => (prev === true ? false : prev));
  }, [searchParams, setOther, setIsValid]);

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-10 pt-16">
        <Logo />

        <div className="relative w-full max-w-xl transition-all">
          <div className="relative min-h-[4rem]">
            {allQuestions.map(({ Form, ...props }, i) => {
              // see if the id is before or after the currentId in allQuestions
              const isBeforeCurrentId = allQuestions.findIndex((q) => q.id === currentId) > i;
              return (
                <div
                  key={props.id}
                  className={cn(
                    'absolute inset-0 transition-all duration-500 ease-in-out',
                    'transform',
                    // Current question
                    props.id === currentId
                      ? 'z-10 translate-x-0 opacity-100'
                      : // Previous question(s)
                        isBeforeCurrentId
                        ? 'invisible z-0 -translate-x-1/3 opacity-0'
                        : // Next question(s)
                          'invisible z-0 translate-x-1/3 opacity-0'
                  )}
                >
                  <Form {...props} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionFormFooter({ id, disabled }: { id: string; disabled?: boolean }) {
  const navigate = useNavigate();
  const fetcher = useFetcher({ key: FETCHER_KEY });
  const { currentQuestionStack } = useOnboardingLoaderData();
  const btnClassName = 'select-none';
  const countCurrent = currentQuestionStack.length > 0 ? currentQuestionStack.findIndex((q) => q.id === id) : 0;
  const countTotal = currentQuestionStack.length > 0 ? currentQuestionStack.length - 1 : 0;
  let _disabled = disabled === undefined ? false : disabled;
  const isSubmitting = fetcher.state !== 'idle';

  return (
    <div
      className={cn(
        'col-span-full grid grid-cols-2 items-center justify-between gap-4 pt-10 transition-opacity delay-300 duration-300 ease-in-out'
      )}
    >
      <div className={cn('flex select-none items-center gap-2 text-sm text-muted-foreground')}>
        <Progress value={(countCurrent / countTotal) * 100} className="h-3 w-1/3" /> Question {countCurrent} /{' '}
        {countTotal}
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
        <Button type="submit" className={cn(btnClassName)} size="lg" disabled={_disabled || isSubmitting}>
          {countCurrent === countTotal ? 'Submit' : 'Next'}
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
          You've unlocked <strong className="ml-1 font-semibold">20 free prompts</strong>!
        </>
      ) : (
        <>
          You'll be rewarded <strong className="mx-1 font-semibold">20 free prompts</strong> on completion!
        </>
      )}
    </aside>
  );
}

function Logo() {
  const { currentIndex } = useOnboardingLoaderData();
  const className = 'h-5 w-5 bg-border transition-colors';
  return (
    <div className="inline-grid grid-cols-2 justify-center gap-0.5">
      <div className={cn(className, 'justify-self-end', currentIndex >= 0 && 'bg-[#CB8999]')} />
      <div className={cn(className, currentIndex > 0 && 'bg-[#8ECB89]')} />
      <div className={cn(className, 'justify-self-end', currentIndex > 1 && 'bg-[#5D576B]')} />
      <div className={cn(className, currentIndex > 2 && 'bg-[#6CD4FF]')} />
      <div className={cn(className, 'col-start-2', currentIndex > 3 && 'bg-[#FFC800]')} />
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
        form.reset();
      }}
      className={className}
    >
      {children}
    </fetcher.Form>
  );
}
