import { expect, type Page } from "@playwright/test";

function buildUrl(route = "/") {
  const baseUrl = (process.env.E2E_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  return `${baseUrl}${route}`;
}

type LogInOptions = {
  email?: string;
  password?: string;
  teamName?: string;
  route?: string;
};

export const logIn = async (page: Page, options: LogInOptions) => {
  // extract email and password if available otherwise use env vars
  const email = options.email ? options.email : process.env.DEFAULT_USER;
  const password = options.password
    ? options.password
    : process.env.DEFAULT_PASSWORD;

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  // setup dialog alerts to be yes
  page.on("dialog", (dialog) => {
    dialog.accept().catch((error) => {
      console.error("Failed to accept the dialog:", error);
    });
  });

  // Try to navigate to our URL
  try {
    console.log(`E2E_URL: ${process.env.E2E_URL}`);
    await page.goto(buildUrl(options.route ? options.route : "/"), {
      waitUntil: "domcontentloaded",
    });
  } catch (error) {
    console.error(error);
  }

  // fill out log in page and log in
  await page.locator(`#username`).fill(email);
  await page.locator(`#password`).fill(password);
  await page.locator(`button:text("Continue")`).click();

  // assert that we are logged in
  await expect(page.getByText(email)).toBeVisible();

  // Click team dropdown
  if (options.teamName) {
    await page
      .locator(`nav`)
      .getByRole(`button`, { name: `arrow_drop_down` })
      .click();
    await page
      .locator(`div[data-state="open"] a:has-text("${options.teamName}")`)
      .nth(0)
      .click();
  }

  // Wait for Filter by file or creator name...
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .waitFor();
};

type CleanUpFilesOptions = {
  fileName: string;
  skipFilterClear: boolean;
};

export const cleanUpFiles = async (
  page: Page,
  { fileName, skipFilterClear }: CleanUpFilesOptions,
) => {
  // filter file by name
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .waitFor();
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .fill(fileName);
  await page.waitForTimeout(2500);

  // setup dialog alerts to be yes
  page.on("dialog", (dialog) => {
    dialog.accept().catch((error) => {
      console.error("Failed to accept the dialog:", error);
    });
  });

  // loop through and delete all the files
  const fileCount = await page
    .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
    .count();
  for (let i = 0; i < fileCount; i++) {
    await page
      .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
      .first()
      .click();
    await page.locator('[role="menuitem"]:has-text("Delete")').click();
    await page
      .locator('[role="alertdialog"] button:has-text("Delete")')
      .click();
    await page.waitForTimeout(1000);
  }

  // once complete clear out search bar
  if (!skipFilterClear)
    await page
      .locator('[placeholder="Filter by file or creator name…"]')
      .fill("");
};

type CreateFileOptions = {
  fileName: string;
};

export const createFile = async (
  page: Page,
  { fileName }: CreateFileOptions,
) => {
  // Click New File
  await page.locator(`button:text-is("New file")`).click();

  // Name file
  await page
    .getByRole("button", { name: "Untitled" })
    .click({ timeout: 60000 });
  await page.keyboard.type(fileName);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3000);

  // Close AI chat box as needed
  try {
    await page
      .getByRole(`button`, { name: `close` })
      .first()
      .click({ timeout: 5000 });
  } catch (e) {
    console.error(e);
  }

  // Navigate back to files
  await page.locator(`nav a >> nth = 0`).click();
};

type NavigateIntoFileOptions = {
  fileName: string;
  skipClose: boolean;
};

export const navigateIntoFile = async (
  page: Page,
  { fileName, skipClose }: NavigateIntoFileOptions,
) => {
  // Search for the file
  await page
    .locator('[placeholder="Filter by file or creator name…"]')
    .fill(fileName);
  await page.waitForTimeout(2000);
  await page.locator(`h2 :text("${fileName}")`).click();

  // Assert we navigate into the file
  await expect(page.locator(`button:text("${fileName}")`)).toBeVisible();

  // Close AI chat drawer if open
  if (!skipClose) {
    try {
      await page
        .getByRole(`button`, { name: `close` })
        .first()
        .click({ timeout: 5000 });
    } catch (e) {
      console.log(e);
    }
  }
};

// async function throttleNetworkLogIn(options = {}) {
//   // extract email and password if available otherwise use env vars
//   const email = options.email ? options.email : process.env.DEFAULT_USER;
//   const password = options.password
//     ? options.password
//     : process.env.DEFAULT_PASSWORD;

//   // launch browser, create page, and navigate to log in page
//   const { context, browser } = await launch(options); // launch browser
//   const page = await context.newPage(); // create page

//   // Use CDP session to simulate network throttling
//   const client = await context.newCDPSession(page);

//   await client.send("Network.enable");

//   // Apply network throttling settings
//   await client.send("Network.emulateNetworkConditions", {
//     offline: false,
//     downloadThroughput: (4 * 500 * 1024) / 8, // 0.5 MB/s = 500 KB/s = 500 * 1024 bytes per second
//     uploadThroughput: (4 * 500 * 1024) / 8, // 0.5 MB/s = 500 KB/s
//     latency: 0.25 * 200, // 200 ms latency
//   });

//   try {
//     console.log(process.env.DEFAULT_URL);
//     await page.goto(buildUrl(options.route ? options.route : "/"));
//   } catch (error) {
//     console.error(error);
//   }

//   // setup dialog alerts to be yes
//   page.on("dialog", (dialog) => {
//     dialog.accept().catch((error) => {
//       console.error("Failed to accept the dialog:", error);
//     });
//   });

//   // fill out log in page and log in
//   await page.locator(`#username`).fill(email);
//   await page.locator(`#password`).fill(password);
//   await page.locator(`button:text("Continue")`).click();

//   // assert that we are logged in
//   await expect(page.locator(`button:has-text("${email}")`)).toBeVisible();

//   // Click team dropdown
//   if (options.teamName) {
//     await page.locator(`nav button[aria-expanded="false"]`).click();
//     await page
//       .locator(`div[data-state="open"] a:has-text("${options.teamName}")`)
//       .click();
//   }

//   // return necessary info
//   return { email, context, browser, page };
// }

// /**
//  * Cleans up all the files with the associate name.
//  *
//  * @param {Page<Object>} page The page object.
//  * @param {Object} options The options object containing the `fileName` key-value pair.
//  * @param {String} options.fileName - The name of the file to be deleted.
//  */
// async function cleanupMyFiles(page, options = {}) {
//   // extract fileName from options object
//   const { fileName } = options;
//   const { folderName } = options;

