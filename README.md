![CI](https://github.com/quadratichq/quadratic/actions/workflows/ci.yml/badge.svg) ![Build and Publish Images to ECR](https://github.com/quadratichq/quadratic/actions/workflows/production-publish-images.yml/badge.svg)
![Twitter Follow](https://img.shields.io/twitter/follow/QuadraticHQ)

## ![quadratic icon small](https://user-images.githubusercontent.com/3479421/162039117-02f85f2c-e382-4ed8-ac39-64efab17a144.svg) **_Spreadsheet with AI, Code, and Connections_**

<img width="1552" alt="Quadratic in a standalone macOS window; users are working together on a spreadsheet to measure the life expectancy in Canada." src="https://media.quadratichq.com/github/quadratic.png">

## Learn more about Quadratic

Learn more [QuadraticHQ.com](https://quadratichq.com)

## Quadratic Cloud

Open Quadratic [app.QuadraticHQ.com](https://app.quadratichq.com)

## Documentation

Read the documentation [docs.QuadraticHQ.com](https://docs.quadratichq.com)

## Want to contribute?

Feature request or bug report? Submit a [Github Issue](https://github.com/quadratichq/quadratic/issues/new/choose/)

Want to contribute? Read our [Contributing Guide](./CONTRIBUTING.md)

## Quadratic is hiring

Check out our open roles ⟶ [careers.quadratichq.com](https://careers.quadratichq.com)

# Quadratic QA Test Suite

This repository contains automated tests for the Quadratic application using Playwright.

## Prerequisites

- Node.js (v14 or newer)
- npm

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Install Playwright browsers:
   ```
   npx playwright install
   ```

## Running Tests

Run all tests:
```
npm test
```

Run tests with UI mode (for debugging and development):
```
npm run test:ui
```

Run tests in headed mode (with visible browser):
```
npm run test:headed
```

Run tests in debug mode:
```
npm run test:debug
```

View the HTML report after a test run:
```
npm run report
```

## Test Structure

- `tests/homepage.spec.ts` - Basic tests for the homepage
- `tests/login.spec.ts` - Tests for login functionality
- `tests/spreadsheet.spec.ts` - Tests for spreadsheet functionality

## Notes

- These tests are designed for the Quadratic application at `app.quadratichq.com`
- The selectors in the tests may need to be updated based on the actual UI
- Screenshots are saved in the project root directory

## Adding New Tests

1. Create a new file in the `tests` directory with a `.spec.ts` extension
2. Import the necessary Playwright modules
3. Write your tests using the Playwright API
4. Run the tests to verify they work as expected
