
<p align="center">
  <a href="https://github.com/ProjectPudim/pudim-bot">
    <img src=".github/assets/pudim-logo.png" alt="Logo do Pudim" width="100" height="100">
  </a>
</p>

<h1 align="center">Pudim</h1>

<p align="center">
  <strong>Um bot multifuncional, de alto desempenho e código aberto para o Fluxer.</strong>
</p>

<p align="center">
  <a href="https://web.fluxer.app/oauth2/authorize?client_id=1562641741457141760&scope=bot&permissions=1099914669142">Convidar o Pudim</a> &middot;
  <a href="https://fluxer.gg/pudim">Servidor de Suporte</a> &middot;
  <a href="https://github.com/ProjectPudim/pudim-bot/blob/main/.github/CONTRIBUTING.md">Contribuir</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Database-MongoDB-47A248.svg" alt="Banco de dados">
  <img src="https://img.shields.io/badge/License-AGPL%20v3.0-blue.svg" alt="Licença">
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6.svg" alt="Linguagem">
</p>

---

## 🍮 Sobre o Pudim

O **Pudim** é um bot multifuncional desenvolvido para o [Fluxer](https://fluxer.com), oferecendo ferramentas de gerenciamento, moderação, automação e entretenimento para comunidades.

Desenvolvido com **TypeScript** e **Bun**, o projeto prioriza desempenho, segurança, organização e extensibilidade, proporcionando uma experiência simples e eficiente.

## 🚀 Começando

Para começar a utilizar o Pudim em sua comunidade:

1. [Convide o Pudim](https://web.fluxer.app/oauth2/authorize?client_id=1562641741457141760&scope=bot&permissions=1099914669142) para seu servidor.
2. Conceda as permissões necessárias para os recursos que deseja utilizar.
3. Utilize `p.help` para visualizar os comandos disponíveis.
4. Configure os sistemas de acordo com as necessidades da sua comunidade.

> **Nota:** o prefixo padrão é `p.`, podendo ser personalizado por servidor.

## 📚 Comandos

O Pudim oferece comandos organizados em categorias para facilitar sua utilização.

| Categoria | Descrição |
| --- | --- |
| **Configurações** | Personalize e configure os sistemas do bot. |
| **Moderação** | Ferramentas para auxiliar no gerenciamento da comunidade. |
| **Utilidades** | Consulte informações sobre usuários, canais e servidores. |
| **Diversão** | Comandos interativos para entretenimento. |

Entre os sistemas disponíveis estão **Tickets**, **Sorteios**, **AutoReaction**, **Reaction Roles** e **AutoRole**.

Para consultar todos os comandos e suas respectivas funcionalidades, utilize `p.help`.

## 🖥️ Hospedagem Própria (Self-Hosted)

O código-fonte do Pudim é disponibilizado sob a licença **GNU AGPL v3.0**, permitindo que desenvolvedores estudem, modifiquem e executem suas próprias instâncias, respeitando os termos da licença.

### 📋 Pré-requisitos

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)
- Uma instância do MongoDB.
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

Configure as variáveis necessárias para executar o bot, incluindo as credenciais da aplicação e a conexão com o banco de dados.

Utilize os arquivos `.env.example` como referência, caso estejam disponíveis.

**4. Inicie o bot:**

```bash
bun run dev:bot
```

> **Importante:** o comando de inicialização considera a estrutura planejada com Bun Workspaces. Consulte os scripts do `package.json` para verificar os comandos disponíveis.

## 🤝 Contribuindo

Contribuições são bem-vindas! Você pode ajudar o Pudim melhorando o código, corrigindo problemas, otimizando funcionalidades ou aprimorando a documentação.

Antes de enviar um Pull Request, leia nosso [Guia de Contribuição](.github/CONTRIBUTING.md).

Para **reportar bugs ou sugerir novas funcionalidades**, utilize exclusivamente a [comunidade oficial do Pudim](https://fluxer.gg/pudim) no Fluxer.

## 📜 Licença

O Pudim é distribuído sob a licença **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Você pode utilizar, estudar, modificar e redistribuir o código conforme as condições estabelecidas pela licença.

Consulte o arquivo [LICENSE](LICENSE) para mais informações.

---

<p align="center">
  Feito com ❤️ para a comunidade Fluxer.
</p>
