# Publicação e configuração no Netlify

O projeto está preparado para TanStack Start no Netlify. O arquivo `netlify.toml` define `npm run build`, publicação de `dist/client` e as funções em `netlify/functions`. O adaptador oficial gera a função SSR do TanStack Start; as funções do ranking usam as rotas `/api/leaderboard/*`.

## Ativação necessária no site

1. Conecte este repositório a um site Netlify (ou selecione um site existente) e faça o deploy.
2. Habilite/provisione **Netlify Database** para o mesmo site. O jogo não usa Netlify Identity, cadastro, email, senha ou sessão autenticada.
3. Faça um novo deploy. O Netlify Database aplica as migrations em pastas numeradas dentro de `netlify/database/migrations/`, cada uma com `migration.sql`; elas suportam apenas os resultados e recompensas necessários ao ranking global, não um fluxo de criação de conta.
4. Abra o site publicado por HTTPS. Informe um nome para entrar imediatamente, jogue e volte ao lobby para conferir o ranking. O nome ativo fica no armazenamento local do navegador; recordes e recompensas enviados ao ranking usam esse nome como rótulo.
5. O ranking atualiza ao voltar ao lobby, ao focar a janela, pelo botão **ATUALIZAR** e por consulta periódica a cada 30 segundos.

Para aplicar/testar migrations localmente, vincule o projeto à conta/site com a Netlify CLI e use `netlify database migrations apply`; o ambiente local precisa do runtime/configuração do Netlify. As migrations e os endpoints não foram executados contra o banco remoto neste workspace.

## Identificação local por nome

O formulário pede somente o nome. Ele é normalizado e salvo no `localStorage` para identificar o jogador neste navegador; entrar não faz chamada de perfil nem cria conta. Não há autenticação, senha, email ou confirmação de email. O nome **não comprova identidade**: outras pessoas podem usar o mesmo nome. Quando uma pontuação ou recompensa for registrada, o nome é enviado junto ao respectivo dado para exibi-lo no ranking global; isso é um registro de jogo, não uma conta autenticada. O ranking é recreativo e não deve ser usado para competição com prêmios ou dados sensíveis. Como a simulação roda no navegador, os recordes informados pelo cliente também não têm validação antitrapaça autoritativa.

As migrations são aditivas: preservam as pontuações e eventos de moedas existentes, normalizando e consolidando registros legados com nomes iguais para manter o ranking. Nenhuma migration cria autenticação ou credenciais.

As chaves originais de recordes locais continuam compartilhadas neste navegador, sem migração ou cópia por nome. A entrada por nome é independente da disponibilidade do banco; o ranking global é atualizado em segundo plano quando pontuações/recompensas são enviadas.

## Regra de classificação

`PONTOS = (melhor altura da Torre em metros × 100) + melhor Sky Flap + melhor Sky Run + melhor Maze`. A Torre guarda décimos de metro como inteiro e o backend converte cada décimo em 10 pontos; por exemplo, 8,5 m = 85 décimos = 850 pontos. Moedas aparecem como informação e não alteram os pontos. O ranking mostra as 100 primeiras posições e inclui o jogador atual mesmo quando ele está abaixo desse recorte.
