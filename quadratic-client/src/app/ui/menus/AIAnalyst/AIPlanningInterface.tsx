import { aiAnalystPlanningModeAtom, aiAnalystPlanningModeLoadingAtom } from '@/app/atoms/aiAnalystAtom';
import { Button } from '@/shared/shadcn/ui/button';
import { SpinnerIcon, AddIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { memo, useCallback, useEffect } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { PlanStep } from './PlanStep';
import { parsePlanIntoSteps, stepsToText, updateStep, addStep, removeStep } from './utils/planParser';

interface AIPlanningInterfaceProps {
  onExecutePlan: (plan: string) => void;
  onCancel: () => void;
}

export const AIPlanningInterface = memo(({ onExecutePlan, onCancel }: AIPlanningInterfaceProps) => {
  const [planningMode, setPlanningMode] = useRecoilState(aiAnalystPlanningModeAtom);
  const loading = useRecoilValue(aiAnalystPlanningModeLoadingAtom);

  const { currentPlan, planSteps, planEdited, originalQuery } = planningMode;

  // Parse plan into steps when currentPlan changes
  useEffect(() => {
    if (currentPlan && planSteps.length === 0) {
      const parsedSteps = parsePlanIntoSteps(currentPlan);
      setPlanningMode(prev => ({
        ...prev,
        planSteps: parsedSteps,
      }));
    }
  }, [currentPlan, planSteps.length, setPlanningMode]);

  const handleStepEdit = useCallback((stepId: string, content: string) => {
    setPlanningMode(prev => {
      const updatedSteps = updateStep(prev.planSteps, stepId, { content, isEditing: false });
      return {
        ...prev,
        planSteps: updatedSteps,
        currentPlan: stepsToText(updatedSteps),
        planEdited: true,
      };
    });
  }, [setPlanningMode]);

  const handleStepStartEdit = useCallback((stepId: string) => {
    setPlanningMode(prev => ({
      ...prev,
      planSteps: updateStep(prev.planSteps, stepId, { isEditing: true }),
    }));
  }, [setPlanningMode]);

  const handleStepCancelEdit = useCallback((stepId: string) => {
    setPlanningMode(prev => ({
      ...prev,
      planSteps: updateStep(prev.planSteps, stepId, { isEditing: false }),
    }));
  }, [setPlanningMode]);

  const handleStepDelete = useCallback((stepId: string) => {
    setPlanningMode(prev => {
      const updatedSteps = removeStep(prev.planSteps, stepId);
      return {
        ...prev,
        planSteps: updatedSteps,
        currentPlan: stepsToText(updatedSteps),
        planEdited: true,
      };
    });
  }, [setPlanningMode]);

  const handleAddStep = useCallback(() => {
    setPlanningMode(prev => {
      const updatedSteps = addStep(prev.planSteps, prev.planSteps.length, '');
      return {
        ...prev,
        planSteps: updatedSteps,
        planEdited: true,
      };
    });
  }, [setPlanningMode]);

  const handleExecute = useCallback(() => {
    const finalPlan = stepsToText(planSteps);
    if (finalPlan.trim()) {
      onExecutePlan(finalPlan.trim());
    }
  }, [planSteps, onExecutePlan]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        {/* Loading state taking full height */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <SpinnerIcon className="w-8 h-8 mx-auto" />
            <div>
              <div className="text-lg font-medium">Creating comprehensive plan...</div>
              <div className="text-sm text-muted-foreground mt-2">
                Analyzing your request: "{originalQuery}"
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasSteps = planSteps.length > 0;
  const canExecute = hasSteps && planSteps.some(step => step.content.trim());

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">Plan Review & Edit</span>
              {planEdited && (
                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                  Modified
                </span>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              Review and edit each step before execution
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExecute}
              disabled={!canExecute}
              className="min-w-24"
            >
              Execute Plan
            </Button>
          </div>
        </div>
        
        {/* Original query */}
        <div className="mt-3 p-3 bg-background/60 rounded-lg border border-border/60">
          <div className="text-xs font-medium text-muted-foreground mb-1">Original Request:</div>
          <div className="text-sm">{originalQuery}</div>
        </div>
      </div>

      {/* Steps content - scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {planSteps.map((step, index) => (
            <PlanStep
              key={step.id}
              id={step.id}
              content={step.content}
              isEditing={step.isEditing}
              stepNumber={index + 1}
              onEdit={handleStepEdit}
              onStartEdit={handleStepStartEdit}
              onCancelEdit={handleStepCancelEdit}
              onDelete={handleStepDelete}
            />
          ))}
          
          {/* Add step button */}
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              onClick={handleAddStep}
              className="text-muted-foreground hover:text-foreground"
            >
              <AddIcon className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>
        </div>
      </div>

      {/* Footer with shortcuts */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-muted/10">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>Click any step to edit • Hover for actions</div>
          <div className="flex items-center gap-4">
            <span>Steps: {planSteps.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
});