//   if (folderName) {
//     await page.locator(`a:has-text("${folderName}")`).click();
//     await page.locator(`h1:text-is("${folderName}")`).waitFor();
//   } else {
//     // navigate to My files tab
//     try {
//       await page.locator('[href="/files"]').click();
//     } catch {
//       await page.locator('[href="/files"]').last().click();
//     }
//     await page.locator('h1:text-is("My files")').waitFor();
//   }
//   // loop through each file that has the name and delete
//   const fileCount = await page.locator(`li a:has-text("${fileName}")`).count();
//   for (let i = 0; i < fileCount; i++) {
//     await page
//       .locator(`li a:has-text("${fileName}") button[aria-haspopup="menu"]`)
//       .first()
//       .click();
//     await page.locator('[role="menuitem"]:has-text("Delete")').click();
//     await page.waitForTimeout(2000);
//   }
// }

// /**
//  * Navigates to a specified [Column, Row] in a spreadsheet-like interface on a webpage.
//  *
//  * @param {Page} page - The Page object representing the browser page.
//  * @param {number} targetColumn - The target column number to navigate to. Columns are zero-indexed.
//  * @param {number} targetRow - The target row number to navigate to. Rows are zero-indexed.
//  */
// async function navigateOnSheet(page, targetColumn, targetRow, options = {}) {
//   // Convert letter-based column to 0-based number
//   const columnToNumber = (col) => {
//     if (typeof col === "number") return col - 1; // If a number, use it as is
//     return col.toUpperCase().charCodeAt(0) - 65; // Convert 'A' to 0, 'B' to 1, etc.
//   };

//   // Adjust column for numerical input (increment to move one ahead)
//   const adjustColumn = (col) => (typeof col === "number" ? col + 1 : col);

//   // Parse position string (e.g., "E13" -> column: 4, row: 13 for 1-based indexing)
//   const parsePosition = (position) => {
//     if (typeof position !== "string") {
//       throw new Error(
//         `Invalid position type: expected string, got ${typeof position}`,
//       );
//     }

//     const match = position.match(/^([A-Z]+)(\d+)$/i); // Match column letters and row numbers
//     if (!match) {
//       throw new Error(`Invalid position format: ${position}`);
//     }
//     return {
//       column: columnToNumber(match[1]), // Convert column letters to 0-based index
//       row: parseInt(match[2], 10), // Row remains 1-based here
//     };
//   };

//   // Adjust target column and row
//   targetColumn = adjustColumn(targetColumn);
//   const adjustedRow = targetRow + 1;

//   // Click canvas if needed
//   if (!options.skipCanvasClick) {
//     try {
//       await page.locator(`#QuadraticCanvasID`).click();
//     } catch (err) {
//       console.error(err);
//     }
//   }

//   // Get our current position
//   let position = await page
//     .locator('div:has(button[aria-haspopup="dialog"]) >> input >> nth = 0')
//     .inputValue();

//   // Ensure the position is a string
//   position = position?.trim();
//   if (!position) {
//     throw new Error("Failed to retrieve the current position.");
//   }

//   // Parse the current position
//   const { column: currentColumn, row: currentRow } = parsePosition(position);

//   // Determine the direction and magnitude for column navigation
//   const columnDifference = columnToNumber(targetColumn) - currentColumn;
//   const columnDirection = columnDifference > 0 ? "ArrowRight" : "ArrowLeft";

//   // Navigate columns
//   for (let i = 0; i < Math.abs(columnDifference); i++) {
//     await page.waitForTimeout(100);
//     await page.keyboard.press(columnDirection);
//   }

//   // Determine the direction and magnitude for row navigation
//   const rowDifference = adjustedRow - currentRow; // Adjusted target row
//   const rowDirection = rowDifference > 0 ? "ArrowDown" : "ArrowUp";

//   // Navigate rows
//   for (let j = 0; j < Math.abs(rowDifference); j++) {
//     await page.waitForTimeout(100);
//     await page.keyboard.press(rowDirection);
//   }

//   await page.waitForTimeout(3000);
// }

// /**
//  * Selects a range of cells in a spreadsheet-like interface by navigating from a starting
//  * cell to an ending cell.
//  *
//  * @param {Page} page - The Page object representing the browser page, used for executing navigation
//  * @param {Array<number>} startingCell - An array containing two elements: the starting
//  *                                       column index and the starting row index of the range
//  *                                       to be selected. Indices are zero-based.
//  * @param {Array<number>} endCell - An array containing two elements: the ending column index
//  *                                   and the ending row index of the range to be selected.
//  *                                   Indices are zero-based.
//  */
// async function selectCells(page, startingCell, endCell) {
//   // Navigate into the first cell
//   await navigateOnSheet(page, startingCell[0], startingCell[1]);

//   // Select all Cells until the final one
//   await page.keyboard.down("Shift");
//   await navigateOnSheet(page, endCell[0], endCell[1], {
//     skipCanvasClick: true,
//   });
//   await page.keyboard.up("Shift");
// }

// /*
//  * Navigates to a specified [Column, Row] in a spreadsheet-like interface on a webpage, then fills in the cell with desired text
//  * and arrows down to the next cell
//  *
//  * @param {object} page - The Page object representing the browser page.
//  * @param {number} targetColumn - The target column number to navigate to. Columns are zero-indexed.
//  * @param {number} targetRow - The target row number to navigate to. Rows are zero-indexed.
//  * @param {string} text - The text desired to be filled in cell
//  */
// async function typeInCell(page, targetColumn, targetRow, text) {
//   await navigateOnSheet(page, targetColumn, targetRow);
//   // type some text
//   await page.keyboard.press("Enter");
//   await page.waitForTimeout(3000);
//   await page.keyboard.type(text);
//   await page.keyboard.press("ArrowDown");
//   await page.mouse.up();
// }

// /**
//  * Creates a new file with a given name, and shares it to another account with given email.
//  *
//  * @param {object]} page current user Playwright page
//  * @param {string} fileName Name of file
//  * @param {string} email of account to share to
//  */
// async function createSharedFile(page, fileName, email) {
//   // Navigate into a team workspace
//   try {
//     await page
//       .locator(`[href*="/teams"]:has-text("File Actions")`)
//       .click({ timeout: 5000 });
//   } catch (error) {
//     console.error(error);
//   }
//   await page.waitForTimeout(2000);

//   await createFile(page, fileName);
//   await page
//     .locator(`a:has-text("${fileName}") button[aria-haspopup="menu"]`)
//     .click();

