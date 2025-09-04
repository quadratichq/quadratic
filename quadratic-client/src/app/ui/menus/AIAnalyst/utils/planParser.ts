import { v4 as uuid } from 'uuid';

export interface PlanStep {
  id: string;
  content: string;
  isEditing: boolean;
}

/**
 * Parses a plan text into discrete editable steps
 * Handles various formats including numbered lists, bullet points, and sections
 */
export function parsePlanIntoSteps(planText: string): PlanStep[] {
  if (!planText.trim()) return [];

  const lines = planText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const steps: PlanStep[] = [];
  let currentStep = '';
  let isInStep = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line starts a new step
    const isStepStart = (
      // Numbered lists: 1. 2. 1) 2) (1) (2) etc.
      /^\s*\(?(\d+)[.)]\s+/.test(line) ||
      // Bullet points: - * • 
      /^\s*[-*•]\s+/.test(line) ||
      // Headers: # ## ### 
      /^\s*#{1,6}\s+/.test(line) ||
      // Step indicators: Step 1, Phase 1, etc.
      /^\s*(step|phase|stage|task|objective)\s+\d+/i.test(line)
    );

    if (isStepStart || (!isInStep && line.trim())) {
      // Save previous step if it exists
      if (currentStep.trim()) {
        steps.push({
          id: uuid(),
          content: currentStep.trim(),
          isEditing: false,
        });
      }
      
      // Start new step
      currentStep = line;
      isInStep = true;
    } else if (isInStep) {
      // Continue current step
      currentStep += '\n' + line;
    } else {
      // Start a new step even if it doesn't match patterns
      if (currentStep.trim()) {
        steps.push({
          id: uuid(),
          content: currentStep.trim(),
          isEditing: false,
        });
      }
      currentStep = line;
      isInStep = true;
    }
  }

  // Add the last step
  if (currentStep.trim()) {
    steps.push({
      id: uuid(),
      content: currentStep.trim(),
      isEditing: false,
    });
  }

  // If no clear structure was found, treat the entire text as one step
  if (steps.length === 0 && planText.trim()) {
    steps.push({
      id: uuid(),
      content: planText.trim(),
      isEditing: false,
    });
  }

  return steps;
}

/**
 * Converts steps back into a single plan text
 */
export function stepsToText(steps: PlanStep[]): string {
  return steps.map(step => step.content).join('\n\n');
}

/**
 * Updates a specific step in the steps array
 */
export function updateStep(steps: PlanStep[], stepId: string, updates: Partial<PlanStep>): PlanStep[] {
  return steps.map(step => 
    step.id === stepId ? { ...step, ...updates } : step
  );
}

/**
 * Adds a new step at a specific position
 */
export function addStep(steps: PlanStep[], position: number, content: string): PlanStep[] {
  const newStep: PlanStep = {
    id: uuid(),
    content: content.trim(),
    isEditing: true,
  };

  const result = [...steps];
  result.splice(position, 0, newStep);
  return result;
}

/**
 * Removes a step
 */
export function removeStep(steps: PlanStep[], stepId: string): PlanStep[] {
  return steps.filter(step => step.id !== stepId);
}