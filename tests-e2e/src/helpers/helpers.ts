// async function throttleNetworkLogIn(options = {}) {
//   // extract email and password if available otherwise use env vars
//   const email = options.email ? options.email : process.env.DEFAULT_USER;
//   const password = options.password
//     ? options.password
//     : process.env.DEFAULT_PASSWORD;

//  , create page, and navigate to log in page
//   const { context, browser } = await launch(options);
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

// async function createNewTeamByURL(page, newTeamName) {
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