//   await page.locator('[role="menuitem"]:has-text("Share")').click();
//   await page.locator(`[placeholder="Email"]`).fill(email);
//   await page.locator(`[type="submit"]:text('Invite')`).click();
//   await page.locator(`[role="dialog"] button:nth-of-type(2)`).click();
// }

// // Stagger function
// async function staggerStart(context, options = {}) {
//   const staggerPage = await context.newPage();
//   try {
//     /**
//      * Navigates to the specified URL.
//      * @param {string} url - The URL to navigate to.
//      * @returns {Promise<void>} A Promise that resolves once the navigation has completed.
//      */
//     await staggerPage.goto(
//       options.stagger
//         ? `https://qawolf-automation.herokuapp.com/stagger/page/${options.stagger}`
//         : `https://qawolf-automation.herokuapp.com/stagger/page/quadratic`,
//     );

//     let countdown = parseInt(await staggerPage.innerText("#countdown")); // Initialize countdown variable

//     while (countdown) {
//       countdown = parseInt(await staggerPage.innerText("#countdown")); // Get the updated countdown value
//       console.log(`Your test will begin in ${countdown} seconds.`);
//       await staggerPage.waitForTimeout(1 * 1000);
//     }
//   } catch (error) {
//     console.error("Failed to load the page:", error);
//   }
//   await staggerPage.close();
// }

// /**
//  * Registers a new user and logs them into the application.
//  *
//  * @param {Object} options - Options for registering the new user.
//  * @param {string} [options.email] - The email address for the new user. Defaults to environment variable DEFAULT_USER.
//  * @param {string} [options.password] - The password for the new user. Defaults to environment variable DEFAULT_PASSWORD.
//  * @param {string} [options.route] - The route to navigate to after logging in. Defaults to the root ("/").
//  * @returns {Object} An object containing the email, context, browser, and page objects.
//  */
// async function registerNewUser(options = {}) {
//   // Get email and password from options or environment variables
//   const email = options.email ? options.email : process.env.DEFAULT_USER;
//   const password = options.password
//     ? options.password
//     : process.env.DEFAULT_PASSWORD;

//   // Launch browser and create a new page
//   const { context, browser } = await launch(options); // Launch browser
//   const page = await context.newPage(); // Create a new page

//   try {
//     // Navigate to the specified route or the root
//     console.log(process.env.DEFAULT_URL);
//     await page.goto(buildUrl(options.route ? options.route : "/"), {
//       timeout: 10 * 1000,
//     });
//   } catch (error) {
//     console.error(error);
//   }

//   // Automatically accept dialog alerts
//   page.on("dialog", (dialog) => {
//     dialog.accept().catch((error) => {
//       console.error("Failed to accept the dialog:", error);
//     });
//   });

//   // Click the "Sign up" button
//   await page.locator(`:text("Sign up")`).click();

//   // Fill out the sign-up form and submit
//   await page.locator(`#email`).fill(email);
//   await page.locator(`#password`).fill(password);

//   // Stagger
//   await staggerStart(context);

//   await page.locator(`button:text("Continue")`).click();

//   // Assert that we were redirected to a new sheet
//   await expect(page.getByText(`Sheet chat`)).toBeVisible();
//   await expect(page).toHaveURL(/file/);

//   // Return the necessary information
//   return { email, context, browser, page };
// }

// /**
//  * Creates a new team by navigating to the create team URL and filling in the team name.
//  * @param {Page} page - The Playwright page object.
//  * @param {string} newTeamName - The name of the new team to be created.
//  * @returns {Promise<void>}
//  *
//  * @example
//  * await createNewTeamByURL(page, 'My New Team');
//  */
// async function createNewTeamByURL(page, newTeamName) {
//   // Navigate to the create team url
//   await page.goto(buildUrl("/teams/create"));
//   await expect(
//     page.getByRole(`heading`, { name: `Create a team` }),
//   ).toBeVisible();

//   // Fill in the new team name
//   await page.locator(`[role="dialog"] [name="name"]`).fill(newTeamName);

//   // Click on the "Create team" submit button
//   await page.locator(`[type="submit"]:text("Create team")`).click();

//   // Assert that the "No files" text is visible on the page
//   await expect(page.locator(`:text("No files")`)).toBeVisible();
//   await expect(page).not.toHaveURL("/create");

//   // Assert getting started with your team message
//   await expect(
//     page.getByRole(`heading`, { name: `Getting started with your team` }),
//   ).toBeVisible();

//   // Return the URL for the team to verify it's visible
//   await page.waitForTimeout(3000);
//   const teamUrl = await page.url().split("/teams/")[1];
//   return { teamUrl };
// }

// async function createNewTeam(page, newTeamName) {
//   // Click on the "My Team" button
//   await page.locator(`nav :text("arrow_drop_down"):visible`).click();

//   // Click on the "Create team" button
//   await page.locator(`:text("Create team")`).click();

//   // Fill in the new team name
//   await page.locator(`[role="dialog"] [name="name"]`).fill(newTeamName);

//   // Click on the "Create team" submit button
//   await page.locator(`[type="submit"]:text("Create team")`).click();

//   // Assert that the new team name is visible on the page
//   await expect(page.locator(`:text("${newTeamName}")`)).toBeVisible();

//   // Assert that the "No files" text is visible on the page
//   await expect(page.locator(`:text("No files")`)).toBeVisible();
// }

// /**
//  * Creates a new team with the specified name.
//  *
//  * @param {Object} page - The Playwright page object.
//  * @param {string} newTeamName - The name of the new team to create.
//  */
// async function createNewTeamOld(page, newTeamName) {
//   // Click the "Create team" button
//   await page.locator(`button:text("Create team")`).click();

//   // Click the "Continue" button on the create team dialog
//   await page.locator(`button:text("Continue")`).click();

//   // Fill in the new team name
//   await page.locator(`[role="dialog"] [name="name"]`).fill(newTeamName);

//   // Click the "Continue to billing" button
//   await page.locator(`:text("Continue to billing")`).click();

//   // Wait for the checkout container to appear
//   await page.waitForSelector(
//     `[data-testid="checkout-container"] :text("Or pay with card")`,
//   );

//   // Fill in the card number
//   await page
//     .locator(`[data-testid="checkout-container"] [aria-label="Card number"]`)
//     .fill(`4242 4242 4242 4242`);

//   // Fill in the expiration date
//   await page
//     .locator(`[data-testid="checkout-container"] [aria-label="Expiration"]`)
//     .fill("01/30");

//   // Fill in the CVC code
//   await page.getByPlaceholder("CVC").fill(`123`);

