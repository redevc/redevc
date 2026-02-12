# RedeVC Monorepo

Repositório PNPM/Turbo que concentra toda a stack da RedeVC:

- `api/` — API em Elysia (Node) com autenticação better-auth e MongoDB.
- `web/` — Front-end Next.js 16 / React 19 com HeroUI, Framer Motion e Tailwind 4.
- `apps/electron/` — Wrapper desktop (Electron) carregando o site em uma janela sem moldura.

## Requisitos
- Node 20+ (recomendado) e PNPM 10.22.0+ (`corepack enable`).
- MongoDB acessível (Atlas ou local).
- Portas padrão: API `3333`, Web `5117` (configure conforme necessário).

## Instalação
```bash
pnpm install
```

## Variáveis de ambiente (visão geral)
- API: configure `api/.env.development.local` ou `.env.local` (veja `api/README.md`).
- Web: crie `web/.env.local` com `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_WEB_URL`.
- Electron usa as URLs do front (nenhum .env dedicado).

## Comandos principais
- `pnpm dev` — roda `api`, `web` e `electron` em paralelo (via Turbo).
- `pnpm build` — build de todos os workspaces.
- `pnpm start` — inicia serviços após build (API + Web; Electron precisa build separado).

Comandos por workspace:
- API: `pnpm --filter @redevc/api dev|build|start`
- Web: `pnpm --filter @redevc/website dev|build|start|lint`
- Electron: `pnpm --filter @redevc/electron dev|build|build:linux`

## Estrutura
```
.
├── api/                # API (Elysia, better-auth, MongoDB)
├── web/                # Site Next.js (app router)
├── apps/
│   └── electron/       # App desktop
├── package.json        # Scripts root (Turbo)
├── turbo.json          # Config de tarefas
└── pnpm-workspace.yaml # Workspaces
```

## Fluxo de desenvolvimento
1. Configure envs (API + Web).
2. Suba a API: `pnpm --filter @redevc/api dev`.
3. Suba o site: `pnpm --filter @redevc/website dev -- --port 5117`.
4. (Opcional) Suba o Electron: `pnpm --filter @redevc/electron dev`.

## Observações
- Roles e autorização estão descritas em `api/src/utils/roles.ts` e `web/src/utils/roles.ts`.
- Comentários persistentes estão implementados na API; o front ainda usa localStorage — veja nota em `web/src/components/comments/Comments.tsx`.
- OpenAPI é exposto pela API (plugin `@elysiajs/openapi`); confira `api/README.md` para detalhes.
