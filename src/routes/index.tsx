import { createFileRoute } from "@tanstack/react-router";

import { SpellboundArcade } from "@/features/spellbound/SpellboundArcade";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Magisterium Arcade — Lobby Celestial em Pixel Art" },
      {
        name: "description",
        content:
          "Entre no Magisterium Arcade: um arcade mágico no céu, com tela de nome do jogador e lobby celestial em pixel art colorido.",
      },
      { property: "og:title", content: "Magisterium Arcade — Lobby Celestial em Pixel Art" },
      {
        property: "og:description",
        content:
          "Base visual do Magisterium Arcade: céu claro, nuvens, ilhas flutuantes e um lobby celestial pronto para os próximos sistemas do jogo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <SpellboundArcade />;
}