//   // Fill in the billing name
//   await page
//     .locator(`[data-testid="checkout-container"] #billingName`)
//     .fill(`test`);

//   // Fill in the ZIP code
//   await page
//     .locator(`[data-testid="checkout-container"] [aria-label="ZIP"]`)
//     .fill(`12345`);

//   // Click the submit button to complete the payment
//   await page.locator(`[data-testid="hosted-payment-submit-button"]`).click();

//   // Wait for the confirmation that no team files are present yet
//   await page.waitForSelector(`:text("No team files yet")`);
// }

// async function inviteUserToTeam(page, email, permission) {
//   // Navigate to Members page
//   await page.locator(`nav :text-is("Members")`).click();
//   await page.locator(`[aria-label="Email"]`).fill(email);
//   const currentPermission = await page
//     .locator(`button[role="combobox"]`)
//     .first()
//     .textContent();
//   if (currentPermission !== permission) {
//     await page.locator(`button[role="combobox"]`).first().click();
//     await page.locator(`[role="option"] :text("${permission}")`).last().click();
//   }
//   await page.locator(`button:text("Invite")`).click();
//   await page.waitForTimeout(2000);
//   await expect(
//     page.locator(`.text-muted-foreground:has-text("${email}")`),
//   ).toBeVisible();
// }

// async function displayMouseCoords(page) {
//   await page.evaluate(() => {
//     const positionDisplay = document.createElement("div");
//     positionDisplay.id = "mousePosition";
//     positionDisplay.style.cssText = `
//       position: fixed;
//       background-color: white;
//       z-index: 1000;
//       bottom: 250px;
//       left: 250px;
//       padding: 2px;
//       font-size: '10px';
//     `;
//     positionDisplay.textContent = "X: -, Y: -"; // Initial text
//     document.body.appendChild(positionDisplay);

//     document.addEventListener("mousemove", (event) => {
//       const { clientX: x, clientY: y } = event;

//       positionDisplay.textContent = `X: ${x}, Y: ${y}`;
//     });
//   });
// }

// // Helper function to save a performance measurement
// async function saveMeasurement(name, value) {
//   const res = await fetch(
//     "https://qawolf-automation.herokuapp.com/apis/measure",
//     {
//       body: JSON.stringify({
//         api_key: process.env.QAWA_API_KEY,
//         name,
//         value,
//       }),
//       headers: {
//         "Content-Type": "application/json",
//       },
//       method: "POST",
//     },
//   );

//   const text = await res.text();
//   try {
//     return JSON.parse(text);
//   } catch (e) {
//     console.warn("Save Measurement Response is not JSON:", text);
//     return text;
//   }
// }

// // Helper function to retrieve a measurement chart
// async function getMeasurementChart(name) {
//   const res = await fetch(
//     `https://qawolf-automation.herokuapp.com/apis/measure/chart?api_key=${process.env.QAWA_API_KEY}&name=${name}`,
//     {
//       method: "GET",
//     },
//   );
//   const data = await res.json();

//   return {
//     chartUrl: data.chartUrl,
//     measurements: data.measurements,
//   };
// }

// // Function to measure the performance of a given action
// async function measurePerformance(action, benchmarkName, description) {
//   console.log(`Starting performance measurement for ${benchmarkName}`);

//   // Mark the start time for performance measurement
//   performance.mark(`${benchmarkName}:start`);

//   // Perform the action
//   await action();

//   // Mark the end time for performance measurement
//   performance.mark(`${benchmarkName}:stop`);

//   // Measure the time between the start and end marks
//   const measure = performance.measure(
//     "time to complete",
//     `${benchmarkName}:start`,
//     `${benchmarkName}:stop`,
//   );

//   // Log the total action time
//   console.warn(`Time to complete ${description}: ${measure.duration}`);

//   // Save the total time measurement
//   await saveMeasurement(benchmarkName, measure.duration);

//   return measure.duration;
// }

// // Function to assert performance within tolerance
// function assertWithinTolerance(measurements, totalTime) {
//   let sum = 0;
//   measurements.forEach((m) => (sum += m.value));
//   let avg = sum / measurements.length;

//   let percentageDifference = Math.abs(totalTime - avg) / totalTime;

//   if (avg > totalTime.toFixed(1)) {
//     console.log(
//       `avg = ${avg.toFixed(1)}, curr = ${totalTime.toFixed(1)}, diff = ${(
//         percentageDifference * 100
//       ).toFixed(1)}%`,
//     );
//     console.log("Performance is overperforming -> No need to report");
//   } else if (percentageDifference > 0.4) {
//     console.warn(
//       `avg = ${avg.toFixed(1)}, curr = ${totalTime.toFixed(1)}, diff = ${(
//         percentageDifference * 100
//       ).toFixed(1)}%`,
//     );
//     throw new Error(
//       `Value outside threshold, please report to Quadratic if trending slower (avg is LOWER than curr) & triage run as Passing.`,
//     );
//   } else {
//     console.warn(
//       `avg = ${avg.toFixed(1)}, curr = ${totalTime.toFixed(1)}, diff = ${(
//         percentageDifference * 100
//       ).toFixed(1)}%`,
//     );
//   }
// }

// /**
//  * Upload File Function. Defaults to .grid
//  * Can take spreadsheet naming parameter in options
//  */
// /*
//  * Upload File Function. Defaults to .grid
//  * Can take spreadsheet naming parameter in options
//  *
//  * @param {object} page - The Page object representing the browser page.
//  * @param {string} fileName - The path of the file
//  * @param {Object} options The options object that can contain fileType, spreadsheet (renaming of file name), or basePath
//  *
//  */
// async function uploadFile(page, fileName, options = {}) {
//   // Click Import
//   await page.locator(`button:text-is("Import ")`).click();

//   // Convert file to .{format} if not passed
//   var noFormatFileName;
//   if (!fileName.includes(`${options.fileType || ".grid"}`)) {
//     // If the filename does not contain our passed fileType or grid, add it
//     noFormatFileName = fileName;
//     fileName = fileName + `${options.fileType || ".grid"}`;
//   } else {
//     noFormatFileName = fileName.split(".")[0];
//   }

//   // If options include filepath use that, otherwise use default
//   let filePath = options.filePath ?? "/home/wolf/team-storage/";

//   // Select file
//   page.once("filechooser", (chooser) => {
//     chooser.setFiles(`${filePath}${fileName}`).catch(console.error);
//   });

//   // Click Local File option
//   await page.locator(`[role="menuitem"]:has-text("Local File")`).click();

