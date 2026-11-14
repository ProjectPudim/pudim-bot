<p align="center">
  <a href="https://github.com/ProjectPudim/pudim-bot">
    <img src=".github/assets/pudim-logo.png" alt="Logo do Pudim" width="100" height="100">
  </a>
</p>

<h1 align="center">Pudim</h1>

<p align="center">
  <strong>Um bot para o Fluxer, organizado em monorepo com Bun Workspaces.</strong>
</p>

<p align="center">
  <a href="https://web.fluxer.app/oauth2/authorize?client_id=1562641741457141760&scope=bot&permissions=1099914669142">Convidar o Pudim</a> &middot;
  <a href="https://fluxer.gg/pudim">Servidor de Suporte</a> &middot;
  <a href="https://github.com/ProjectPudim/pudim-bot/blob/main/.github/CONTRIBUTING.md">Contribuir</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Database-MongoDB-47A248.svg" alt="Banco de dados">
  <img src="https://img.shields.io/badge/Cache-Valkey%2FRedis-DC382D.svg" alt="Cache">
  <img src="https://img.shields.io/badge/License-AGPL%20v3.0-blue.svg" alt="Licença">
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6.svg" alt="Linguagem">
</p>

---

## 🍮 Sobre o Pudim

O **Pudim** é um bot desenvolvido para o [Fluxer](https://fluxer.com), organizado como um monorepo em TypeScript com Bun Workspaces. O projeto separa a aplicação do bot dos pacotes compartilhados, priorizando tipagem estrita, organização e reutilização de código.

## 🚀 Começando

Para começar a utilizar o Pudim em sua comunidade:

1. [Convide o Pudim](https://web.fluxer.app/oauth2/authorize?client_id=1562641741457141760&scope=bot&permissions=1099914669142) para seu servidor.
2. Conceda as permissões necessárias para os recursos que deseja utilizar.
3. Utilize `p.help` para visualizar os comandos disponíveis.

> **Nota:** o prefixo padrão é `p.`.

## 📚 Comandos

Os comandos disponíveis atualmente estão organizados na categoria de utilidades, incluindo `help` e `ping`. Utilize `p.help` para consultar a lista completa e suas descrições.

## 🖥️ Hospedagem Própria (Self-Hosted)

O código-fonte do Pudim é disponibilizado sob a licença **GNU AGPL v3.0**, permitindo que desenvolvedores estudem, modifiquem e executem suas próprias instâncias, respeitando os termos da licença.

### 📋 Pré-requisitos

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)
- Uma instância do MongoDB.
- Uma instância do Valkey/Redis.
- Credenciais de uma aplicação de bot no Fluxer.

### 📦 Instalação

**1. Clone o repositório:**

```bash
git clone https://github.com/ProjectPudim/pudim-bot.git
cd pudim-bot
```

**2. Instale as dependências:**

```bash
bun install
```

**3. Configure as variáveis de ambiente:**

Crie o arquivo `apps/bot/.env` com as variáveis necessárias:

```env
BOT_TOKEN=...
MONGODB_URI=...
VALKEY_URL=...
```

**4. Inicie o bot:**

```bash
bun run dev:bot
```

Outros comandos úteis:

```bash
bun run dev
bun run typecheck
bun run lint
bun run format
bun run format:check
```

## 📁 Estrutura do projeto

```text
pudim/
├── apps/
│   └── bot/
├── packages/
│   ├── cache/
│   ├── config/
│   ├── database/
│   ├── framework/
│   ├── i18n/
│   └── shared/
├── .github/
├── eslint.config.js
├── prettier.config.js
├── tsconfig.json
└── package.json
```

- **apps/bot** — Aplicação do bot.
- **packages/cache** — Integração com cache (Valkey/Redis).
- **packages/config** — Configuração compartilhada do TypeScript.
- **packages/database** — Conexão e modelos do MongoDB.
- **packages/framework** — Framework de comandos, eventos e bootstrap.
- **packages/i18n** — Sistema de internacionalização.
- **packages/shared** — Tipos e utilitários compartilhados.

## 🤝 Contribuindo

Contribuições são bem-vindas! Antes de enviar um Pull Request, leia nosso [Guia de Contribuição](.github/CONTRIBUTING.md).

Para **reportar bugs ou sugerir novas funcionalidades**, utilize exclusivamente a [comunidade oficial do Pudim](https://fluxer.gg/pudim) no Fluxer.

## 📜 Licença

O Pudim é distribuído sob a licença **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Consulte o arquivo [LICENSE](LICENSE) para mais informações.

---

<p align="center">
  Feito com ❤️ para a comunidade Fluxer.
</p>
```<|end|><|start|>assist to=write<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="path">
C:\Users\Miguel\Desktop\projects\pudim\pudim\.github\CONTRIBUTING.md
