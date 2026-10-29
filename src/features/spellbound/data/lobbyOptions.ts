import type { LobbyOption } from "../types";

export const lobbyOptions: LobbyOption[] = [
  {
    id: "tower",
    label: "TORRE",
    description: "Desafios mágicos de arcade",
    accentClassName: "bg-arcade-cyan",
  },
  {
    id: "sky-flap",
    label: "SKY FLAP",
    description: "Voe entre portais celestiais",
    accentClassName: "bg-arcade-sky-deep",
  },
  {
    id: "sky-run",
    label: "SKY RUN",
    description: "Corra pelas ilhas celestiais",
    accentClassName: "bg-arcade-violet",
  },
  {
    id: "spellbound-maze",
    label: "LABIRINTO MÁGICO",
    description: "Explore corredores arcanos e encontre o portal",
    accentClassName: "bg-arcade-mint",
  },
  {
    id: "characters",
    label: "PERSONAGENS",
    description: "Escolha seu animal mago",
    accentClassName: "bg-arcade-violet",
  },
  {
    id: "customize",
    label: "PERSONALIZAR",
    description: "Oficina de cosméticos",
    accentClassName: "bg-arcade-pink",
  },
  {
    id: "leaderboard",
    label: "RANKING",
    description: "Salão de pontuações em obras",
    accentClassName: "bg-arcade-lilac",
  },
];
