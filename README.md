# Pudim

Bot mínimo para o Fluxer, organizado em monorepo com Bun Workspaces.

## Estrutura

```text
pudim/
├── apps/
│   └── bot/
├── packages/
│   ├── cache/
│   ├── config/
│   ├── database/
│   ├── i18n/
│   └── shared/
├── .github/
├── eslint.config.js
├── prettier.config.js
├── tsconfig.json
└── package.json
```

- **apps/bot** — Aplicação do bot.
- **packages/cache** — Conexão e utilitários de cache (Valkey/Redis).
- **packages/config** — Configuração compartilhada do TypeScript.
- **packages/database** — Conexão com MongoDB.
- **packages/i18n** — Sistema de internacionalização.
- **packages/shared** — Logger compartilhado.

## Pré-requisitos

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)
- Uma instância do MongoDB.
- Uma instância do Valkey/Redis.
- Credenciais de uma aplicação de bot no Fluxer.

## Instalação

1. Clone o repositório:

```bash
git clone https://github.com/ProjectPudim/pudim-bot.git
cd pudim-bot
```

2. Instale as dependências:

```bash
bun install
```

3. Configure as variáveis de ambiente em `apps/bot/.env`:

```env
NODE_ENV=development
BOT_TOKEN=
MONGODB_URI=mongodb://pudim_app:change-me-app@127.0.0.1:27017/pudim?authSource=pudim
VALKEY_URL=redis://:change-me-valkey@127.0.0.1:6379
```

4. Inicie o bot:

```bash
bun run dev:bot
```

Outros comandos úteis:

```bash
bun run typecheck
bun run lint
bun run format
bun run format:check
```

## Variáveis de ambiente

- `NODE_ENV` — Ambiente de execução (`development` ou `production`).
- `BOT_TOKEN` — Token do bot no Fluxer.
- `MONGODB_URI` — URI de conexão com o MongoDB.
- `VALKEY_URL` — URL de conexão com o Valkey/Redis.

## Licença

O Pudim é distribuído sob a licença **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Consulte o arquivo [LICENSE](LICENSE) para mais informações.
