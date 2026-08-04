# Aether Mock Hub

A desktop application for managing and serving mock APIs — built with **React**, **Vite**, and **Electron**.

## Tech Stack

- ⚛️ React 19 + TypeScript
- ⚡ Vite 8
- 🖥️ Electron 34
- 🎨 Tailwind CSS v4
- 🐻 Zustand (state management)
- 🧪 Vitest (testing)

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm

### Install dependencies

```bash
npm install
```

### Run in browser (dev mode)

```bash
npm run dev
```

### Run as Electron app

```bash
npm run electron:dev
```

### Build desktop installer (Windows)

```bash
npm run electron:build
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build for production |
| `npm run electron:dev` | Run as Electron desktop app |
| `npm run electron:build` | Build Windows installer (NSIS) |
| `npm run test` | Run tests with Vitest |
| `npm run lint` | Lint with oxlint |

## License

MIT