//   // Confirm file is uploaded
//   await expect(page.locator(`#QuadraticCanvasID`)).toBeVisible();

//   // Rename file
//   if (options.spreadsheet) {
//     await page.locator(`button:text("${noFormatFileName}")`).click();
//     await page.keyboard.type(options.spreadsheet, { delay: 250 });
//     await page.keyboard.press("Enter");
//     await page.waitForTimeout(3000);
//   }

//   // Close Chat
//   try {
//     await page.getByRole(`button`, { name: `close` }).first().click();
//   } catch (err) {
//     console.error(err);
//   }

//   // Close negative rows and columns warning tooltip
//   try {
//     await page.getByLabel(`Close`).click({ timeout: 3000 });
//   } catch (err) {
//     console.error(err);
//   }

//   // Close 'File automatically updated...' alert
//   try {
//     await page
//       .getByRole(`button`, { name: `close` })
//       .first()
//       .click({ timeout: 3000 });
//   } catch (err) {
//     console.error(err);
//   }
// }

// /**
//  * Clean up server connections: requires user to be inside a sheet and clicked on an empty cell

//  * @param {object} page - The Page object representing the browser page.
//  * @param {string} connectionName - The prefix of the connection
//  *
//  */
// async function cleanUpServerConnections(page, connectionName) {
//   // setup dialog alerts to be yes
//   page.on("dialog", (dialog) => {
//     dialog.accept().catch((error) => {
//       console.error("Failed to accept the dialog:", error);
//     });
//   });

//   // Press "/"
//   await page.keyboard.press("/");
//   await page.locator(`span:text-is("Manage connections")`).click();

//   if (await page.getByRole(`heading`, { name: `No connections` }).isVisible()) {
//     console.log("No connections to clean up");
//     return;
//   }
//   // filter file by name
//   await page.locator('[placeholder="Filter by name"]').waitFor();
//   await page.locator('[placeholder="Filter by name"]').fill(connectionName);
//   await page.waitForTimeout(2500);

//   // loop through and delete all the files
//   const connectionCount = await page.locator(`form + div > div`).count();
//   for (let i = 0; i < connectionCount; i++) {
//     await page
//       .locator(`button:has-text("${connectionName}") + button `)
//       .first()
//       .click();
//     await page.getByRole(`button`, { name: `Delete` }).click();
//   }
// }

// async function toggleShowTableUI(page) {
//   // Right-click on cell A1
//   await page.locator("#QuadraticCanvasID").click({
//     button: "right",
//     position: {
//       x: 76,
//       y: 33,
//     },
//   });

//   // Click the button with 'Show table UI'
//   await page.getByRole(`menuitem`, { name: `table Table` }).hover();
//   await page.getByRole("menuitem", { name: "Show table UI" }).click();
// }

// /**
//  * Retrieves a list of dedicated users for a given workflow.
//  * @returns {object} An object of dedicated users for the specified workflow.
//  *
//  * @example
//  * const users = getDedicatedUsers();
//  * const {user1, user2} = getDedicatedUsers();
//  */
// function getDedicatedUsers() {
//   const workflowId = process.env.QAWOLF_WORKFLOW_ID;
//   const users = JSON.parse(process.env.DEDICATED_USERS);
//   return users[workflowId];
// }

// /**
//  * Updates the environment variable DEDICATED_USERS to include new emails for the workflowId
//  *
//  * @param {Array<string>} emails - An array of email addresses to set for the users.
//  * A promise that resolves when the environment variable is updated.
//  *
//  * @example
//  * setUserEmails(['user1@example.com', 'user2@example.com']);
//  *
//  * Will add or override a user emails if run from a workflow that already has the ID as a key
//  * {
//       clu8lscpb1s23cz013bbn0ocz: {
//         user1: 'quadratic+filterFiles_user1@qawolf.email',
//         user2: 'quadratic+filterFiles_user2@qawolf.email'
//       },
//       clu8lt3ok89117b015mrw1o2c: { user1: 'quadratic+createATeam@qawolf.email' }
//    }
//  */
// async function setUserEmails(emails) {
//   const workflowId = process.env.QAWOLF_WORKFLOW_ID;
//   const oldUsers = JSON.parse(process.env.DEDICATED_USERS); // Handle potential undefined value

//   const newUsers = Object.fromEntries(
//     emails.map((email, index) => [`user${index + 1}`, email]),
//   );

//   await setEnvironmentVariable(
//     "DEDICATED_USERS",
//     JSON.stringify({ ...oldUsers, [workflowId]: newUsers }),
//   );
// }

// /**
//  * Helper Function to get view characteristics/ "List" and "Grid"
//  * @returns {Object} Characteristics of the current view
//  */
// async function getGridListCharacteristics(page) {
//   const ulElement = page.locator("ul").first();
//   const liElements = await page.locator("ul > li").all();

//   let firstLiStructure = null;
//   if (liElements.length > 0) {
//     const firstLi = liElements[0];
//     firstLiStructure = await firstLi.evaluate((el) => ({
//       hasAspectVideo: el.querySelector(".aspect-video") !== null,
//       hasFlexRow: el.querySelector(".flex.flex-row") !== null,
//       imgWidth: el.querySelector("img")?.getAttribute("width") || null,
//     }));
//   }

//   return {
//     ulClasses: await ulElement.evaluate((el) => el.className),
//     liCount: liElements.length,
//     firstLiStructure,
//   };
// }

// /**
//  * Starts at the Quadratic 'Team settings' page
//  * Cancels a user's Pro subscription and performs various assertions throughout the process.
//  * This function simulates the steps for cancelling an active Pro plan subscription, including:
//  *
//  * 1. Verifying the user's current page is the 'Settings' page.
//  * 2. Navigating to the 'Billing' management page and ensuring key sections are visible (current subscription, payment methods, etc.).
//  * 3. Clicking the 'Cancel subscription' button to initiate cancellation.
//  * 4. Verifying that the cancellation confirmation page appears.
//  * 5. Confirming that the subscription cancellation is completed and displayed correctly in the dialog.
//  * 6. Ensuring that the 'Renew Subscription' button appears, confirming the cancellation.
//  * 7. Validating that the cancellation date is displayed.
//  * 8. Returning to the homepage to complete the process.
//  *
//  * @param {object} page - The Page object representing the browser page.
//  * @throws {Error} Throws an error if any of the assertions or steps fail.
//  */
// async function cancelProPlan(page) {
//   try {
//     // Assert page is currently displaying Settings
//     await expect(page).toHaveURL(/settings/);
//     await expect(page).toHaveTitle(/settings/);
//     await expect(
//       page.getByRole(`heading`, { name: `Team settings` }),
//     ).toBeVisible();

