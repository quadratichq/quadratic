import { Anthropic } from '@anthropic-ai/sdk';
import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import config from './config';
import { PromptTest, testPrompts } from './prompt-tests';

// Define the schema for Claude's evaluation response
const EvaluationSchema = z.object({
  rating: z.enum(['GREEN', 'YELLOW', 'RED']),
  explanation: z.string().min(1)
});

type Evaluation = z.infer<typeof EvaluationSchema>;

// Helper function to evaluate a prompt with Claude
async function evaluateWithClaude(
  page: any,
  promptTest: PromptTest,
  screenshotPath: string,
  anthropic: Anthropic
): Promise<{ rating: string; explanation: string; validationStatus: string }> {
  // Convert screenshot to base64 for sending to Claude
  const screenshotBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
  
  // Prepare the prompt for Claude with custom validation criteria
  const criteriaText = promptTest.validationCriteria
    .map((criteria, index) => `${index + 1}. ${criteria}`)
    .join('\n');
  
  const claudePrompt = `
  I'm showing you a screenshot of a Quadratic spreadsheet that was generated from the prompt: "${promptTest.prompt}".
  
  Please evaluate if the result looks correct based on the prompt. Analyze the following:
  ${criteriaText}
  
  Provide your evaluation in a structured JSON format with the following fields:
  {
    "rating": "GREEN" | "YELLOW" | "RED",
    "explanation": "Your detailed explanation here"
  }
  
  Rating definitions:
  - GREEN: The result looks correct and fully satisfies the prompt requirements
  - YELLOW: The result partially satisfies the prompt but has minor issues
  - RED: The result is incorrect or has major issues
  
  Your response should be valid JSON that can be parsed programmatically.
  `;
  
  try {
    const message = await anthropic.messages.create({
      model: config.claude.model,
      max_tokens: config.claude.maxTokens,
      system: config.claude.systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: claudePrompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshotBase64
              }
            }
          ]
        }
      ]
    });
    
    // The content is an array of content blocks, we need to check the type
    const contentBlock = message.content[0];
    let evaluationText = '';
    
    // Check if the content block is of type 'text'
    if (contentBlock.type === 'text') {
      evaluationText = contentBlock.text;
    } else {
      evaluationText = JSON.stringify(contentBlock);
    }
    
    // Extract the JSON from the response
    // Claude might wrap the JSON in markdown code blocks or add additional text
    let jsonMatch = evaluationText.match(/```json\s*([\s\S]*?)\s*```/) || 
                    evaluationText.match(/```\s*([\s\S]*?)\s*```/) ||
                    evaluationText.match(/({[\s\S]*})/);
    
    let rating = 'UNKNOWN';
    let explanation = 'Could not parse evaluation';
    let validationStatus = 'FAILED';
    
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsedJson = JSON.parse(jsonMatch[1].trim());
        
        // Validate the parsed JSON against our schema
        const validationResult = EvaluationSchema.safeParse(parsedJson);
        
        if (validationResult.success) {
          const evaluation: Evaluation = validationResult.data;
          rating = evaluation.rating;
          explanation = evaluation.explanation;
          validationStatus = 'PASSED';
        } else {
          // Try to extract values even if validation fails
          if (parsedJson && typeof parsedJson === 'object') {
            if (parsedJson.rating && ['GREEN', 'YELLOW', 'RED'].includes(parsedJson.rating)) {
              rating = parsedJson.rating;
            }
            if (parsedJson.explanation && typeof parsedJson.explanation === 'string') {
              explanation = parsedJson.explanation;
            }
          }
        }
      } catch (e) {
        // Failed to parse JSON from Claude response
      }
    }
    
    return { rating, explanation, validationStatus };
  } catch (error) {
    console.error('Error evaluating with Claude:', error);
    return { 
      rating: 'UNKNOWN', 
      explanation: `Error evaluating with Claude: ${error}`, 
      validationStatus: 'FAILED' 
    };
  }
}

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

// Function to run a single prompt test
async function runPromptTest(page: any, promptTest: PromptTest, anthropic: Anthropic) {
  // Ensure test-results directory exists
  const testResultsDir = path.join(__dirname, '../test-results');
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
  }

  try {
    // Always login at the start of each test
    await login(page);
    
    // Navigate to the new file page with the prompt
    await page.goto(config.urls.createFileWithPrompt + encodeURIComponent(promptTest.prompt));

    // Wait for the page to load
    await page.waitForLoadState('load', { timeout: config.timeouts.navigation });
    await page.waitForLoadState('domcontentloaded', { timeout: config.timeouts.navigation });
    await page.waitForLoadState('load', { timeout: config.timeouts.navigation });
    
    // Wait for "Cancel generating" button to be visible
    await page.waitForSelector('button:has-text("Cancel generating")', { timeout: config.timeouts.elementVisibility });

    // Wait for "Cancel generating" button to be removed 
    await page.waitForSelector('button:has-text("Cancel generating")', { state: 'hidden', timeout: config.timeouts.generation });

    // Take a screenshot for Claude evaluation
    const timestamp = Date.now();
    const screenshotPath = path.join(testResultsDir, `${promptTest.name.replace(/\s+/g, '-')}-${timestamp}.png`);
    
    // Take screenshot of only the canvas element instead of the entire page
    const canvasElement = page.locator('#QuadraticCanvasID');
    await expect(canvasElement).toBeVisible({ timeout: config.timeouts.elementVisibility });
    await canvasElement.screenshot({ path: screenshotPath });
    
    // Evaluate the result with Claude
    const { rating, explanation, validationStatus } = await evaluateWithClaude(
      page,
      promptTest,
      screenshotPath,
      anthropic
    );
    
    // Format the evaluation result for test output
    const evaluationSummary = `
=== AI EVALUATION RESULTS ===
Test: ${promptTest.name}
Prompt: "${promptTest.prompt}"
Rating: ${rating}
Validation: ${validationStatus}
---
${explanation}
===========================
`;
    
    // Add the evaluation to the test report
    test.info().annotations.push({
      type: 'AI Evaluation',
      description: evaluationSummary
    });
    
    // Attach the screenshot to the test report
    await test.info().attach(`${promptTest.name}-result.png`, {
      path: screenshotPath,
      contentType: 'image/png'
    });
    
    // Assertions based on the rating and validation status
    expect(validationStatus, 'Claude response validation failed').toBe('PASSED');
    
    if (validationStatus === 'PASSED' && promptTest.expectedRating) {
      // Only assert on rating if validation passed and expected rating is specified
      expect(rating, `AI evaluation indicates issues with the result for "${promptTest.name}"`).toBe(promptTest.expectedRating);
    }
  } catch (error) {
    console.error(`Error running test for "${promptTest.name}":`, error);
    throw error;
  }
}

// Run basic prompt tests in parallel
test.describe('Quadratic AI Prompt Tests', () => {
  // Run basic prompt tests in parallel
  for (const promptTest of testPrompts) {
    test(`Testing basic prompt: ${promptTest.name}`, async ({ page }) => {
      // Check if ANTHROPIC_API_KEY is set
      if (!process.env.ANTHROPIC_API_KEY) {
        test.skip(true, 'ANTHROPIC_API_KEY environment variable is not set. Skipping Claude evaluation.');
        return;
      }
      
      // Initialize Anthropic client
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      
      await runPromptTest(page, promptTest, anthropic);
    });
  }
}); 