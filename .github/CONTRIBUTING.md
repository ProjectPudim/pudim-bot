
# 🤝 Contribuindo com o Pudim

Obrigado pelo interesse em contribuir com o **Pudim**! 🍮

O Pudim é um projeto de código aberto desenvolvido para o [Fluxer](https://fluxer.com). Contribuições que ajudem a melhorar sua qualidade, desempenho, segurança, documentação ou funcionalidades são bem-vindas.

Antes de contribuir, leia as orientações abaixo para mantermos o projeto organizado e consistente.

## 📋 Antes de começar

Antes de enviar uma contribuição:

- Verifique se já existe um Pull Request relacionado à alteração que deseja realizar.
- Para mudanças significativas, discuta sua proposta na [comunidade oficial do Pudim](https://fluxer.gg/pudim).
- Respeite a arquitetura, os padrões de código e as convenções existentes.
- Evite alterações que não estejam relacionadas ao objetivo da contribuição.
- Não adicione dependências externas desnecessárias.
- Nunca compartilhe tokens, credenciais ou informações sensíveis.

> **Importante:** relatos de bugs e sugestões de funcionalidades devem ser enviados exclusivamente pela comunidade oficial do Pudim, e não pelas issues do GitHub.

## 🐛 Reportando bugs

Encontrou algum problema no Pudim? Os relatos de bugs devem ser enviados por meio da nossa **comunidade oficial no Fluxer**.

**[Reportar um Bug — Comunidade do Pudim](https://fluxer.gg/pudim)**

Ao reportar um bug, forneça, sempre que possível:

- **Descrição:** explique claramente o problema encontrado.
- **Passos para reproduzir:** descreva como o erro acontece.
- **Comportamento esperado:** informe qual deveria ser o resultado.
- **Comportamento atual:** explique o que realmente acontece.
- **Evidências:** inclua capturas de tela ou logs, removendo informações sensíveis.

Antes de enviar um relato, verifique se o problema já foi reportado anteriormente.

## 💡 Sugerindo funcionalidades

Tem alguma ideia para melhorar o Pudim? Compartilhe sua sugestão em nossa **comunidade oficial no Fluxer**!

**[Enviar uma Sugestão — Comunidade do Pudim](https://fluxer.gg/pudim)**

Ao enviar uma sugestão, procure explicar:

- **Funcionalidade:** o que você gostaria de adicionar ou melhorar.
- **Objetivo:** qual problema essa funcionalidade resolveria.
- **Funcionamento:** como você imagina que ela deveria funcionar.
- **Benefícios:** como essa mudança ajudaria os usuários.

As sugestões serão avaliadas considerando sua utilidade, viabilidade técnica e alinhamento com os objetivos do projeto.

O envio de uma sugestão não garante sua implementação.

## 🛠️ Ambiente de desenvolvimento

O Pudim utiliza **TypeScript** e **Bun**, com uma arquitetura planejada de monorepo organizada em aplicações e packages compartilhadas.

### 📦 Pré-requisitos

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/)
- Um editor de código, preferencialmente Visual Studio Code.
- Acesso aos serviços necessários para testar as funcionalidades modificadas.

### 🚀 Configuração

**1. Faça um fork do repositório e clone sua cópia:**

```bash
git clone https://github.com/SEU-USUARIO/pudim-bot.git
cd pudim-bot
```

Substitua `SEU-USUARIO` pelo nome da sua conta no GitHub.

**2. Instale as dependências:**

```bash
bun install
```

**3. Configure as variáveis de ambiente:**

Utilize os arquivos `.env.example` disponíveis como referência, quando existirem.

Nunca envie arquivos `.env` contendo credenciais reais para o repositório.

**4. Crie uma branch para sua contribuição:**

```bash
git checkout -b feat/nome-da-funcionalidade
```

## 📁 Organização do projeto

A estrutura planejada do repositório separa as aplicações dos códigos compartilhados:

```text
pudim-bot/
├── apps/
│   ├── bot/
│   ├── api/
│   └── dashboard/
├── packages/
│   ├── core/
│   ├── database/
│   └── shared/
├── .github/
│   └── CONTRIBUTING.md
├── docs/
├── LICENSE
└── README.md
```

- **apps/** — Aplicações independentes do projeto.
- **packages/** — Código reutilizável e compartilhado.
- **.github/** — Workflows, templates e configurações do GitHub.
- **docs/** — Documentação técnica do projeto.

Antes de criar novos módulos, packages ou utilitários, verifique se já existe uma implementação que possa ser reutilizada.

## 📝 Padrões de código

Para manter a consistência e a qualidade do projeto:

- Utilize **TypeScript**, respeitando as configurações de tipagem existentes.
- Siga os padrões de formatação e lint definidos no repositório.
- Prefira soluções simples, legíveis, modulares e reutilizáveis.
- Respeite a arquitetura e a organização de diretórios existentes.
- Utilize funções, managers e utilitários já disponíveis antes de criar novas implementações.
- Evite dependências externas desnecessárias.
- Não introduza alterações incompatíveis sem discussão prévia.
- Utilize nomes de variáveis, funções, argumentos e identificadores em inglês.
- Mantenha as mensagens exibidas aos usuários em **português brasileiro (pt-BR)**, respeitando o sistema de internacionalização existente.
- Evite valores fixos quando já existirem configurações ou constantes apropriadas.
- Não modifique funcionalidades que não estejam relacionadas à contribuição.

## 🧪 Testes e validações

Antes de enviar um Pull Request, execute as verificações de qualidade disponíveis no projeto.

```bash
bun run lint
bun run typecheck
```

Quando existirem testes automatizados relacionados à sua alteração, execute-os também.

Certifique-se de que:

- O código não apresenta erros de tipagem.
- Nenhuma regra de lint foi violada.
- As funcionalidades existentes continuam funcionando corretamente.
- A alteração foi testada nos cenários relevantes.
- Nenhum arquivo temporário, credencial ou código de depuração foi incluído.

Se alguma verificação não puder ser executada, explique o motivo na descrição do Pull Request.

## 🌿 Branches e commits

Utilize nomes claros e descritivos para identificar o objetivo de cada branch.

| Tipo | Exemplo |
| --- | --- |
| Funcionalidade | `feat/ticket-system` |
| Correção | `fix/giveaway-validation` |
| Documentação | `docs/update-readme` |
| Refatoração | `refactor/command-handler` |
| Manutenção | `chore/update-dependencies` |

Para mensagens de commit, recomendamos seguir o padrão [Conventional Commits](https://www.conventionalcommits.org/).

```text
feat: add new utility command
fix: resolve ticket permission issue
docs: improve contributing guide
refactor: simplify database connection
chore: update dependencies
```

Procure manter os commits pequenos, objetivos e relacionados à alteração proposta.

## 🔀 Pull Requests

Contribuições de código devem ser enviadas por meio de **Pull Requests no GitHub**.

**[Acessar Pull Requests — Pudim](https://github.com/ProjectPudim/pudim-bot/pulls)**

Antes de abrir um Pull Request:

1. Certifique-se de que sua alteração está alinhada aos padrões do projeto.
2. Atualize sua branch com as alterações recentes da branch principal.
3. Execute as verificações de qualidade disponíveis.
4. Faça o push das alterações para seu fork.
5. Abra um Pull Request direcionado à branch principal do repositório original.

Na descrição do Pull Request, inclua:

- **Resumo:** descreva o que foi alterado.
- **Motivação:** explique por que a alteração é necessária.
- **Implementação:** apresente brevemente como a solução funciona.
- **Testes:** informe quais verificações foram realizadas.
- **Referências:** mencione discussões relevantes, quando existirem.
- **Capturas de tela:** inclua imagens quando houver alterações visuais.

### 🔍 Revisão de código

Todos os Pull Requests poderão passar por uma revisão antes de serem integrados ao projeto.

Durante a revisão, os mantenedores poderão solicitar melhorias, sugerir alternativas, exigir testes adicionais ou recusar alterações incompatíveis com os objetivos do Pudim.

O envio de um Pull Request não garante sua aprovação ou integração.

## 🔒 Segurança

A segurança do Pudim e de seus usuários é uma prioridade.

Se encontrar uma vulnerabilidade que possa comprometer usuários, comunidades ou informações sensíveis, **não divulgue detalhes exploráveis publicamente**.

Entre em contato de forma privada com a equipe responsável por meio da [comunidade oficial do Pudim](https://fluxer.gg/pudim).

Nunca compartilhe publicamente:

- Tokens de autenticação.
- Chaves de API.
- Credenciais de banco de dados.
- Informações pessoais ou sensíveis.
- Detalhes que facilitem a exploração de vulnerabilidades.

## 📜 Licença

O Pudim é distribuído sob a licença **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Ao contribuir com o projeto, você concorda que suas contribuições sejam disponibilizadas sob os termos da licença aplicável.

Certifique-se de possuir os direitos necessários sobre o código enviado e não inclua conteúdo de terceiros incompatível com a licença.

Consulte o arquivo [LICENSE](../LICENSE) para mais informações.

## 💬 Comunidade

A comunidade oficial do Pudim é o principal espaço para comunicação entre usuários, colaboradores e mantenedores.

Por meio dela, você pode:

- Reportar bugs e problemas.
- Enviar sugestões de funcionalidades.
- Discutir melhorias e propostas.
- Tirar dúvidas relacionadas ao projeto.
- Acompanhar novidades e atualizações.

**[🍮 Participar da Comunidade do Pudim](https://fluxer.gg/pudim)**

---

<p align="center">
  <strong>Obrigado por contribuir para o desenvolvimento do Pudim! 🍮</strong>
</p>
