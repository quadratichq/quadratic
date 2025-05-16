import { questionsById } from '@/dashboard/onboarding/questionsById';
import {
  AIIcon,
  CheckIcon,
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

const questionFormsById = {
  role: Question2,
  languages: Question3,
  goals: Question4,
};

const useCurrentIndex = () => {
  const [searchParams] = useSearchParams();
  const uniqueKeys = new Set(searchParams.keys());
  return uniqueKeys.size;
};

function AnimatedOnboarding() {
  const currentIndex = useCurrentIndex();

  // const [currentIndex, setCurrentIndex] = useState(0);
  // const handleNext = () => {
  //   setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  // };
  // const handleBack = () => {
  //   setCurrentIndex((i) => Math.max(0, i - 1));
  // };

  return (
    <>
      <Link to="./" className="flex justify-center">
        <Logo index={currentIndex} />
      </Link>
      <div className="relative w-full max-w-xl transition-all">
        <div className="relative min-h-[4rem]">
          <div
            className={cn(
              'absolute inset-0 transition-all duration-500 ease-in-out',
              0 === currentIndex
                ? 'z-10 translate-x-0 opacity-100'
                : 0 < currentIndex
                  ? 'invisible z-0 -translate-x-1/3 opacity-0'
                  : 'invisible z-0 translate-x-1/3 opacity-0',
              'transform'
            )}
          >
            <Question1 id="use" />
          </div>
          {Object.entries(questionFormsById).map(([id, Form], i) => (
            <div
              key={id}
              className={cn(
                'absolute inset-0 transition-all duration-500 ease-in-out',
                i + 1 === currentIndex
                  ? 'z-10 translate-x-0 opacity-100'
                  : i + 1 < currentIndex
                    ? 'invisible z-0 -translate-x-1/3 opacity-0'
                    : 'invisible z-0 translate-x-1/3 opacity-0',
                'transform'
              )}
            >
              <Form id={id} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function QuestionFooter() {
  const currentIndex = useCurrentIndex();
  // const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  return (
    <div className="mt-10 flex w-full items-center justify-center gap-4">
      <Button
        type="reset"
        onClick={() => {
          // setSearchParams((prev) => {
          //   const entries = Array.from(prev.entries());
          //   const entriesMinusLast = entries.slice(0, -1);
          //   return new URLSearchParams(entriesMinusLast);
          // });
          navigate(-1);
        }}
        size="lg"
        variant="link"
        className={cn('w-20 text-muted-foreground', currentIndex === 0 && 'invisible opacity-0')}
      >
        Back
      </Button>
      <span className="flex-grow text-center text-muted-foreground">Question {currentIndex + 1} of X</span>
      <Button type="submit" className="w-20" size="lg">
        Next
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
      <div className={cn(className, index > 4 && 'bg-[#6CD4FF]')} />
      <div className={cn(className, 'col-start-2', index > 4 && 'bg-[#FFC800]')} />
    </div>
  );
}

function Question({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-10">{children}</div>;
}
function QuestionOptions({ children, className }: { children: React.ReactNode; className?: string }) {
  const [, setSearchParams] = useSearchParams();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;

        const formData = new FormData(form);
        const values = Object.fromEntries(formData.entries());

        const valuez = Array.from(formData.entries());

        console.log('handle submit form', values, valuez);
        setSearchParams((prev) => {
          valuez.forEach(([key, value]) => {
            prev.append(key, value as string);
          });
          // Object.entries(values).forEach(([key, value]) => {
          //   prev.set(key, value as string);
          // });
          return prev;
        });

        form.reset();
        // handleSubmit();
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

function Question1(props: any) {
  const className =
    'flex flex-col items-center gap-2 border border-border rounded-lg px-4 py-8 hover:border-primary shadow-sm font-medium active:bg-accent';
  return (
    <Question>
      <QuestionName caption="You answers help personalize your experience.">How will you use Quadratic?</QuestionName>
      <QuestionOptions className="grid grid-cols-3 gap-2">
        <QuestionOption value="work" name={props.id} className={className}>
          <WorkIcon size="lg" className="text-primary" />
          Work
        </QuestionOption>
        <QuestionOption value="personal" name={props.id} className={className}>
          <PersonalIcon size="lg" className="text-primary" />
          Personal
        </QuestionOption>
        <QuestionOption value="education" name={props.id} className={className}>
          <EducationIcon size="lg" className="text-primary" />
          Education
        </QuestionOption>
      </QuestionOptions>
      <aside className="mx-auto flex items-center justify-center rounded-full bg-accent px-4 py-2 text-muted-foreground">
        <StarShineIcon className="mr-2" />
        You’ll be rewarded <strong className="mx-1 font-semibold">20 free prompts</strong> on completion!
      </aside>
    </Question>
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
        {/* <QuestionOption type="reset">None of these</QuestionOption> */}
      </QuestionOptions>
    </Question>
  );
}

function Question4(props: any) {
  return (
    <Question>
      <QuestionName>What are you looking to accomplish in Quadratic?</QuestionName>
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
    'relative select-none border border-border font-medium shadow-sm hover:border-primary hover:shadow-md has-[input:checked]:border-primary has-[input:checked]:bg-accent has-[input:checked]:shadow-lg';
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
    return (
      <label htmlFor={name + value} className={cn(baseClassName, className ? className : defaultClassName)}>
        <input type="checkbox" id={name + value} value={value} name={name} className="peer sr-only" />
        {children}
        <CheckIcon className="absolute right-2 top-2 ml-auto text-primary opacity-0 peer-checked:opacity-100" />
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
    </label>
  );
}

export function Questionnn({ id }: { id: string }) {
  const question = questionsById[id];
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h2 className="text-center text-4xl font-bold">{question.label}</h2>
        {question.subLabel && <p className="text-center text-lg">{question.subLabel}</p>}
      </header>
      <main>
        {question.options.map((option) => (
          <QuestionOption key={option.value} value={option.value} name={id}>
            {option.label}
          </QuestionOption>
        ))}
      </main>
      <aside className="mx-auto flex items-center justify-center rounded-full bg-secondary px-4 py-2 text-muted-foreground">
        <StarShineIcon className="mr-2" />
        You’ll be rewarded <strong className="mx-1 font-semibold">20 free prompts</strong> on completion!
      </aside>
      <footer></footer>
    </div>
  );
}
