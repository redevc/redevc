# RedeVC – API (Elysia)

API REST da RedeVC, escrita em TypeScript com [Elysia](https://elysiajs.com/) e autenticação via [better-auth](https://better-auth.dev/). Usa MongoDB como persistência e expõe documentação OpenAPI.

## Requisitos
- Node 20+
- PNPM 10+
- MongoDB (URI `mongodb+srv://...` ou instância local)

## Variáveis de ambiente
Crie `api/.env.development.local` para desenvolvimento (ou `.env.local` para produção). Base em `api/.env.example`.

| Variável | Descrição |
|----------|-----------|
| `BETTER_AUTH_SECRET` | Chave de 32 chars para sessões do better-auth. |
| `BETTER_AUTH_URL` | URL base pública da API (ex.: `http://localhost:3333`). |
| `BETTER_AUTH_DOMAIN` | Domínio para cookies cross-subdomain (opcional). |
| `DEFAULT_PORT` | Porta da API (padrão `3333`). |
| `WEB_APP_URL` | URL do app web em produção. |
| `WEB_DEV_URL` | URL do app web em dev (ex.: `http://localhost:5117`). |
| `WEB_URL` | URL pública do site. |
| `MONGODB_URI` | String de conexão MongoDB. |
| `MONGODB_DB_NAME` | Nome do banco (ex.: `api`). |

## Scripts
- `pnpm --filter @redevc/api dev` — modo watch (tsx).
- `pnpm --filter @redevc/api build` — transpila para `dist/`.
- `pnpm --filter @redevc/api start` — executa build em produção.

## Endpoints principais (resumo)
- `GET /` — health-check.
- `GET /about` — metadados da API.
- `GET /auth/*` — rotas better-auth (signup/signin/etc).
- `GET /me` — perfil do usuário autenticado.
- `GET /users/:id` — dados públicos (nome, username, imagem, role).
- `PATCH /users/:id` — atualiza nome/username/imagem (próprio usuário ou admin).
- `POST /news` — cria notícia (publishers: owner/admin/developer/editor).
- `GET /news` — lista notícias (filtros: `status`, `tag`, `authorId`, `featuredOnly`, `page`, `limit`).
- `GET /news/search` — busca full-text (título/descrição/tags).
- `GET /news/slug/:slug` / `GET /news/:id` — obtém notícia (rascunhos só para autor).
- `PUT /news/:id` — atualiza notícia (autor ou publisher).
- `DELETE /news/:id` — remove notícia (autor ou publisher).
- `POST /news/slug/:slug/view` — incrementa visualizações.

## Autorização e roles
Roles possíveis: `owner`, `admin`, `developer`, `editor`, `user` (`api/src/utils/roles.ts`).  
Criação/edição/remoção de notícias: `owner/admin/developer/editor` (publishers).  
Rascunhos só podem ser lidos/alterados pelo autor autenticado (ou publisher em casos específicos).

## Arquitetura
- Entrada: `src/server.ts` (Elysia + CORS + OpenAPI + better-auth).
- Config: `src/config/env.ts` (Zod), `src/config/auth.ts` (better-auth), `src/config/package.ts`.
- Rotas: `src/http/routes/` (`news`, `users`, `user` (/me), `about`, `index`).
- Schemas: `src/http/schemas/news.ts` (Zod).
- Banco: `src/database/collections/news.ts`, `comments.ts`, `client.ts`.
- Utilidades: `src/utils/slugify.ts`, `snowflake.ts`, `logger.ts`, `roles.ts`.

## OpenAPI
O plugin `@elysiajs/openapi` gera a documentação automaticamente com base nos schemas Zod e nas rotas do better-auth. A rota exata é exibida no log ao iniciar a API (procure por `OpenAPI`), normalmente em `http://localhost:3333/swagger` ou caminho padrão do plugin.

## Desenvolvimento
1) Configure `.env.development.local`.  
2) Inicie MongoDB e, em outro terminal, execute:
```bash
pnpm --filter @redevc/api dev
```
3) A API sobe em `DEFAULT_PORT` (padrão 3333).

## Produção
```bash
pnpm --filter @redevc/api build
pnpm --filter @redevc/api start
```

## Notas
- Não há seeds; crie o primeiro usuário via better-auth signup e atribua role manualmente no banco, se necessário.
- Índices do Mongo são criados automaticamente em `ensureNewsIndexes`/`ensureCommentsIndexes`.
