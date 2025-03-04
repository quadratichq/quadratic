/**
 * Evaluation Scoring Utilities
 * 
 * This file contains functions for calculating aggregate scores based on AI model evaluations.
 */

import type { EvaluationResult } from './ai-evaluators';
import config from './config';

/**
 * Calculates an aggregate satisfaction score from multiple model evaluations
 * 
 * @param evaluations Array of evaluation results from different models
 * @returns A score between 0.0 and 100.0 representing overall satisfaction
 */
export function calculateAggregateScore(evaluations: EvaluationResult[]): number {
  if (!evaluations.length) return 0;
  
  // Extract the overall satisfaction scores from each evaluation
  const satisfactionScores = evaluations.map(evaluation => {
    // Parse the satisfaction percentage from string to number
    const matchResult = evaluation.satisfactionPercentage?.match(/(\d+(\.\d+)?)/);
    return matchResult ? parseFloat(matchResult[0]) : 0;
  });
  
  // Calculate the average satisfaction score
  const totalScore = satisfactionScores.reduce((sum, score) => sum + score, 0);
  return totalScore / satisfactionScores.length;
}

/**
 * Determines if the test passes based on the aggregate score
 * 
 * @param aggregateScore The calculated aggregate score
 * @returns Boolean indicating if the test passes
 */
export function doesPassThreshold(aggregateScore: number): boolean {
  return aggregateScore >= config.execution.scoring.passThreshold;
}

/**
 * Formats the aggregate score as a percentage string
 * 
 * @param aggregateScore The calculated aggregate score
 * @returns Formatted percentage string (e.g. "95.0%")
 */
export function formatScorePercentage(aggregateScore: number): string {
  return aggregateScore.toFixed(1) + '%';
} 