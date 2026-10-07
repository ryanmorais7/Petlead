# PetLead

CRM de vendas para atendimento via WhatsApp. Organiza as conversas, resume cada
cliente e responde a uma pergunta ao abrir o sistema: **quem eu deveria chamar hoje?**

Nenhuma mensagem é enviada a um cliente sem a aprovação do vendedor.

## Estado atual

As telas leem e gravam no banco de dados:

- **Hoje** (`/`): indicadores e a fila do dia por prioridade, com as ações de adiar,
  marcar como fechado e não contatar.
- **Conversas** (`/inbox`): lista, histórico e painel com resumo e mensagem sugerida.
- **Leads** (`/leads`): lista com busca e filtros, e cadastro manual em `/leads/novo`.
- **Perfil do lead** (`/leads/[id]`): dados, resumo, mensagens, follow-ups, venda e histórico.

Ainda não conectados: WhatsApp Business Platform, geração de mensagens e login.
Enquanto não há login, o sistema assume um único vendedor (o primeiro usuário do banco).

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Drizzle ORM · Neon PostgreSQL · Zod

## Como executar

Requer Node.js 20.9 ou superior.

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL
npm run db:migrate           # cria as tabelas
npm run db:seed              # cria o vendedor e os leads de demonstração
npm run dev
```

Abra http://localhost:3000.

Os leads de demonstração são fictícios e têm ids fixos. `npm run db:seed` os recria com
datas atualizadas e `npm run db:seed:clear` os remove, sem tocar nos leads reais.

## Scripts

| Comando               | O que faz                                         |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Servidor de desenvolvimento                       |
| `npm run build`       | Build de produção                                 |
| `npm run start`       | Executa o build de produção                       |
| `npm run lint`        | ESLint                                            |
| `npm run typecheck`   | Gera os tipos de rotas e roda o TypeScript        |
| `npm run db:generate` | Gera uma migration a partir de `db/schema.ts`     |
| `npm run db:migrate`  | Aplica as migrations no banco de `DATABASE_URL`   |
| `npm run db:studio`   | Abre o Drizzle Studio                             |
| `npm run db:seed`     | Cria o vendedor e recarrega os leads de demonstração |
| `npm run db:seed:clear` | Remove os leads de demonstração                 |

## Variáveis de ambiente

Documentadas em [.env.example](.env.example). Os valores reais ficam em `.env.local`,
que nunca é commitado. Todas são lidas apenas no servidor, por [lib/env.ts](lib/env.ts).

| Variável                                   | Usada para                           | Necessária a partir de |
| ------------------------------------------ | ------------------------------------ | ---------------------- |
| `DATABASE_URL`                             | Conexão com o Neon                   | Conexão do banco       |
| `WHATSAPP_ACCESS_TOKEN`                    | Envio de mensagens pela Cloud API    | Integração WhatsApp    |
| `WHATSAPP_PHONE_NUMBER_ID`                 | Número que envia as mensagens        | Integração WhatsApp    |
| `WHATSAPP_BUSINESS_ACCOUNT_ID`             | Conta WhatsApp Business              | Integração WhatsApp    |
| `WHATSAPP_APP_SECRET`                      | Validar a assinatura dos webhooks    | Integração WhatsApp    |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN`            | Verificação do webhook pela Meta     | Integração WhatsApp    |
| `WHATSAPP_GRAPH_API_VERSION`               | Versão da Graph API                  | Integração WhatsApp    |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`    | Geração de resumos e mensagens       | Geração de mensagens   |
| `AUTH_SECRET`                              | Assinatura da sessão                 | Autenticação           |

## Banco de dados

O schema está em [db/schema.ts](db/schema.ts) e as migrations em `db/migrations`.
Para criar as tabelas em um banco Neon:

1. Crie o banco no Neon e copie a connection string *pooled*.
2. Preencha `DATABASE_URL` em `.env.local`.
3. Rode `npm run db:migrate`.

Ao alterar o schema, rode `npm run db:generate` e depois `npm run db:migrate`.

## Estrutura

```
app/
  (app)/              Telas autenticadas (dashboard, inbox, leads)
components/
  ui/                 Componentes base (botão, badge, card...)
  layout/             Navegação e moldura das páginas
  dashboard/ inbox/ leads/ conversation/
db/
  schema.ts           Tabelas, enums e relações
  migrations/         SQL gerado pelo Drizzle
  seed/               Leads de demonstração
lib/
  domain/             Enums e rótulos, fonte única para banco, validação e UI
  data/               Leituras usadas pelas telas, sempre do vendedor atual
  actions/            Alterações (adiar, fechar, não contatar, novo lead)
  leads/              Política de contato, prioridade da fila e score
  followups/          Configuração da cadência de follow-up
  validations/        Schemas Zod (formulários, API, webhook, análise)
  ai/                 Contrato do provider de sugestões
  auth/               Usuário atual
```

## Regras que o código garante

- **Aprovação obrigatória**: sugestões nascem com `approved = false` e o schema de envio
  exige `approved: true` vindo da tela do vendedor.
- **Não insistir**: um lead com `DO_NOT_CONTACT` nunca entra na fila, não recebe sugestão
  nem follow-up. A regra está em [lib/leads/contact-policy.ts](lib/leads/contact-policy.ts).
- **Score é recomendação**: ordena a fila, mas nunca dispara envio.
- **Idempotência**: `messages.whatsapp_message_id` é único, para que um webhook
  reenviado não duplique mensagens.
