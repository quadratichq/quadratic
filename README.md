![Quadratic Tests](https://github.com/quadratic-eng/quadratic/actions/workflows/main.yml/badge.svg)

![quadraticlogo4 1](https://user-images.githubusercontent.com/3479421/162037216-2fea1620-2310-4cfa-96fb-31299195e3a9.png)

![quardatic icon small](https://user-images.githubusercontent.com/3479421/162039117-02f85f2c-e382-4ed8-ac39-64efab17a144.svg)  **_The Data Science Spreadsheet._**
----

Infinite data grid with Python, JavaScript, and SQL built-in. Data Connectors to pull any data.

Take your data and do something useful with it as quickly and as easily as possible.

<img width="1680" alt="Screen Shot 2022-02-13 at 12 45 36 PM" src="https://user-images.githubusercontent.com/3479421/153772038-08865af4-cdc4-4b56-809a-259a89461595.png">

# Info

Quadratic is a WebGL + WASM React App that runs both in browser and in Electron.

# Development Progress

Quadratic is in ALPHA. We do not recommend relying on Quadratic.

- [x] WebGL Grid (pinch and zoom)
- [x] Python
- [x] Pandas Support
- [ ] Database Connection Support (issue [#35](https://github.com/quadratic-eng/quadratic/issues/35))
- [ ] SQL Support (issue [#34](https://github.com/quadratic-eng/quadratic/issues/34))
- [ ] JS Support

Notice an bug? Submit a Github Issue!

# Getting Started

## Online Demo

https://early.quadratic.to

## Locally

Install Dependencies

```bash
npm install
```

Run Electron

```bash
npm run dev
```

Run Web

```bash
npm start
```

Deploying on Amplify

Make sure to add all file types to "Rewrites and redirects"

```
</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|ttf|map|json|wasm|data|fnt|tar|py)$)([^.]+$)/>
```

# License
Quadratic is licensed under the Elastic License 2.0 (ELv2).
