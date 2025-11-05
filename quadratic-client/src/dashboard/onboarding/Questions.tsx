import { FreePlan, ProPlan } from '@/dashboard/billing/BillingPlans';
import {
  ControlCheckboxInputOther,
  ControlCheckboxStacked,
  ControlLinkInline,
  ControlLinkStacked,
} from '@/dashboard/onboarding/Controls';
import { useOnboardingLoaderData } from '@/routes/teams.$teamUuid.onboarding';
import { connectionsByType, potentialConnectionsByType } from '@/shared/components/connections/connectionsByType';
import {
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EducationIcon,
  PersonalIcon,
  RadioButtonCheckedIcon,
  RadioButtonUncheckedIcon,
  WorkIcon,
} from '@/shared/components/Icons';
import { Button } from '@/shared/shadcn/ui/button';
import { Input } from '@/shared/shadcn/ui/input';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useRef, useState } from 'react';
import { Link, useFetcher, useNavigate, useSearchParams } from 'react-router';
import { atom, useRecoilState, useSetRecoilState } from 'recoil';

const FETCHER_KEY = 'onboarding-form-submission';

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
  optionsByValue: Record<string, string>;
  excludeForUse?: string[];
};

export const questionsById: Record<
  string,
  QuestionProps & { Form: (props: QuestionProps & { id: string }) => React.ReactNode }
