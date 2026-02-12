# RedeVC – App Electron

Wrapper desktop que carrega o site da RedeVC em uma janela sem moldura, com controles customizados e integração IPC.

## Requisitos
- Node 20+
- PNPM 10+
- Front-end web rodando em `http://localhost:5117` (ou ajuste a URL em `main.js`).

## Scripts
- `pnpm --filter @redevc/electron dev` — inicia o Electron em modo desenvolvimento.
- `pnpm --filter @redevc/electron build` — empacota (targets padrão electron-builder).
- `pnpm --filter @redevc/electron build:linux` — build AppImage para Linux.

## Como rodar em desenvolvimento
1) Suba o site (`pnpm --filter @redevc/website dev -- --port 5117`).  
2) Em outro terminal: `pnpm --filter @redevc/electron dev`.  
3) A janela abrirá com frame removido; os botões de minimizar/maximizar/fechar usam IPC.

## IPC / Window Controls
- Preload (`preload.js`) expõe `windowControls` no `window`:
  - `minimize()`, `maximize()`, `close()`
  - `isMaximized()` retorna estado atual
  - `onMaximizeChange(cb)`, `onFullscreenChange(cb)`
- O front consome via `web/src/components/UI/electron/WindowHeader`.

## Build/Distribuição
- Config em `package.json` (`build.appId`, targets `AppImage`, `nsis`, `dmg`).
- Ajuste ícones/branding conforme necessário antes de distribuir.
