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
  excludeForUse?: string[];
};

export const questionsById: Record<
  string,
  QuestionProps & { Form: (props: QuestionProps & { id: string }) => React.ReactNode }
> = {
  instructions: {
    title: 'Welcome to Quadratic!',
    Form: (props) => {
      return (
        <Question title={props.title}>
          <QuestionForm>
            <ImageCarousel />
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
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const options = [
        { value: 'work', label: 'Work', icon: <WorkIcon size="lg" className="text-primary" /> },
        { value: 'personal', label: 'Personal', icon: <PersonalIcon size="lg" className="text-primary" /> },
        { value: 'education', label: 'Education', icon: <EducationIcon size="lg" className="text-primary" /> },
      ];

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <div className="grid grid-cols-3 gap-2">
              {options.map(({ value, label, icon }) => (
                <Link key={value} to={`./?${searchParams.toString()}&${props.id}=${value}`}>
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
    Form: (props) => {
      const optionsByValue = {
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
      const [searchParams] = useSearchParams();
      const [other, setOther] = useRecoilState(otherCheckboxAtom);

      return (
        <Question title={props.title}>
          <QuestionForm>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(optionsByValue).map(([value, label]) =>
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
    Form: (props) => {
      const optionsByValue = {
        '1': 'Just me',
        '2-5': '2-5',
        '5-20': '5-20',
        '20-250': '20-250',
        '250-10000': '250-10,000',
        '10000+': '10,000+',
      };
      const [searchParams] = useSearchParams();
      return (
        <Question title={props.title}>
          <QuestionForm>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(optionsByValue).map(([value, label]) => (
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
    Form: (props) => {
      const [other, setOther] = useRecoilState(otherCheckboxAtom);

      // Build options array with proper type inference
      const options: Array<{
        name: string;
        value: string;
        Logo: React.ComponentType;
      }> = [
        ...(Object.keys(connectionsByType) as Array<keyof typeof connectionsByType>).map((key) => ({
          name: connectionsByType[key].name,
          value: key,
          Logo: connectionsByType[key].Logo,
        })),
        ...(Object.keys(potentialConnectionsByType) as Array<keyof typeof potentialConnectionsByType>).map((key) => ({
          name: potentialConnectionsByType[key].name,
          value: key,
          Logo: potentialConnectionsByType[key].Logo,
        })),
      ];

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm>
            <div className="grid grid-cols-3 gap-2">
              {options.map(({ name, value, Logo }) => {
                return value === 'OTHER' ? (
                  <ControlCheckboxInputOther
                    key={value}
                    id={props.id}
                    value={value.toLowerCase()}
                    checked={other}
                    onChange={setOther}
                    stacked
                  >
                    <Logo />
                  </ControlCheckboxInputOther>
                ) : (
                  <ControlCheckboxStacked name={props.id} value={value} key={value}>
                    <Logo />
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
        </Question>
      );
    },
  },
  'team-invites[]': {
    title: 'Who would you like to invite to your team?',
    subtitle: 'Quadratic is better with your team. We’ll send them an invite.',
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
                type="submit"
                name={props.id}
                value="free"
                size="lg"
                className="mt-auto w-full"
                disabled={isSubmitting}
                loading={isSubmittingFree}
              >
                Get started
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
  const className = 'h-4 w-4 bg-border transition-colors';
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
        }, 1000);
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

function ImageCarousel() {
  const images = [1, 2, 3, 4];
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
    <div className="relative w-full md:ml-[-4rem] md:w-[calc(100%+8rem)]">
      <div className="-mt-6 flex justify-center gap-4 pb-4">
        {/* Go left */}
        <button
          type="button"
          onClick={goToPrevious}
          className="left-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-primary transition-opacity"
          aria-label="Previous image"
        >
          <ChevronLeftIcon size="lg" />
        </button>

        {/* Indicators */}
        <div className="flex items-center justify-center gap-4">
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

        {/* Go right */}
        <button
          type="button"
          onClick={goToNext}
          className="right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full text-primary transition-opacity"
          aria-label="Next image"
        >
          <ChevronRightIcon size="lg" />
        </button>
      </div>

      <div
        className="flex transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {images.map((src, index) => (
          <div key={src} className="max-w-full flex-shrink-0">
            <img
              src={`/onboarding/${src}.png`}
              alt={`Quadratic onboarding ${index + 1}`}
              className={cn(
                'w-full max-w-full rounded-lg border object-cover transition duration-500 ease-in-out',
                currentIndex === index
                  ? 'scale-100 border-border shadow-sm'
                  : 'scale-90 border-border opacity-20 grayscale'
              )}
              width="635"
              height="380"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
