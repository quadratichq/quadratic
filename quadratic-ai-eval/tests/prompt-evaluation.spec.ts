import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { aiEval, EvaluationResult, ModelConfig } from './ai-evaluators';
import config from './config';
import { calculateAggregateScore, doesPassThreshold, formatScorePercentage } from './evaluation-scoring';
import { testPrompts } from './prompt-tests';

// Helper function to handle login
async function login(page: any) {
  // Navigate to the homepage
  await page.goto(config.auth.loginUrl);
  
  // Wait for Auth0 login page to load
  await page.waitForSelector('input[name="username"]', { timeout: config.timeouts.navigation });
  
  // Fill in Auth0 login form
  const emailInput = page.locator('input[name="username"]');
  const passwordInput = page.locator('input[name="password"]');
  
  await expect(emailInput).toBeVisible({ timeout: config.timeouts.elementVisibility });
  await emailInput.fill(config.auth.email);
  
  await expect(passwordInput).toBeVisible({ timeout: config.timeouts.elementVisibility });
  await passwordInput.fill(config.auth.password);
  
  // press enter
  await page.keyboard.press('Enter');
  
  // Wait for redirect back to Quadratic after successful login
  await page.waitForURL(config.auth.redirectUrl, { timeout: config.timeouts.navigation });
}

// Helper function to format criteria evaluations for display
function formatCriteriaEvaluations(criteriaEvaluations) {
  if (!criteriaEvaluations || criteriaEvaluations.length === 0) {
    return 'No criteria evaluations available';
  }
  
  return criteriaEvaluations.map((ce, idx) => 
    `${idx + 1}. ${ce.criterion}: ${ce.met} - ${ce.explanation}`
  ).join('\n');
}

