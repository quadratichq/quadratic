import {
  AIIcon,
  ArrowRightIcon,
  BlockIcon,
  CheckBoxEmptyIcon,
  CheckBoxIcon,
  DatabaseIcon,
  EducationIcon,
  PersonalIcon,
  StarShineIcon,
  WorkIcon,
} from '@/shared/components/Icons';
import { LanguageIcon } from '@/shared/components/LanguageIcon';
import { useRemoveInitialLoadingUI } from '@/shared/hooks/useRemoveInitialLoadingUI';
import { Button } from '@/shared/shadcn/ui/button';
import { Progress } from '@/shared/shadcn/ui/progress';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

const CONTROL_BASE =
  'group relative select-none rounded border border-border font-medium shadow-sm hover:border-primary hover:shadow-md has-[input:checked]:border-primary has-[input:checked]:bg-accent has-[input:checked]:shadow-lg has-[input:focus-visible]:ring-1 has-[input:focus-visible]:ring-ring';
const CONTROL_INLINE =
  'flex items-center gap-2 rounded-lg border border-border px-4 py-4 font-medium shadow-sm hover:border-primary active:bg-accent';
const CONTROL_STACKED =
  'flex flex-col items-center gap-1 rounded-lg border border-border px-4 py-8 font-medium shadow-sm hover:border-primary active:bg-accent';

function ControlLinkInline(props: { children: React.ReactNode }) {
  return (
    <div className={cn(CONTROL_BASE, CONTROL_INLINE)}>
      {props.children}
      <ArrowRightIcon className="ml-auto opacity-20 group-hover:text-primary group-hover:opacity-100" />
    </div>
  );
}

function ControlCheckboxInline(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    children: React.ReactNode;
  }
) {
  const { children, ...rest } = props;
  const iconClassName = 'absolute right-4 top-1/2 -translate-y-1/2';
  const defaultClassName = 'flex items-center gap-2 rounded-lg p-4 peer';
  return (
    <ControlCheckbox className={defaultClassName} {...rest}>
      {children}
      <CheckBoxEmptyIcon
        className={cn(iconClassName, 'text-border opacity-100 group-hover:text-primary peer-checked:opacity-0')}
      />
      <CheckBoxIcon className={cn(iconClassName, 'text-primary opacity-0 peer-checked:opacity-100')} />
    </ControlCheckbox>
  );
}

function ControlCheckbox(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    children: React.ReactNode;
  }
) {
  const { children, className, ...rest } = props;

  return (
    <label className={cn(CONTROL_BASE, className)}>
      <input type="checkbox" className="peer sr-only" {...rest} />
      {children}
    </label>
  );
}

function ControlCheckboxStacked(
  props: React.InputHTMLAttributes<HTMLInputElement> & {
    children: React.ReactNode;
  }
) {
  const { children, className, ...rest } = props;
  const iconClassName = 'absolute right-2 top-2';

  return (
    <ControlCheckbox className={CONTROL_STACKED} {...rest}>
      {props.children}
      <CheckBoxEmptyIcon className={cn(iconClassName, 'text-border opacity-100 peer-checked:opacity-0')} />
      <CheckBoxIcon className={cn(iconClassName, 'text-primary opacity-0 peer-checked:opacity-100')} />
    </ControlCheckbox>
  );
}

export const Component = () => {
  useRemoveInitialLoadingUI();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-10 pt-16">
      <AnimatedOnboarding />
    </div>
  );
};

type QuestionFormProps = {
  id: string;
  use?: string;
  title: string;
  subtitle?: string;
  options: Array<{ value: string; label: string }>;
};
type Questions = Array<QuestionFormProps & { Form: (props: QuestionFormProps) => React.ReactNode }>;

// TODO: turn this into a zod schema so we validate the payload before sending it...?
export type QuestionVersion1Payload = {
  use: 'work' | 'personal' | 'education';
  'work-role': string;
  'work-role-other'?: string;
  'personal-uses': string;
  'personal-uses-other'?: string;
  'education-identity': string;
  'education-identity-other'?: string;
  'education-subjects': string;
};

