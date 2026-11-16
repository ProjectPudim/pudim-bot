# Infraestrutura Docker do Pudim

Este diretório centraliza a infraestrutura compartilhada do monorepo Pudim.

O desenvolvimento cotidiano não exige Docker para as aplicações. O Bun executa o bot e as futuras aplicações diretamente no terminal do VS Code. O Docker fornece MongoDB, Valkey e permite validar imagens de produção.

## Arquitetura

```text
docker/
├── compose.yaml
├── .env.example
├── mongodb/
│   ├── init/
│   │   └── 01-create-users.js
│   └── backup/
│       ├── Dockerfile
│       ├── package.json
│       └── src/
├── valkey/
│   └── valkey.conf
└── README.md
```

As aplicações ficam em `apps/` e possuem Dockerfiles próprios. As packages compartilhadas ficam em `packages/`.

## Bun Workspaces

O monorepo utiliza Bun Workspaces:

```bash
bun install
bun run dev:bot
bun run start:bot
```

Não utilize npm, yarn ou pnpm.

## Desenvolvimento pelo VS Code

Fluxo recomendado:

```bash
bun install
bun run infra:up
bun run dev:bot
```

O bot executa no terminal do VS Code com hot reload nativo do Bun. MongoDB e Valkey continuam no Docker Desktop.

## Desenvolvimento com Docker

Para validar o ambiente completo:

```bash
bun run docker:build
bun run docker:up
bun run docker:logs
```

Para parar:

```bash
bun run docker:down
```

## Modo híbrido

Este é o fluxo principal:

Terminal 1:

```bash
bun run infra:up
```

Terminal 2:

```bash
bun run dev:bot
```

As alterações no código reiniciam apenas o processo do bot. MongoDB e Valkey não são reiniciados e seus volumes são preservados.

## Scripts do package.json

Scripts da raiz:

| Script         | Função                                 |
| -------------- | -------------------------------------- |
| `dev:bot`      | Inicia o bot com hot reload            |
| `start:bot`    | Inicia o bot sem watch                 |
| `infra:up`     | Inicia MongoDB e Valkey                |
| `infra:down`   | Para MongoDB e Valkey sem apagar dados |
| `infra:logs`   | Logs da infraestrutura                 |
| `docker:up`    | Inicia os serviços Docker configurados |
| `docker:down`  | Para containers sem apagar volumes     |
| `docker:build` | Constrói as imagens                    |
| `docker:logs`  | Logs dos containers                    |
| `lint`         | Executa lint                           |
| `typecheck`    | Verificação TypeScript                 |
| `format`       | Formata código                         |
| `format:check` | Verifica formatação                    |

## Hot reload

O modo terminal utiliza `bun --watch`. Alterações em TypeScript reiniciam o processo. MongoDB e Valkey permanecem ativos.

## Configuração de ambiente

Copie os exemplos:

```bash
cp docker/.env.example docker/.env
cp apps/bot/.env.example apps/bot/.env
```

No terminal do Windows, utilize `127.0.0.1`. Dentro do Docker, utilize os nomes dos serviços, como `mongodb` e `valkey`.

Nunca versione arquivos `.env` reais.

## MongoDB

MongoDB roda autenticado, com usuário root apenas para inicialização e usuários de aplicação com privilégios mínimos.

Dados persistem em `mongodb_data`.

Porta local restrita a `127.0.0.1`.

## Valkey

Valkey roda autenticado, com limite de memória e política de eviction `allkeys-lru`.

Persistência configurável via AOF e RDB.

Porta local restrita a `127.0.0.1`.

Não há backups automáticos do Valkey.

## RedisClient nativo do Bun

A package `@pudim/cache` utiliza `Bun.RedisClient`. A API pública preserva `connectRedis`, `disconnectRedis`, `getRedis`, `createRedisSubscriber`, além de GET, SET, DEL, TTL e Pub/Sub.

## Backups automáticos do MongoDB

O serviço `mongodb-backup` executa `mongodump` periodicamente, criptografa com AES-256-GCM, calcula SHA-256, aplica retenção e envia ao Fluxer quando configurado.

Frequência padrão: 1 hora. Retenção padrão: 7 dias.

O agendador é independente do bot.

## Envio para Fluxer

Configure:

```dotenv
MONGODB_BACKUP_WEBHOOK_URL=
```

O envio utiliza `multipart/form-data` com o arquivo criptografado anexado e uma mensagem em embed quando suportado.

Rate limits e `Retry-After` são respeitados com backoff exponencial.

## Criptografia

Configure:

```dotenv
MONGODB_BACKUP_ENCRYPTION_KEY=
```

A chave deve ser Base64 de 32 bytes gerados por CSPRNG. Backups não são enviados sem criptografia.

Formato versionado: magic `PDBK`, versão, nonce de 12 bytes, tag de 16 bytes e ciphertext.

## Restauração

Use o script de restauração do serviço de backup:

```bash
MONGODB_BACKUP_ENCRYPTION_KEY=... bun docker/mongodb/backup/src/restore.ts --file ./backup.enc --uri mongodb://... --expected-sha256 <hash> --yes
```

Nunca restaure automaticamente em produção.

## Retenção

Arquivos locais mais antigos que o período configurado são removidos. Arquivos incompletos não são considerados válidos.

## Scripts adicionais

- `backup:up`: inicia apenas o serviço de backup.
- `backup:down`: para o serviço de backup.
- `backup:logs`: exibe logs do backup.

## GitHub Actions

O workflow `ci.yml` executa lint, typecheck e format check.

O workflow `docker.yml` constrói e publica imagens no GHCR para `linux/amd64`.

Pushes na `main` publicam `latest`. Pull requests apenas constroem. Tags de release publicam versões.

## Hospedagem na Altare

Prepare serviços independentes para bot, MongoDB, Valkey e backup. Configure `MONGODB_URI` e `VALKEY_URL` com endpoints externos. Para Valkey gerenciado com TLS, utilize `rediss://`. Não exponha MongoDB ou Valkey publicamente.

## Hospedagem na Altare

Prepare Dockerfiles independentes. A Altare pode executar aplicações Docker, volumes persistentes, secrets e serviços auxiliares. Verifique limites de recursos e agendamentos na documentação oficial antes do deploy.

## Adição de novas aplicações

Crie a aplicação em `apps/<nome>`, adicione scripts próprios, Dockerfile próprio e entradas no Compose quando necessário. Não crie scripts na raiz para aplicações inexistentes.

## Diagnóstico de problemas

- Verifique `.env`.
- Verifique logs: `bun run infra:logs`.
- Verifique healthchecks: `docker compose -f docker/compose.yaml ps`.
- Verifique conectividade com `127.0.0.1` no terminal e nomes de serviço no Docker.
- Não exponha MongoDB ou Valkey publicamente.
