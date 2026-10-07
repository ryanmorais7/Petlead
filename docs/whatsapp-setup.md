# Conectando o WhatsApp

O PetLead usa a **WhatsApp Business Platform (Cloud API)**, a integração oficial da Meta.
Toda a parte técnica já está pronta e testada. Falta apenas conectar um número real e
preencher as credenciais.

Enquanto as variáveis não existirem, o sistema funciona normalmente: o envio fica
desabilitado e a tela de conversas mostra "WhatsApp ainda não conectado".

## O que já está pronto

| Peça | Onde |
| --- | --- |
| Webhook (verificação e recebimento) | `app/api/whatsapp/webhook/route.ts` |
| Validação da assinatura, processamento e registro dos eventos | `lib/whatsapp/webhook.ts` |
| Mensagens recebidas (cria lead e conversa, sem duplicar) | `lib/whatsapp/inbound.ts` |
| Confirmações de enviada, entregue, lida e falhou | `lib/whatsapp/statuses.ts` |
| Envio de texto | `lib/whatsapp/client.ts`, `lib/whatsapp/send-message.ts` |
| Regras de envio (dono do lead, não contatar, janela de 24h) | `lib/whatsapp/send-lead-message.ts` |
| Janela de atendimento de 24 horas | `lib/whatsapp/conversation-window.ts` |
| Campo de resposta e "Aprovar e enviar" na tela de conversas | `components/inbox/` |

## Variáveis de ambiente

Preencha em **Vercel → projeto petlead → Settings → Environment Variables** (produção) e em
`.env.local` (seu computador). Depois de alterar na Vercel, faça um novo deploy.

| Variável | Para que serve | Onde encontrar |
| --- | --- | --- |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Confirma para a Meta que a URL é sua | Você inventa. Já existe um valor gerado no seu `.env.local` |
| `WHATSAPP_APP_SECRET` | Prova que cada webhook veio da Meta | App → **Configurações do app → Básico → Chave secreta do app** |
| `WHATSAPP_ACCESS_TOKEN` | Autoriza o envio de mensagens | Usuário de sistema no Gerenciador de Negócios (passo 4) |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifica o número que envia | App → **WhatsApp → Configuração da API → Identificação do número de telefone** |
| `WHATSAPP_GRAPH_API_VERSION` | Versão da API usada no envio | A versão exibida nos exemplos do painel, ex.: `v23.0` |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Referência da conta | App → **WhatsApp → Configuração da API**. Ainda não é usado pelo código |

Recebimento depende das duas primeiras. Envio depende de `WHATSAPP_ACCESS_TOKEN` e
`WHATSAPP_PHONE_NUMBER_ID`. Se `WHATSAPP_GRAPH_API_VERSION` ficar vazia, o sistema usa
`v23.0`; como a Meta aposenta versões antigas, prefira informar a versão atual.

Nenhuma dessas variáveis chega ao navegador. Nunca as cole em chats nem as envie ao Git.

## Passo a passo quando o chip estiver disponível

Os nomes dos menus podem mudar um pouco conforme a Meta atualiza o painel.

### 1. Criar o app

