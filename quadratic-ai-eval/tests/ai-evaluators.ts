/**
 * AI Evaluation Utilities
 * 
 * This file contains functions for evaluating UI screenshots with different AI models.
 * Currently supports Claude and OpenAI models.
 */

import { Anthropic } from '@anthropic-ai/sdk';
import * as fs from 'fs';
import { OpenAI } from 'openai';
import { z } from 'zod';
import config from './config';
import type { PromptTest } from './prompt-tests';

// Define the schema for AI evaluation response
export const EvaluationSchema = z.object({
  criteria_evaluations: z.array(
    z.object({
      criterion: z.string(),
      met: z.enum(['YES', 'PARTIALLY', 'NO']),
      explanation: z.string()
    })
  ),
  rating: z.enum(['GREEN', 'YELLOW', 'RED']),
  explanation: z.string().min(1),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional()
});

export type Evaluation = z.infer<typeof EvaluationSchema>;
export type AIProvider = 'claude' | 'openai';

// Define the model configuration interface
export interface ModelConfig {
  provider: AIProvider;
  modelName: string;
  maxTokens?: number;
  systemPrompt?: string;
  evaluationPrompt?: string;
}

export interface EvaluationResult {
  rating: string;
  explanation: string;
  validationStatus: string;
  criteriaEvaluations: any[];
  satisfactionPercentage: string;
  confidence: string;
}

/**
 * Simplified evaluation function for screenshots
 * 
 * @param modelConfig The AI model configuration to use
 * @param screenshotPath Path to the screenshot
 * @param validationCriteriaString A string of validation criteria
 * @param promptText The original prompt text that generated the result
 * @returns Evaluation result
 */
export async function simpleAiEval(
  modelConfig: ModelConfig | AIProvider,
  screenshotPath: string,
  validationCriteriaString: string,
  promptText: string
): Promise<EvaluationResult> {
  // Convert screenshot to base64 for sending to AI models
  const screenshotBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
  
  // If modelConfig is just a provider string, convert it to a ModelConfig
  const resolvedConfig = typeof modelConfig === 'string'
    ? getDefaultModelConfig(modelConfig)
    : modelConfig;
  
  switch (resolvedConfig.provider) {
    case 'claude':
      return evaluateWithClaude(screenshotBase64, promptText, validationCriteriaString, resolvedConfig);
    case 'openai':
      return evaluateWithOpenAI(screenshotBase64, promptText, validationCriteriaString, resolvedConfig);
    default:
      throw new Error(`Unsupported provider: ${resolvedConfig.provider}`);
  }
}

/**
 * Main function to evaluate a screenshot with a specified AI model
 * 
 * @param modelConfig The AI model configuration to use
 * @param screenshotPath Path to the screenshot file
 * @param promptTest The prompt test object containing criteria and prompt
 * @returns Evaluation result with rating, explanation, and validation status
 */
export async function aiEval(
  modelConfig: ModelConfig | AIProvider,
  screenshotPath: string,
  promptTest: PromptTest
): Promise<EvaluationResult> {
  // Convert screenshot to base64 for sending to AI models
  const screenshotBase64 = fs.readFileSync(screenshotPath, { encoding: 'base64' });
  
  // Prepare the validation criteria text
  const criteriaText = promptTest.validationCriteria
    .map((criteria, index) => `${index + 1}. ${criteria}`)
    .join('\n');
  
  // If modelConfig is just a provider string, convert it to a ModelConfig
  const resolvedConfig = typeof modelConfig === 'string'
    ? getDefaultModelConfig(modelConfig)
    : modelConfig;
  
  switch (resolvedConfig.provider) {
    case 'claude':
      return evaluateWithClaude(screenshotBase64, promptTest.prompt, criteriaText, resolvedConfig);
    case 'openai':
      return evaluateWithOpenAI(screenshotBase64, promptTest.prompt, criteriaText, resolvedConfig);
    default:
      throw new Error(`Unsupported provider: ${resolvedConfig.provider}`);
  }
}

/**
 * Get the default model configuration for a provider
 * 
 * @param provider The AI provider ('claude' or 'openai')
 * @returns Model configuration with default values
 */
