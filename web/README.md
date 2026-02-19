# RedeVC – Website (Next.js)

Aplicação web da RedeVC construída com Next.js 16 (app router) e React 19. Usa HeroUI, Framer Motion e Tailwind 4 para UI, além de better-auth no cliente para autenticação.

## Requisitos
- Node 20+
- PNPM 10+
- API da RedeVC rodando e acessível (`NEXT_PUBLIC_API_URL`).

## Variáveis de ambiente
Crie `web/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:3333
NEXT_PUBLIC_WEB_URL=http://localhost:5117
```
`NEXT_PUBLIC_WEB_URL` é usado em metadata e callback de login.

## Scripts
- `pnpm --filter @redevc/website dev` — Next dev (padrão porta 5117).
- `pnpm --filter @redevc/website build` — build de produção.
- `pnpm --filter @redevc/website start` — serve o build.
- `pnpm --filter @redevc/website lint` — eslint.

## Principais rotas/fluxos
- `/` — Home com manchete, feed por tags, paginação incremental e destaques.
- `/news/[slug]` — Leitura da notícia, contagem de views, autor, Markdown renderizado, comentários.
- `/edit/[slug]` — Edição in-line (título, tags, status draft/published, conteúdo Markdown com prévia). Restrito ao autor logado.
- `/dashboard/[id]` — Dashboard:
  - Admin: visão geral + criação rápida de notícias.
  - Usuário: edição de perfil.

## Componentes-chave
- Navbar (`src/components/UI/Navbar.tsx`): ticker de destaques, busca global (`useNewsSearch` → `/news/search`), progress de leitura.
- `UserStatus` (`src/components/UI/user/UserStatus`): login/signup via better-auth.
- `EditNewsProvider` (`src/lib/edit-news-context.tsx`): gestão de rascunho, dirty state, salvamento, toast.
- `SaveBubble`: atalho de salvar (Ctrl/Cmd+S) e status de persistência.
- `Comments`: atualmente salva em `localStorage`; rota proxy `/api/comments` pronta para conectar à API.
- Markdown: `MarkdownContent` suporta callouts `[!NOTE]`, embeds YouTube com `@youtube <url>` e áudio com `@audio <assetId> | <título opcional>`.
- Editor: telas de criação/edição possuem upload de áudio chunked, com conversão assíncrona para MP3 e inserção automática do token `@audio`.

## Arquitetura (resumo)
- `src/app/` — rotas Next (app router).
- `src/lib/` — clientes de API (`api/news.ts`, `api/users.ts`), auth, providers, hooks de busca.
- `src/components/` — UI, Markdown, comentários, barras de navegação, etc.
- `src/utils/roles.ts` — checagem de roles no cliente.

## Desenvolvimento
1) API rodando (`http://localhost:3333`).  
2) `pnpm --filter @redevc/website dev -- --port 5117`  
3) Acesse `http://localhost:5117`.

## Produção
```bash
pnpm --filter @redevc/website build
pnpm --filter @redevc/website start -- --port 5117
```

## Observações
- Certifique-se de que `NEXT_PUBLIC_API_URL` aponte para a API com CORS liberado para `WEB_URL/WEB_DEV_URL`.
- Recursos Electron: `WindowHeader` integra-se via `windowControls` exposto pelo preload do app desktop.
