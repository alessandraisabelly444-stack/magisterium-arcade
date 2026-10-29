# Remix of Remix of Remix of Remix of Remix of Spellbound Arcade Foundation

Quero começar a desenvolver um jogo chamado Spellbound Arcade.

IMPORTANTE: nesta primeira etapa, NÃO implemente os modos de jogo, bots, corrida, sistema de construção, habilidades dos personagens, loja ou multiplayer. Quero primeiro construir uma base organizada e funcional para adicionarmos os sistemas posteriormente.

CONCEITO GERAL

Spellbound Arcade é um jogo inspirado na evolução dos jogos de arcade, misturando uma estética clássica de fliperama com fantasia e magia.

O jogo inteiro acontece em um mundo celestial, com ilhas flutuantes, nuvens, estrelas, construções mágicas e elementos de fantasia.

A estética deve ser baseada em pixel art, com aparência de videogame arcade moderno, mas sem limitar o jogo a uma paleta de cores específica.

NÃO quero gráficos realistas, 3D realista ou aparência de jogo hiper-realista.

A identidade visual deve ser:

pixel art;

colorida;

legível;

divertida;

mágica;

inspirada em arcades;

com elementos celestiais;

visual consistente entre menus e gameplay.

TELA INICIAL

Ao iniciar o jogo, o jogador deve primeiro inserir seu nome.

Criar uma tela:

SPELLBOUND ARCADE

"ENTER YOUR NAME"

com um campo para o jogador digitar seu nome.

Adicionar um botão:

"CONFIRM"

O nome deve ser salvo durante a sessão e ficar disponível para os sistemas futuros do jogo.

Depois de confirmar o nome, o jogador deve entrar no lobby principal.

LOBBY

Criar um lobby celestial em formato de uma pequena ilha flutuante.

O cenário deve possuir:

céu;

nuvens;

estrelas;

pequenas ilhas flutuantes;

estruturas mágicas;

decoração inspirada em fliperamas;

elementos de fantasia.

O lobby deve funcionar como o menu principal do jogo.

Criar áreas/botões para futuramente receber:

TOWER

CLOUD RACE

CHARACTERS

CUSTOMIZE

LEADERBOARD

Nesta primeira etapa, esses botões podem apenas existir visualmente e mostrar uma mensagem como "COMING SOON" quando clicados, pois os sistemas serão implementados posteriormente.

Também adicionar uma área mostrando o nome do jogador.

Exemplo:

PLAYER
JÚLIO

Não utilizar um nome fixo. Deve aparecer o nome digitado pelo jogador na tela inicial.

ESTRUTURA DO PROJETO

Organize o código de maneira modular para que seja fácil adicionar posteriormente:

personagens;

habilidades;

troca de personagens;

modos de jogo;

bots;

moedas;

customização;

ranking;

sistema de partidas.

Evite colocar toda a lógica em um único arquivo ou componente gigante.

Crie componentes reutilizáveis sempre que possível.

PERSONAGENS

Por enquanto, NÃO implemente as habilidades.

Apenas prepare a estrutura para estes cinco personagens:

Raposa branca maga de gelo

Tema: gelo

Cor predominante: branco/azul

Coelho roxo ninja

Tema: ninja/magia

Cor predominante: roxo

Sapo mago do pântano

Tema: pântano

Cor predominante: verde

Guaxinim mago ferreiro

Tema: fogo/forja

Cor predominante: laranja/vermelho

Coruja maga

Tema: tempo

Cor predominante: azul/roxo

Esses personagens devem ser tratados como personagens jogáveis que serão implementados em uma etapa posterior.

INTERFACE

A interface deve seguir a mesma identidade visual do mundo:

pixel art;

elementos de arcade;

painéis mágicos;

fontes com aparência de videogame;

botões grandes e legíveis;

pequenas animações quando apropriado.

Evite interfaces excessivamente modernas e minimalistas que pareçam um aplicativo corporativo.

O jogo deve parecer um videogame.

RESPONSIVIDADE

A interface deve funcionar corretamente em diferentes tamanhos de tela.

Organize os elementos para que não fiquem sobrepostos ou cortados.

IMPORTANTE

Não implemente ainda:

gameplay;

Tower;

Cloud Race;

bots;

multiplayer;

habilidades;

troca de personagem;

moedas;

loja;

customização;

ranking online.

Nesta etapa, quero apenas uma fundação visual e estrutural funcional, com:

Tela de entrada do nome.

Salvamento do nome durante a sessão.

Lobby celestial.

Navegação básica entre as opções.

Estrutura preparada para receber os sistemas futuros.

Priorize organização do código e estabilidade.
Não altere sistemas futuros que ainda não foram implementados.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8517d4e7-94b9-4d5d-8e39-0e22b94183a3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
