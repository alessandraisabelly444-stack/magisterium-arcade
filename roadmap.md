# Tower — Shuriken e arenas paralelas

- [x] Adicionar seleção segura e remoção de uma peça própria no motor, sem alterar IA/física dos bots.
- [x] Implementar estado, controle Z, pausa, mira por mouse, cooldown e efeitos da Shuriken do Coelho.
- [x] Organizar jogador e três bots em quatro arenas verticais lado a lado com HUD compacto.
- [x] Validar física pós-destruição, troca de personagem, controles, bots e adaptação móvel/desktop.

## Feedback visual da Tower

- [x] Acrescentar rastro pixelado à Shuriken e explosão localizada no impacto, sem efeito físico.
- [x] Restaurar guia de aterrissagem apenas para a peça ativa do jogador, recalculada a cada quadro.
- [x] Verificar visualmente voo, impacto e guia com movimento, rotação, descida e hard drop.

## Forja Mágica do Guaxinim

- [x] Integrar escolha I/O/T/S/Z/J/L ao botão Z e ao fluxo normal da peça ativa.
- [x] Adicionar sequência curta de forja, resfriamento visual e cooldown de 10s.
- [x] Validar cancelamento, troca de personagem, controles, guia de queda e bots em andamento.

## Meta e confirmação de vitória da Tower

- [x] Elevar a meta para 20 células/15 m e usar o topo real da estrutura, incluindo peças rotacionadas.
- [x] Exigir cinco segundos contínuos acima da linha; continuar simulando a partida e cancelar/resetar a confirmação se a torre baixar.
- [x] Exibir contagem regressiva própria para jogador e cada bot, sem compartilhar temporizadores entre arenas.

## Recompensas em moedas na Tower

- [x] Definir a recompensa da Tower como 5 moedas por peça estável no encerramento da partida, 1 moeda por metro inteiro da altura máxima atingida e bônus de 25 moedas pela vitória.
- [x] Contar apenas peças que o motor marcou como estáveis; peças ativas ou ainda caindo não recebem moedas. Encerrar o cálculo quando o jogador e os três bots tiverem resultado final.
- [x] Manter o cálculo em uma função pura de resultados, sem alterar física ou condição de vitória; creditar uma única vez por partida pelo sistema compartilhado de comprovantes e exibir o detalhamento no resultado.
- [ ] Futuro — loja, compras e desbloqueios continuam fora do escopo.

## Identificação simples por nome

- [x] Remover login/cadastro, email, senha, autenticação e endpoint de criação/carregamento de perfil do fluxo do jogador.
- [x] Pedir somente o nome e entrar imediatamente; normalizar e salvar o nome ativo no `localStorage` sem depender do backend.
- [x] Preservar telas, regras, controles e chaves originais de recordes dos jogos; não separar os recordes locais por nome.
- [x] Manter a leaderboard existente: o nome é enviado apenas junto aos resultados/recompensas que precisam aparecer no placar, sem credenciais ou conta.
- [ ] Aplicar as migrations e validar a leaderboard contra o Netlify Database real; pendente de conexão do site/banco neste workspace.
