export const getAIResearcherCodeString = (query: string, refCell: string) => {
  return `AI("${query}", ${refCell})`;
};
