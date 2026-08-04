<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:302b63,100:24243e&height=200&section=header&text=Aether%20Mock%20Hub&fontSize=52&fontColor=ffffff&fontAlignY=38&desc=Mock%20Tests.%20Reimagined.&descAlignY=60&descSize=18&animation=fadeIn" width="100%"/>
</p>

<p align="center">
  <a href="https://github.com/random1619/Aether-Mock-Hub">
    <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=22&duration=3000&pause=800&color=A78BFA&center=true&vCenter=true&multiline=false&width=600&lines=Desktop+Mock+Test+Platform;Built+with+React+%2B+Electron;Blazing+Fast+%E2%80%A2+Offline+Ready;Exam-Grade+Integrity+Engine" alt="Typing SVG" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-A78BFA?style=for-the-badge&logo=github&logoColor=white" />
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?style=for-the-badge&logo=windows&logoColor=white" />
  <img src="https://img.shields.io/badge/electron-34.0.0-47848F?style=for-the-badge&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/license-MIT-22c55e?style=for-the-badge" />
</p>

<br/>

---

## ✨ What is Aether Mock Hub?

> **Aether Mock Hub** is a **desktop-first** mock test platform for competitive exam preparation — featuring an offline-ready exam engine, real-time analytics, smart revision, and a beautiful Netflix-style UI.

<br/>

## 🚀 Feature Highlights

<table>
  <tr>
    <td align="center" width="33%">
      <h3>🎯 Exam Engine</h3>
      <p>Full-screen proctored exam mode with violation detection, section timers, and question palette</p>
    </td>
    <td align="center" width="33%">
      <h3>📊 Smart Analytics</h3>
      <p>Section-wise accuracy rings, weak area detection, and attempt history tracking</p>
    </td>
    <td align="center" width="33%">
      <h3>🔔 Alarm System</h3>
      <p>Schedule mock tests with custom alarms — never miss a practice session</p>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <h3>🗂️ Multi-Provider</h3>
      <p>Oliveboard, Mocks360, Pundits, The Solver, English Madhyam & more — all in one place</p>
    </td>
    <td align="center" width="33%">
      <h3>🔖 Saved Questions</h3>
      <p>Bookmark questions for smart revision — powered by spaced-repetition logic</p>
    </td>
    <td align="center" width="33%">
      <h3>⚡ Offline First</h3>
      <p>All data stored locally via IndexedDB — works without internet once loaded</p>
    </td>
  </tr>
</table>

<br/>

---

## 🛠️ Tech Stack

<p align="center">
  <img src="https://skillicons.dev/icons?i=react,ts,vite,tailwind,electron&theme=dark&perline=5" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Electron-34-47848F?style=flat-square&logo=electron&logoColor=white" />
  <img src="https://img.shields.io/badge/Zustand-5-FF6B35?style=flat-square" />
  <img src="https://img.shields.io/badge/Framer_Motion-12-FF0055?style=flat-square&logo=framer&logoColor=white" />
  <img src="https://img.shields.io/badge/GSAP-3-88CE02?style=flat-square" />
  <img src="https://img.shields.io/badge/Recharts-3-22C55E?style=flat-square" />
  <img src="https://img.shields.io/badge/Vitest-4-6E9F18?style=flat-square&logo=vitest&logoColor=white" />
</p>

<br/>

---

## ⚙️ Getting Started

### Prerequisites

```
Node.js ≥ 18    npm ≥ 9    Windows 10/11
```

### 📦 Install

```bash
git clone https://github.com/random1619/Aether-Mock-Hub.git
cd Aether-Mock-Hub
npm install
```

### 🧪 Run in Browser

```bash
npm run dev
```

### 🖥️ Run as Desktop App

```bash
npm run electron:dev
```

### 📦 Build Windows Installer

```bash
npm run electron:build
# Output → dist-installer/
```

<br/>

---

## 📜 Available Scripts

| Command | Description |
|:---|:---|
| `npm run dev` | Start Vite dev server in browser |
| `npm run build` | Production build |
| `npm run electron:dev` | Launch as Electron desktop app |
| `npm run electron:build` | Build NSIS Windows installer |
| `npm run test` | Run all tests with Vitest |
| `npm run lint` | Lint codebase with oxlint |

<br/>

---

## 🗂️ Project Structure

```
Aether-Mock-Hub/
├── electron/          # Main & preload processes
├── src/
│   ├── components/    # UI components (dashboard, exam, layout, ui)
│   ├── pages/         # Route-level pages + provider pages
│   ├── services/      # Business logic (parsers, stores, analytics)
│   ├── stores/        # Zustand global state
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utilities (scoring, integrity, exam links)
│   └── styles/        # CSS (theme, content, locomotive)
├── scripts/           # Build/extract scripts
└── spa-public/        # Static SPA fallback
```

<br/>

---

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=0:24243e,50:302b63,100:0f0c29&height=120&section=footer&animation=fadeIn" width="100%"/>
</p>

<p align="center">
  <sub>Built with 💜 · <a href="https://github.com/random1619/Aether-Mock-Hub">Aether Mock Hub</a></sub>
</p>