// Note: these are in a specific order for a reason. They represent the order
// of the questions in the onboarding flow. Any with `use` will be filtered out
// based on the value of `use` in the search params.
const allQuestions: Questions = [
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
              <Link
                key={option.value}
                to={`./?${props.id}=${option.value}`}
                className={cn(CONTROL_BASE, CONTROL_STACKED)}
              >
                {iconsByValue[option.value]}
                <span className="relative flex items-center">
                  {option.label}
                  <ArrowRightIcon className="absolute left-full top-1/2 -translate-y-1/2 opacity-20 group-hover:text-primary group-hover:opacity-100" />
                </span>
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
    use: 'work',
    title: 'What best describes your role?',
    options: [
      { value: 'data-analysis', label: 'Data analysis' },
      { value: 'software-development', label: 'Software development' },
      { value: 'engineering', label: 'Engineering' },
      { value: 'sales', label: 'Sales' },
      { value: 'marketing', label: 'Marketing' },
      { value: 'product', label: 'Product' },
      { value: 'founder', label: 'Founder / entrepreneur' },
      { value: 'ai-ml', label: 'AI / ML' },
      { value: 'finance', label: 'Finance' },
      { value: 'other', label: 'Other' },
    ],
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const [other, setOther] = useState<boolean>(false);

      return (
        <Question title={props.title}>
          <QuestionForm className="grid grid-cols-2 gap-2" onSubmit={() => setOther(false)}>
            {props.options.map((option) =>
              option.value === 'other' ? (
                <CheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </CheckboxInputOther>
              ) : (
                <Link
                  to={`./?${searchParams.toString()}&${props.id}=${option.value}`}
                  onClick={() => setOther(false)}
                  key={option.value}
                >
                  <ControlLinkInline>{option.label}</ControlLinkInline>
                </Link>
              )
            )}
          </QuestionForm>
        </Question>
      );
    },
  },

  // Personal
  {
    id: 'personal-uses',
    use: 'personal',
    title: 'What are you planning to use Quadratic for?',
    subtitle: 'Select all that apply',
    options: [
      { value: 'personal-finance', label: 'Personal finance' },
      { value: 'trading-investing', label: 'Trading/Investing' },
      { value: 'side-projects-hobbies', label: 'Side projects or hobbies' },
      { value: 'learning-to-code', label: 'Learning to code' },
      { value: 'getting-better-at-ai', label: 'Getting better at AI' },
      { value: 'other', label: 'Other' },
    ],
    Form: (props) => {
      const [other, setOther] = useState<boolean>(false);

      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm
            className="grid grid-cols-2 gap-2"
            onSubmit={() => {
              setOther(false);
            }}
          >
            {props.options.map((option) =>
              option.value === 'other' ? (
                <CheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </CheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={option.value} key={option.value}>
                  {option.label}
                </ControlCheckboxInline>
              )
            )}
          </QuestionForm>
        </Question>
      );
    },
  },

  // Education
  {
    id: 'education-identity',
    use: 'education',
    title: 'What best describes you?',
    options: [
      { value: 'university-student', label: 'University student' },
      { value: 'high-school-student', label: 'High school student' },
      { value: 'educator-professor', label: 'Educator / professor' },
      { value: 'researcher', label: 'Researcher' },
      { value: 'bootcamp-self-taught', label: 'Bootcamp / self-taught' },
      { value: 'other', label: 'Other' },
    ],
    Form: (props) => {
      const [searchParams] = useSearchParams();
      const [other, setOther] = useState<boolean>(false);

      return (
        <Question title={props.title}>
          <QuestionForm className="grid grid-cols-2 gap-2">
            {props.options.map((option) =>
              option.value === 'other' ? (
                <CheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </CheckboxInputOther>
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
          </QuestionForm>
        </Question>
      );
    },
  },
  {
    id: 'education-subjects',
    use: 'education',
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
      const [other, setOther] = useState<boolean>(false);
      return (
        <Question title={props.title} subtitle={props.subtitle}>
          <QuestionForm className="grid grid-cols-2 gap-2">
            {props.options.map((option) =>
              option.value === 'other' ? (
                <CheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </CheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={option.value} key={option.value}>
                  {option.label}
                </ControlCheckboxInline>
              )
            )}
          </QuestionForm>
        </Question>
      );
    },
  },

  // Shared
  {
    id: 'languages',
    title: 'Which languages are you proficient in?',
    subtitle: 'Select all that apply',
    options: [
      { value: 'formulas', label: 'Formulas' },
      { value: 'python', label: 'Python' },
      { value: 'javascript', label: 'JavaScript' },
      { value: 'sql', label: 'SQL' },
      { value: 'ai', label: 'AI / Vibe coding' },
      // { value: 'none', label: 'None of these' },
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
      // TODO: how to handle people answering none
      // TODO: change QuestionOption to ControlCheckboxStacked
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
          </QuestionForm>
        </Question>
      );
    },
  },
  {
    id: 'goals',
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
      const [other, setOther] = useState<boolean>(false);
      return (
        <Question>
          <QuestionName caption={props.subtitle}>{props.title}</QuestionName>
          <QuestionForm className="grid grid-cols-2 gap-1">
            {props.options.map((option) =>
              option.value === 'other' ? (
                <CheckboxInputOther
                  key={option.value}
                  id={props.id}
                  value={option.value}
                  checked={other}
                  onChange={setOther}
                >
                  {option.label}
                </CheckboxInputOther>
              ) : (
                <ControlCheckboxInline name={props.id} value={option.value} key={option.value}>
                  {option.label}
                </ControlCheckboxInline>
              )
            )}
          </QuestionForm>
        </Question>
      );
    },
  },
  // TODO: show "you got 20 free prompts" message on last question
];