> = {
  instructions: {
    title: 'Welcome to Quadratic!',
    subtitle:
      'Connect to your data, chat with AI, and share the results with your team, all in a familiar spreadsheet interface.',
    optionsByValue: {
      foo: 'I want to use Quadratic to analyze data',
    },
    Form: (props) => {
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <ImageCarousel />
            <FreePromptsMsg isLastQuestion={false} />
            <input type="hidden" name={props.id} value="" />
            <QuestionFormFooter>
              <Button type="submit" size="lg">
                Get started
              </Button>
            </QuestionFormFooter>
          </QuestionForm>
        </Question>
      );
    },
  },
  use: {
    title: 'How will you use Quadratic?',
    subtitle: 'Your answers help personalize your experience.',
    optionsByValue: {
      work: 'Work',
      personal: 'Personal',
      education: 'Education',
    },
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const iconsByValue: Record<string, React.ReactNode> = {
        work: <WorkIcon size="lg" className="text-primary" />,
        personal: <PersonalIcon size="lg" className="text-primary" />,
        education: <EducationIcon size="lg" className="text-primary" />,
      };

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(props.optionsByValue).map(([value, label]) => (
                <Link key={value} to={`./?${searchParams.toString()}&${props.id}=${value}`}>
                  <ControlLinkStacked>
                    {iconsByValue[value]}
                    <span className="relative flex items-center">
                      {label}
                      <ArrowRightIcon className="absolute left-full top-1/2 -translate-y-1/2 opacity-20 group-hover:text-primary group-hover:opacity-100" />
                    </span>
                  </ControlLinkStacked>
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

  // Work / Education
  role: {
    title: 'What best describes your role?',
    excludeForUse: ['personal'],
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
          <QuestionForm>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(props.optionsByValue).map(([value, label]) =>
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
                  <Link to={`./?${searchParams.toString()}&${props.id}=${value}`} key={value}>
                    <ControlLinkInline>{label}</ControlLinkInline>
                  </Link>
                )
              )}
            </div>
            <QuestionFormFooter>
              <BackButton />
              <Button type="submit" size="lg" disabled={!other}>
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
          <QuestionForm>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(props.optionsByValue).map(([value, label]) => (
                <Link to={`./?${searchParams.toString()}&${props.id}=${value}`} key={value}>
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
  'connections[]': {
    title: 'What data sources are you interested in connecting to?',
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
          <QuestionForm>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(props.optionsByValue).map(([value, label]) => {
                // TODO: fix types
                // @ts-expect-error
                const Icon = connectionsByType[value] ? (
                  // @ts-expect-error
                  connectionsByType[value].Logo
                ) : // @ts-expect-error
                potentialConnectionsByType[value] ? (
                  // @ts-expect-error
                  potentialConnectionsByType[value].Logo
                ) : (
                  <div>?</div>
                );
                /* we don't have a stacked 'other' right now... */
                return value === 'OTHER' ? (
                  <ControlCheckboxInputOther
                    key={value}
                    id={props.id}
                    value={value}
                    checked={other}
                    onChange={setOther}
                  >
                    <Icon />
                  </ControlCheckboxInputOther>
                ) : (
                  <ControlCheckboxStacked name={props.id} value={value} key={value}>
                    <Icon />
                  </ControlCheckboxStacked>
                );
              })}
            </div>

            {/* Allows submission of empty values */}
            <input type="hidden" name={props.id} value="" />

            <QuestionFormFooter>
              <BackButton />
              <Button type="submit" size="lg">
                Next
              </Button>
            </QuestionFormFooter>
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

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <Input
              ref={inputRef}
              className="h-12 w-full text-lg"
              type="text"
              name={props.id}
              autoFocus
              placeholder="e.g. Acme Corp."
              onChange={(e) => {
                setIsValid(e.target.value.length > 0);
              }}
            />
            <QuestionFormFooter>
              <BackButton />
              <Button type="submit" size="lg" disabled={!isValid}>
                Next
              </Button>
            </QuestionFormFooter>
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
          <QuestionForm>
            <div className="flex flex-col gap-2 md:grid md:grid-cols-2">
              {['john@example.com', 'alice@example.com', 'bob@example.com', 'susan@example.com'].map((placeholder) => (
                <Input
                  key={placeholder}
                  className="h-12 w-full text-lg"
                  type="email"
                  name={props.id}
                  placeholder={placeholder}
                />
              ))}
            </div>
            <QuestionFormFooter>
              <BackButton />
              <Button type="submit" size="lg">
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
    optionsByValue: {
      free: 'Free',
      pro: 'Pro',
    },
    Form: (props) => {
      const [selectedPlan, setSelectedPlan] = useState<keyof typeof props.optionsByValue>(
        Object.keys(props.optionsByValue)[0]
      );
      // const navigate = useNavigate();
      const fetcher = useFetcher({ key: FETCHER_KEY });
      const isSubmitting = fetcher.state !== 'idle';
      const className = cn(
        'h-full w-full group relative rounded shadow-sm border border-border p-4 enabled:hover:border-primary enabled:hover:shadow-md'
      );

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <div className="grid grid-cols-2 gap-4">
              {/* TODO: handle button nature of this */}
              {Object.keys(props.optionsByValue).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={cn(className, selectedPlan === key && 'border-primary bg-accent shadow-md')}
                  onClick={() => setSelectedPlan(key)}
                  disabled={isSubmitting}
                >
                  {key === 'free' ? <FreePlan className="h-full" /> : <ProPlan />}
                  {selectedPlan === key ? (
                    <RadioButtonCheckedIcon className="absolute right-4 top-5 text-primary" />
                  ) : (
                    <RadioButtonUncheckedIcon className="absolute right-4 top-5 text-border" />
                  )}
                </button>
              ))}
            </div>
            <input type="hidden" name={props.id} value={selectedPlan} />
            <QuestionFormFooter>
              {/* <Button
                  type="reset"
                  variant="secondary"
                  size="lg"
                  disabled={isSubmitting}
                  // onClick={() => {
                  //   navigate(-1);
                  // }}
                  asChild
                >
                  <Link to={backTo}>Back</Link>
                </Button> */}
              <Button type="submit" size="lg" disabled={isSubmitting} loading={isSubmitting}>
                Done
              </Button>
            </QuestionFormFooter>
          </QuestionForm>
        </Question>
      );
    },
  },
};

