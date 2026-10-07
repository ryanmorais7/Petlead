import type {
  AiSuggestion,
  Conversation,
  ConversationSummary,
  Followup,
  Lead,
  LeadEvent,
  Message,
  Sale,
  User,
} from "@/db/schema";
import type {
  LeadSource,
  LeadStatus,
  LeadTemperature,
  MessageType,
  SuggestionType,
} from "@/lib/domain/enums";
import { LEAD_STATUS_LABELS } from "@/lib/domain/labels";
import type { SuggestionTone } from "@/lib/validations/analysis";

/**
 * Demonstration data used while the database and WhatsApp are not connected.
 * Every date is relative to "now" so the queue always looks alive.
 * Names and phone numbers are fictitious.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function uid(group: number, index: number): string {
  return `00000000-0000-4000-8000-${String(group * 100000 + index).padStart(12, "0")}`;
}

export const MOCK_USER: User = {
  id: uid(1, 1),
  name: "Ryan Morais",
  email: "vendedor@petlead.local",
  role: "ADMIN",
  createdAt: new Date("2026-01-05T12:00:00Z"),
  updatedAt: new Date("2026-01-05T12:00:00Z"),
};

export type SuggestionTones = Partial<Record<SuggestionTone, string>>;

export type Dataset = {
  leads: Lead[];
  conversations: Conversation[];
  messages: Message[];
  summaries: ConversationSummary[];
  suggestions: AiSuggestion[];
  /** Alternative wordings of the current suggestion, by lead id. */
  suggestionTones: Record<string, SuggestionTones>;
  followups: Followup[];
  events: LeadEvent[];
  sales: Sale[];
};

type ThreadEntry = [direction: "in" | "out", hoursAgo: number, text: string, type?: MessageType];

type Seed = {
  name: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  temperature: LeadTemperature;
  score: number;
  petCount: number | null;
  petNames?: string[];
  plan?: string;
  objection?: string;
  lostReason?: string;
  notes?: string;
  createdDaysAgo: number;
  thread: ThreadEntry[];
  summary: { text: string; intent: string; next: string };
  followup?: { inDays: number; reason: string; step?: number };
  suggestion?: {
    type: SuggestionType;
    content: string;
    reason: string;
    confidence: number;
    tones?: SuggestionTones;
  };
  sale?: { plan: string; daysAgo: number; viaFollowup?: boolean };
};