/**
 * This hook is how we track the progress of the various forms. We track this
 * status via the search params. Each key corresponds to a question (one question
 * per form). In cases where multiple answers are possible, that's because the
 * user is able to specify 'other' and we track that via the `-other` suffix.
 * So, for example, a question might be `role` and if the user selects 'other'
 * then we'll track that as `role-other`, so the URL is:
 *
 *   ?use=work&role=other&role-other=some+user+input
 *
 * That is derived as a count of 2 questions: [use, role]
 */
const useFormNavigation = () => {
  const [searchParams] = useSearchParams();
  const currentUse = searchParams.get('use');
  const uniqueKeys = new Set(Array.from(searchParams.keys()).filter((key) => !key.endsWith('-other')));
  const currentQuestionStack = currentUse ? allQuestions.filter((q) => (q.use ? q.use === currentUse : true)) : [];
  const currentIndex = uniqueKeys.size;

  const currentId = currentUse ? currentQuestionStack[currentIndex].id : 'use';

  return {
    currentUse: currentUse ? currentUse : null,
    currentIndex: currentIndex,
    totalQuestions: currentQuestionStack.length - 1,
    currentId,
    isFirstQuestion: currentIndex === 0,
    isLastQuestion: currentId === allQuestions[allQuestions.length - 1].id,
    currentQuestion: currentUse ? currentQuestionStack[currentIndex] : allQuestions[0],
  };
};