1. Acesse [developers.facebook.com](https://developers.facebook.com) → **Meus apps → Criar app**.
2. Escolha o caso de uso de **WhatsApp** / tipo **Empresa** e vincule ao seu portfólio de negócios.
3. No painel do app, adicione o produto **WhatsApp**.

### 2. Registrar o número real

1. **WhatsApp → Configuração da API → Adicionar número de telefone**.
2. Informe o número e confirme com o código recebido por SMS ou ligação (aqui o chip é necessário).
3. Anote a **Identificação do número de telefone** (`WHATSAPP_PHONE_NUMBER_ID`) e a
   **Identificação da conta do WhatsApp Business** (`WHATSAPP_BUSINESS_ACCOUNT_ID`).

Atenção: um número em uso no aplicativo WhatsApp ou WhatsApp Business do celular precisa
ser migrado para a plataforma, e deixa de funcionar no aplicativo. Confirme isso antes de
registrar o número principal de atendimento.

### 3. Copiar o App Secret

**Configurações do app → Básico → Chave secreta do app → Mostrar**. Esse é o
`WHATSAPP_APP_SECRET`. Cadastre na Vercel e faça um deploy **antes** do passo 5.

### 4. Gerar o token de acesso permanente

O token temporário do painel expira em 24 horas. Para produção:

1. [business.facebook.com](https://business.facebook.com) → **Configurações → Usuários → Usuários do sistema → Adicionar** (função Administrador).
2. **Atribuir ativos**: adicione o app (controle total) e a conta do WhatsApp.
3. **Gerar token**: escolha o app, validade **Nunca**, e marque as permissões
   `whatsapp_business_messaging` e `whatsapp_business_management`.
4. Copie o token na hora (ele não é exibido de novo). Esse é o `WHATSAPP_ACCESS_TOKEN`.

### 5. Cadastrar o webhook

Com `WHATSAPP_WEBHOOK_VERIFY_TOKEN` e `WHATSAPP_APP_SECRET` já na Vercel e o deploy feito:

1. App → **WhatsApp → Configuração → Webhook → Editar**.
2. **URL de callback**: `https://petlead.vercel.app/api/whatsapp/webhook`
3. **Verificar token**: o mesmo valor de `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
4. **Verificar e salvar**. A Meta chama a URL e o PetLead devolve o código de confirmação.
5. Em **Campos do webhook**, assine **messages**.

Se a verificação falhar, o token informado é diferente do da Vercel, ou o deploy ainda não
terminou.

### 6. Conferir

Abra `https://petlead.vercel.app/api/health`. Com tudo preenchido:

```json
{ "status": "ok", "whatsapp": { "sending": true, "webhookVerification": true, "webhookSignature": true } }
```

## Teste com o número real

1. De outro celular, envie "Oi" para o número conectado.
2. Em alguns segundos a conversa aparece em **Conversas**, com um lead novo (origem WhatsApp,
   status Novo) e a faixa **Janela de atendimento aberta**.
3. Responda pelo campo de mensagem e clique em **Enviar**. A resposta deve chegar no celular.
4. No PetLead, a mensagem enviada ganha um tique (enviada), dois tiques (entregue) e dois
   tiques azuis quando for lida.
5. Envie outra mensagem do celular e confirme que ela entra na mesma conversa, sem criar
   outro lead.
6. Marque o lead como **Não contatar** e confirme que o campo de resposta fica bloqueado.

## Regras que o sistema aplica

- **Aprovação**: nenhuma mensagem sai sem um clique seu em "Enviar" ou "Aprovar e enviar".
- **Janela de 24 horas**: mensagem livre só é aceita até 24 horas depois da última mensagem
  do cliente. Fora disso a Meta exige modelos aprovados (templates), que ainda não foram
  implementados. O envio fica bloqueado com a faixa **Fora da janela de 24h**.
- **Primeiro contato**: para um lead que nunca escreveu, o envio também fica bloqueado, pelo
  mesmo motivo. Use o botão "Abrir no WhatsApp" enquanto não houver templates.
- **Não contatar**: bloqueia o envio em qualquer situação. Se o cliente voltar a escrever,
  a mensagem é guardada, mas o lead continua bloqueado.
- **Telefone**: o número de destino vem sempre do cadastro do lead, nunca da tela.
- **Duplicidade**: a Meta pode reenviar o mesmo webhook. Cada mensagem tem um identificador
  único e é gravada uma única vez.
- **Nono dígito**: números brasileiros com e sem o nono dígito são tratados como o mesmo lead.

## Testar sem número real

### Testes automatizados

```bash
npm test
```

Rodam em um Postgres em memória, sem tocar no banco real e sem enviar nada. Cobrem
verificação do webhook, assinatura, criação e reaproveitamento de lead, duplicidade,
confirmações de entrega, janela de 24 horas, não contatar e lead de outro vendedor.

### Simular um webhook no servidor local

1. Em `.env.local`, defina `WHATSAPP_APP_SECRET` com qualquer valor (ex.: `teste-local`).
2. Rode `npm run dev`.
3. Em outro terminal:

```bash
npm run whatsapp:simulate -- inbound-text
npm run whatsapp:simulate -- inbound-duplicate
npm run whatsapp:simulate -- inbound-followup
```

Os exemplos ficam em `tests/fixtures/whatsapp/`. O simulador assina a requisição com o
mesmo segredo do servidor e só aceita endereços locais.

**Cuidado**: o servidor local grava no banco apontado por `DATABASE_URL`, que hoje é o
mesmo da produção. O lead "Cliente Teste" (telefone fictício `5511900000201`) vai aparecer
no sistema. Remova-o depois, ou use um banco separado para desenvolvimento.

`message-delivered` e `message-read` só têm efeito sobre uma mensagem enviada de verdade;
no simulador local elas são aceitas e ignoradas.

## Acompanhar o que acontece

- **Logs**: Vercel → projeto petlead → **Logs**. Filtre por `/api/whatsapp/webhook`. Cada
  evento gera uma linha em JSON (`WhatsApp webhook processed`, `invalid signature`,
  `WhatsApp API returned an error`), sem tokens.
- **Histórico de webhooks**: tabela `whatsapp_webhook_events`, com o conteúdo recebido e o
  resultado (`PROCESSED`, `IGNORED`, `FAILED`). Veja com `npm run db:studio`.
- **Diagnóstico**: `/api/health` mostra o que está configurado, sem expor valores.

## Respostas do webhook

| Situação | Resposta |
| --- | --- |
| Verificação com token correto | 200 com o código de confirmação |
| Verificação com token errado ou não configurado | 403 |
| `WHATSAPP_APP_SECRET` não configurado | 503 (nada é processado) |
| Assinatura ausente ou inválida | 401 (nada é gravado) |
| Evento válido, processado ou ignorado | 200 |
| Falha ao processar | 500 (a Meta reenvia; o reenvio é seguro) |
