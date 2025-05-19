import {
  AIIcon,
  ArrowRightIcon,
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
import { cn } from '@/shared/shadcn/utils';
import { Link, useNavigate, useSearchParams } from 'react-router';

export const Component = () => {
  useRemoveInitialLoadingUI();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-10 pt-16">
      <AnimatedOnboarding />
    </div>
  );
};

const allQuestions = [
  {
    id: 'use', // TODO: `intent`
    title: 'How will you use Quadratic?',
    subtitle: 'Your answers help personalize your experience.',
    type: 'radio',
    options: [
      { value: 'work', label: 'Work' },
      { value: 'personal', label: 'Personal' },
      { value: 'education', label: 'Education' },
    ],
    Form: (props: any) => {
      const iconsByValue: Record<string, React.ReactNode> = {
        work: <WorkIcon size="lg" className="text-primary" />,
        personal: <PersonalIcon size="lg" className="text-primary" />,
        education: <EducationIcon size="lg" className="text-primary" />,
      };
      const className =
        'flex flex-col items-center gap-2 border border-border rounded-lg px-4 py-8 hover:border-primary shadow-sm font-medium active:bg-accent';
      return (
        <Question>
          <QuestionName caption={props.subtitle}>{props.title}</QuestionName>
          <QuestionOptions className="grid grid-cols-3 gap-2">
            {props.options.map((option: any) => (
              <QuestionOption value={option.value} name={props.id} className={className} type={props.type}>
                {iconsByValue[option.value]}
                {option.label}
              </QuestionOption>
            ))}
          </QuestionOptions>

          <aside className="mx-auto flex items-center justify-center rounded-full bg-accent px-4 py-2 text-muted-foreground">
            <StarShineIcon className="mr-2" />
            You’ll be rewarded <strong className="mx-1 font-semibold">20 free prompts</strong> on completion!
          </aside>
        </Question>
      );
    },
  },

  // Work
  { id: 'role', Form: Question2, use: 'work' },

  // Personal
  { id: 'personal-use', Form: Question5, use: 'personal' },

  // Education
  { id: 'self-describe', Form: Question6, use: 'education' },
  { id: 'subject-areas', Form: Question7, use: 'education' },

  // Shared
  { id: 'languages', Form: Question3, showNext: true /* type=checkbox */ },
  { id: 'goals', Form: Question4, showNext: true },
];

const useFormNavigation = () => {
  const [searchParams] = useSearchParams();
  const currentUse = searchParams.get('use');
  // TODO: how do we handle 'other' if they submit it?
  const uniqueKeys = new Set(searchParams.keys());
  const currentQuestionStack = currentUse ? allQuestions.filter((q) => (q.use ? q.use === currentUse : true)) : [];
  const currentIndex = uniqueKeys.size;
  const currentId = currentUse ? currentQuestionStack[currentIndex].id : 'use';

  return {
    currentUse: currentUse ? currentUse : null,
    currentIndex: currentIndex,
    currentId,
    isLastQuestion: currentId === allQuestions[allQuestions.length - 1].id,
    currentQuestion: currentUse ? currentQuestionStack[currentIndex] : allQuestions[0],
  };
};

