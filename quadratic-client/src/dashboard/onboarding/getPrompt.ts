import { questionsById, type OnboardingResponseV1 } from '@/dashboard/onboarding/Questions';

export const DEFAULT_PROMPT =
  'Hi, I’m a new user to Quadratic. Show me what you can do by creating some sample product sales data and then charting it. Then tell me what else is possible in Quadratic.';

/**
 * If the user chose some of our pre-canned answers, we'll generate a prompt
 * for them to get started. If they chose 'other', we'll return a generic prompt
 */
export function getPrompt(data: OnboardingResponseV1) {
  if (data.use === 'work' && data['work-role'] && data['work-role'] !== 'other') {
    const value = data['work-role'];
    const label = questionsById['work-role'].optionsByValue[value];
    if (label)
      return `Hi, I'm a new user to Quadratic and I plan on using it for work. I work in ${label}; show me what you can do by creating me a sample dataset for that field. Once finished with the dataset, create a chart that helps explain the data. Then tell me what else is possible in Quadratic.`;
  } else if (data.use === 'personal' && data['personal-uses[]'] && data['personal-uses[]'].length > 0) {
    const value = data['personal-uses[]'].filter((value) => value !== 'other')[0];
    const label = questionsById['personal-uses[]'].optionsByValue[value];
    if (value && label)
      return `Hi, I'm a new user to Quadratic and I plan on using it for personal projects. One thing I'm going to use it for in particular is ${label}; show me what you can do by creating a sample dataset for that. Once finished with the dataset, create a chart that helps explain the data. Then tell me what else is possible in Quadratic.`;
  } else if (
    data.use === 'education' &&
    data['education-identity'] &&
    data['education-identity'] !== 'other' &&
    data['education-subjects[]'] &&
    data['education-subjects[]'].length > 0
  ) {
    const valueIdentity = data['education-identity'];
    const labelIdentity = questionsById['education-identity'].optionsByValue[valueIdentity];
    const valueSubject = data['education-subjects[]'].filter((value) => value !== 'other')[0];
    const labelSubject = questionsById['education-subjects[]'].optionsByValue[valueSubject];
    if (labelIdentity && labelSubject) {
      return `Hi, I’m a new user to Quadratic and I plan on using it for education. I’m a ${labelIdentity} and one of the areas I’m working in is ${labelSubject}; create me a sample dataset for my field. Once finished with the dataset, create a chart that helps explain the data. Then tell me what else is possible in Quadratic.`;
    }
  }

  return DEFAULT_PROMPT;
}