// function useBackUrl(targetQuestionId: string) {
//   const [searchParams] = useSearchParams();
//   const newSearchParams = new URLSearchParams(searchParams.toString());
//   newSearchParams.delete(targetQuestionId);
//   newSearchParams.delete(`${targetQuestionId}-other`);
//   return `./?${newSearchParams.toString()}`;
// }

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
    <div ref={scrollRef} className="h-full overflow-auto">
      <div className="mx-auto flex max-w-xl flex-col gap-10 pt-10">
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

function QuestionFormFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex w-full items-center justify-center gap-2 pb-10 pt-10">{children}</div>;
}

// function QuestionFormFooter({ disabled }: { disabled?: boolean }) {
//   const navigate = useNavigate();
//   const fetcher = useFetcher({ key: FETCHER_KEY });
//   const { currentIndex, currentQuestionNumber, currentQuestionsTotal } = useOnboardingLoaderData();
//   const btnClassName = 'select-none';
//   const isSubmitting = fetcher.state !== 'idle';

//   return (
//     <div
//       className={cn(
//         'col-span-full items-center justify-center gap-2 pb-10 pt-10 transition-opacity duration-300 ease-in-out'
//       )}
//     >
//       {/* <div
//         className={cn(
//           'hidden',
//           'flex select-none items-center gap-2 text-sm text-muted-foreground',
//           currentIndex === 0 && 'invisible opacity-0'
//         )}
//       >
//         <Progress value={(currentQuestionNumber / currentQuestionsTotal) * 100} className="h-3 w-1/3 transition-none" />{' '}
//         Question {currentQuestionNumber} / {currentQuestionsTotal}
//       </div> */}
//       <div className="flex w-full items-center justify-center gap-2">
//         <Button
//           type="reset"
//           disabled={isSubmitting || currentIndex === 0}
//           onClick={(e) => {
//             navigate(-1);
//           }}
//           size="lg"
//           variant="secondary"
//           className={cn(btnClassName, currentIndex === 110 && 'hidden')}
//         >
//           Back
//         </Button>

//         <Button type="submit" className={cn(btnClassName)} size="lg" disabled={disabled} loading={isSubmitting}>
//           {currentQuestionNumber !== currentQuestionsTotal ? 'Next' : 'Done'}
//         </Button>
//       </div>
//     </div>
//   );
// }

function FreePromptsMsg({ isLastQuestion }: { isLastQuestion: boolean }) {
  // TODO: probably just gonna remove this, because you don't get anything for doing it
  // we make you.
  return null;
  // return (
  //   <aside className="mx-auto flex items-center justify-center rounded-full bg-accent px-4 py-2 text-muted-foreground">
  //     <StarShineIcon className="mr-2" />
  //     {isLastQuestion ? <>You've unlocked free prompts!</> : <>You'll be rewarded free prompts on completion!</>}
  //   </aside>
  // );
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

function ImageCarousel() {
  const images = [1, 2, 3, 4, 5];
  const [currentIndex, setCurrentIndex] = useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-lg">
      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((src, index) => (
          <div key={src} className="max-w-full flex-shrink-0 overflow-hidden rounded-lg border border-border">
            <img
              src={`/onboarding/${src}.png`}
              alt={`Quadratic ${index + 1}`}
              className="max-w-full object-cover"
              width="635"
              height="380"
            />
          </div>
        ))}
      </div>

      {/* Navigation buttons */}
      <button
        type="button"
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70"
        aria-label="Previous image"
      >
        <ChevronLeftIcon size="lg" />
      </button>
      <button
        type="button"
        onClick={goToNext}
        className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70"
        aria-label="Next image"
      >
        <ChevronRightIcon size="lg" />
      </button>

      {/* Indicator dots */}
      <div className="absolute bottom-4 left-1/2 flex hidden -translate-x-1/2 items-center justify-center gap-4">
        {images.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goToSlide(index)}
            className={cn(
              'h-4 w-4 rounded-full transition-all',
              currentIndex === index ? 'bg-primary' : 'bg-foreground/20'
            )}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
