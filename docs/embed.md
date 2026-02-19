# Embedding Quadratic spreadsheets

You can embed a Quadratic spreadsheet in your own website or app so visitors can view or interact with it without leaving the page. The spreadsheet runs in an iframe and supports the same features as opening the file in Quadratic (formulas, Python, JavaScript, charts, etc.), with options to restrict editing or show a single sheet.

## Prerequisites

The file you want to embed must be **shared publicly**. In Quadratic, open the file, go to **File → Share**, and under "Anyone with the link" choose **Can view** or **Can edit**. If the file is set to "No access", the embed will not load for people who don't have direct access.

## Getting the embed link

1. Open the spreadsheet in Quadratic.
2. Go to **File → Share** (or use the Share option in the top bar).
3. Scroll to the **Embed** section at the bottom and expand it.
4. Optionally adjust the embed options (read-only, sheet, preload—see below).
5. Copy the embed URL from the read-only box, or use **Copy link** to copy the URL and **Copy HTML** to copy a ready-made `<iframe>` snippet.

The base embed URL looks like:

```
https://app.quadratichq.com/embed?embedId=YOUR_EMBED_UUID
```

The `embedId` is a unique identifier for the embed link, separate from the file's UUID. This ensures the file's UUID is never exposed in the embed URL.

## Embed URL parameters

You can add query parameters to control how the embed behaves.

| Parameter   | Description |
|------------|-------------|
| `embedId`  | **Required** for embedding an existing file. The embed link's UUID (from the Share dialog). Omit when using `import` or blank. |
| `import`   | URL of a file to import (CSV, Excel, Parquet, or Quadratic grid). The file is fetched and opened in the embed. See [Embedding with imported Excel or CSV files](#embedding-with-imported-excel-or-csv-files). |
| `readonly` | If present, the embed loads in read-only mode. Viewers cannot edit cells or run code. |
| `sheet`    | Name of a single sheet to display. When set, only that sheet is shown and the sheet bar is hidden. Omit to show all sheets. |
| `preload`  | Comma-separated list of runtimes to preload for faster first run: `python`, `js`, or `python,js`. |

The `embedId` and `import` parameters are mutually exclusive: use `embedId` to embed an existing Quadratic file, or `import` with a URL to load CSV/Excel/Parquet/grid from the web. Omit both for a blank spreadsheet.

### Examples

- View-only embed:
  `https://app.quadratichq.com/embed?embedId=abc-123&readonly`

- Single sheet, read-only:
  `https://app.quadratichq.com/embed?embedId=abc-123&readonly&sheet=Summary`

- Preload Python and JavaScript:
  `https://app.quadratichq.com/embed?embedId=abc-123&preload=python,js`

## Embedding with imported Excel or CSV files

You can embed Quadratic and have it load a spreadsheet from a URL instead of an existing Quadratic file. Use the `import` parameter with the full URL of the file. The file is fetched when the embed loads and opened in the viewer. The original file is never modified — if the user signs in to Quadratic, a duplicate is created in their account.

**Supported formats:**

- **CSV** (`.csv`)
- **Excel** (`.xlsx`, `.xls`)
- **Parquet** (`.parquet`)
- **Quadratic grid** (`.grid`)

The format is inferred from the URL path (the file extension). The URL must be publicly accessible so the embed can fetch it (same-origin or CORS permitting).

**Examples:**

- Import a CSV from your site:
  `https://app.quadratichq.com/embed?import=https://yoursite.com/data/sales.csv`

- Import an Excel file (read-only):
  `https://app.quadratichq.com/embed?import=https://yoursite.com/reports/q4.xlsx&readonly`

You can combine `import` with other embed parameters (`readonly`, `sheet`, `preload`) the same way as with `embedId`.

## Adding the embed to your site

Use an iframe and set the `src` to your embed URL:

```html
<iframe
  src="https://app.quadratichq.com/embed?embedId=YOUR_EMBED_UUID"
  width="100%"
  height="600"
  style="border: none;">
</iframe>
```

Adjust `width` and `height` to fit your layout. The Share dialog's **Copy HTML** button gives you a snippet you can paste into your page.

## Embed options explained

- **Read-only** — When enabled, the embedded spreadsheet is view-only. No edits or code execution.
- **Only show sheet** — If you enter a sheet name, only that sheet is shown and the sheet tabs are hidden. Leave blank to show all sheets.
- **Preload Python** / **Preload JavaScript** — Preloads the corresponding runtime so the first run of Python or JavaScript in the embed is faster. Helpful if you know visitors will run code.

## Viewing and editing in the embed

Anyone with the embed link can open the spreadsheet. They can change cells and run code in the browser regardless of whether the file is shared as **Can view** or **Can edit**, but **no one can ever modify your original file through an embed**. All changes happen in a temporary, in-browser session.

If a viewer signs in to Quadratic (or opens the file from the embed), a **duplicate** of the file is created in their account. They work on their own independent copy from that point on — your original file is never touched. This means:

- Your data is always safe.
- Viewers get the full Quadratic experience (formulas, Python, JavaScript, charts, etc.).
- Saving requires a Quadratic account and always produces a separate copy.
