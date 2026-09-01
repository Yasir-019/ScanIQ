# ScanIQ Community — Third-Party Notices & Licenses

ScanIQ Community incorporates open-source software packages, icons, and components. This document provides attribution and licensing information for all third-party dependencies as required by their respective open-source licenses.

---

## 📦 Runtime Dependencies

| Package | Version | License | Copyright / Authors | Purpose |
| :--- | :---: | :---: | :--- | :--- |
| **React** | `^18.3.1` | **MIT** | Copyright (c) Meta Platforms, Inc. and affiliates. | User interface rendering engine |
| **React DOM** | `^18.3.1` | **MIT** | Copyright (c) Meta Platforms, Inc. and affiliates. | DOM-specific rendering methods |
| **React Router DOM** | `^6.30.1` | **MIT** | Copyright (c) Remix Software Inc. | Client-side routing and navigation |
| **Zustand** | `^5.0.12` | **MIT** | Copyright (c) 2019-2024 Paul Henschel | Client-side reactive state management |
| **Dexie.js** | `^4.4.2` | **Apache-2.0** | Copyright (c) 2016 David Fahlander | IndexedDB wrapper for local OSINT persistence |
| **Dexie React Hooks** | `^4.4.0` | **Apache-2.0** | Copyright (c) 2020 David Fahlander | React hooks for reactive IndexedDB live queries |
| **@zxing/library** | `^0.21.3` | **Apache-2.0** | Copyright (c) 2015 ZXing authors | Multi-format 1D/2D barcode & QR decoding |
| **@zxing/browser** | `^0.1.5` | **Apache-2.0** | Copyright (c) 2018 ZXing authors | Browser camera & video stream capture for ZXing |
| **Radix UI Primitives** | `^1.1.14` | **MIT** | Copyright (c) 2022 WorkOS | Accessible UI primitives (Dialog, Tabs, Tooltip, Switch, Alert) |
| **Lucide React** | `^0.462.0` | **ISC** | Copyright (c) 2020 lucide-react contributors | Vector UI icons |
| **Framer Motion** | `^12.38.0` | **MIT** | Copyright (c) 2018 Framer B.V. | Motion and micro-interaction animations |
| **Tailwind CSS** | `^3.4.17` | **MIT** | Copyright (c) Tailwind Labs, Inc. | Utility-first styling framework |
| **Tailwind-Merge** | `^2.6.0` | **MIT** | Copyright (c) 2023 Dany Keys | Conflict-free Tailwind class resolution |
| **clsx** | `^2.1.1` | **MIT** | Copyright (c) Luke Edwards | Conditional class names utility |
| **Class Variance Authority** | `^0.7.1` | **MIT** | Copyright (c) 2022 Joe Bell | Component styling variant manager |
| **i18next** | `^26.0.8` | **MIT** | Copyright (c) 2024 i18next Community | Internationalization framework |
| **react-i18next** | `^17.0.6` | **MIT** | Copyright (c) 2024 i18next Community | React bindings for i18next |
| **i18next Browser Detector** | `^8.2.1` | **MIT** | Copyright (c) 2024 i18next Community | Browser language auto-detection |
| **Sonner** | `^1.7.4` | **MIT** | Copyright (c) 2023 Emil Kowalski | Accessible toast notifications |

---

## 🛠️ Build & Test Dependencies

| Package | License | Author / Organization | Purpose |
| :--- | :---: | :--- | :--- |
| **Vite** | **MIT** | Copyright (c) 2019-present Yuxi (Evan) You & Vite Contributors | Production bundler & dev server |
| **TypeScript** | **Apache-2.0** | Copyright (c) Microsoft Corporation | Static type checking and compiler |
| **Vitest** | **MIT** | Copyright (c) 2021-present Anthony Fu, Matias Capeletto | Automated test runner |
| **ESLint** | **MIT** | Copyright (c) OpenJS Foundation and ESLint contributors | Linter & static code analysis |
| **Testing Library** | **MIT** | Copyright (c) 2018 Kent C. Dodds | React component testing harness |
| **Autoprefixer / PostCSS** | **MIT** | Copyright (c) Andrey Sitnik | CSS vendor prefixing & transformations |

---

## 🎨 Fonts & Assets

* **UI Typography**: Uses the operating system's native modern sans-serif font stack (Apple SF Pro, Segoe UI, Roboto, Ubuntu, Inter system fallback). No external web font files are loaded from third-party CDNs.
* **Vector Icons**: Lucide React icons licensed under the ISC License.
* **Logos & Brand Graphics**: Original SVG & PNG assets created for the ScanIQ Community project, licensed under the GNU General Public License v3.0 or later (GPL-3.0-or-later).

---

## 📄 License Texts

### MIT License
```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache License, Version 2.0
```text
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### ISC License
```text
Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
