# Embedding Quadratic spreadsheets

You can embed a Quadratic spreadsheet in your own website or app so visitors can view or interact with it without leaving the page. The spreadsheet runs in an iframe and supports the same features as opening the file in Quadratic (formulas, Python, JavaScript, charts, etc.), with options to restrict editing or show a single sheet.

## Prerequisites

The file you want to embed must be **shared publicly**. In Quadratic, open the file, go to **File → Share**, and under "Anyone with the link" choose **Can view** or **Can edit**. If the file is set to "No access", the embed will not load for people who don’t have direct access.

## Getting the embed link

1. Open the spreadsheet in Quadratic.
2. Go to **File → Share** (or use the Share option in the top bar).
3. Scroll to the **Embed** section at the bottom and expand it.
4. Optionally adjust the embed options (read-only, sheet, preload—see below).
5. Copy the embed URL from the read-only box, or use **Copy link** to copy the URL and **Copy HTML** to copy a ready-made `<iframe>` snippet.

The base embed URL looks like:

```
https://app.quadratichq.com/embed?fileId=YOUR_FILE_UUID
```

## Embed URL parameters

You can add query parameters to control how the embed behaves.

| Parameter   | Description |
|------------|-------------|
| `fileId`   | **Required** for embedding an existing file. The file’s UUID (from the Quadratic URL or Share dialog). |
| `readonly` | If present, the embed loads in read-only mode. Viewers cannot edit cells or run code. |
| `sheet`    | Name of a single sheet to display. When set, only that sheet is shown and the sheet bar is hidden. Omit to show all sheets. |
| `preload`  | Comma-separated list of runtimes to preload for faster first run: `python`, `js`, or `python,js`. |

### Examples

- View-only embed:
  `https://app.quadratichq.com/embed?fileId=abc-123&readonly`

- Single sheet, read-only:
  `https://app.quadratichq.com/embed?fileId=abc-123&readonly&sheet=Summary`

- Preload Python and JavaScript:
  `https://app.quadratichq.com/embed?fileId=abc-123&preload=python,js`

## Adding the embed to your site

Use an iframe and set the `src` to your embed URL:

```html
<iframe
  src="https://app.quadratichq.com/embed?fileId=YOUR_FILE_UUID"
  width="100%"
  height="600"
  style="border: none;">
</iframe>
```

Adjust `width` and `height` to fit your layout. The Share dialog’s **Copy HTML** button gives you a snippet you can paste into your page.

## Embed options explained

- **Read-only** — When enabled, the embedded spreadsheet is view-only. No edits or code execution.
- **Only show sheet** — If you enter a sheet name, only that sheet is shown and the sheet tabs are hidden. Leave blank to show all sheets.
- **Preload Python** / **Preload JavaScript** — Preloads the corresponding runtime so the first run of Python or JavaScript in the embed is faster. Helpful if you know visitors will run code.

## Viewing and editing in the embed

Anyone with the link can open the embed. If the file is shared as **Can edit**, they can change cells and run code in the browser. Those changes are **not** saved back to your file unless the viewer signs in to Quadratic. If they log in and want to keep their changes, they can save a **copy** of the file to their own account. So your original file stays under your control; embedded viewers get a full experience but saving requires a Quadratic account and creates their own copy.