//     // Click 'Manage billing' to reach the billing management page
//     await page.getByRole(`button`, { name: `Manage billing` }).click();

//     // Assert that the current page is the billing management page
//     // Check for information that includes: current subscription, payment methods, billing info and invoice history
//     await expect(page).toHaveTitle(/Billing/);
//     await expect(page.getByText(`Current subscription`)).toBeVisible();
//     await expect(
//       page.getByText(/Payment method[s]?/, { exact: true }),
//     ).toBeVisible();
//     await expect(page.getByText(`Billing information`)).toBeVisible();
//     await expect(page.getByText(`Invoice history`)).toBeVisible();

//     // Click 'Cancel subscription' button
//     await page.locator(`[data-test="cancel-subscription"]`).click();

//     // Assert that the page to confirm the cancellation appears
//     await expect(page).toHaveTitle(/Cancel subscription/);
//     await expect(page.getByText(`Cancel your subscription`)).toBeVisible();

//     // Store the text content of the main page container and remove the extra spaces
//     const cancelSubscriptionRawText = await page
//       .locator('[data-testid="page-container-main"]')
//       .textContent();
//     const cancelSubscriptionText = cancelSubscriptionRawText
//       .replace(/\s+/g, " ")
//       .trim();

//     // Assert that the normalized text contains the expected phrase
//     expect(cancelSubscriptionText).toContain("subscription will be canceled");

//     // Click 'Cancel subscription" to confirm the cancellation
//     await page.locator(`[data-testid="confirm"]`).click();

//     // Wait for the cancellation confirmation dialog to appear
//     await page.getByRole(`dialog`).waitFor();

//     // Assert that the dialog contains the text "Subscription has been cancelled" to confirm cancellation
//     await expect(page.locator(`[role="dialog"] span`).nth(1)).toHaveText(
//       `Subscription has been canceled`,
//     );

//     // Click 'No thanks' to exit the dialog
//     await page.locator(`[data-testid="cancellation_reason_cancel"]`).click();

//     // Assert that the subscription has been cancelled by checking for 'Renew Subscription' button to appear
//     await expect(
//       page.locator(`[data-test="renew-subscription"]`),
//     ).toBeVisible();

//     // Assert that the cancellation date is visible
//     await expect(
//       page.locator(`[data-test="subscription-cancel-at-period-end-badge"]`),
//     ).toBeVisible();

//     // End cleanup by navigating to the homepage
//     await page.locator(`[data-testid="return-to-business-link"]`).click();
//   } catch (error) {
//     console.log(
//       `An error occurred while cancelling the Pro plan: ${error.message}`,
//     );
//   }
// }

// /**
//  * Starts at the Quadratic 'Team settings' page
//  * Upgrades a user's subscription to the Pro plan and performs various assertions throughout the process.
//  * This function simulates the steps for upgrading from a Free plan to a Pro plan, including:
//  * 1. Verifying the user's current subscription (Free plan).
//  * 2. Navigating to the Stripe checkout page and ensuring the correct product is being purchased.
//  * 3. Filling in the credit card details and completing the checkout process.
//  * 4. Verifying that the user is redirected to the Team files page post-purchase.
//  * 5. Ensuring that the Pro plan is now marked as the active subscription and that the Free plan no longer shows as active.
//  * 6. Validating that the 'Upgrade to Pro' button is no longer visible and that the 'Manage billing' button is available.
//  *
//  * @param {object} page - The Page object representing the browser page.
//  * @throws {Error} Throws an error if any of the assertions or steps fail.
//  *
//  * Note: This function uses pre-defined (valid) credit card credentials (`creditCard` object) for simulating the checkout process.
//  */
// async function upgradeToProPlan(page) {
//   // Dummy credit card credentials for the checkout page
//   const creditCard = {
//     name: "Wolf Tester",
//     number: "4242 4242 4242 4242",
//     expiration: "03/30",
//     cvc: "424",
//     zipCode: "90210",
//   };

//   try {
//     // Assert page is currently displaying Settings
//     await expect(page).toHaveURL(/settings/);
//     await expect(page).toHaveTitle(/settings/);
//     await expect(
//       page.getByRole(`heading`, { name: `Team settings` }),
//     ).toBeVisible();

//     // Locate the parent div that contains 'Free plan'
//     const freePlanParentEl = page.locator(`:text("Free plan")`).locator("..");

//     // Assert both 'Free plan' and 'Current plan' texts are within the same parent div
//     await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible();
//     await expect(
//       freePlanParentEl.locator(`:text("Current plan")`),
//     ).toBeVisible();

//     // Assert that the 'Upgrade to Pro' button is visible, indicating that the user is not on the Pro plan
//     await expect(
//       page.getByRole(`button`, { name: `Upgrade to Pro` }),
//     ).toBeVisible();

//     // Locate the parent div that contains 'Pro plan' details
//     const proPlanParentEl = page
//       .locator(`:text("Pro plan")`)
//       .locator("..")
//       .locator("..");

//     // Locate the text within the parent div of the 'Pro plan' heading
//     // Use a regex to extract the number between `$` and `/user/month` to store the Pro plan cost
//     const proPlanCostText = await proPlanParentEl.textContent();
//     const proPlanCost = proPlanCostText.match(/\$(\d+)(?= \/user\/month)/)[1];

//     // Click 'Upgrade to Pro' to upgrade the account
//     await page.getByRole(`button`, { name: `Upgrade to Pro` }).click();

//     // Assert that page was redirected to a Stripe integrated payment page
//     await expect(
//       page.getByRole(`link`, { name: `Powered by Stripe` }),
//     ).toBeVisible();

//     // Assert that subscription page is for Team billing
//     await expect(
//       page.locator(`[data-testid="product-summary-name"]`),
//     ).toHaveText(`Subscribe to Team`);
//     await expect(
//       page.locator(`[data-testid="line-item-product-name"]`),
//     ).toHaveText(`Team`);

//     // Assert that the 'Total due today' text is visible, indicating that we're on a checkout page
//     await expect(page.getByText(`Total due today`)).toBeVisible();

//     // Store the checkout page total
//     const checkoutTotalText = await page
//       .locator(`[data-testid="product-summary-total-amount"]`)
//       .getByText(`$`)
//       .innerText();
//     const checkoutTotal = checkoutTotalText.replace("$", "").split(".")[0];

