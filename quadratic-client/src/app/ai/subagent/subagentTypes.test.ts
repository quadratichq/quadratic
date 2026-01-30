import { AITool } from 'quadratic-shared/ai/specs/aiToolsSpec';
import { describe, expect, it } from 'vitest';
import {
  getAllSubagentTypes,
  getSubagentConfig,
  isToolAllowedForSubagent,
  SUBAGENT_CONFIGS,
  SubagentType,
} from './subagentTypes';

describe('subagentTypes', () => {
  describe('SubagentType enum', () => {
    it('should have DataFinder type', () => {
      expect(SubagentType.DataFinder).toBe('data_finder');
    });
  });

  describe('SUBAGENT_CONFIGS', () => {
    it('should have config for DataFinder', () => {
      const config = SUBAGENT_CONFIGS[SubagentType.DataFinder];
      expect(config).toBeDefined();
      expect(config.type).toBe(SubagentType.DataFinder);
      expect(config.allowedTools).toContain(AITool.GetCellData);
      expect(config.allowedTools).toContain(AITool.HasCellData);
      expect(config.allowedTools).toContain(AITool.TextSearch);
      expect(config.maxIterations).toBeGreaterThan(0);
      expect(config.systemPrompt).toBeTruthy();
    });

    it('should not include write tools for DataFinder', () => {
      const config = SUBAGENT_CONFIGS[SubagentType.DataFinder];
      expect(config.allowedTools).not.toContain(AITool.SetCellValues);
      expect(config.allowedTools).not.toContain(AITool.SetCodeCellValue);
      expect(config.allowedTools).not.toContain(AITool.DeleteCells);
    });
  });

  describe('getSubagentConfig', () => {
    it('should return config for valid type', () => {
      const config = getSubagentConfig(SubagentType.DataFinder);
      expect(config.type).toBe(SubagentType.DataFinder);
    });

    it('should throw for invalid type', () => {
      expect(() => getSubagentConfig('invalid' as SubagentType)).toThrow('Unknown subagent type');
    });
  });

  describe('isToolAllowedForSubagent', () => {
    it('should return true for allowed tools', () => {
      expect(isToolAllowedForSubagent(SubagentType.DataFinder, AITool.GetCellData)).toBe(true);
      expect(isToolAllowedForSubagent(SubagentType.DataFinder, AITool.HasCellData)).toBe(true);
      expect(isToolAllowedForSubagent(SubagentType.DataFinder, AITool.TextSearch)).toBe(true);
    });

    it('should return false for disallowed tools', () => {
      expect(isToolAllowedForSubagent(SubagentType.DataFinder, AITool.SetCellValues)).toBe(false);
      expect(isToolAllowedForSubagent(SubagentType.DataFinder, AITool.SetCodeCellValue)).toBe(false);
      expect(isToolAllowedForSubagent(SubagentType.DataFinder, AITool.DeleteCells)).toBe(false);
      expect(isToolAllowedForSubagent(SubagentType.DataFinder, AITool.AddSheet)).toBe(false);
    });
  });

  describe('getAllSubagentTypes', () => {
    it('should return all subagent types', () => {
      const types = getAllSubagentTypes();
      expect(types).toContain(SubagentType.DataFinder);
      expect(types.length).toBeGreaterThan(0);
    });
  });
});