const SEEDS: Seed[] = [
  {
    name: "Maria Souza",
    phone: "5511900000101",
    source: "INSTAGRAM",
    status: "INTERESTED",
    temperature: "HOT",
    score: 86,
    petCount: 2,
    petNames: ["Thor", "Mel"],
    plan: "Plano família",
    createdDaysAgo: 2,
    thread: [
      ["in", 50, "Oi, vi o anúncio de vocês no Instagram. Queria saber como funciona o plano pra dois cachorros"],
      ["out", 49.6, "Oi, Maria 😊 que bom te ver por aqui! Me conta um pouquinho sobre eles: qual a idade e o porte de cada um?"],
      ["in", 49.2, "O Thor tem 4 anos, é um labrador. A Mel é vira-lata, tem 2 aninhos"],
      ["out", 48.8, "Que dupla linda 🐾 Vou te mandar o material com os planos que atendem os dois."],
      ["out", 48.7, "Planos Pet de TODOS.pdf", "DOCUMENT"],
      ["in", 27, "Recebi, obrigada! Gostei do plano família"],
      ["in", 26.5, "Como eu faço pra contratar? Precisa de algum documento deles?"],
    ],
    summary: {
      text: "Tem dois cachorros (Thor, labrador de 4 anos, e Mel, vira-lata de 2). Recebeu o material, gostou do plano família e perguntou como contratar e quais documentos são necessários.",
      intent: "Quer contratar",
      next: "Responder hoje explicando o passo a passo do cadastro.",
    },
    suggestion: {
      type: "REPLY",
      content:
        "Oi, Maria 😊 que bom que você gostou! Contratar é bem simples e eu faço o cadastro com você por aqui mesmo. Posso te passar agora o que preciso do Thor e da Mel? 🐾",
      reason: "Cliente perguntou como contratar e ainda não recebeu resposta.",
      confidence: 0.91,
      tones: {
        friendly:
          "Oi, Maria 😊 fiquei feliz que você gostou do plano família! O Thor e a Mel vão ficar bem cuidados 💚 Contratar é simples, faço tudo com você por aqui. Posso te explicar o passo a passo?",
        short: "Oi, Maria 😊 é bem simples, faço o cadastro com você por aqui. Posso te passar o que preciso?",
        direct:
          "Oi, Maria! Para contratar eu preciso de alguns dados seus e dos dois pets. Posso te enviar a lista agora?",
        softClose:
          "Oi, Maria 😊 que bom que o plano família fez sentido pra vocês! Se quiser, já deixo o cadastro do Thor e da Mel encaminhado hoje. Te passo o que preciso? 🐾",
      },
    },
  },
  {
    name: "Juliana Prado",
    phone: "5511900000104",
    source: "CONDOMINIO",
    status: "READY_TO_CLOSE",
    temperature: "HOT",
    score: 92,
    petCount: 1,
    petNames: ["Mia"],
    plan: "Plano individual",
    createdDaysAgo: 1,
    thread: [
      ["in", 30, "Oi! Peguei seu contato no grupo do condomínio. Quero fazer o plano da minha gata"],
      ["out", 29.6, "Oi, Juliana 😊 que bom! Como ela se chama?"],
      ["in", 29.4, "Mia, tem 3 anos"],
      ["out", 29, "Perfeito 🐱 Pra fazer o cadastro eu preciso de um documento seu e da carteirinha de vacinação da Mia."],
      ["in", 3.2, "Foto: carteirinha de vacinação", "IMAGE"],
      ["in", 3, "Pronto, mandei a carteirinha. Falta mais alguma coisa?"],
    ],
    summary: {
      text: "Chegou pelo grupo do condomínio já decidida a contratar o plano para a gata Mia (3 anos). Enviou a carteirinha de vacinação e perguntou se falta algo.",
      intent: "Fechar o plano",
      next: "Confirmar o recebimento e concluir o cadastro hoje.",
    },
    suggestion: {
      type: "CLOSING",
      content:
        "Recebi sim, Juliana, obrigado 😊 Vou conferir a carteirinha da Mia e já te confirmo se está tudo certo para finalizarmos o cadastro 🐱",
      reason: "Cliente enviou a documentação e aguarda confirmação.",
      confidence: 0.94,
      tones: {
        friendly:
          "Recebi, Juliana, muito obrigado 😊 A Mia já está quase com o plano dela 💚 Vou conferir a carteirinha e te aviso em seguida.",
        short: "Recebi, Juliana 😊 vou conferir e já te confirmo.",
        direct: "Recebi a carteirinha, Juliana. Vou conferir e te confirmo ainda hoje o próximo passo.",
        softClose:
          "Recebi, Juliana 😊 Com a carteirinha da Mia em mãos, consigo deixar o cadastro pronto hoje. Te confirmo assim que conferir 🐱",
      },
    },
  },
  {
    name: "Bianca Nunes",
    phone: "5511900000113",
    source: "WHATSAPP",
    status: "NEW",
    temperature: "WARM",
    score: 45,
    petCount: null,
    createdDaysAgo: 0,
    thread: [["in", 0.6, "Olá! Vocês atendem na zona leste?"]],
    summary: {
      text: "Primeiro contato. Perguntou se o atendimento cobre a zona leste. Ainda não informou quantos pets tem.",
      intent: "Tirando dúvidas",
      next: "Responder sobre a região e conhecer os pets dela.",
    },
    suggestion: {
      type: "REPLY",
      content:
        "Olá, Bianca 😊 seja bem-vinda! Vou confirmar a rede de atendimento da sua região e já te respondo. Enquanto isso, me conta: você tem cachorro, gato ou os dois? 🐾",
      reason: "Primeira mensagem do cliente. A cobertura da região precisa ser confirmada antes de responder.",
      confidence: 0.72,
    },
  },
  {
    name: "Patrícia Gomes",
    phone: "5511900000107",
    source: "INFLUENCIADOR",
    status: "WAITING_PAYMENT",
    temperature: "HOT",
    score: 88,
    petCount: 1,
    petNames: ["Pipoca"],
    plan: "Plano individual",
    createdDaysAgo: 4,
    thread: [
      ["in", 98, "Oi, vim pelo perfil da Dra. Lívia. Quero o plano pra minha cachorrinha"],
      ["out", 97.5, "Oi, Patrícia 😊 seja bem-vinda! Como ela se chama?"],
      ["in", 97, "Pipoca 🐶 tem 1 ano"],
      ["out", 96, "Que fofura 🧡 Te enviei as opções pra você escolher com calma."],
      ["in", 52, "Quero esse individual mesmo. Quais as formas de pagamento?"],
      ["out", 51.5, "Ótima escolha 😊 Te mandei as formas de pagamento disponíveis. Qual fica melhor pra você?"],
      ["in", 29, "Vou fazer no cartão. Faço amanhã quando receber, pode ser?"],
      ["out", 28.5, "Pode sim, sem problema nenhum 😊 Fico por aqui."],
    ],
    summary: {
      text: "Escolheu o plano individual para a Pipoca (1 ano). Disse que faria o pagamento no cartão no dia seguinte, quando recebesse.",
      intent: "Fechar o plano",
      next: "Lembrar gentilmente do pagamento combinado para hoje.",
    },
    followup: { inDays: 0, reason: "Combinou de pagar hoje, no cartão." },
    suggestion: {
      type: "CLOSING",
      content:
        "Oi, Patrícia 😊 passando pra saber se deu tudo certo por aí. Quando quiser finalizar o plano da Pipoca é só me avisar que te ajudo 🐶",
      reason: "Cliente combinou o pagamento para hoje.",
      confidence: 0.88,
      tones: {
        friendly:
          "Oi, Patrícia 😊 lembrei de você e da Pipoca 🧡 Quando for um bom momento pra finalizar, me chama que eu te acompanho no passo a passo.",
        short: "Oi, Patrícia 😊 quando quiser finalizar o plano da Pipoca, me avisa.",
        direct: "Oi, Patrícia! Conforme combinamos, posso te enviar o link de pagamento do plano da Pipoca?",
        softClose:
          "Oi, Patrícia 😊 se estiver tudo certo por aí, consigo deixar o plano da Pipoca ativo hoje mesmo. Te mando o link? 🐶",
      },
    },
  },
  {
    name: "Havanny Lima",
    phone: "5511900000102",
    source: "INDICACAO",
    status: "WAITING_FAMILY",
    temperature: "WARM",
    score: 68,
    petCount: 2,
    petNames: ["Luna", "Bob"],
    plan: "Plano família",
    objection: "Precisa alinhar a decisão com o esposo",
    createdDaysAgo: 3,
    thread: [
      ["in", 80, "Boa tarde! A Carla me indicou vocês. Tenho uma gatinha e um cachorro"],
      ["out", 79.5, "Boa tarde, Havanny 😊 que legal que a Carla indicou! Como se chamam os dois?"],
      ["in", 79, "Luna e Bob 🥰"],
      ["out", 78.5, "Lindos nomes 💚 Te enviei os detalhes do plano pra você ver com calma."],
      ["in", 74, "Gostei bastante. Vou conversar com meu esposo e te falo"],
      ["out", 73.5, "Claro 😊 conversa com ele com calma. Se surgir qualquer dúvida sobre o plano, pode me chamar que te explico direitinho 💚🐾"],
    ],
    summary: {
      text: "Indicada pela Carla. Tem a gata Luna e o cachorro Bob, gostou do plano família e disse que conversaria com o esposo antes de decidir.",
      intent: "Interessada, decidindo em família",
      next: "Follow-up leve hoje, sem pressão.",
    },
    followup: { inDays: 0, reason: "Disse que conversaria com o esposo. Follow-up leve." },
    suggestion: {
      type: "FOLLOW_UP",
      content:
        "Oi, Havanny 😊 lembrei de você e dos seus pequenos. Conseguiu conversar com seu esposo sobre o plano? Se ficou alguma dúvida, pode falar comigo que te ajudo 💚",
      reason: "Três dias desde que ela disse que falaria com o esposo.",
      confidence: 0.84,
      tones: {
        friendly:
          "Oi, Havanny 😊 como estão a Luna e o Bob? Lembrei de vocês hoje 💚 Se você e seu esposo tiverem qualquer dúvida sobre o plano, é só me chamar, tá?",
        short: "Oi, Havanny 😊 conseguiu conversar com seu esposo? Qualquer dúvida, estou por aqui 💚",
        direct: "Oi, Havanny! Vocês conseguiram conversar sobre o plano? Posso esclarecer algum ponto pra ajudar na decisão?",
        softClose:
          "Oi, Havanny 😊 conseguiu conversar com seu esposo? Se fizer sentido pra vocês, eu deixo o cadastro da Luna e do Bob encaminhado quando preferirem 💚",
      },
    },
  },
  {
    name: "Rafael Teixeira",
    phone: "5511900000105",
    source: "PANFLETO",
    status: "COMPARING_COMPETITOR",
    temperature: "WARM",
    score: 55,
    petCount: 3,
    petNames: ["Zeca", "Lola", "Chico"],
    objection: "Está comparando com outro plano que já conhece",
    createdDaysAgo: 6,
    thread: [
      ["in", 140, "Peguei um panfleto de vocês na feira. Tenho 3 cachorros, compensa?"],
      ["out", 139, "Oi, Rafael 😊 que bom que guardou o panfleto! Com três, vale a pena olhar com atenção. Qual a idade deles?"],
      ["in", 138, "Zeca 8, Lola 5 e Chico 1 ano"],
      ["out", 137, "Entendi 🐾 Te mandei o material com as opções pra três pets."],
      ["in", 98, "Vi aqui. Vou comparar com um outro plano que um amigo usa e te dou retorno"],
      ["out", 97, "Faz muito bem em comparar 😊 Se quiser, me fala o que é mais importante pra você que eu te mostro como funciona por aqui."],
    ],
    summary: {
      text: "Pegou o panfleto na feira. Tem três cachorros (8, 5 e 1 ano) e está comparando com o plano que um amigo usa.",
      intent: "Comparando opções",
      next: "Follow-up leve perguntando o que pesa mais na decisão.",
    },
    followup: { inDays: 0, reason: "Ficou de comparar com outro plano e dar retorno." },
    suggestion: {
      type: "FOLLOW_UP",
      content:
        "Oi, Rafael 😊 conseguiu comparar os planos? Se tiver algum ponto que ficou em dúvida pro Zeca, a Lola e o Chico, me fala que eu te explico com calma 🐾",
      reason: "Quatro dias desde que disse que compararia com outro plano.",
      confidence: 0.77,
    },
  },
  {
    name: "Carlos Mendes",
    phone: "5511900000103",
    source: "FACEBOOK",
    status: "NO_RESPONSE",
    temperature: "COLD",
    score: 34,
    petCount: 1,
    petNames: ["Rex"],
    createdDaysAgo: 21,
    thread: [
      ["in", 500, "Quanto custa o plano?"],
      ["out", 499.5, "Oi, Carlos 😊 tudo bem? Te passo os valores certinhos. É pra cachorro ou gato?"],
      ["in", 499, "Cachorro, o Rex. Ele tem 9 anos"],
      ["out", 498.5, "Entendi 🐶 Te enviei o material com as opções pra idade dele."],
      ["out", 480, "Carlos, conseguiu dar uma olhada? Fico à disposição 😊"],
    ],
    summary: {
      text: "Perguntou o preço para o Rex, um cachorro de 9 anos. Recebeu o material e parou de responder.",
      intent: "Interessado, sem retorno",
      next: "Reativação amigável, sem pressão.",
    },
    suggestion: {
      type: "REACTIVATION",
      content:
        "Oi, Carlos 😊 lembrei de você e do Rex. Como ele está? Se ainda fizer sentido pra vocês, posso te atualizar sobre as opções pra idade dele 🐶",
      reason: "20 dias sem contato depois de demonstrar interesse.",
      confidence: 0.63,
    },
  },
  {
    name: "Ana Beatriz Rocha",
    phone: "5511900000106",
    source: "INSTAGRAM",
    status: "NO_RESPONSE",
    temperature: "COLD",
    score: 28,
    petCount: 2,
    petNames: ["Nina", "Fred"],
    createdDaysAgo: 36,
    thread: [
      ["in", 860, "Oi, queria informações do plano pra dois pets"],
      ["out", 859, "Oi, Ana 😊 claro! São cachorros ou gatos?"],
      ["in", 858, "Uma gata e um cachorro, Nina e Fred"],
      ["out", 857, "Que legal 🐾 Te mandei as condições pra dois pets. Qualquer dúvida é só chamar."],
      ["in", 820, "Obrigada, vou ver direitinho"],
    ],
    summary: {
      text: "Pediu informações para a gata Nina e o cachorro Fred, agradeceu o material e disse que ia analisar. Sem novas mensagens desde então.",
      intent: "Interessada, sem retorno",
      next: "Reativação citando a conversa anterior.",
    },
    suggestion: {
      type: "REACTIVATION",
      content:
        "Oi, Ana 😊 lembrei de você porque na época a gente conversou sobre o plano para a Nina e o Fred. Como vocês estão? Se ainda fizer sentido pra você, posso te atualizar sobre as condições por aqui 💚🐾",
      reason: "34 dias sem contato.",
      confidence: 0.58,
    },
  },
  {
    name: "Diego Martins",
    phone: "5511900000108",
    source: "WHATSAPP",
    status: "THINKING",
    temperature: "WARM",
    score: 49,
    petCount: 1,
    petNames: ["Simba"],
    objection: "Quer pensar antes de decidir",
    createdDaysAgo: 3,
    thread: [
      ["in", 60, "Boa noite, o plano cobre consulta?"],
      ["out", 59, "Boa noite, Diego 😊 te enviei o material com tudo o que cada plano inclui, assim você confere certinho."],
      ["in", 50, "Entendi. Vou pensar e qualquer coisa te chamo"],
      ["out", 49.5, "Combinado 😊 pensa com calma. Estou por aqui se precisar 🐾"],
    ],
    summary: {
      text: "Perguntou sobre cobertura de consultas para o gato Simba. Recebeu o material e disse que vai pensar.",
      intent: "Avaliando",
      next: "Aguardar. Follow-up leve agendado para daqui a dois dias.",
    },
    followup: { inDays: 2, reason: "Disse que vai pensar. Dar espaço antes de voltar." },
  },
  {
    name: "Tiago Farias",
    phone: "5511900000114",
    source: "CONDOMINIO",
    status: "CONTACTED",
    temperature: "WARM",
    score: 42,
    petCount: 1,
    petNames: ["Bolt"],
    createdDaysAgo: 2,
    thread: [
      ["in", 44, "Oi, vi o recado no elevador. Depois quero ver o plano pro meu cachorro"],
      ["out", 43.5, "Oi, Tiago 😊 claro! Quer que eu te mande o material agora?"],
      ["in", 43, "Estou viajando, volto semana que vem. Me chama depois?"],
      ["out", 42.5, "Combinado, boa viagem 😊 Te chamo na semana que vem 🐾"],
    ],
    summary: {
      text: "Viu o recado no elevador do condomínio. Está viajando e pediu para ser chamado na semana que vem.",
      intent: "Interessado, pediu para falar depois",
      next: "Respeitar o prazo pedido. Chamar na próxima semana.",
    },
    followup: { inDays: 6, reason: "Está viajando. Pediu contato na semana que vem." },
  },
  {
    name: "Fernanda Alves",
    phone: "5511900000109",
    source: "INDICACAO",
    status: "CLOSED",
    temperature: "HOT",
    score: 100,
    petCount: 2,
    petNames: ["Amora", "Tobias"],
    plan: "Plano família",
    createdDaysAgo: 9,
    thread: [
      ["in", 210, "Oi! Minha vizinha fez o plano com você e falou super bem"],
      ["out", 209, "Oi, Fernanda 😊 que alegria saber disso! Me conta dos seus pets."],
      ["in", 208, "Amora e Tobias, dois gatos"],
      ["out", 207, "Que amor 🐱 Te enviei o plano que atende os dois."],
      ["in", 150, "Pode fazer o cadastro!"],
      ["out", 146, "Tudo certo, Fernanda 😊 a Amora e o Tobias já estão com o plano ativo. Qualquer coisa, estou por aqui 💚"],
    ],
    summary: {
      text: "Indicada pela vizinha. Contratou o plano família para os gatos Amora e Tobias.",
      intent: "Cliente ativa",
      next: "Nenhuma ação comercial. Manter o relacionamento.",
    },
    sale: { plan: "Plano família", daysAgo: 6 },
  },
  {
    name: "Marcos Vinícius Costa",
    phone: "5511900000110",
    source: "INSTAGRAM",
    status: "CLOSED",
    temperature: "HOT",
    score: 100,
    petCount: 1,
    petNames: ["Duque"],
    plan: "Plano individual",
    createdDaysAgo: 20,
    thread: [
      ["in", 470, "Vi o story de vocês. Como funciona pra cachorro idoso?"],
      ["out", 469, "Oi, Marcos 😊 te enviei o material com as opções. Quantos anos ele tem?"],
      ["in", 468, "O Duque tem 11"],
      ["out", 350, "Oi, Marcos 😊 lembrei do Duque. Conseguiu ver o material? Se ficou alguma dúvida, pode me chamar 🐶"],
      ["in", 340, "Vi sim, desculpa a demora. Quero fazer"],
      ["out", 290, "Prontinho, Marcos 😊 o plano do Duque já está ativo 💚"],
    ],
    summary: {
      text: "Chegou pelo Instagram perguntando sobre plano para o Duque, de 11 anos. Voltou depois de um follow-up e fechou o plano individual.",
      intent: "Cliente ativo",
      next: "Nenhuma ação comercial. Manter o relacionamento.",
    },
    sale: { plan: "Plano individual", daysAgo: 12, viaFollowup: true },
  },
  {
    name: "Lucas Andrade",
    phone: "5511900000112",
    source: "FACEBOOK",
    status: "LOST",
    temperature: "COLD",
    score: 12,
    petCount: 1,
    petNames: ["Bidu"],
    objection: "Já tem plano em outra empresa",
    lostReason: "Já possui plano em outra empresa e está satisfeito",
    createdDaysAgo: 15,
    thread: [
      ["in", 350, "Vocês têm plano pra cachorro pequeno?"],
      ["out", 349, "Oi, Lucas 😊 temos sim! Te enviei as opções."],
      ["in", 330, "Obrigado, mas já tenho plano em outra empresa e estou satisfeito"],
      ["out", 329, "Sem problema, Lucas 😊 fico feliz que o Bidu está bem cuidado. Se um dia precisar, estou por aqui."],
    ],
    summary: {
      text: "Já tem plano em outra empresa para o Bidu e está satisfeito. Agradeceu e encerrou a conversa.",
      intent: "Sem interesse no momento",
      next: "Nenhuma ação. Lead encerrado.",
    },
  },
  {
    name: "Sônia Ribeiro",
    phone: "5511900000111",
    source: "PANFLETO",
    status: "DO_NOT_CONTACT",
    temperature: "COLD",
    score: 0,
    petCount: 1,
    createdDaysAgo: 8,
    thread: [
      ["in", 190, "Quem é?"],
      ["out", 189, "Oi, Sônia 😊 aqui é o Ryan, da Pet de TODOS. Você deixou o contato no nosso panfleto."],
      ["in", 188, "Não tenho interesse. Por favor não me mande mais mensagens"],
      ["out", 187, "Tudo bem, Sônia. Não vou mais te chamar. Desculpe o incômodo."],
    ],
    summary: {
      text: "Pediu para não receber mais mensagens.",
      intent: "Não quer contato",
      next: "Não contatar.",
    },
  },
];