function AnimatedOnboarding() {
  const formNavigation = useFormNavigation();
  const { currentIndex, currentId } = formNavigation;
  // console.log('formNavigation', formNavigation);

  return (
    <>
      <Logo index={currentIndex} />

      <div className="relative w-full max-w-xl transition-all">
        <div className="relative min-h-[4rem]">
          {allQuestions.map(({ Form, ...props }, i) => {
            const id = props.id;
            // console.log('currentId:%s id:%s currentIndex:%s i:%s', currentId, id, currentIndex, i);
            // see if the id is before or after the currentId in allQuestions
            const isBeforeCurrentId = allQuestions.findIndex((q) => q.id === currentId) > i;
            return (
              <div
                key={id}
                id={id}
                className={cn(
                  'absolute inset-0 transition-all duration-500 ease-in-out',
                  'transform',
                  // Current question
                  id === currentId
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
    </>
  );
}

function CheckboxInputOther(props: {
  children: React.ReactNode;
  id: string;
  value: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { children, id, value, checked, onChange } = props;
  const inputRef = useRef<HTMLInputElement>(null);

  // Control the functionality of the input based on the checked state
  useEffect(() => {
    if (checked) {
      inputRef.current?.focus();
    } else if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, [checked]);

  return (
    <>
      <ControlCheckboxInline
        checked={checked}
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.checked)}
      >
        {children}
      </ControlCheckboxInline>

      {checked && (
        <input
          type="text"
          ref={inputRef}
          name={`${id}-other`}
          placeholder="Please elaborate…"
          className="text-md col-span-full w-full rounded-lg border border-border px-4 py-4 font-medium peer-has-[input:checked]:border-primary peer-has-[input:checked]:bg-accent peer-has-[input:checked]:shadow-lg"
        />
      )}
    </>
  );
}

function QuestionFormFooter({ disabled }: { disabled?: boolean }) {
  const navigate = useNavigate();
  const { currentIndex, totalQuestions, isFirstQuestion, isLastQuestion } = useFormNavigation();
  const btnClassName = 'select-none';

  return (
    <div
      className={cn(
        'col-span-full grid grid-cols-2 items-center justify-between gap-4 pt-10 transition-opacity delay-300 duration-300 ease-in-out',
        isFirstQuestion && 'invisible opacity-0'
      )}
    >
      <div className="flex select-none items-center gap-2 text-sm text-muted-foreground">
        <Progress value={(currentIndex / totalQuestions) * 100} className="hidden h-3 w-1/3 delay-500" /> Question{' '}
        {currentIndex} / {totalQuestions}
      </div>
      <div className="flex items-center justify-end gap-2">
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
        <Button
          type="submit"
          className={cn(btnClassName)}
          size="lg"
          disabled={disabled === undefined ? false : disabled}
        >
          {isLastQuestion ? 'Submit' : 'Next'}
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
          You've unlocked <strong className="mx-1 font-semibold">20 free prompts</strong>, let's get started!
        </>
      ) : (
        <>
          You'll be rewarded <strong className="mx-1 font-semibold">20 free prompts</strong> on completion!
        </>
      )}
    </aside>
  );
}

function Logo({ index }: { index: number }) {
  const className = 'h-5 w-5 bg-border transition-colors';
  // TODO: figure out how to show progress across variable question stacks
  return (
    <div className="inline-grid grid-cols-2 justify-center gap-0.5">
      <div className={cn(className, 'justify-self-end', index >= 0 && 'bg-[#CB8999]')} />
      <div className={cn(className, index > 0 && 'bg-[#8ECB89]')} />
      <div className={cn(className, 'justify-self-end', index > 1 && 'bg-[#5D576B]')} />
      <div className={cn(className, index > 2 && 'bg-[#6CD4FF]')} />
      <div className={cn(className, 'col-start-2', index > 3 && 'bg-[#FFC800]')} />
    </div>
  );
}

function Question({ children, title, subtitle }: { children: React.ReactNode; title?: string; subtitle?: string }) {
  return (
    <div className="flex flex-col gap-10">
      {title && <QuestionName caption={subtitle}>{title}</QuestionName>}
      {children}
    </div>
  );
}
function QuestionName({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h2 className="text-center text-4xl font-bold">{children}</h2>
      {caption && <p className="text-center text-lg text-muted-foreground">{caption}</p>}
    </header>
  );
}

function QuestionForm({
  children,
  className,
  onChange,
  onSubmit,
}: {
  children: React.ReactNode;
  className?: string;
  onChange?: (e: React.FormEvent<HTMLFormElement>) => void;
  onSubmit?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLastQuestion } = useFormNavigation();
  // TODO: consider what you want to do here
  // reset on form submit
  // const [isValid, setIsValid] = useState(false);

  return (
    <form
      ref={formRef}
      // onChange={(e) => {
      //   if (!formRef.current) {
      //     return;
      //   }
      //   // if the form has at least one field in it, then it's valid
      //   const form = formRef.current;
      //   const formData = new FormData(form);
      //   const values = Array.from(formData.entries());
      //   // exclude empty values
      //   const nonEmptyValues = values.filter(([key, value]) => value !== '');

      //   if (nonEmptyValues.length > 0) {
      //     setIsValid(true);
      //   } else {
      //     setIsValid(false);
      //   }
      // }}
      onChange={(e) => {
        if (onChange) onChange(e);
      }}
      onSubmit={(e) => {
        e.preventDefault();

        // Handle form-specific side effects (if provided)
        if (onSubmit) {
          onSubmit();
        }

        // Get the current form's data
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const values = Array.from(formData.entries());

        // No values? No dice!
        if (values.length === 0) {
          console.warn('No values submitted. Gotta submit something!', formData.entries());
          return;
        }

        // Create a new version of the search params
        const newSearchParams = new URLSearchParams(searchParams);
        values.forEach(([key, value]) => {
          if (newSearchParams.has(key)) {
            newSearchParams.append(key, value as string);
          } else {
            newSearchParams.set(key, value as string);
          }
        });

        // If it's the last question, convert the search params to a payload
        // and submit it to the server
        if (isLastQuestion) {
          const payload: Record<string, string | string[]> = {};
          for (const [key, value] of newSearchParams.entries()) {
            if (payload[key]) {
              // Convert existing string to array if not already
              payload[key] = Array.isArray(payload[key]) ? payload[key] : [payload[key]];
              if (value !== '') {
                payload[key].push(value);
              }
            } else if (value !== '') {
              payload[key] = value;
            }
          }
          // JSON stringify url search params of prev
          window.alert(JSON.stringify(payload));
          return;
        }

        // Otherwise update the search params and reset the current form
        setSearchParams(newSearchParams);
        form.reset();
      }}
      className={className}
    >
      {children}
      <QuestionFormFooter disabled={false} />
    </form>
  );
}