//     // Assert the cost reflects the Pro Plan cost shown on the 'Settings' page
//     expect(checkoutTotal).toBe(proPlanCost);

//     // Assert that the bank account textbox is not visible
//     // This ensures that we will be filling in credit card details and not bank details (debit)
//     await expect(
//       page.getByRole(`textbox`, { name: `Bank account` }),
//     ).not.toBeVisible();

//     // Fill the card number in the input for 'Card Information'
//     await page
//       .getByRole(`textbox`, { name: `Card number` })
//       .fill(creditCard.number);

//     // Fill the expiration date in the input for 'Expiration'
//     await page
//       .getByRole(`textbox`, { name: `Expiration` })
//       .fill(creditCard.expiration);

//     // Fill the 3-digit CVC number in the input for 'CVC'
//     await page.getByRole(`textbox`, { name: `CVC` }).fill(creditCard.cvc);

//     // Fill the cardholder's name in the input for 'Cardholder Name'
//     await page
//       .getByRole(`textbox`, { name: `Cardholder name` })
//       .fill(creditCard.name);

//     // Fill the zip code in the input for 'Zip Code'
//     await page.getByRole(`textbox`, { name: `ZIP` }).fill(creditCard.zipCode);

//     // Default 'country or region' should be set to 'US'
//     await expect(page.getByLabel(`Country or region`)).toHaveValue(`US`);

//     // Click 'Subscribe' button to upgrade the count to a Pro plan
//     await page.locator(`[data-testid="hosted-payment-submit-button"]`).click();

//     // Wait for the page to redirect to the Team files page
//     await page.waitForNavigation({ waitUntil: "networkidle" });

//     // Assert that page has redirected to the Team files page
//     await expect(page).toHaveTitle(/Team files/);
//     await expect(
//       page.getByRole(`heading`, { name: `Team files` }),
//     ).toBeVisible();

//     // Navigate to the Settings page by clicking the 'Settings' link
//     await page.getByRole("link", { name: "settings Settings" }).click();

//     // Assert page is currently displaying Settings
//     await expect(page).toHaveURL(/settings/);
//     await expect(page).toHaveTitle(/settings/);
//     await expect(
//       page.getByRole(`heading`, { name: `Team settings` }),
//     ).toBeVisible();

//     // Assert that the 'Free plan' is no longer accompanied by the 'Current plan' flag
//     // freePlanParentEl is declared 'Arrange' step
//     await expect(freePlanParentEl.locator(`:text("Free plan")`)).toBeVisible();
//     await expect(
//       freePlanParentEl.locator(`:text("Current plan")`),
//     ).not.toBeVisible();

//     // Assert that the 'Pro plan' container includes the 'Current plan' flag
//     await expect(proPlanParentEl.locator(`:text("Pro plan")`)).toBeVisible();
//     await expect(
//       proPlanParentEl.locator(`:text("Current plan")`),
//     ).toBeVisible();

//     // Assert that the 'Upgrade to Pro' button is no longer visible
//     await expect(
//       page.getByRole(`button`, { name: `Upgrade to Pro` }),
//     ).not.toBeVisible();

//     // Assert that the 'Manage billing' button is visible
//     // This indicates that the user has an active subscription to manage
//     await expect(
//       page.getByRole(`button`, { name: `Manage billing` }),
//     ).toBeVisible();
//   } catch (error) {
//     console.log(
//       `An error occurred while upgrading to the Pro plan: ${error.message}`,
//     );
//   }
// }

// /**
//  * Cleans up the provided payment method by:
//  * - Checks if the "Payment methods" section is visible.
//  * - If "Payment methods" is not found, cleanup is skipped assuming that there is no more than 1 payment method.
//  * - Restores the default payment method (original Visa).
//  * - Deletes the newly added payment method (e.g., Mastercard) and confirms the deletion.
//  * - Ensures only the original payment method remains visible.
//  *
//  * @param {object} page - The Page object representing the browser page.
//  * @param {object} newPaymentMethod - The payment method to be deleted.
//  * @param {string} newPaymentMethod.type - The type of the payment method (e.g., "Visa").
//  * @param {string} newPaymentMethod.cardNumber - The card number.
//  * @param {string} newPaymentMethod.expDateFull - The expiration date (e.g., "12/25").
//  */
// async function cleanupPaymentMethod(page, newPaymentMethod) {
//   try {
//     // Check if the page contains the 'Payment methods' text
//     const paymentMethodsTextVisible = await page
//       .getByText("Payment methods", { exact: true })
//       .isVisible();

//     // If 'Payment methods' text is visible, perform cleanup
//     // Note: 'methods' is plural indicating more than 1 card
//     if (paymentMethodsTextVisible) {
//       // When a new card is added, it becomes the default payment method
//       // Assign default payment method *back* to the original Visa card
//       await page.locator(`[data-testid="overflow-menu-button"]`).click();
//       await page
//         .locator('[data-test="menu-contents"]')
//         .waitFor({ state: "visible" });
//       await page.getByRole(`menuitem`, { name: `Make default` }).click();

//       // Wait for dropdown to be hidden
//       await page.waitForTimeout(1000);

//       // Remove the newly added payment method (Mastercard)
//       await page.locator(`[data-testid="overflow-menu-button"]`).click();
//       await page
//         .locator('[data-test="menu-contents"]')
//         .waitFor({ state: "visible" });
//       await page
//         .locator(`[data-test="nonDefaultPaymentInstrumentDeleteButton"]`)
//         .click();

//       // Wait for dialog to appear for delete confirmation
//       await page
//         .locator(`.Dialog-header`)
//         .getByText("Delete payment method")
//         .waitFor();

//       // Assert the dialog is for confirmation the deletion of the new payment method
//       await expect(
//         page.getByRole(`dialog`).getByText(`${newPaymentMethod.type} ••••`),
//       ).toBeVisible();
//       await expect(
//         page
//           .getByRole(`dialog`)
//           .getByText(`Expires ${newPaymentMethod.expDateFull}`),
//       ).toBeVisible();

//       // Click 'Delete payment method' and confirm deletion
//       await page
//         .locator(
//           `[data-test="PaymentInstrumentActionsDetatchModalConfirmButton"]`,
//         )
//         .click();

//       // **Assert that payment method was deleted:
//       // Wait for page to update
//       await page.waitForTimeout(1000);

//       // Assert that there is only 1 card element representing the initial card
//       const afterCleanupCardCount = await page
//         .locator(`[data-testid="page-container-main"] .Card--radius--all`)
//         .count();
//       expect(afterCleanupCardCount).toBe(1);