function getDefaultModelConfig(provider: AIProvider): ModelConfig {
  switch (provider) {
    case 'claude': {
      const claudeModel = config.models.find(model => model.provider === 'anthropic');
      if (!claudeModel) {
        throw new Error('No Claude model configuration found');
      }
      return {
        provider: 'claude',
        modelName: claudeModel.id,
        maxTokens: claudeModel.maxTokens,
        systemPrompt: claudeModel.systemPrompt,
        evaluationPrompt: claudeModel.evaluationPrompt
      };
    }
    case 'openai': {
      const openaiModel = config.models.find(model => model.provider === 'openai');
      if (!openaiModel) {
        throw new Error('No OpenAI model configuration found');
      }
      return {
        provider: 'openai',
        modelName: openaiModel.id,
        maxTokens: openaiModel.maxTokens,
        systemPrompt: openaiModel.systemPrompt,
        evaluationPrompt: openaiModel.evaluationPrompt
      };
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * Evaluate a screenshot with Claude
 * 
 * @param screenshotBase64 Base64-encoded screenshot
 * @param promptText The original prompt text
 * @param criteriaText Formatted validation criteria
 * @param modelConfig The Claude model configuration
 * @returns Evaluation result
 */
async function evaluateWithClaude(
  screenshotBase64: string,
  promptText: string,
  criteriaText: string,
  modelConfig: ModelConfig
): Promise<EvaluationResult> {
  // Check if ANTHROPIC_API_KEY is set
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  
  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
  
  // Prepare the prompt for Claude using the template from config
  const claudeModel = config.models.find(model => model.provider === 'anthropic');
  const claudePrompt = (modelConfig.evaluationPrompt || (claudeModel?.evaluationPrompt || ''))
    .replace('{promptText}', promptText)
    .replace('{criteriaText}', criteriaText);
  
  try {
    const message = await anthropic.messages.create({
      model: modelConfig.modelName,
      max_tokens: modelConfig.maxTokens || (claudeModel?.maxTokens || 1000),
      system: modelConfig.systemPrompt || (claudeModel?.systemPrompt || ''),
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
    
    return parseAIResponse(evaluationText);
  } catch (error) {
    console.error('Error evaluating with Claude:', error);
    return { 
      rating: 'UNKNOWN', 
      explanation: `Error evaluating with Claude: ${error}`, 
      validationStatus: 'FAILED',
      criteriaEvaluations: [],
      satisfactionPercentage: '0%',
      confidence: 'LOW'
    };
  }
}

/**
 * Evaluate a screenshot with OpenAI
 * 
 * @param screenshotBase64 Base64-encoded screenshot
 * @param promptText The original prompt text
 * @param criteriaText Formatted validation criteria
 * @param modelConfig The OpenAI model configuration
 * @returns Evaluation result
 */
async function evaluateWithOpenAI(
  screenshotBase64: string,
  promptText: string,
  criteriaText: string,
  modelConfig: ModelConfig
): Promise<EvaluationResult> {
  // Check if OPENAI_API_KEY is set
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  // Prepare the prompt for OpenAI using the template from config
  const openaiModel = config.models.find(model => model.provider === 'openai');
  const openaiPrompt = (modelConfig.evaluationPrompt || (openaiModel?.evaluationPrompt || ''))
    .replace('{promptText}', promptText)
    .replace('{criteriaText}', criteriaText);
  
  try {
    const response = await openai.chat.completions.create({
      model: modelConfig.modelName,
      messages: [
        {
          role: "system",
          content: modelConfig.systemPrompt || (openaiModel?.systemPrompt || '')
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: openaiPrompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: modelConfig.maxTokens || (openaiModel?.maxTokens || 1000)
    });
    
    const evaluationText = response.choices[0]?.message?.content || '';
    return parseAIResponse(evaluationText);
  } catch (error) {
    console.error('Error evaluating with OpenAI:', error);
    return { 
      rating: 'UNKNOWN', 
      explanation: `Error evaluating with OpenAI: ${error}`, 
      validationStatus: 'FAILED',
      criteriaEvaluations: [],
      satisfactionPercentage: '0%',
      confidence: 'LOW'
    };
  }
}

/**
 * Parse the AI response text into a structured evaluation result
 * 
 * @param evaluationText The raw text response from the AI model
 * @returns Evaluation result with validation status
 */
function parseAIResponse(evaluationText: string): EvaluationResult {
  try {
    // Find JSON in the response text
    let jsonText = evaluationText;
    const jsonMatch = evaluationText.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Parse the JSON
    const parsedJson = JSON.parse(jsonText);
    
    // For our simplified format, we'll just check if the required fields exist
    if (parsedJson.criteria_evaluations && parsedJson.overall_satisfaction && parsedJson.explanation) {
      // Return the validated data with a PASSED status
      
      // Use the overall satisfaction directly from the response
      const satisfactionScore = parsedJson.overall_satisfaction;
      
      // For backwards compatibility, derive a rating from the satisfaction score
      let rating = 'RED';
      if (satisfactionScore >= 80) {
        rating = 'GREEN';
      } else if (satisfactionScore >= 50) {
        rating = 'YELLOW';
      }
      
      return {
        rating: rating,
        explanation: parsedJson.explanation,
        validationStatus: 'PASSED',
        criteriaEvaluations: parsedJson.criteria_evaluations,
        satisfactionPercentage: satisfactionScore.toFixed(1) + '%',
        confidence: 'HIGH'  // We're no longer using confidence levels
      };
    } else {
      // Try to extract just the satisfaction and explanation
      const fallbackSatisfaction = parsedJson.overall_satisfaction || 0;
      const fallbackExplanation = parsedJson.explanation || 'No explanation provided';
      
      // For backwards compatibility, derive a rating from the satisfaction score
      let fallbackRating = 'RED';
      if (fallbackSatisfaction >= 80) {
        fallbackRating = 'GREEN';
      } else if (fallbackSatisfaction >= 50) {
        fallbackRating = 'YELLOW';
      }
      
      console.warn('JSON validation failed. Missing required fields.');
      console.warn('Attempting fallback parsing with just satisfaction and explanation');
      
      return {
        rating: fallbackRating,
        explanation: fallbackExplanation,
        validationStatus: 'PARTIAL',
        criteriaEvaluations: [],
        satisfactionPercentage: fallbackSatisfaction.toFixed(1) + '%',
        confidence: 'LOW'
      };
    }
  } catch (error) {
    // Handle JSON parsing errors
    console.error('Error parsing AI response:', error);
    return {
      rating: 'UNKNOWN',
      explanation: `Error parsing AI response: ${error}. Received: ${evaluationText}`,
      validationStatus: 'FAILED',
      criteriaEvaluations: [],
      satisfactionPercentage: '0%',
      confidence: 'LOW'
    };
  }
} 