export function buildMockDataset(now: Date): Dataset {
  const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * HOUR_MS);
  const inDays = (days: number) => new Date(now.getTime() + days * DAY_MS);

  const data: Dataset = {
    leads: [],
    conversations: [],
    messages: [],
    summaries: [],
    suggestions: [],
    suggestionTones: {},
    followups: [],
    events: [],
    sales: [],
  };
  let eventCount = 0;

  SEEDS.forEach((seed, seedIndex) => {
    const n = seedIndex + 1;
    const leadId = uid(2, n);
    const conversationId = uid(3, n);
    const createdAt = at(Math.max(seed.createdDaysAgo * 24, seed.thread[0]?.[1] ?? 0));

    const addEvent = (
      type: LeadEvent["type"],
      when: Date,
      description: string | null,
      userId: string | null = null,
    ) => {
      eventCount += 1;
      data.events.push({
        id: uid(8, eventCount),
        leadId,
        userId,
        type,
        description,
        payload: null,
        createdAt: when,
      });
    };

    addEvent("LEAD_CREATED", createdAt, null);

    const threadMessages = seed.thread.map<Message>(([direction, hoursAgo, text, type], index) => {
      const inbound = direction === "in";
      const timestamp = at(hoursAgo);
      return {
        id: uid(4, n * 100 + index),
        conversationId,
        leadId,
        whatsappMessageId: `wamid.demo-${n}-${index}`,
        direction: inbound ? "INBOUND" : "OUTBOUND",
        type: type ?? "TEXT",
        text,
        timestamp,
        status: inbound ? "RECEIVED" : "READ",
        rawPayload: null,
        createdAt: timestamp,
      };
    });
    data.messages.push(...threadMessages);

    const lastMessage = threadMessages.at(-1) ?? null;
    if (lastMessage) {
      addEvent(
        lastMessage.direction === "INBOUND" ? "MESSAGE_RECEIVED" : "MESSAGE_SENT",
        lastMessage.timestamp,
        lastMessage.text,
        lastMessage.direction === "OUTBOUND" ? MOCK_USER.id : null,
      );
    }

    data.conversations.push({
      id: conversationId,
      leadId,
      whatsappConversationId: null,
      createdAt,
      updatedAt: lastMessage?.timestamp ?? createdAt,
    });

    data.summaries.push({
      id: uid(5, n),
      leadId,
      summary: seed.summary.text,
      customerIntent: seed.summary.intent,
      mainObjection: seed.objection ?? null,
      recommendedNextAction: seed.summary.next,
      updatedAt: lastMessage?.timestamp ?? createdAt,
    });

    let suggestionId: string | null = null;
    if (seed.suggestion) {
      suggestionId = uid(6, n);
      data.suggestions.push({
        id: suggestionId,
        leadId,
        conversationId,
        type: seed.suggestion.type,
        content: seed.suggestion.content,
        reason: seed.suggestion.reason,
        confidence: seed.suggestion.confidence,
        approved: false,
        editedContent: null,
        sentAt: null,
        createdAt: lastMessage?.timestamp ?? createdAt,
      });
      if (seed.suggestion.tones) data.suggestionTones[leadId] = seed.suggestion.tones;
    }

    let nextFollowupAt: Date | null = null;
    if (seed.followup) {
      nextFollowupAt = inDays(seed.followup.inDays);
      const followupCreatedAt = lastMessage?.timestamp ?? createdAt;
      data.followups.push({
        id: uid(7, n),
        leadId,
        scheduledFor: nextFollowupAt,
        reason: seed.followup.reason,
        status: seed.followup.inDays <= 0 && suggestionId ? "READY" : "PENDING",
        sequenceStep: seed.followup.step ?? null,
        aiSuggestionId: suggestionId,
        createdAt: followupCreatedAt,
        updatedAt: followupCreatedAt,
      });
      addEvent("FOLLOWUP_CREATED", followupCreatedAt, seed.followup.reason);
    }

    if (seed.status !== "NEW") {
      addEvent(
        seed.status === "DO_NOT_CONTACT" ? "DO_NOT_CONTACT_SET" : "STATUS_CHANGED",
        lastMessage?.timestamp ?? createdAt,
        seed.status === "DO_NOT_CONTACT"
          ? "Cliente pediu para não receber mais mensagens."
          : `Status alterado para "${LEAD_STATUS_LABELS[seed.status]}".`,
      );
    }

    if (seed.sale) {
      const closedAt = at(seed.sale.daysAgo * 24);
      let followupId: string | null = null;
      if (seed.sale.viaFollowup) {
        followupId = uid(7, 500 + n);
        const sentAt = at(seed.sale.daysAgo * 24 + 60);
        data.followups.push({
          id: followupId,
          leadId,
          scheduledFor: sentAt,
          reason: "Cliente parou de responder depois de receber o material.",
          status: "SENT",
          sequenceStep: 1,
          aiSuggestionId: null,
          createdAt: sentAt,
          updatedAt: sentAt,
        });
        addEvent("FOLLOWUP_SENT", sentAt, "Follow-up enviado após aprovação.", MOCK_USER.id);
      }
      data.sales.push({
        id: uid(9, n),
        leadId,
        ownerUserId: MOCK_USER.id,
        planName: seed.sale.plan,
        monthlyValue: null,
        source: seed.source,
        followupId,
        notes: null,
        closedAt,
        createdAt: closedAt,
      });
      addEvent("SALE_CLOSED", closedAt, seed.sale.plan, MOCK_USER.id);
    }

    data.leads.push({
      id: leadId,
      ownerUserId: MOCK_USER.id,
      name: seed.name,
      phone: seed.phone,
      email: null,
      source: seed.source,
      status: seed.status,
      temperature: seed.temperature,
      leadScore: seed.score,
      mainObjection: seed.objection ?? null,
      lostReason: seed.lostReason ?? null,
      notes: seed.notes ?? null,
      petCount: seed.petCount,
      petNames: seed.petNames ?? [],
      planInterest: seed.plan ?? null,
      lastContactAt: lastMessage?.timestamp ?? null,
      nextFollowupAt,
      doNotContact: seed.status === "DO_NOT_CONTACT",
      createdAt,
      updatedAt: lastMessage?.timestamp ?? createdAt,
    });
  });

  return data;
}