//       // Assert that the newly added payment method is NOT visible based on its expiration date
//       await expect(
//         page.getByText(`Expires ${newPaymentMethod.expDateFull}`),
//       ).not.toBeVisible();

//       // Assert that the newly added payment method is NOT visible based on its card number and type
//       await expect(
//         page.getByText(
//           `${newPaymentMethod.type} •••• ${newPaymentMethod.cardNumber.split(" ")[3]}`,
//         ),
//       ).not.toBeVisible();
//     } else {
//       console.log('Page does not contain "Payment methods", skipping cleanup.');
//     }
//   } catch (error) {
//     console.log(
//       `There was an error cleaning up the provided payment method: ${error.message}`,
//     );
//   }
// }

// /**
//  * Starts at the 'Billing Management' page and resets the billing information to default values by:
//  * - Navigating to the billing information section.
//  * - Filling the fields with default values (e.g., 'My Team' for Name, 'N/A' for Address).
//  * - Saving the changes.
//  *
//  * @param {object} page - The Page object representing the browser page.
//  */
// async function resetBillingInformation(page) {
//   try {
//     // Click 'Update information' to update the billing info
//     await page.getByRole(`button`, { name: `Update information` }).click();

//     // Assert that the page displays 'Billing Information'
//     await expect(
//       page.locator(`form`).getByText(`Billing information`),
//     ).toBeVisible();

//     // Assert that 'Name', 'Email', 'Address' and 'Phone Number' fields are available to update
//     await expect(
//       page
//         .locator(`div`)
//         .filter({ hasText: /^Name$/ })
//         .first(),
//     ).toBeVisible();
//     await expect(
//       page
//         .locator(`div`)
//         .filter({ hasText: /^Email$/ })
//         .first(),
//     ).toBeVisible();
//     await expect(
//       page.locator(`div`).filter({ hasText: /^Address$/ }),
//     ).toBeVisible();
//     await expect(
//       page.locator(`div`).filter({ hasText: /^Phone number$/ }),
//     ).toBeVisible();

//     // Assert that there are options to 'Save' or 'Cancel' any changes
//     await expect(page.locator(`[data-testid="confirm"]`)).toBeVisible();
//     await expect(page.locator(`[data-test="cancel"]`)).toBeVisible();

//     // Fill 'Name' textbox with the default name: 'My Team'
//     await page.getByRole(`textbox`, { name: `Name` }).fill("My Team");

//     // Update the remaining billing information (address, city, state, zip)
//     await page.getByRole(`textbox`, { name: `Address line 1` }).fill(`N/A`);
//     await page.getByRole(`textbox`, { name: `Address line 2` }).fill(``);
//     await page.getByRole(`textbox`, { name: `City` }).fill(`N/A`);
//     await page.getByLabel(`State`).click();
//     await page.getByLabel(`State`).type(`Alabama`);
//     await page.getByLabel(`State`).press("Enter");
//     await page.getByRole(`textbox`, { name: `ZIP` }).fill(`95014`);

//     // Click 'Save' button to confirm the changes
//     await page.locator(`[data-testid="confirm"]`).click();

//     // Assert that the name is back to the original 'My Team'
//     await expect(page.getByText(`NameMy Team`)).toBeVisible();

//     // Assert that the billing address is just placeholder text
//     await expect(page.getByText(`N/A`, { exact: true })).toBeVisible();
//     await expect(page.getByText(`N/A, AL 95014 US`)).toBeVisible();
//   } catch (error) {
//     console.log(
//       `There was an error cleaning up the billing information: ${error.message}.`,
//     );
//   }
// }

// /**
//  * Starts at the Quadratic homepage.
//  * Removes a team member from the Pro Plan and verifies billing and member count details.
//  *
//  * @param {object} page - The Page object representing the browser page.
//  * @param {string} emailAddress - The account email for billing verification.
//  * @param {string} additionalUserEmail - The email of the member to remove.
//  */
// async function deleteMemberFromProPlan(
//   page,
//   emailAddress,
//   additionalUserEmail,
// ) {
//   try {
//     // Navigate to the Team Members page by clicking 'Members'
//     await page.getByRole(`link`, { name: `group Members` }).click();

//     // Assert that we've navigated to the team management page
//     await expect(
//       page.getByRole(`heading`, { name: `Team members` }),
//     ).toBeVisible();
//     await expect(page).toHaveURL(/members/);

//     // Only execute cleanup if the additional user's email is on the team members page
//     const isVisible = await page
//       .getByText(additionalUserEmail)
//       .first()
//       .isVisible();
//     if (isVisible) {
//       // Click 'Can Edit' to open the dropdown menu
//       await page.locator(`[role="combobox"]`).last().click();

//       // Select 'Remove' to delete this user from the team
//       await page
//         .getByRole(`option`, { name: `Remove` })
//         .locator(`span`)
//         .first()
//         .click();

//       // Assert that the team member that was added earlier in the WF is now removed
//       await expect(
//         page.getByText(additionalUserEmail).first(),
//       ).not.toBeVisible();

//       // Navigate back to Settings page
//       await page.getByRole(`link`, { name: `settings Settings` }).click();

//       // Locate the text element that starts with 'Team members (manage)' followed by a number
//       // Store the text content (e.g., 'Team members (manage)1'
//       const afterCleanupMemberCountText = await page
//         .locator("text=/^Team members \\(manage\\)\\d+$/")
//         .textContent();
//       const afterCleanupMemberCount = Number(
//         afterCleanupMemberCountText.match(/\d+/)[0],
//       );

//       // Assert that the team member count should be back to 1
//       expect(afterCleanupMemberCount).toBe(1);

//       // Navigate to billing management page
//       await page.getByRole(`button`, { name: `Manage billing` }).click();

//       // Assert the account email address is displayed on the billing page
//       await expect(page.getByText(emailAddress)).toBeVisible();

//       // Assert that the 'Cancel Subscription' button appears
//       await expect(
//         page.locator(`[data-test="cancel-subscription"]`),
//       ).toBeVisible();

//       // Assert that the page reflects the base Pro plan cost
//       await expect(page.getByText(`$20.00 per month`)).toBeVisible();

//       // Assert that the page does not include the Pro plan cost + 1 extra member
//       await expect(page.getByText(`$40.00 per month`)).not.toBeVisible();

//       // Navigate to homepage
//       await page.locator(`[data-testid="return-to-business-link"]`).click();
//     }
//   } catch (error) {
//     console.log(
//       `There was an error when deleting the team member from the Pro Plan: ${error.message}`,
//     );
//   }
// }
