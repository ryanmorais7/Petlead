# Gerador de mensagens

O PetLead usa um modelo de linguagem para ler cada conversa e preparar o trabalho do
vendedor: resumo, intenção, objeção, temperatura, score, próxima ação e mensagens
sugeridas em cinco tons.

Ele nunca envia nada. Cada sugestão é um rascunho que você revisa, edita e envia.

## Ligar

1. Crie uma chave de API em [console.anthropic.com](https://console.anthropic.com) (menu **API Keys**) e adicione créditos em **Billing**.
2. Cadastre `AI_API_KEY` na Vercel (projeto petlead → Settings → Environment Variables) e no `.env.local`.
3. Faça um novo deploy.
4. Confira em `/api/health`: `"messageGenerator": true`.

| Variável | Para que serve |
| --- | --- |
| `AI_API_KEY` | Chave do provedor. Sem ela o gerador fica desligado |
| `AI_PROVIDER` | Provedor. Hoje só `anthropic`, que é o padrão |
| `AI_MODEL` | Modelo. Vazio usa `claude-opus-5-5` |

A chave fica só no servidor e nunca chega ao navegador. Não cole a chave em chats.

## Custo

Cada análise é uma chamada ao modelo, cobrada pelo provedor por volume de texto. Uma
análise acontece quando:

- um cliente manda mensagem (automático, logo depois de a mensagem ser gravada);
- você clica em **Gerar mensagem** ou **Gerar outra**.

O modelo padrão é o mais capaz da linha. Para gastar menos, defina
`AI_MODEL=claude-sonnet-5-5`, que custa cerca de metade. Vale comparar a qualidade das
sugestões antes de trocar em definitivo. Acompanhe o consumo no painel do provedor.

## O que o modelo sabe sobre a empresa

Só o que estiver escrito em [lib/ai/business-context.ts](../lib/ai/business-context.ts).
Hoje esse arquivo não tem preços, coberturas, carências nem documentos exigidos. Por isso,
quando um cliente perguntar algo assim, a sugestão dirá que você vai confirmar e já retorna,
em vez de inventar.

**Preencha esse arquivo com os dados reais** (planos, valores, formas de pagamento,
carências, regiões atendidas, documentos do cadastro) para as sugestões responderem direto.
Mantenha-o curto e atualizado: o que estiver ali será afirmado aos clientes.

## Regras que o sistema garante

- **Nada é enviado sem você**: a análise só grava um rascunho.
- **A resposta do modelo é validada** antes de qualquer uso. Se vier fora do formato, é
  descartada inteira e nada muda no lead.
- **Venda e perda são decisões suas**: o modelo não consegue marcar um lead como fechado
  nem como perdido.
- **Pedido para parar**: se o cliente disser que não quer mais contato, o lead vira "não
  contatar", os follow-ups são cancelados e nenhuma mensagem é sugerida. Um lead bloqueado
  nunca é reaberto pela análise.
- **Conteúdo da conversa é dado**: instruções escritas por um cliente dentro de uma
  mensagem não mudam o comportamento do gerador.
- **Tom**: as regras de atendimento (acolher, não pressionar, não inventar urgência, emojis
  com moderação) estão em [lib/ai/prompts.ts](../lib/ai/prompts.ts).

## Follow-ups a partir da conversa

A análise também estima quando voltar a falar com o cliente ("vou falar com meu esposo" →
2 ou 3 dias; "me chama semana que vem" → a data pedida). Esse prazo vira um follow-up
quando você responde. Sem prazo indicado, vale a cadência padrão de 2, 5, 10, 20 e 30 dias
de [lib/followups/config.ts](../lib/followups/config.ts).

Se você falar com o cliente pelo aplicativo do WhatsApp, clique em **Já chamei** no lead:
isso registra o contato e agenda o próximo follow-up.

## Trocar de provedor

O sistema depende apenas da interface `SuggestionProvider`
([lib/ai/provider.ts](../lib/ai/provider.ts)). Para usar outro fornecedor, implemente essa
interface em `lib/ai/providers/` e registre em [lib/ai/config.ts](../lib/ai/config.ts).

## Se algo falhar

- **"O gerador de mensagens ainda não está conectado."**: falta `AI_API_KEY`, ou a chave foi
  recusada pelo provedor.
- **"Um serviço externo não respondeu."**: limite de uso, falta de créditos ou instabilidade.
  Os detalhes ficam nos logs da Vercel, sem a chave.
- Uma falha na análise automática nunca impede a mensagem do cliente de ser gravada.
