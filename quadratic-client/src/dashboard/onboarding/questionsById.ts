type Question = {
  type: 'text' | 'checkbox' | 'radio';
  label: string;
  subLabel?: string;
  options: Array<{ label: string; value: string }>;
};

export const questionsById: Record<string, Question> = {
  'use-case': {
    type: 'radio',
    label: 'How will you use Quadratic?',
    subLabel: 'You answers help personalize your experience.',
    options: [
      { label: 'Work', value: 'work' },
      { label: 'Personal', value: 'personal' },
      { label: 'Education', value: 'education' },
    ],
  },
  role: {
    type: 'radio',
    label: 'What best describes your role?',
    options: [
      { label: 'Data analysis', value: 'data-analysis' },
      { label: 'Software development', value: 'software-development' },
      { label: 'Engineering', value: 'engineering' },
      { label: 'Sales', value: 'sales' },
      { label: 'Marketing', value: 'marketing' },
      { label: 'Product', value: 'product' },
      { label: 'Founder / entrepreneur', value: 'founder' },
      { label: 'AI / ML', value: 'ai-ml' },
      { label: 'Finance', value: 'finance' },
      { label: 'Other', value: 'other' },
    ],
  },
  // proficiency: {
  //   type: 'multi-select',
  //   label: 'Which tools do you consider yourself proficient in?',
  //   options: [
  //     { label: 'Python', value: 'python' },
  //     { label: 'SQL', value: 'sql' },
  //     { label: 'None of these', value: 'none' },
  //   ],
  // },
  // goals: {
  //   type: 'multi-select',
  //   label: 'What are you looking to accomplish in Quadratic?',
  //   options: [
  //     { label: 'Data analysis', value: 'data-analysis' },
  //     { label: 'AI integrations', value: 'ai' },
  //     { label: 'Other', value: 'other', allowsCustomText: true },
  //   ],
  // },
};