function AnimatedOnboarding() {
  const formNavigation = useFormNavigation();
  const { currentIndex, currentId } = formNavigation;
  console.log('formNavigation', formNavigation);

  return (
    <>
      <Link to="./" className="flex justify-center">
        <Logo index={currentIndex} />
      </Link>
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

function QuestionFooter() {
  const { currentIndex, isLastQuestion, currentQuestion } = useFormNavigation();
  const navigate = useNavigate();
  const isFirstQuestion = currentIndex === 0;
  const showNext = !isFirstQuestion && currentQuestion.showNext;
  const className = 'w-28 px-0 select-none transition-opacity delay-200 ease-in-out';

  return (
    <div className="mt-10 flex w-full items-center justify-center gap-4">
      <Button
        type="reset"
        onClick={() => {
          navigate(-1);
        }}
        size="lg"
        variant="link"
        className={cn(className, 'justify-start text-muted-foreground', isFirstQuestion && 'invisible opacity-0')}
      >
        Back
      </Button>
      <span className="flex-grow select-none text-center text-sm text-muted-foreground">
        Question {currentIndex + 1} of X
      </span>

      <Button type="submit" className={cn(className, !showNext && 'invisible opacity-0')} size="lg">
        {isLastQuestion ? 'Get started!' : 'Next'}
      </Button>
    </div>
  );
}

function Logo({ index }: { index: number }) {
  const className = 'h-5 w-5 bg-border transition-colors';
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

function Question({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-10">{children}</div>;
}

// TODO: rename to QuestionForm
function QuestionOptions({ children, className }: { children: React.ReactNode; className?: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLastQuestion } = useFormNavigation();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const values = Array.from(formData.entries());

        console.log('handle submit form', values, searchParams);
        // TODO: handle empty values, like filter them out

        // Append the new values
        const newSearchParams = searchParams;
        values.forEach(([key, value]) => {
          newSearchParams.append(key, value as string);
        });

        // If it's the last question, convert the search params to a payload
        // and submit it to the server
        if (isLastQuestion) {
          const payload: Record<string, string | string[]> = {};
          for (const [key, value] of newSearchParams.entries()) {
            if (payload[key]) {
              // Convert existing string to array if not already
              payload[key] = Array.isArray(payload[key]) ? payload[key] : [payload[key]];
              payload[key].push(value);
            } else {
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
    >
      <div className={className}>{children}</div>

      <QuestionFooter />
    </form>
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

function Question2(props: any) {
  return (
    <Question>
      <QuestionName>What best describes your role?</QuestionName>
      <QuestionOptions className="grid grid-cols-2 gap-2">
        <QuestionOption name={props.id} value="data-analysis">
          Data analysis
        </QuestionOption>
        <QuestionOption name={props.id} value="software-development">
          Software development
        </QuestionOption>
        <QuestionOption name={props.id} value="engineering">
          Engineering
        </QuestionOption>
        <QuestionOption name={props.id} value="sales">
          Sales
        </QuestionOption>
        <QuestionOption name={props.id} value="marketing">
          Marketing
        </QuestionOption>
        <QuestionOption name={props.id} value="product">
          Product
        </QuestionOption>
        <QuestionOption name={props.id} value="founder">
          Founder / entrepreneur
        </QuestionOption>
        <QuestionOption name={props.id} value="ai-ml">
          AI / ML
        </QuestionOption>
        <QuestionOption name={props.id} value="finance">
          Finance
        </QuestionOption>
        <QuestionOption name={props.id} value="other">
          Other
        </QuestionOption>
      </QuestionOptions>
    </Question>
  );
}

function Question3(props: any) {
  const className =
    'relative flex flex-col items-center justify-center gap-2 rounded border border-border px-4 py-8 shadow-sm text-center hover:border-primary  has-[input:checked]:border-primary has-[input:checked]:bg-accent font-medium active:bg-accent';
  const languageClassName = 'h-10 w-10';
  return (
    <Question>
      <QuestionName caption="Select all that apply">Which of these Quadratic tools do you use?</QuestionName>
      <QuestionOptions className="grid grid-cols-3 gap-2">
        <QuestionOption type="checkbox" name={props.id} value="formulas" className={className}>
          <LanguageIcon language="formula" className={languageClassName} />
          Formulas
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="python" className={className}>
          <LanguageIcon language="python" className={languageClassName} />
          Python
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="javascript" className={className}>
          <LanguageIcon language="javascript" className={languageClassName} />
          JavaScript
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="sql" className={className}>
          <DatabaseIcon size="lg" className={languageClassName + ' text-orange-600'} />
          SQL
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="ai" className={className}>
          <AIIcon size="lg" className={languageClassName + ' text-green-600'} />
          AI / Vibe coding
        </QuestionOption>
        <input type="hidden" name={props.id} value="" />
        {/* <QuestionOption type="reset">None of these</QuestionOption> */}
      </QuestionOptions>
    </Question>
  );
}

function Question4(props: any) {
  return (
    <Question>
      <QuestionName caption="Select all that apply">What are you looking to accomplish in Quadratic?</QuestionName>
      <QuestionOptions className="grid grid-cols-2 gap-1">
        <QuestionOption type="checkbox" name={props.id} value="db-connections">
          Database connections
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="api-integrations">
          API integrations
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="data-cleaning">
          Data cleaning
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="data-analysis">
          Data analysis
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="data-modeling">
          Data modeling
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="data-visualization">
          Data visualization
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="ai-analysis">
          AI analysis
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="other">
          Other
        </QuestionOption>
      </QuestionOptions>
    </Question>
  );
}

function Question5(props: any) {
  return (
    <Question>
      <QuestionName caption="Select all that apply">What are you planning to use Quadratic for?</QuestionName>
      <QuestionOptions className="grid grid-cols-2 gap-2">
        <QuestionOption name={props.id} value="personal-finance">
          Personal finance
        </QuestionOption>
        <QuestionOption name={props.id} value="trading-investing">
          Trading/Investing
        </QuestionOption>
        <QuestionOption name={props.id} value="side-projects-hobbies">
          Side projects or hobbies
        </QuestionOption>
        <QuestionOption name={props.id} value="learning-to-code">
          Learning to code
        </QuestionOption>
        <QuestionOption name={props.id} value="getting-better-at-ai">
          Getting better at AI
        </QuestionOption>
        <QuestionOption name={props.id} value="other">
          Other
        </QuestionOption>
      </QuestionOptions>
    </Question>
  );
}

function Question6(props: any) {
  return (
    <Question>
      <QuestionName>What best describes you?</QuestionName>
      <QuestionOptions className="grid grid-cols-2 gap-2">
        <QuestionOption name={props.id} value="university-student">
          University student
        </QuestionOption>
        <QuestionOption name={props.id} value="high-school-student">
          High school student
        </QuestionOption>
        <QuestionOption name={props.id} value="educator-professor">
          Educator / professor
        </QuestionOption>
        <QuestionOption name={props.id} value="researcher">
          Researcher
        </QuestionOption>
        <QuestionOption name={props.id} value="bootcamp-self-taught">
          Bootcamp / self-taught
        </QuestionOption>
        <QuestionOption name={props.id} value="other">
          Other
        </QuestionOption>
      </QuestionOptions>
    </Question>
  );
}

function Question7(props: any) {
  return (
    <Question>
      <QuestionName caption="Select all that apply">What subject areas are you working in?</QuestionName>
      <QuestionOptions className="grid grid-cols-2 gap-2">
        <QuestionOption type="checkbox" name={props.id} value="math">
          Math
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="finance-economics">
          Finance / Economics
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="physics-engineering">
          Physics / Engineering
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="computer-science-ai">
          Computer Science / AI
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="business-marketing">
          Business / Marketing
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="social-sciences">
          Social sciences
        </QuestionOption>
        <QuestionOption type="checkbox" name={props.id} value="other">
          Other
        </QuestionOption>
      </QuestionOptions>
    </Question>
  );
}

function QuestionOption({
  type,
  value,
  children,
  className,
  name,
}: {
  type?: 'checkbox' | 'reset'; // defaykt us radio
  value: string;
  children: React.ReactNode;
  className?: string;
  name: string;
}) {
  const baseClassName =
    'group relative select-none border border-border font-medium shadow-sm hover:border-primary hover:shadow-md has-[input:checked]:border-primary has-[input:checked]:bg-accent has-[input:checked]:shadow-lg';
  const defaultClassName = 'flex items-center gap-2 rounded-lg p-4';

  // if (type === 'reset') {
  //   return (
  //     <label htmlFor={name + value} className={className ? className : defaultClassName}>
  //       <input type="reset" id={name + value} className="sr-only" />
  //       <input type="checkbox" id={name + value} name={name} value={value} className="sr-only" />
  //       {children}
  //     </label>
  //   );
  // }

  if (type === 'checkbox') {
    const isLanguage = name === 'languages';
    const iconClassName = isLanguage ? 'absolute right-2 top-2' : 'absolute right-4 top-1/2 -translate-y-1/2';
    return (
      <label htmlFor={name + value} className={cn(baseClassName, className ? className : defaultClassName)}>
        <input type="checkbox" id={name + value} value={value} name={name} className="peer sr-only" />
        {children}
        <CheckBoxEmptyIcon className={cn(iconClassName, 'text-border opacity-100 peer-checked:opacity-0')} />
        <CheckBoxIcon className={cn(iconClassName, 'text-primary opacity-0 peer-checked:opacity-100')} />
      </label>
    );
  }

  return (
    <label className={cn(baseClassName, className ? className : defaultClassName)}>
      <input
        type="radio"
        value={value}
        name={name}
        className="sr-only"
        onClick={(e) => {
          const target = e.target as HTMLInputElement;
          if (target.form) {
            target.form.requestSubmit();
          }
        }}
      />

      {children}

      {name !== 'use' && (
        <ArrowRightIcon className="ml-auto opacity-20 group-hover:text-primary group-hover:opacity-100" />
      )}
    </label>
  );
}

// export function Questionnn({ id }: { id: string }) {
//   const question = questionsById[id];
//   return (
//     <div className="flex flex-col gap-10">
//       <header className="flex flex-col gap-2">
//         <h2 className="text-center text-4xl font-bold">{question.label}</h2>
//         {question.subLabel && <p className="text-center text-lg">{question.subLabel}</p>}
//       </header>
//       <main>
//         {question.options.map((option) => (
//           <QuestionOption key={option.value} value={option.value} name={id}>
//             {option.label}
//           </QuestionOption>
//         ))}
//       </main>
//       <aside className="mx-auto flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-muted-foreground">
//         <StarShineIcon className="mr-2" />
//         You’ll be rewarded <strong className="mx-1 font-semibold">20 free prompts</strong> on completion!
//       </aside>
//       <footer></footer>
//     </div>
//   );
// }
