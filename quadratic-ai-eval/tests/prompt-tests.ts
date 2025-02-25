// Define the schema for test prompts
export interface PromptTest {
  prompt: string;
  name: string;
  validationCriteria: string[];
  expectedRating?: 'GREEN' | 'YELLOW' | 'RED';
}

// Define the test prompts and their validation criteria
export const testPrompts: PromptTest[] = [
  {
    name: 'States GDP Map',
    prompt: 'Return a table of states with gdp per capita, and plot it on a map.',
    validationCriteria: [
      'Does the spreadsheet contain a table of states with GDP per capita?',
      'Is there a map visualization of this data?',
      'Is the data properly formatted and presented?',
      'Are there any obvious errors or issues?',
      'Are the states on the map correctly colored?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'Population Density Heatmap',
    prompt: 'Create a heatmap showing population density by county in the United States.',
    validationCriteria: [
      'Does the spreadsheet contain county-level population density data?',
      'Is there a heatmap visualization of this data?',
      'Are the counties properly colored according to their population density?',
      'Is there a legend explaining the color scale?',
      'Is the data properly formatted and presented?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'Stock Price Trends',
    prompt: 'Show me the stock price trends for AAPL, MSFT, GOOG, and AMZN over the past 5 years with a line chart.',
    validationCriteria: [
      'Does the spreadsheet contain stock price data for AAPL, MSFT, GOOG, and AMZN?',
      'Is there a line chart visualization showing the trends?',
      'Does the chart cover approximately a 5-year period?',
      'Are the lines properly labeled or is there a legend?',
      'Is the data properly formatted and presented?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'COVID-19 Cases by Country',
    prompt: 'Create a bar chart showing COVID-19 cases by country for the top 10 most affected countries.',
    validationCriteria: [
      'Does the spreadsheet contain COVID-19 case data for countries?',
      'Is there a bar chart visualization showing the top 10 countries?',
      'Are the countries sorted by number of cases?',
      'Are the bars properly labeled?',
      'Is the data properly formatted and presented?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'Basic Chart Creation',
    prompt: 'Insert a line chart with the x axis as dates and y axis as number of sales, first generate sample data for that chart',
    validationCriteria: [
      'Does the spreadsheet contain a dataset of a time series of date and sales values?',
      'Is there a line chart visualization showcasing the sales over time?',
      'Is the data properly formatted and presented?',
      'Are there any obvious errors or issues?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'DataFrame Manipulation',
    prompt: 'Insert the following dataset and then use python to reference the data and make it cleaner/more readable, then display the cleaned dataset\nProduct Name\tPrice\tIn Stock\tDate Added\tRating\nlaptop pro 15"\t1299.99\tYes\t2023-01-15\t4.7/5\nSMARTPHONE X\t899\tNO\t2023-01-22\t3.9 stars\nwireless headphones\t129.95\tyes\t2023-02-05\t4.2/5\n49.99\tYes\t2023-01-30\t4.0 stars\nGAMING MOUSE\t79.99\t\t2023-02-15\t4.5/5\nexternal SSD 1TB\t159.99\tYES\t2023-03-01\t\nmechanical keyboard\t149.95\tno\t2023-03-10\t4.8 stars\nmonitor 27"\t249.99\tYes\t2023-02-20\t4.3/5',
    validationCriteria: [
      'Does the spreadsheet show the original dataset?',
      'Is there a cleaned version of the dataset displayed?',
      'Is the cleaned data more legible and easier to work with?',
      'Are there any obvious errors or issues?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'DataFrame Star Rating Count',
    prompt: 'Insert the following dataset and then count the number of items that have 4 stars or greater; display the answer as "Number: " and the answer\nProduct Name\tPrice\tIn Stock\tDate Added\tRating\nlaptop pro 15"\t1299.99\tYes\t2023-01-15\t4.7/5\nSMARTPHONE X\t899\tNO\t2023-01-22\t3.9 stars\nwireless headphones\t129.95\tyes\t2023-02-05\t4.2/5\n49.99\tYes\t2023-01-30\t4.0 stars\nGAMING MOUSE\t79.99\t\t2023-02-15\t4.5/5\nexternal SSD 1TB\t159.99\tYES\t2023-03-01\t\nmechanical keyboard\t149.95\tno\t2023-03-10\t4.8 stars\nmonitor 27"\t249.99\tYes\t2023-02-20\t4.3/5',
    validationCriteria: [
      'Does the spreadsheet show the dataset?',
      'Is the correct count of items with 4 stars or greater displayed as "Number: 6"?',
      'Is the data properly formatted and presented?',
      'Are there any obvious errors or issues?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'DataFrame Column Reordering',
    prompt: 'Insert the following dataset and then create a condensed version with the column Q-P2 pictured as the first column and Q-P1 as the second\nProduct Name\tPrice\tIn Stock\tDate Added\tRating\nlaptop pro 15"\t1299.99\tYes\t2023-01-15\t4.7/5\nSMARTPHONE X\t899\tNO\t2023-01-22\t3.9 stars\nwireless headphones\t129.95\tyes\t2023-02-05\t4.2/5\n49.99\tYes\t2023-01-30\t4.0 stars\nGAMING MOUSE\t79.99\t\t2023-02-15\t4.5/5\nexternal SSD 1TB\t159.99\tYES\t2023-03-01\t\nmechanical keyboard\t149.95\tno\t2023-03-10\t4.8 stars\nmonitor 27"\t249.99\tYes\t2023-02-20\t4.3/5',
    validationCriteria: [
      'Does the spreadsheet show two datasets?',
      'Is the condensed version showing Q-P2 as the first column and Q-P1 as the second?',
      'Is the data properly formatted and presented?',
      'Are there any obvious errors or issues?'
    ],
    expectedRating: 'GREEN'
  },
  {
    name: 'Advanced DataFrame Manipulation',
    prompt: 'Insert the following dataset and perform advanced data cleaning and analysis, including handling missing values, standardizing formats, and providing summary statistics\nProduct Name\tPrice\tIn Stock\tDate Added\tRating\nlaptop pro 15"\t1299.99\tYes\t2023-01-15\t4.7/5\nSMARTPHONE X\t899\tNO\t2023-01-22\t3.9 stars\nwireless headphones\t129.95\tyes\t2023-02-05\t4.2/5\n49.99\tYes\t2023-01-30\t4.0 stars\nGAMING MOUSE\t79.99\t\t2023-02-15\t4.5/5\nexternal SSD 1TB\t159.99\tYES\t2023-03-01\t\nmechanical keyboard\t149.95\tno\t2023-03-10\t4.8 stars\nmonitor 27"\t249.99\tYes\t2023-02-20\t4.3/5',
    validationCriteria: [
      'Does the spreadsheet show the original dataset?',
      'Are missing values properly handled?',
      'Are formats standardized (e.g., consistent Yes/No values, rating format)?',
      'Are summary statistics provided (e.g., average price, rating distribution)?',
      'Is the data properly formatted and presented?'
    ],
    expectedRating: 'GREEN'
  }
  // Add more test prompts as needed
];