// Run a single consensus test for each prompt
test.describe('Quadratic AI Prompt Tests', () => {
  for (const promptTest of testPrompts) {
    test(promptTest.name, async ({ page }) => {
      // Check if we have at least one API key
      const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY;
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      
      if (!hasClaudeKey && !hasOpenAIKey) {
        test.skip(true, 'Neither ANTHROPIC_API_KEY nor OPENAI_API_KEY environment variables are set. Skipping evaluation.');
        return;
      }
      
      // Collect the model configs we can use based on available API keys
      const modelConfigs: ModelConfig[] = [];
      
      if (hasClaudeKey) {
        const claudeModel = config.models.find(model => model.provider === 'anthropic');
        if (claudeModel) {
          modelConfigs.push({
            provider: 'claude',
            modelName: claudeModel.id,
            maxTokens: claudeModel.maxTokens
          });
        }
      }
      
      if (hasOpenAIKey) {
        const openaiModel = config.models.find(model => model.provider === 'openai');
        if (openaiModel) {
          modelConfigs.push({
            provider: 'openai',
            modelName: openaiModel.id,
            maxTokens: openaiModel.maxTokens
          });
        }
      }
      
      // Navigate and wait for the result to be generated
      await login(page);
      await page.goto(config.urls.createFileWithPrompt + encodeURIComponent(promptTest.prompt));

      // Wait for the cancel button to disappear (if it was present)
      await page.waitForSelector('button:has-text("Cancel generating")', { timeout: config.timeouts.elementVisibility });
      await page.waitForSelector('button:has-text("Cancel generating")', { state: 'hidden', timeout: config.timeouts.generation });
      
      // Take a screenshot for AI evaluation
      const testResultsDir = path.join(__dirname, '../test-results');
      if (!fs.existsSync(testResultsDir)) {
        fs.mkdirSync(testResultsDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const screenshotPath = path.join(testResultsDir, `${promptTest.name.replace(/\s+/g, '-')}-${timestamp}.png`);
      
      const canvasElement = page.locator('#QuadraticCanvasID');
      await expect(canvasElement).toBeVisible({ timeout: config.timeouts.elementVisibility });
      await canvasElement.screenshot({ path: screenshotPath });
      
      // Attach the screenshot to the test report
      await test.info().attach(`${promptTest.name}-result.png`, {
        path: screenshotPath,
        contentType: 'image/png'
      });
      
      // If we only have one model, just use that for evaluation
      if (modelConfigs.length === 1) {
        const modelConfig = modelConfigs[0];
        const result = await aiEval(modelConfig, screenshotPath, promptTest);
        
        // Get model info for reporting
        const providerName = modelConfig.provider;
        const modelName = modelConfig.modelName;
        
        // Format the evaluation result for test output
        const evaluationSummary = `
=== SINGLE MODEL EVALUATION RESULTS ===
Test: ${promptTest.name}
Prompt: "${promptTest.prompt}"
Provider: ${providerName}
Model: ${modelName}
Rating: ${result.rating}
Validation: ${result.validationStatus}
Confidence: ${result.confidence}
Satisfaction: ${result.satisfactionPercentage}
---
${result.explanation}
---
${formatCriteriaEvaluations(result.criteriaEvaluations)}
===========================
`;
        
        // Add the evaluation to the test report
        test.info().annotations.push({
          type: 'AI Evaluation',
          description: evaluationSummary
        });
        
        // Assertions based on the rating and validation status
        expect(result.validationStatus, 'AI response validation failed').toBe('PASSED');
        
        if (result.validationStatus === 'PASSED' && promptTest.expectedRating) {
          // Only assert on rating if validation passed and expected rating is specified
          expect(result.rating, `AI evaluation indicates issues with the result for "${promptTest.name}"`).toBe(promptTest.expectedRating);
        }
        
        return; // End test early if only one model
      }
      
      // With multiple models, run consensus evaluation
      // Collect evaluations from each model
      const evaluations: EvaluationResult[] = [];
      for (const modelConfig of modelConfigs) {
        try {
          const result = await aiEval(modelConfig, screenshotPath, promptTest);
          
          // Add individual model results to the test report
          const individualSummary = `
=== ${modelConfig.provider.toUpperCase()} EVALUATION ===
Rating: ${result.rating}
Confidence: ${result.confidence}
Satisfaction: ${result.satisfactionPercentage}
---
${formatCriteriaEvaluations(result.criteriaEvaluations)}
`;
          
          test.info().annotations.push({
            type: `${modelConfig.provider.charAt(0).toUpperCase() + modelConfig.provider.slice(1)} Evaluation`,
            description: individualSummary
          });
          
          evaluations.push(result);
        } catch (error) {
          console.error(`Error evaluating with ${modelConfig.provider}:`, error);
        }
      }
      
      // Skip if we didn't get at least 2 successful evaluations when we have 2+ models
      if (evaluations.length < 2 && modelConfigs.length >= 2) {
        test.skip(true, `Not enough successful evaluations for consensus (got ${evaluations.length}, need at least 2)`);
        return;
      }
      
      // Collect ratings and confidences
      const ratings = evaluations.map(e => e.rating);
      const confidences = evaluations.map(e => e.confidence);
      
      // Check for consensus with confidence weighting if enabled
      let majorityRating = '';
      let maxWeight = 0;
      
      // Simple counting without weighting
      const counts: Record<string, number> = {};
      ratings.forEach(rating => {
        counts[rating] = (counts[rating] || 0) + 1;
      });
      
      // Find the majority rating
      let maxCount = 0;
      Object.entries(counts).forEach(([rating, count]) => {
        if (count > maxCount) {
          majorityRating = rating;
          maxCount = count;
        }
      });
      
      // Calculate agreement percentage
      var agreementPercentage = maxCount / ratings.length;
      
      // Create consensus result
      const consensusResult = {
        rating: majorityRating,
        agreementPercentage: (agreementPercentage * 100).toFixed(1) + '%',
        ratings: ratings.join(', '),
        confidences: confidences.join(', '),
        models: modelConfigs.map(mc => `${mc.provider}:${mc.modelName}`).join(', '),
        expectedRating: promptTest.expectedRating || 'Not specified'
      };
      
      // Calculate aggregate satisfaction score if enabled
      let aggregateScore = 0;
      let passesThreshold = false;
      let scorePercentage = '0.0%';
      
      if (config.execution.scoring?.enabled) {
        aggregateScore = calculateAggregateScore(evaluations);
        passesThreshold = doesPassThreshold(aggregateScore);
        scorePercentage = formatScorePercentage(aggregateScore);
        
        // Add score information to consensus result
        Object.assign(consensusResult, {
          aggregateScore,
          scorePercentage,
          passesThreshold
        });
      }
      
      // Format consensus result for test output
      const consensusSummary = `
=== CONSENSUS EVALUATION RESULTS ===
Test: ${promptTest.name}
Prompt: "${promptTest.prompt}"
Models used: ${consensusResult.models}
Individual ratings: ${consensusResult.ratings}
Individual confidences: ${consensusResult.confidences}
Majority rating: ${consensusResult.rating}
${config.execution.scoring?.enabled ? `Aggregate satisfaction score: ${scorePercentage}
Passes threshold (${config.execution.scoring.passThreshold}%): ${passesThreshold ? 'YES' : 'NO'}` : ''}
Expected rating: ${consensusResult.expectedRating}
===========================
`;
      
      // Add the consensus to the test report
      test.info().annotations.push({
        type: 'Consensus Evaluation',
        description: consensusSummary
      });
      
      // Use the first evaluation's detailed explanation
      const detailedExplanation = evaluations[0].explanation;
      test.info().annotations.push({
        type: 'Detailed Explanation',
        description: detailedExplanation
      });
      
      // Assertions when we have multiple models
      if (modelConfigs.length >= 2) {
        // Only check aggregate score threshold
        expect(
          passesThreshold,
          `Aggregate satisfaction score (${scorePercentage}) is below threshold (${config.execution.scoring.passThreshold}%)`
        ).toBe(true);
      }
    });
  }
}); 