import * as React from "react";
import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Fragment as Fragment$1, jsx, jsxs } from "react/jsx-runtime";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import Matter from "matter-js";
//#region src/lib/utils.ts
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
//#endregion
//#region src/components/ui/button.tsx
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
			destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
			outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
			secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
			ghost: "hover:bg-accent hover:text-accent-foreground",
			link: "text-primary underline-offset-4 hover:underline",
			arcade: "pixel-button-rise border-2 border-arcade-panel-border bg-accent font-arcade text-accent-foreground hover:-translate-y-0.5 hover:bg-arcade-violet active:translate-y-1 active:shadow-none",
			arcadePanel: "pixel-button-rise border-2 border-arcade-cyan bg-arcade-panel font-arcade text-arcade-panel-foreground hover:-translate-y-0.5 hover:bg-muted active:translate-y-1 active:shadow-none"
		},
		size: {
			default: "h-9 px-4 py-2",
			sm: "h-8 rounded-md px-3 text-xs",
			lg: "h-10 rounded-md px-8",
			icon: "h-9 w-9",
			arcade: "min-h-12 rounded-sm px-5 py-3 text-[0.64rem] leading-relaxed sm:text-xs"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ jsx(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size,
			className
		})),
		ref,
		...props
	});
});
Button.displayName = "Button";
//#endregion
//#region src/features/spellbound/playerProfile.ts
var ACTIVE_PLAYER_PROFILE_KEY = "spellbound-arcade-active-player-v1";
var activePlayerNameInMemory = null;
function normalizePlayerName(value) {
	if (typeof value !== "string") return null;
	const displayName = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
	const length = Array.from(displayName).length;
	if (length === 0 || length > 18) return null;
	return {
		displayName,
		normalizedName: displayName.toLocaleLowerCase("pt-BR")
	};
}
function getActivePlayerName() {
	if (typeof window !== "undefined") try {
		const parsed = normalizePlayerName(window.localStorage.getItem(ACTIVE_PLAYER_PROFILE_KEY));
		if (parsed) return parsed.displayName;
	} catch {}
	return activePlayerNameInMemory;
}
function setActivePlayerName(value) {
	const parsed = value === null ? null : normalizePlayerName(value);
	activePlayerNameInMemory = parsed?.displayName ?? null;
	if (typeof window === "undefined") return;
	try {
		if (parsed) window.localStorage.setItem(ACTIVE_PLAYER_PROFILE_KEY, parsed.displayName);
		else window.localStorage.removeItem(ACTIVE_PLAYER_PROFILE_KEY);
	} catch {}
}
//#endregion
//#region src/features/spellbound/leaderboard/api.ts
var LEADERBOARD_UPDATED_EVENT = "spellbound:leaderboard-updated";
async function postJson(path, payload) {
	const response = await fetch(path, {
		method: "POST",
		credentials: "same-origin",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload)
	});
	if (!response.ok) {
		const detail = await response.json().catch(() => null);
		const message = typeof detail?.error === "string" ? detail.error : "A operação não foi concluída.";
		throw new Error(message);
	}
	return response.json().catch(() => ({}));
}
async function postJsonWithRetry(path, payload) {
	let lastError;
	for (let attempt = 0; attempt < 3; attempt += 1) try {
		return await postJson(path, payload);
	} catch (error) {
		lastError = error;
		if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
	}
	throw lastError instanceof Error ? lastError : /* @__PURE__ */ new Error("A operação não foi concluída.");
}
async function fetchGlobalLeaderboard(playerName) {
	const parsedName = normalizePlayerName(playerName);
	if (!parsedName) throw new Error("Informe um nome para carregar o ranking.");
	const query = new URLSearchParams({ playerName: parsedName.displayName });
	const response = await fetch(`/api/leaderboard?${query.toString()}`, {
		headers: { accept: "application/json" },
		cache: "no-store"
	});
	if (!response.ok) {
		const detail = await response.json().catch(() => null);
		const message = typeof detail?.error === "string" ? detail.error : "Não foi possível carregar o ranking.";
		throw new Error(message);
	}
	return await response.json();
}
async function submitGlobalRecord(game, score) {
	const playerName = getActivePlayerName();
	if (!playerName || !Number.isSafeInteger(score) || score <= 0) return false;
	try {
		await postJsonWithRetry("/api/leaderboard/score", {
			game,
			score,
			playerName
		});
		if (typeof window !== "undefined") window.dispatchEvent(new Event(LEADERBOARD_UPDATED_EVENT));
		return true;
	} catch {
		return false;
	}
}
async function syncGlobalCoinReward(matchId, amount, playerName = getActivePlayerName()) {
	if (!playerName || !matchId || !Number.isSafeInteger(amount) || amount <= 0) return;
	try {
		await postJsonWithRetry("/api/leaderboard/coins", {
			matchId,
			amount,
			playerName
		});
		if (typeof window !== "undefined") window.dispatchEvent(new Event(LEADERBOARD_UPDATED_EVENT));
	} catch {}
}
function subscribeToLeaderboardUpdates(listener) {
	if (typeof window === "undefined") return () => void 0;
	window.addEventListener(LEADERBOARD_UPDATED_EVENT, listener);
	return () => window.removeEventListener(LEADERBOARD_UPDATED_EVENT, listener);
}
//#endregion
//#region src/features/spellbound/currency.ts
var CURRENCY_STORAGE_KEY = "spellbound-arcade-currency-v1";
var CURRENCY_CHANGE_EVENT = "spellbound-arcade:currency-change";
var emptyStore = () => ({
	version: 1,
	balances: {},
	receipts: {},
	unlockedCharacters: {}
});
var memoryStore = emptyStore();
var matchIdCounter = 0;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function readStore() {
	if (typeof window === "undefined") return memoryStore;
	try {
		const raw = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
		if (!raw) return memoryStore;
		const parsed = JSON.parse(raw);
		if (!isRecord(parsed) || parsed["version"] !== 1) return memoryStore;
		return {
			version: 1,
			balances: isRecord(parsed["balances"]) ? parsed["balances"] : {},
			receipts: isRecord(parsed["receipts"]) ? parsed["receipts"] : {},
			unlockedCharacters: isRecord(parsed["unlockedCharacters"]) ? parsed["unlockedCharacters"] : {}
		};
	} catch {
		return memoryStore;
	}
}
function writeStore(store) {
	memoryStore = store;
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(store));
	} catch {}
	window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT));
}
function normalizeAmount(amount) {
	return Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
}
function getWalletBalance(walletId) {
	const balance = readStore().balances[walletId];
	return typeof balance === "number" && Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : 0;
}
function getPurchasedCharacterIds(walletId) {
	const stored = readStore().unlockedCharacters[walletId];
	return Array.isArray(stored) ? [...new Set(stored)] : [];
}
/** Deducts coins and records ownership in one localStorage write, so a character cannot be charged twice. */
function purchaseCharacter(walletId, characterId, cost) {
	if (!walletId) return "insufficient-funds";
	const store = readStore();
	const unlocked = store.unlockedCharacters[walletId] ?? [];
	if (unlocked.includes(characterId)) return "already-unlocked";
	const price = normalizeAmount(cost);
	const balance = normalizeAmount(store.balances[walletId] ?? 0);
	if (balance < price) return "insufficient-funds";
	store.balances[walletId] = balance - price;
	store.unlockedCharacters[walletId] = [...unlocked, characterId];
	writeStore(store);
	return "purchased";
}
function getMatchRewardReceipts(matchId) {
	const receipts = readStore().receipts[matchId];
	return Array.isArray(receipts) ? receipts.map((receipt) => ({ ...receipt })) : [];
}
/**
* Credits each participant once for a given match, while allowing eliminated participants to be
* settled before the remaining local players finish. Repeated calls return the original receipt.
*/
function settleMatchRewards(matchId, entries) {
	if (!matchId || entries.length === 0) return getMatchRewardReceipts(matchId);
	const store = readStore();
	const receipts = [...store.receipts[matchId] ?? []];
	const settledWallets = new Set(receipts.map((receipt) => receipt.walletId));
	let changed = false;
	for (const entry of entries) {
		if (!entry.walletId || settledWallets.has(entry.walletId)) continue;
		const amount = normalizeAmount(entry.amount);
		const total = normalizeAmount(store.balances[entry.walletId] ?? 0) + amount;
		const receipt = {
			walletId: entry.walletId,
			playerId: entry.playerId,
			playerName: entry.playerName.trim() || "JOGADOR",
			amount,
			total
		};
		store.balances[entry.walletId] = total;
		receipts.push(receipt);
		settledWallets.add(entry.walletId);
		changed = true;
	}
	if (changed) {
		store.receipts[matchId] = receipts;
		writeStore(store);
	}
	return receipts.map((receipt) => ({ ...receipt }));
}
function createMatchId(gameId) {
	matchIdCounter += 1;
	return `${gameId}:${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${matchIdCounter.toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}
/** Uses the entered name to select this browser's local player wallet; it does not authenticate anyone. */
function walletIdForPlayerName(playerName) {
	const normalized = normalizePlayerName(playerName)?.normalizedName ?? "";
	let hash = 2166136261;
	for (let index = 0; index < normalized.length; index += 1) {
		hash ^= normalized.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return `profile:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
/** Local multiplayer participants beyond slot 1 keep distinct balances shared across games. */
function walletIdForLocalSlot(slotIndex) {
	return `local-slot:${Math.max(2, Math.floor(slotIndex) + 1)}`;
}
function useWalletBalance(walletId) {
	const [balance, setBalance] = useState(0);
	useEffect(() => {
		const refresh = () => setBalance(getWalletBalance(walletId));
		const onStorage = (event) => {
			if (event.key === null || event.key === CURRENCY_STORAGE_KEY) refresh();
		};
		refresh();
		window.addEventListener("storage", onStorage);
		window.addEventListener(CURRENCY_CHANGE_EVENT, refresh);
		return () => {
			window.removeEventListener("storage", onStorage);
			window.removeEventListener(CURRENCY_CHANGE_EVENT, refresh);
		};
	}, [walletId]);
	return balance;
}
/** Settles only finalized participants. The JSON signature keeps the effect quiet during RAF HUD updates. */
function useMatchCurrencyRewards(matchId, finalizedEntries, primaryWalletId) {
	const payload = JSON.stringify(finalizedEntries);
	const [receipts, setReceipts] = useState([]);
	useEffect(() => {
		const settledReceipts = settleMatchRewards(matchId, JSON.parse(payload));
		setReceipts(getMatchRewardReceipts(matchId));
		const primaryReceipt = settledReceipts.find((receipt) => receipt.walletId === primaryWalletId);
		if (primaryWalletId && primaryReceipt) syncGlobalCoinReward(matchId, primaryReceipt.amount);
	}, [
		matchId,
		payload,
		primaryWalletId
	]);
	return receipts;
}
//#endregion
//#region src/assets/characters/fox.png
var fox_default = "/assets/fox-O_0-EBQH.png";
//#endregion
//#region src/assets/characters/frog.png
var frog_default = "/assets/frog-ByZCjgDu.png";
//#endregion
//#region src/assets/characters/owl.png
var owl_default = "/assets/owl-CzdhdhzK.png";
//#endregion
//#region src/assets/characters/rabbit.png
var rabbit_default = "/assets/rabbit-DRa05r4d.png";
//#endregion
//#region src/assets/characters/raccoon.png
var raccoon_default = "/assets/raccoon-BPz_Szrg.png";
//#endregion
//#region src/assets/characters/capybara.png
var capybara_default = "/assets/capybara-BeBGCZko.png";
//#endregion
//#region src/assets/characters/axolotl.png
var axolotl_default = "/assets/axolotl-CeMlQRr5.png";
//#endregion
//#region src/features/spellbound/data/characters.ts
var playableCharacterSeeds = [
	{
		id: "white-fox-ice-mage",
		name: "Raposa Branca do Gelo",
		shortName: "RAPOSA",
		theme: "Gelo",
		magicLabel: "MAGIA DO GELO",
		description: "Uma maga capaz de controlar o gelo.",
		dominantColor: "Branco / Azul",
		badgeClassName: "bg-spell-ice",
		sprite: fox_default
	},
	{
		id: "purple-rabbit-ninja",
		name: "Coelho Ninja Roxo",
		shortName: "COELHO",
		theme: "Magia Ninja",
		magicLabel: "MAGIA NINJA",
		description: "Um ninja veloz que salta entre sombras mágicas.",
		dominantColor: "Roxo",
		badgeClassName: "bg-spell-ninja",
		sprite: rabbit_default
	},
	{
		id: "swamp-frog-mage",
		name: "Sapo Mago do Pântano",
		shortName: "SAPO",
		theme: "Pântano",
		magicLabel: "MAGIA DO PÂNTANO",
		description: "Um mago que desperta musgo, raízes e plantas.",
		dominantColor: "Verde",
		badgeClassName: "bg-spell-swamp",
		sprite: frog_default
	},
	{
		id: "forge-raccoon-mage",
		name: "Guaxinim da Forja",
		shortName: "GUAXINIM",
		theme: "Forja de Fogo",
		magicLabel: "MAGIA DA FORJA",
		description: "Um ferreiro que molda o fogo com seu martelo.",
		dominantColor: "Laranja / Vermelho",
		badgeClassName: "bg-spell-forge",
		sprite: raccoon_default
	},
	{
		id: "time-owl-mage",
		name: "Coruja do Tempo",
		shortName: "CORUJA",
		theme: "Tempo",
		magicLabel: "MAGIA DO TEMPO",
		description: "Uma maga misteriosa que dobra os ponteiros do tempo.",
		dominantColor: "Azul / Roxo",
		badgeClassName: "bg-spell-time",
		sprite: owl_default
	},
	{
		id: "calm-capybara-mage",
		name: "Capivara da Calmaria",
		shortName: "CAPIVARA",
		theme: "Calmaria",
		magicLabel: "MAGIA DA CALMARIA",
		description: "Uma maga tranquila que desacelera os espíritos e ajuda a alinhar peças.",
		dominantColor: "Canela / Azul / Ciano",
		badgeClassName: "bg-spell-time",
		sprite: capybara_default,
		coinCost: 1e3
	},
	{
		id: "axolotl-mage",
		name: "Axolote Guardião",
		shortName: "AXOLOTE",
		theme: "Vida e Renascimento",
		magicLabel: "MAGIA DA RESSURREIÇÃO",
		description: "Guarda um coração a mais e pode trazer um aliado de volta à partida.",
		dominantColor: "Rosa / Azul / Roxo",
		badgeClassName: "bg-spell-time",
		sprite: axolotl_default,
		coinCost: 1e3
	}
];
function getCharacterById(id) {
	return playableCharacterSeeds.find((character) => character.id === id) ?? null;
}
//#endregion
//#region src/features/spellbound/components/PixelSceneDecor.tsx
var starPositions = [
	"left-[8%] top-[10%]",
	"left-[20%] top-[24%]",
	"left-[44%] top-[12%]",
	"left-[68%] top-[20%]",
	"left-[84%] top-[9%]",
	"left-[91%] top-[36%]",
	"left-[13%] top-[64%]",
	"left-[73%] top-[72%]"
];
function PixelStar({ className }) {
	return /* @__PURE__ */ jsx("span", {
		"aria-hidden": "true",
		className: `twinkle absolute h-3 w-3 bg-arcade-star shadow-[0_0_16px_var(--color-arcade-star)] ${className}`
	});
}
function PixelCloud({ className }) {
	return /* @__PURE__ */ jsx("div", {
		"aria-hidden": "true",
		className: `absolute ${className}`,
		children: /* @__PURE__ */ jsxs("div", {
			className: "relative h-12 w-28 bg-arcade-cloud shadow-[8px_8px_0_var(--color-arcade-cloud-shadow)] sm:h-16 sm:w-40",
			children: [
				/* @__PURE__ */ jsx("span", { className: "absolute -top-5 left-5 h-9 w-12 bg-arcade-cloud sm:-top-7 sm:h-12 sm:w-16" }),
				/* @__PURE__ */ jsx("span", { className: "absolute -top-8 left-14 h-12 w-14 bg-arcade-cloud sm:-top-10 sm:left-20 sm:h-16 sm:w-20" }),
				/* @__PURE__ */ jsx("span", { className: "absolute -right-4 top-4 h-8 w-8 bg-arcade-cloud sm:h-10 sm:w-10" })
			]
		})
	});
}
function FloatingIsland({ className }) {
	return /* @__PURE__ */ jsxs("div", {
		"aria-hidden": "true",
		className: `floaty absolute ${className}`,
		children: [/* @__PURE__ */ jsx("div", { className: "mx-auto h-6 w-24 bg-island-grass-bright shadow-[0_6px_0_var(--color-island-grass)]" }), /* @__PURE__ */ jsx("div", { className: "mx-auto h-12 w-16 bg-island-earth shadow-[8px_8px_0_var(--color-arcade-shadow)]" })]
	});
}
function PixelSceneDecor({ density = "full" }) {
	const visibleStars = density === "full" ? starPositions : starPositions.slice(0, 5);
	return /* @__PURE__ */ jsxs("div", {
		"aria-hidden": "true",
		className: "pointer-events-none absolute inset-0 overflow-hidden pixelated",
		children: [
			visibleStars.map((position) => /* @__PURE__ */ jsx(PixelStar, { className: position }, position)),
			/* @__PURE__ */ jsx(PixelCloud, { className: "left-[-2rem] top-[18%] opacity-85" }),
			/* @__PURE__ */ jsx(PixelCloud, { className: "right-[-3rem] top-[52%] scale-75 opacity-80" }),
			density === "full" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx(FloatingIsland, { className: "left-[4%] top-[44%] hidden sm:block" }), /* @__PURE__ */ jsx(FloatingIsland, { className: "right-[6%] top-[28%] scale-75" })] }) : null
		]
	});
}
//#endregion
//#region src/features/spellbound/gameplay/sprites/baseAnimations.ts
/** Shared basic animations. Characters may override any of them. */
var baseAnimations = {
	idle: {
		fps: 3,
		loop: true,
		frames: [
			{ legs: "stand" },
			{
				legs: "stand",
				dy: .5,
				scaleY: .97
			},
			{ legs: "stand" },
			{
				legs: "stand",
				eyes: "closed"
			}
		]
	},
	walk: {
		fps: 6,
		loop: true,
		frames: [
			{ legs: "stepA" },
			{
				legs: "stand",
				dy: -.5
			},
			{ legs: "stepB" },
			{
				legs: "stand",
				dy: -.5
			}
		]
	},
	run: {
		fps: 12,
		loop: true,
		frames: [
			{
				legs: "stepA",
				rotate: 8,
				dy: -1
			},
			{
				legs: "spread",
				rotate: 8,
				dy: -2
			},
			{
				legs: "stepB",
				rotate: 8,
				dy: -1
			},
			{
				legs: "tuck",
				rotate: 8
			}
		]
	},
	jump: {
		fps: 8,
		loop: true,
		frames: [
			{
				legs: "down",
				scaleY: .85,
				scaleX: 1.1,
				dy: 1
			},
			{
				legs: "tuck",
				dy: -4,
				scaleY: 1.1
			},
			{
				legs: "tuck",
				dy: -6
			},
			{
				legs: "spread",
				dy: -5
			},
			{
				legs: "spread",
				dy: -2
			},
			{
				legs: "down",
				scaleY: .9,
				scaleX: 1.08,
				dy: 1
			}
		]
	},
	hurt: {
		fps: 10,
		loop: true,
		frames: [
			{
				legs: "spread",
				eyes: "hurt",
				dx: -1.5,
				rotate: -10,
				fx: "flash"
			},
			{
				legs: "spread",
				eyes: "hurt",
				dx: 1,
				rotate: -6
			},
			{
				legs: "spread",
				eyes: "hurt",
				dx: -1,
				rotate: -8,
				fx: "flash"
			},
			{
				legs: "stand",
				eyes: "hurt"
			},
			{
				legs: "stand",
				eyes: "hurt"
			}
		]
	},
	victory: {
		fps: 6,
		loop: true,
		frames: [
			{
				legs: "down",
				eyes: "happy",
				scaleY: .9,
				dy: 1
			},
			{
				legs: "tuck",
				eyes: "happy",
				dy: -4,
				fx: "sparkle"
			},
			{
				legs: "tuck",
				eyes: "happy",
				dy: -5,
				rotate: 10,
				fx: "sparkle"
			},
			{
				legs: "tuck",
				eyes: "happy",
				dy: -4,
				rotate: -10,
				fx: "sparkle"
			},
			{
				legs: "stand",
				eyes: "happy"
			}
		]
	},
	defeat: {
		fps: 4,
		loop: false,
		frames: [
			{
				legs: "stand",
				eyes: "hurt"
			},
			{
				legs: "spread",
				eyes: "hurt",
				rotate: -20,
				dy: 1
			},
			{
				legs: "spread",
				eyes: "closed",
				rotate: -60,
				dy: 3
			},
			{
				legs: "spread",
				eyes: "closed",
				rotate: -90,
				dy: 4,
				fx: "stars"
			}
		]
	}
};
var gameplaySprites = {
	"white-fox-ice-mage": {
		characterId: "white-fox-ice-mage",
		legColumns: [5, 9],
		palette: {
			o: "#1e2a5a",
			b: "#f7fbff",
			l: "#cfe6ff",
			a: "#4aa3f0",
			c: "#9ee8ff",
			e: "#1e2a5a",
			m: "#b8f4ff",
			n: "#1e2a5a"
		},
		grid: [
			"..o.......o.....",
			".oco.....oco....",
			".obbo...obbo....",
			".obbboooobbo....",
			".obbbbbbbbbo....",
			"obebbbbbbbebo...",
			"obbbblnlbbbbo...",
			".obblllllbbo..o.",
			"..obbllllbo..obo",
			"..oaaacaaaao.obo",
			".oaaalllaaaoocbo",
			".oaaalllaaaobbo.",
			"..oaaacaaaoobo..",
			"...ooooooooo...."
		]
	},
	"purple-rabbit-ninja": {
		characterId: "purple-rabbit-ninja",
		legColumns: [5, 9],
		palette: {
			o: "#2a1648",
			b: "#a67ae8",
			l: "#e3d2ff",
			a: "#3b2a6e",
			c: "#ff6fb0",
			e: "#ffffff",
			m: "#d9b8ff",
			n: "#ff9ac8"
		},
		grid: [
			"...oo...oo......",
			"..obbo.oblo.....",
			"..oblo.oblo.....",
			"..oblo.oblo.....",
			"..obbooobbo.....",
			".obbbbbbbbbo....",
			".oaaaaaaaaaocc..",
			".oaeaaaaaeaoc...",
			".obbbbnbbbbo....",
			"..obbllbbbo.....",
			"..oaaaaaaaao....",
			".oaaacccaaaao...",
			"..oaaaaaaaao....",
			"...ooooooooo...."
		],
		animations: { ability: {
			fps: 12,
			loop: true,
			frames: [
				{
					legs: "spread",
					rotate: -8,
					dx: -1
				},
				{
					legs: "tuck",
					rotate: 10,
					dx: 1,
					fx: "sparkle"
				},
				{
					legs: "stand",
					rotate: -4
				}
			]
		} }
	},
	"swamp-frog-mage": {
		characterId: "swamp-frog-mage",
		legColumns: [4, 10],
		palette: {
			o: "#12331f",
			b: "#5cc46a",
			l: "#c8f0a8",
			a: "#3c7a4a",
			c: "#8fe06a",
			e: "#12331f",
			m: "#b4ff9a",
			n: "#e87a8a"
		},
		grid: [
			"...ooo....ooo...",
			"..olelo..olelo..",
			"..olllo..olllo..",
			".obbbbbbbbbbbbo.",
			".obbbbbbbbbbbbo.",
			".obbnnnnnnnnbbo.",
			"..obbbbbbbbbbo..",
			"...occcccccco...",
			"..oaaaaaaaaaao..",
			".oaaallllllaaao.",
			".oaaallllllaaao.",
			".oaaacaaaacaaao.",
			"..oaaaaaaaaaao..",
			"...oooooooooo..."
		]
	},
	"forge-raccoon-mage": {
		characterId: "forge-raccoon-mage",
		legColumns: [5, 9],
		palette: {
			o: "#241a1a",
			b: "#9aa0ad",
			l: "#e6e8ee",
			a: "#8a4a2a",
			c: "#ff7a2a",
			e: "#ffffff",
			m: "#ffb347",
			n: "#241a1a"
		},
		grid: [
			"..oo......oo....",
			".obbo....obbo...",
			".obbboooobbbo...",
			".obbbbbbbbbbo...",
			"ooooeooooeoooo..",
			".oolllllllllo...",
			".obllllnlllbo.oo",
			"..obllllllbo.obo",
			"...obbbbbbo.oolo",
			"..oaaaaaaaaoobo.",
			".oaalllllaaoolo.",
			".oacalllacaobo..",
			"..oaaaaaaaao....",
			"...ooooooooo...."
		]
	},
	"time-owl-mage": {
		characterId: "time-owl-mage",
		legColumns: [5, 9],
		palette: {
			o: "#1a1a4a",
			b: "#5a6ee0",
			l: "#d8e0ff",
			a: "#7a4ec8",
			c: "#9ee8ff",
			e: "#1a1a4a",
			m: "#c8b8ff",
			n: "#b8c4ff"
		},
		grid: [
			".oo........oo...",
			".obo......obo...",
			"..obooooooob....",
			"..obbbbbbbbbo...",
			".obllllbllllbo..",
			".oblellblelbo...",
			".obllllnllllbo..",
			"..obbbnnnbbbo...",
			".oabbbbbbbbbao..",
			"oaabbooooobbaao.",
			"oaabocccccobaao.",
			".oabocoocobbao..",
			"..oabooooobao...",
			"...ooooooooo...."
		]
	}
};
function getGameplaySprite(id) {
	return gameplaySprites[id];
}
/** Resolves an animation: character override first, then shared base animation. */
function getAnimation(id, state) {
	return (gameplaySprites[id]?.animations ?? {})[state] ?? baseAnimations[state];
}
//#endregion
//#region src/features/spellbound/gameplay/sprites/footAnchor.ts
var SCALE_ORIGIN_X = 8;
var SCALE_ORIGIN_Y = 16;
var ROTATION_ORIGIN_X = 8;
var ROTATION_ORIGIN_Y = 13;
/** Apply the same SVG scale/rotation/translation order used by GameplaySprite to a foot pixel. */
function transformFootPixelY(x, y, frame) {
	const scaledX = SCALE_ORIGIN_X + (x - SCALE_ORIGIN_X) * (frame.scaleX ?? 1);
	const scaledY = SCALE_ORIGIN_Y + (y - SCALE_ORIGIN_Y) * (frame.scaleY ?? 1);
	const radians = (frame.rotate ?? 0) * Math.PI / 180;
	return ROTATION_ORIGIN_Y + (scaledX - ROTATION_ORIGIN_X) * Math.sin(radians) + (scaledY - ROTATION_ORIGIN_Y) * Math.cos(radians) + (frame.dy ?? 0);
}
/** Return the vertical SVG translation that keeps the lowest foot pixel on a shared baseline. */
function getFootAnchorCorrection(legs, frame, baselineY = 16) {
	return baselineY - Math.max(...legs.map((leg) => transformFootPixelY(leg.x, 14 + leg.height, frame)));
}
//#endregion
//#region src/features/spellbound/gameplay/sprites/useSpriteAnimation.ts
/** Advances the frame index of an animation. Non-looping animations stop on the last frame. */
function useSpriteAnimation(animation) {
	const [frameIndex, setFrameIndex] = useState(0);
	useEffect(() => {
		setFrameIndex(0);
		if (!animation) return;
		const interval = window.setInterval(() => {
			setFrameIndex((current) => {
				const next = current + 1;
				if (next < animation.frames.length) return next;
				return animation.loop ? 0 : current;
			});
		}, 1e3 / animation.fps);
		return () => window.clearInterval(interval);
	}, [animation]);
	return animation?.frames[frameIndex] ?? animation?.frames[0];
}
//#endregion
//#region src/features/spellbound/gameplay/sprites/GameplaySprite.tsx
var FOOT_BASE_Y = 16;
function legOffsets(pose) {
	switch (pose) {
		case "stepA": return [
			-1,
			1,
			2,
			1
		];
		case "stepB": return [
			1,
			-1,
			1,
			2
		];
		case "tuck": return [
			0,
			0,
			1,
			1
		];
		case "spread": return [
			-1,
			1,
			2,
			2
		];
		case "down": return [
			0,
			0,
			1,
			1
		];
		default: return [
			0,
			0,
			2,
			2
		];
	}
}
function eyeColor(pose, key, palette) {
	if (key !== "e") return palette[key];
	if (pose === "closed" || pose === "happy") return palette.o;
	if (pose === "hurt") return "#ffffff";
	return palette.e;
}
function GameplaySprite({ characterId, animation = "idle", size = 96, facing = "right", sourceFacing = "right", footAnchored = false, className }) {
	const sprite = getGameplaySprite(characterId);
	const shouldFlipX = facing !== sourceFacing;
	const frame = useSpriteAnimation(useMemo(() => getAnimation(characterId, animation), [characterId, animation])) ?? {};
	const eyes = frame.eyes ?? "open";
	const bodyPixels = useMemo(() => {
		const out = [];
		sprite?.grid.forEach((row, y) => [...row].forEach((ch, x) => {
			if (ch !== ".") out.push({
				x,
				y,
				key: ch
			});
		}));
		return out;
	}, [sprite]);
	const [ldx, rdx, lh, rh] = legOffsets(frame.legs ?? "stand");
	const [lx, rx] = sprite?.legColumns ?? [0, 0];
	const legs = [{
		x: lx + ldx,
		h: lh
	}, {
		x: rx + rdx,
		h: rh
	}];
	const scaleY = frame.scaleY ?? 1;
	const footPixelLegs = legs.map((leg) => ({
		x: leg.x,
		height: leg.h
	}));
	const footCorrection = footAnchored ? getFootAnchorCorrection(footPixelLegs, frame, FOOT_BASE_Y) : 0;
	const transform = [
		`translate(${frame.dx ?? 0} ${(frame.dy ?? 0) + footCorrection})`,
		`rotate(${frame.rotate ?? 0} 8 13)`,
		`translate(8 16) scale(${frame.scaleX ?? 1} ${scaleY}) translate(-8 -16)`
	].join(" ");
	if (!sprite) return /* @__PURE__ */ jsx("img", {
		src: characterId === "calm-capybara-mage" ? capybara_default : axolotl_default,
		alt: characterId,
		width: size,
		height: footAnchored ? size : size * 26 / 24,
		className,
		style: {
			imageRendering: "pixelated",
			objectFit: "contain",
			transform: shouldFlipX ? "scaleX(-1)" : void 0,
			overflow: "visible"
		},
		role: "img",
		"aria-label": `${characterId} ${animation}`
	});
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: footAnchored ? `-4 -8 24 24` : `-4 -8 24 26`,
		width: size,
		height: footAnchored ? size : size * 26 / 24,
		shapeRendering: "crispEdges",
		className,
		style: {
			transform: shouldFlipX ? "scaleX(-1)" : void 0,
			overflow: "visible"
		},
		role: "img",
		"aria-label": `${characterId} ${animation}`,
		children: [
			/* @__PURE__ */ jsx("ellipse", {
				cx: 8,
				cy: footAnchored ? 15.2 : 16.4,
				rx: 5,
				ry: .8,
				fill: "#1e2a5a",
				opacity: .25
			}),
			/* @__PURE__ */ jsxs("g", {
				transform,
				children: [
					legs.map((leg, i) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("rect", {
						x: leg.x,
						y: 14,
						width: 2,
						height: leg.h,
						fill: sprite.palette.o
					}), leg.h === 2 && /* @__PURE__ */ jsx("rect", {
						x: leg.x + .25,
						y: 14,
						width: 1.5,
						height: 1,
						fill: sprite.palette.a
					})] }, i)),
					bodyPixels.map((p) => /* @__PURE__ */ jsx("rect", {
						x: p.x,
						y: p.y,
						width: 1.02,
						height: 1.02,
						fill: eyeColor(eyes, p.key, sprite.palette)
					}, `${p.x}-${p.y}`)),
					frame.fx === "flash" && /* @__PURE__ */ jsx("rect", {
						x: 0,
						y: 0,
						width: 16,
						height: 14,
						fill: "#ffffff",
						opacity: .45
					})
				]
			}),
			frame.fx === "sparkle" && [
				[-2, -2],
				[15, -1],
				[-1, 8],
				[16, 6]
			].map(([x, y]) => /* @__PURE__ */ jsx("rect", {
				x,
				y: y + (frame.dy ?? 0),
				width: 1,
				height: 1,
				fill: sprite.palette.m
			}, `${x}${y}`)),
			frame.fx === "stars" && [
				[4, 6],
				[8, 5],
				[12, 6]
			].map(([x, y]) => /* @__PURE__ */ jsx("rect", {
				x,
				y,
				width: 1,
				height: 1,
				fill: "#b8f4ff"
			}, `${x}${y}`))
		]
	});
}
//#endregion
//#region src/features/spellbound/gameplay/sprites/types.ts
/** Animation states implemented right now (ability comes with the abilities system). */
var BASIC_ANIMATION_STATES = [
	"idle",
	"walk",
	"run",
	"jump",
	"hurt",
	"victory",
	"defeat"
];
//#endregion
//#region src/features/spellbound/components/GameplaySpritePreview.tsx
var LABELS = {
	idle: "PARADO",
	walk: "ANDAR",
	run: "CORRER",
	jump: "PULAR",
	hurt: "DANO",
	victory: "VITÓRIA",
	defeat: "DERROTA",
	ability: "HABILIDADE"
};
function GameplaySpritePreview({ characterId }) {
	const [state, setState] = useState("idle");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/25 p-3",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "font-arcade text-[0.55rem] text-arcade-cyan",
				children: "SPRITE DE JOGO"
			}),
			/* @__PURE__ */ jsx("div", {
				className: "flex h-28 items-end justify-center",
				children: /* @__PURE__ */ jsx(GameplaySprite, {
					characterId,
					animation: state,
					size: 96
				}, `${characterId}-${state}`)
			}),
			/* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-4 gap-1",
				children: BASIC_ANIMATION_STATES.map((s) => /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setState(s),
					className: cn("border-2 border-arcade-panel-border px-1.5 py-1 font-arcade text-[0.45rem] text-arcade-ink transition-colors hover:bg-arcade-lilac/40", state === s && "bg-arcade-lilac/60"),
					children: LABELS[s]
				}, s))
			})
		]
	});
}
//#endregion
//#region src/features/spellbound/components/CharacterSelectScreen.tsx
function CharacterSelectScreen({ selectedId, walletId, unlockedCharacterIds, onSelect, onPurchase, onBack }) {
	const selected = getCharacterById(selectedId);
	const coinBalance = useWalletBalance(walletId);
	const [purchaseFeedback, setPurchaseFeedback] = useState("");
	const handlePurchase = (characterId) => {
		const result = onPurchase(characterId);
		if (result === "purchased") setPurchaseFeedback("PERSONAGEM DESBLOQUEADO! Agora você pode selecioná-lo.");
		else if (result === "insufficient-funds") setPurchaseFeedback("MOEDAS INSUFICIENTES PARA ESTA COMPRA.");
		else setPurchaseFeedback("ESTE PERSONAGEM JÁ ESTÁ DESBLOQUEADO.");
	};
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, {}), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5",
			children: [
				/* @__PURE__ */ jsxs("header", {
					className: "flex flex-wrap items-center justify-between gap-4",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "font-arcade text-[0.56rem] text-arcade-violet sm:text-xs",
								children: "MAGISTERIUM ARCADE"
							}),
							/* @__PURE__ */ jsx("h1", {
								className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-4xl",
								children: "PERSONAGENS"
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "mt-2 font-arcade text-[0.5rem] text-arcade-gold",
								children: ["SALDO: 🪙 ", coinBalance.toLocaleString("pt-BR")]
							})
						]
					}), /* @__PURE__ */ jsx(Button, {
						type: "button",
						variant: "arcade",
						size: "arcade",
						onClick: onBack,
						children: "VOLTAR AO LOBBY"
					})]
				}),
				/* @__PURE__ */ jsx("section", {
					className: "pixel-panel grid gap-5 rounded-sm p-4 sm:p-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)_auto]",
					children: selected ? /* @__PURE__ */ jsxs(Fragment$1, { children: [
						/* @__PURE__ */ jsxs("div", {
							className: "relative mx-auto flex h-56 w-56 items-center justify-center border-2 border-arcade-panel-border bg-arcade-sky/35",
							children: [/* @__PURE__ */ jsx("div", {
								className: "absolute inset-6 animate-pulse rounded-full bg-arcade-cyan/30 blur-xl",
								"aria-hidden": "true"
							}), /* @__PURE__ */ jsx("img", {
								src: selected.sprite,
								alt: selected.name,
								width: 816,
								height: 816,
								className: "floaty relative h-52 w-52 object-contain [image-rendering:pixelated]"
							}, selected.id)]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex min-w-0 flex-col justify-center gap-3",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.6rem] text-arcade-cyan sm:text-xs",
									children: "PERSONAGEM SELECIONADO"
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl",
									children: selected.shortName
								}),
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-xs text-arcade-lilac sm:text-sm",
									children: selected.magicLabel
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "font-game text-xl leading-tight text-muted-foreground sm:text-2xl",
									children: [
										"\"",
										selected.description,
										"\""
									]
								})
							]
						}),
						/* @__PURE__ */ jsx(GameplaySpritePreview, { characterId: selected.id })
					] }) : /* @__PURE__ */ jsxs("div", {
						className: "col-span-full py-10 text-center",
						children: [/* @__PURE__ */ jsx("p", {
							className: "font-arcade text-xs text-arcade-cyan sm:text-sm",
							children: "ESCOLHA SEU ANIMAL MAGO"
						}), /* @__PURE__ */ jsx("p", {
							className: "mt-2 font-game text-xl text-muted-foreground",
							children: "Selecione um personagem desbloqueado abaixo."
						})]
					})
				}),
				/* @__PURE__ */ jsx("section", {
					className: "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7",
					"aria-label": "Seleção de personagens",
					children: playableCharacterSeeds.map((character) => {
						const isSelected = character.id === selectedId;
						const isUnlocked = !character.coinCost || unlockedCharacterIds.includes(character.id);
						const canAfford = coinBalance >= (character.coinCost ?? 0);
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => isUnlocked ? onSelect(character.id) : handlePurchase(character.id),
							disabled: !isUnlocked && !canAfford,
							"aria-pressed": isSelected,
							"aria-label": isUnlocked ? `${character.name}: selecionar` : canAfford ? `Comprar ${character.name} por ${character.coinCost} moedas` : `${character.name} bloqueado; faltam ${(character.coinCost ?? 0) - coinBalance} moedas`,
							className: cn("pixel-panel group flex flex-col items-center gap-2 rounded-sm p-3 text-center transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-75", isSelected && "-translate-y-1 ring-4 ring-arcade-cyan", !isUnlocked && "border-arcade-gold/70"),
							children: [
								/* @__PURE__ */ jsx("img", {
									src: character.sprite,
									alt: character.name,
									width: 816,
									height: 816,
									loading: "lazy",
									className: cn("h-28 w-28 object-contain [image-rendering:pixelated] transition-transform group-hover:scale-105", isSelected && "floaty", !isUnlocked && "grayscale-[0.25]")
								}),
								/* @__PURE__ */ jsx("h3", {
									className: "font-arcade text-[0.6rem] leading-relaxed text-arcade-ink sm:text-xs",
									children: character.shortName
								}),
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.5rem] leading-relaxed text-arcade-violet sm:text-[0.55rem]",
									children: character.magicLabel
								}),
								/* @__PURE__ */ jsx("p", {
									className: "font-game text-base leading-tight text-muted-foreground",
									children: character.description
								}),
								!isUnlocked && /* @__PURE__ */ jsxs("span", {
									className: "font-arcade text-[0.45rem] text-arcade-gold",
									children: [
										"🔒 ",
										character.coinCost?.toLocaleString("pt-BR"),
										" MOEDAS"
									]
								}),
								/* @__PURE__ */ jsx("span", {
									className: cn("mt-auto font-arcade text-[0.48rem]", isSelected ? "text-arcade-cyan" : isUnlocked ? "text-muted-foreground" : "text-arcade-gold"),
									children: isSelected ? "✦ SELECIONADO ✦" : isUnlocked ? "SELECIONAR" : canAfford ? "COMPRAR" : "MOEDAS INSUFICIENTES"
								})
							]
						}, character.id);
					})
				}),
				/* @__PURE__ */ jsx("p", {
					className: "min-h-5 text-center font-arcade text-[0.5rem] text-arcade-cyan",
					"aria-live": "polite",
					children: purchaseFeedback
				})
			]
		})]
	});
}
//#endregion
//#region src/features/spellbound/data/gameModes.ts
/**
* The mode catalog is the single source of truth for which play options each
* minigame exposes. New games can opt into any combination without changing
* the shared mode-selection UI.
*/
var MINIGAME_MODE_CAPABILITIES = {
	"sky-flap": {
		singleplayer: true,
		multiplayer: true,
		bots: true,
		privateRoom: true
	},
	"sky-run": {
		singleplayer: true,
		multiplayer: true,
		bots: true,
		privateRoom: true
	},
	tower: {
		singleplayer: false,
		multiplayer: true,
		bots: true,
		privateRoom: true
	},
	"spellbound-maze": {
		singleplayer: true,
		multiplayer: true,
		bots: true,
		privateRoom: true
	}
};
function supportsMinigameMode(gameId, mode) {
	return MINIGAME_MODE_CAPABILITIES[gameId][mode];
}
//#endregion
//#region src/features/spellbound/components/GameModeSelectorScreen.tsx
var GAME_COPY = {
	"sky-flap": {
		title: "SKY FLAP",
		intro: "Prepare suas asas para atravessar os portais celestiais.",
		multiplayer: "Compita no mesmo percurso mágico, contra bots ou com amigos."
	},
	"sky-run": {
		title: "SKY RUN",
		intro: "Corra por mundos encantados e desvie dos obstáculos mágicos.",
		multiplayer: "Corra no mesmo percurso, contra bots ou com amigos."
	},
	tower: {
		title: "TOWER",
		intro: "Construa sua torre e dispute a arena encantada.",
		multiplayer: "Escolha bots para enfrentar ou crie uma sala privada."
	},
	"spellbound-maze": {
		title: "LABIRINTO MÁGICO",
		intro: "Explore labirintos celestes sem fim, reúna runas e escape dos espíritos.",
		multiplayer: "Corra por objetivos compartilhados e dispute quem alcança o portal primeiro."
	}
};
var MODE_ACCENTS = {
	cyan: {
		ring: "focus-visible:ring-arcade-cyan",
		number: "text-arcade-cyan",
		border: "border-arcade-cyan",
		hover: "group-hover:bg-arcade-cyan/25"
	},
	violet: {
		ring: "focus-visible:ring-arcade-violet",
		number: "text-arcade-violet",
		border: "border-arcade-violet",
		hover: "group-hover:bg-arcade-violet/25"
	}
};
function GameModeSelectorScreen({ gameId, onSingleplayer, onMultiplayer, onBack }) {
	const copy = GAME_COPY[gameId];
	const modes = [supportsMinigameMode(gameId, "singleplayer") && onSingleplayer ? {
		key: "singleplayer",
		title: "SINGLEPLAYER",
		description: copy.intro,
		action: "JOGAR SOZINHO",
		onClick: onSingleplayer,
		accent: MODE_ACCENTS.cyan
	} : null, supportsMinigameMode(gameId, "multiplayer") && onMultiplayer ? {
		key: "multiplayer",
		title: "MULTIPLAYER",
		description: copy.multiplayer,
		action: "ABRIR OPÇÕES",
		onClick: onMultiplayer,
		accent: MODE_ACCENTS.violet
	} : null].filter((mode) => mode !== null);
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, { density: "calm" }), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex min-h-[85vh] w-full max-w-5xl flex-col",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex items-center justify-between gap-4",
				children: [/* @__PURE__ */ jsx("p", {
					className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-xs",
					children: "MAGISTERIUM ARCADE"
				}), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "arcade",
					onClick: onBack,
					children: "VOLTAR AO LOBBY"
				})]
			}), /* @__PURE__ */ jsxs("section", {
				className: "my-auto py-12 text-center",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "mb-3 font-arcade text-xs text-arcade-ink sm:text-sm",
						children: copy.title
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "pixel-title text-3xl leading-relaxed text-arcade-ink sm:text-5xl",
						children: "ESCOLHA A MODALIDADE"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mx-auto mt-3 max-w-xl font-game text-lg text-muted-foreground sm:text-xl",
						children: copy.intro
					}),
					/* @__PURE__ */ jsx("div", {
						className: `mx-auto mt-10 grid max-w-4xl gap-5 ${modes.length > 1 ? "sm:grid-cols-2" : "sm:max-w-xl"}`,
						children: modes.map((mode) => /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: mode.onClick,
							className: `pixel-panel group flex min-h-60 flex-col items-center justify-center gap-4 rounded-sm border-2 border-arcade-panel-border bg-arcade-panel/90 p-6 text-center shadow-[6px_6px_0_var(--color-arcade-shadow)] transition-transform hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 ${mode.accent.ring}`,
							children: [
								/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									className: `font-arcade text-4xl ${mode.accent.number}`,
									children: mode.key === "singleplayer" ? "01" : "02"
								}),
								/* @__PURE__ */ jsx("span", {
									className: "font-arcade text-xl text-arcade-ink sm:text-2xl",
									children: mode.title
								}),
								/* @__PURE__ */ jsx("span", {
									className: "max-w-xs font-game text-lg text-muted-foreground",
									children: mode.description
								}),
								/* @__PURE__ */ jsx("span", {
									className: `mt-1 border-2 ${mode.accent.border} bg-arcade-sky/60 px-5 py-2 font-arcade text-[0.6rem] text-arcade-ink transition-colors ${mode.accent.hover}`,
									children: mode.action
								})
							]
						}, mode.key))
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/features/spellbound/data/lobbyOptions.ts
var lobbyOptions = [
	{
		id: "tower",
		label: "TORRE",
		description: "Desafios mágicos de arcade",
		accentClassName: "bg-arcade-cyan"
	},
	{
		id: "sky-flap",
		label: "SKY FLAP",
		description: "Voe entre portais celestiais",
		accentClassName: "bg-arcade-sky-deep"
	},
	{
		id: "sky-run",
		label: "SKY RUN",
		description: "Corra pelas ilhas celestiais",
		accentClassName: "bg-arcade-violet"
	},
	{
		id: "spellbound-maze",
		label: "LABIRINTO MÁGICO",
		description: "Explore corredores arcanos e encontre o portal",
		accentClassName: "bg-arcade-mint"
	},
	{
		id: "characters",
		label: "PERSONAGENS",
		description: "Escolha seu animal mago",
		accentClassName: "bg-arcade-violet"
	},
	{
		id: "customize",
		label: "PERSONALIZAR",
		description: "Oficina de cosméticos",
		accentClassName: "bg-arcade-pink"
	},
	{
		id: "leaderboard",
		label: "RANKING",
		description: "Salão de pontuações em obras",
		accentClassName: "bg-arcade-lilac"
	}
];
//#endregion
//#region src/features/spellbound/leaderboard/GlobalLeaderboardPanel.tsx
function GlobalLeaderboardPanel({ entries, isLoading, error, onRefresh }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "pixel-panel min-w-0 rounded-sm border-2 border-arcade-gold/80 p-3 shadow-[4px_4px_0_var(--color-arcade-shadow)] sm:p-5",
		"aria-labelledby": "spellbound-ranking-title",
		children: [
			/* @__PURE__ */ jsxs("header", {
				className: "mb-4 flex flex-wrap items-start justify-between gap-3 border-b-2 border-arcade-panel-border/70 pb-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("p", {
						className: "mb-2 font-arcade text-[0.48rem] text-arcade-cyan sm:text-[0.58rem]",
						children: "RECORDES DOS QUATRO JOGOS · CLASSIFICAÇÃO GLOBAL"
					}),
					/* @__PURE__ */ jsx("h2", {
						id: "spellbound-ranking-title",
						className: "font-arcade text-sm leading-relaxed text-arcade-violet sm:text-lg",
						children: "🏆 RANKING"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 text-xs text-muted-foreground sm:text-sm",
						children: "Pontos: Torre × 100 + Sky Flap + Sky Run + Maze"
					})
				] }), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "sm",
					className: "shrink-0 font-arcade text-[0.48rem]",
					onClick: onRefresh,
					disabled: isLoading,
					"aria-label": "Atualizar ranking global",
					children: isLoading ? "ATUALIZANDO…" : "ATUALIZAR"
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-[2rem_minmax(0,1fr)_auto_3.4rem] items-center gap-2 border-b-2 border-arcade-panel-border bg-arcade-sky/45 px-2 py-2 font-arcade text-[0.42rem] text-arcade-ink sm:grid-cols-[3rem_minmax(0,1fr)_7rem_6rem] sm:gap-3 sm:px-3 sm:text-[0.54rem]",
				children: [
					/* @__PURE__ */ jsx("span", { children: "POS." }),
					/* @__PURE__ */ jsx("span", { children: "JOGADOR" }),
					/* @__PURE__ */ jsx("span", {
						className: "text-right",
						children: "PONTOS"
					}),
					/* @__PURE__ */ jsx("span", {
						className: "text-right",
						children: "🪙 MOEDAS"
					})
				]
			}),
			error ? /* @__PURE__ */ jsxs("div", {
				className: "my-4 border-2 border-arcade-pink/70 bg-arcade-pink/10 p-3 text-center",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.48rem] leading-relaxed text-arcade-ink sm:text-[0.58rem]",
						children: "RANKING TEMPORARIAMENTE INDISPONÍVEL"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 text-xs text-muted-foreground sm:text-sm",
						children: error
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 text-xs text-muted-foreground",
						children: "Seus recordes e moedas locais continuam salvos neste dispositivo."
					})
				]
			}) : null,
			isLoading && entries.length === 0 ? /* @__PURE__ */ jsx("div", {
				className: "space-y-2 py-3",
				"aria-label": "Carregando classificação",
				"aria-live": "polite",
				children: [
					0,
					1,
					2,
					3
				].map((row) => /* @__PURE__ */ jsx("div", { className: "h-10 animate-pulse border border-arcade-panel-border/60 bg-arcade-sky/30" }, row))
			}) : null,
			!isLoading && !error && entries.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "px-3 py-8 text-center font-game text-sm text-muted-foreground",
				children: "Nenhum recorde global ainda. Jogue para inaugurar o ranking!"
			}) : null,
			entries.length > 0 ? /* @__PURE__ */ jsx("ol", {
				className: "max-h-[26rem] overflow-y-auto",
				"aria-label": "Classificação global dos jogadores",
				children: entries.map((entry) => /* @__PURE__ */ jsxs("li", {
					className: `grid grid-cols-[2rem_minmax(0,1fr)_auto_3.4rem] items-center gap-2 border-b border-arcade-panel-border/45 px-2 py-2.5 last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)_7rem_6rem] sm:gap-3 sm:px-3 ${entry.isCurrentPlayer ? "bg-arcade-gold/20 ring-2 ring-inset ring-arcade-gold" : "odd:bg-arcade-sky/20"}`,
					"aria-current": entry.isCurrentPlayer ? "true" : void 0,
					"aria-label": `${entry.position}º lugar, ${entry.name}, ${entry.points.toLocaleString("pt-BR")} pontos, ${entry.coins.toLocaleString("pt-BR")} moedas${entry.isCurrentPlayer ? ", você" : ""}`,
					children: [
						/* @__PURE__ */ jsxs("span", {
							className: "font-arcade text-[0.5rem] text-arcade-violet sm:text-xs",
							children: [entry.position, "º"]
						}),
						/* @__PURE__ */ jsxs("span", {
							className: `min-w-0 truncate font-arcade text-[0.48rem] sm:text-[0.62rem] ${entry.isCurrentPlayer ? "text-arcade-ink" : "text-arcade-panel-foreground"}`,
							title: entry.name,
							children: [entry.name.toLocaleUpperCase("pt-BR"), entry.isCurrentPlayer ? /* @__PURE__ */ jsx("span", {
								className: "ml-2 text-[0.4rem] text-arcade-gold sm:text-[0.48rem]",
								children: "VOCÊ"
							}) : null]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-right font-arcade text-[0.48rem] text-arcade-cyan sm:text-xs",
							children: entry.points.toLocaleString("pt-BR")
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-right font-arcade text-[0.45rem] text-arcade-gold sm:text-[0.58rem]",
							children: entry.coins.toLocaleString("pt-BR")
						})
					]
				}, entry.position))
			}) : null
		]
	});
}
//#endregion
//#region src/features/spellbound/leaderboard/useGlobalLeaderboard.ts
var INITIAL_STATE = {
	entries: [],
	isLoading: true,
	error: null
};
function useGlobalLeaderboard(playerName) {
	const [state, setState] = useState(INITIAL_STATE);
	const refresh = useCallback(async () => {
		setState((current) => ({
			...current,
			isLoading: true,
			error: null
		}));
		try {
			const result = await fetchGlobalLeaderboard(playerName);
			setState({
				entries: result.entries,
				isLoading: false,
				error: null
			});
		} catch (error) {
			setState({
				entries: [],
				isLoading: false,
				error: error instanceof Error ? error.message : "Ranking indisponível. Verifique o Netlify Database e tente novamente."
			});
		}
	}, [playerName]);
	useEffect(() => {
		let active = true;
		const load = async () => {
			setState((current) => ({
				...current,
				isLoading: true,
				error: null
			}));
			try {
				const result = await fetchGlobalLeaderboard(playerName);
				if (active) setState({
					entries: result.entries,
					isLoading: false,
					error: null
				});
			} catch (error) {
				if (!active) return;
				setState({
					entries: [],
					isLoading: false,
					error: error instanceof Error ? error.message : "Ranking indisponível. Verifique o Netlify Database e tente novamente."
				});
			}
		};
		load();
		const unsubscribe = subscribeToLeaderboardUpdates(() => void refresh());
		window.addEventListener("focus", refresh);
		const refreshInterval = window.setInterval(refresh, 3e4);
		return () => {
			active = false;
			unsubscribe();
			window.removeEventListener("focus", refresh);
			window.clearInterval(refreshInterval);
		};
	}, [playerName, refresh]);
	return {
		...state,
		refresh
	};
}
//#endregion
//#region src/features/spellbound/components/CharacterPreviewRail.tsx
function CharacterPreviewRail({ selectedId, unlockedCharacterIds, onOpen }) {
	return /* @__PURE__ */ jsxs("section", {
		className: "pixel-panel rounded-sm p-4",
		"aria-label": "Personagens jogáveis",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "truncate font-arcade text-xs text-arcade-violet sm:text-sm",
				children: "PERSONAGENS"
			}), /* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: onOpen,
				className: "shrink-0 font-arcade text-[0.55rem] text-arcade-cyan hover:underline",
				children: "VER TODOS"
			})]
		}), /* @__PURE__ */ jsx("div", {
			className: "grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7",
			children: playableCharacterSeeds.map((character) => {
				const isUnlocked = !character.coinCost || unlockedCharacterIds.includes(character.id);
				return /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: onOpen,
					"aria-label": isUnlocked ? `${character.name}, personagem desbloqueado` : `${character.name}, bloqueado por ${character.coinCost} moedas`,
					className: cn("border-2 border-arcade-panel-border bg-arcade-sky/35 p-2 transition-transform hover:-translate-y-1", character.id === selectedId && "ring-4 ring-arcade-cyan", !isUnlocked && "border-arcade-gold/70"),
					children: [
						/* @__PURE__ */ jsx("img", {
							src: character.sprite,
							alt: character.name,
							width: 816,
							height: 816,
							loading: "lazy",
							className: "mx-auto mb-2 h-16 w-16 object-contain [image-rendering:pixelated]"
						}),
						/* @__PURE__ */ jsx("h3", {
							className: "text-center font-arcade text-[0.5rem] leading-relaxed text-foreground",
							children: character.shortName
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-center text-sm leading-tight text-muted-foreground",
							children: character.theme
						}),
						!isUnlocked && /* @__PURE__ */ jsxs("p", {
							className: "mt-1 text-center font-arcade text-[0.38rem] text-arcade-gold",
							children: [
								"🔒 ",
								character.coinCost?.toLocaleString("pt-BR"),
								" 🪙"
							]
						})
					]
				}, character.id);
			})
		})]
	});
}
//#endregion
//#region src/features/spellbound/components/ComingSoonNotice.tsx
function ComingSoonNotice({ label }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "pixel-panel fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-sm p-4 text-center font-arcade text-xs text-arcade-violet sm:bottom-6",
		role: "status",
		"aria-live": "polite",
		children: [label, " — EM BREVE"]
	});
}
//#endregion
//#region src/features/spellbound/components/LobbyOptionButton.tsx
function LobbyOptionButton({ option, onSelect }) {
	return /* @__PURE__ */ jsxs(Button, {
		type: "button",
		"data-audio-sfx": "menu-open",
		variant: "arcadePanel",
		size: "arcade",
		onClick: () => onSelect(option),
		className: "group h-auto min-h-20 w-full max-w-full min-w-0 justify-start whitespace-normal overflow-hidden rounded-sm p-3 text-left sm:min-h-20 sm:p-3",
		children: [/* @__PURE__ */ jsx("span", { className: cn("h-10 w-10 shrink-0 border-2 border-arcade-panel-border shadow-[4px_4px_0_var(--color-arcade-shadow)]", option.accentClassName) }), /* @__PURE__ */ jsxs("span", {
			className: "min-w-0 flex-1",
			children: [/* @__PURE__ */ jsx("span", {
				className: "block truncate text-[0.62rem] leading-relaxed text-arcade-ink sm:text-xs",
				children: option.label
			}), /* @__PURE__ */ jsx("span", {
				className: "mt-1 block break-words font-game text-sm leading-snug text-muted-foreground sm:text-base",
				children: option.description
			})]
		})]
	});
}
//#endregion
//#region src/features/spellbound/components/PlayerBadge.tsx
function PlayerBadge({ playerName }) {
	return /* @__PURE__ */ jsx("section", {
		className: "pixel-panel rounded-sm p-3 sm:p-4",
		"aria-label": "Jogador atual",
		children: /* @__PURE__ */ jsxs("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ jsx("p", {
				className: "font-arcade text-[0.56rem] text-arcade-violet sm:text-[0.65rem]",
				children: "JOGADOR"
			}), /* @__PURE__ */ jsx("p", {
				className: "truncate font-arcade text-sm uppercase text-arcade-panel-foreground sm:text-base",
				children: playerName
			})]
		})
	});
}
//#endregion
//#region src/features/spellbound/components/LobbyScreen.tsx
var hiddenMainMenuOptionIds = /* @__PURE__ */ new Set([
	"characters",
	"customize",
	"leaderboard"
]);
function LobbyScreen({ playerName, walletId, onChangePlayer, selectedCharacterId, unlockedCharacterIds, onOpenCharacters, onOpenTower, onOpenSkyFlap, onOpenSkyRun, onOpenMaze }) {
	const [selectedOption, setSelectedOption] = useState(null);
	const coinBalance = useWalletBalance(walletId);
	const leaderboard = useGlobalLeaderboard(playerName);
	const handleSelectOption = (option) => {
		if (option.id === "characters") {
			onOpenCharacters();
			return;
		}
		if (option.id === "tower") {
			onOpenTower();
			return;
		}
		if (option.id === "sky-flap") {
			onOpenSkyFlap();
			return;
		}
		if (option.id === "sky-run") {
			onOpenSkyRun();
			return;
		}
		if (option.id === "spellbound-maze") {
			onOpenMaze();
			return;
		}
		setSelectedOption(option);
	};
	useEffect(() => {
		if (!selectedOption) return;
		const timeoutId = window.setTimeout(() => {
			setSelectedOption(null);
		}, 2200);
		return () => window.clearTimeout(timeoutId);
	}, [selectedOption]);
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8",
		children: [
			/* @__PURE__ */ jsx(PixelSceneDecor, {}),
			/* @__PURE__ */ jsxs("div", {
				className: "relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-5",
				children: [
					/* @__PURE__ */ jsxs("header", {
						className: "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("p", {
								className: "font-arcade text-[0.56rem] text-arcade-violet sm:text-xs",
								children: "LOBBY CELESTIAL"
							}), /* @__PURE__ */ jsx("h1", {
								className: "pixel-title truncate text-2xl leading-relaxed text-arcade-ink sm:text-4xl lg:text-5xl",
								children: "MAGISTERIUM ARCADE"
							})]
						}), /* @__PURE__ */ jsx(PlayerBadge, { playerName })]
					}),
					/* @__PURE__ */ jsxs("section", {
						className: "grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "pixel-panel min-w-0 rounded-sm p-3 sm:p-5",
							children: [/* @__PURE__ */ jsx(GlobalLeaderboardPanel, {
								entries: leaderboard.entries,
								isLoading: leaderboard.isLoading,
								error: leaderboard.error,
								onRefresh: () => void leaderboard.refresh()
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "border-2 border-arcade-panel-border bg-arcade-sky/35 p-3 text-center",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.52rem] text-arcade-cyan sm:text-[0.62rem]",
											children: "CEU"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-sm text-muted-foreground sm:text-base",
											children: "ABERTO"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "border-2 border-arcade-panel-border bg-arcade-sky/35 p-3 text-center",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.52rem] text-arcade-pink sm:text-[0.62rem]",
											children: "MAGIA"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-sm text-muted-foreground sm:text-base",
											children: "CARREGANDO"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "border-2 border-arcade-panel-border bg-arcade-sky/35 p-3 text-center",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.52rem] text-arcade-violet sm:text-[0.62rem]",
											children: "ARCADE"
										}), /* @__PURE__ */ jsx("p", {
											className: "text-sm text-muted-foreground sm:text-base",
											children: "PRONTO"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "border-2 border-arcade-gold bg-arcade-sky/55 p-3 text-center shadow-[3px_3px_0_var(--color-arcade-shadow)]",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.52rem] text-arcade-gold sm:text-[0.62rem]",
											children: "TOTAL DE MOEDAS"
										}), /* @__PURE__ */ jsxs("p", {
											className: "mt-1 font-arcade text-sm text-arcade-ink sm:text-base",
											"aria-live": "polite",
											children: ["🪙 ", coinBalance.toLocaleString("pt-BR")]
										})]
									})
								]
							})]
						}), /* @__PURE__ */ jsxs("aside", {
							className: "min-w-0 space-y-4",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "pixel-panel rounded-sm p-4",
								children: [/* @__PURE__ */ jsx("h2", {
									className: "mb-4 font-arcade text-xs text-arcade-violet sm:text-sm",
									children: "MENU PRINCIPAL"
								}), /* @__PURE__ */ jsx("div", {
									className: "grid gap-3",
									children: lobbyOptions.filter((option) => !hiddenMainMenuOptionIds.has(option.id)).map((option) => /* @__PURE__ */ jsx(LobbyOptionButton, {
										option,
										onSelect: handleSelectOption
									}, option.id))
								})]
							}), /* @__PURE__ */ jsx(Button, {
								type: "button",
								variant: "arcade",
								size: "arcade",
								onClick: onChangePlayer,
								className: "w-full",
								children: "TROCAR JOGADOR"
							})]
						})]
					}),
					/* @__PURE__ */ jsx(CharacterPreviewRail, {
						selectedId: selectedCharacterId,
						unlockedCharacterIds,
						onOpen: onOpenCharacters
					})
				]
			}),
			selectedOption ? /* @__PURE__ */ jsx(ComingSoonNotice, { label: selectedOption.label }) : null
		]
	});
}
//#endregion
//#region src/features/spellbound/components/MultiplayerActionMenuScreen.tsx
var GAME_LABELS = {
	"sky-flap": "SKY FLAP",
	"sky-run": "SKY RUN",
	tower: "TOWER",
	"spellbound-maze": "LABIRINTO MÁGICO"
};
var CARD_ACCENTS = {
	cyan: {
		ring: "focus-visible:ring-arcade-cyan",
		index: "text-arcade-cyan",
		border: "border-arcade-cyan",
		hover: "group-hover:bg-arcade-cyan/25"
	},
	violet: {
		ring: "focus-visible:ring-arcade-violet",
		index: "text-arcade-violet",
		border: "border-arcade-violet",
		hover: "group-hover:bg-arcade-violet/25"
	},
	gold: {
		ring: "focus-visible:ring-arcade-gold",
		index: "text-arcade-gold",
		border: "border-arcade-gold",
		hover: "group-hover:bg-arcade-gold/25"
	}
};
function MultiplayerActionMenuScreen({ gameId, roomsReady = false, onBots, onLocal, onCreateRoom, onJoinRoom, onBack }) {
	const cards = [
		supportsMinigameMode(gameId, "bots") ? {
			key: "bots",
			number: "01",
			title: "JOGAR COM BOTS",
			description: "Enfrente adversários de IA com personagem, comportamento e pontuação próprios.",
			action: "COMEÇAR PARTIDA",
			onClick: onBots,
			disabled: false,
			accent: CARD_ACCENTS.cyan
		} : null,
		onLocal ? {
			key: "local",
			number: "02",
			title: "PARTIDA LOCAL",
			description: "Joguem no mesmo dispositivo com controles separados por participante.",
			action: "CONFIGURAR JOGADORES",
			onClick: onLocal,
			disabled: false,
			accent: CARD_ACCENTS.violet
		} : null,
		supportsMinigameMode(gameId, "privateRoom") ? {
			key: "create",
			number: onLocal ? "03" : "02",
			title: "CRIAR SALA PRIVADA",
			description: "Abra uma sala e convide amigos usando um código curto.",
			action: roomsReady ? "CRIAR SALA" : "BACKEND PENDENTE",
			onClick: onCreateRoom ?? (() => void 0),
			disabled: !roomsReady || !onCreateRoom,
			accent: CARD_ACCENTS.violet
		} : null,
		supportsMinigameMode(gameId, "privateRoom") ? {
			key: "join",
			number: onLocal ? "04" : "03",
			title: "ENTRAR EM SALA",
			description: "Digite o código do anfitrião para participar da partida.",
			action: roomsReady ? "DIGITAR CÓDIGO" : "BACKEND PENDENTE",
			onClick: onJoinRoom ?? (() => void 0),
			disabled: !roomsReady || !onJoinRoom,
			accent: CARD_ACCENTS.gold
		} : null
	].filter((card) => card !== null);
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-4 py-5 text-foreground sm:px-6 sm:py-8",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, { density: "calm" }), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex min-h-[85vh] w-full max-w-6xl flex-col",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex items-center justify-between gap-4",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-xs",
					children: "MAGISTERIUM ARCADE"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-2 font-arcade text-xs text-arcade-ink sm:text-sm",
					children: GAME_LABELS[gameId]
				})] }), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "arcade",
					onClick: onBack,
					children: "VOLTAR"
				})]
			}), /* @__PURE__ */ jsxs("section", {
				className: "my-auto py-10 text-center",
				children: [
					/* @__PURE__ */ jsx("h1", {
						className: "pixel-title text-3xl leading-relaxed text-arcade-ink sm:text-5xl",
						children: "MULTIPLAYER"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mx-auto mt-3 max-w-2xl font-game text-lg text-muted-foreground sm:text-xl",
						children: "Escolha como jogar. O percurso e as regras continuam próprios deste minigame."
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2",
						children: cards.map((card) => /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: card.onClick,
							disabled: card.disabled,
							className: `pixel-panel group flex min-h-52 flex-col items-center justify-center gap-3 rounded-sm border-2 border-arcade-panel-border bg-arcade-panel/90 p-5 text-center shadow-[6px_6px_0_var(--color-arcade-shadow)] transition-transform enabled:hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-4 ${card.accent.ring} disabled:cursor-not-allowed disabled:opacity-55`,
							children: [
								/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									className: `font-arcade text-3xl ${card.accent.index}`,
									children: card.number
								}),
								/* @__PURE__ */ jsx("span", {
									className: "font-arcade text-lg text-arcade-ink sm:text-xl",
									children: card.title
								}),
								/* @__PURE__ */ jsx("span", {
									className: "max-w-sm font-game text-base text-muted-foreground",
									children: card.description
								}),
								/* @__PURE__ */ jsx("span", {
									className: `mt-1 border-2 ${card.accent.border} bg-arcade-sky/60 px-4 py-2 font-arcade text-[0.55rem] text-arcade-ink transition-colors ${card.accent.hover}`,
									children: card.action
								})
							]
						}, card.key))
					}),
					!roomsReady && supportsMinigameMode(gameId, "privateRoom") && /* @__PURE__ */ jsx("p", {
						className: "mx-auto mt-5 max-w-2xl border border-arcade-panel-border bg-arcade-panel/75 px-3 py-2 font-game text-sm text-muted-foreground",
						children: "Salas privadas entre dispositivos dependem de um backend persistente e ainda não estão configuradas."
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/features/spellbound/components/ArcadeCabinetFrame.tsx
function ArcadeCabinetFrame({ children }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "pixel-panel relative w-full max-w-3xl rounded-sm p-4 sm:p-6",
		children: [/* @__PURE__ */ jsx("div", {
			className: "checker-floor absolute inset-x-4 top-4 h-8 opacity-30",
			"aria-hidden": "true"
		}), /* @__PURE__ */ jsx("div", {
			className: "relative border-2 border-arcade-cyan bg-arcade-sky/30 p-4 shadow-[inset_0_0_24px_color-mix(in_oklab,var(--color-arcade-cyan)_24%,transparent)] sm:p-8",
			children
		})]
	});
}
//#endregion
//#region src/features/spellbound/components/NameEntryScreen.tsx
function NameEntryScreen({ onEnter }) {
	const [playerName, setPlayerName] = useState("");
	const [message, setMessage] = useState("");
	const [isError, setIsError] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	async function handleSubmit(event) {
		event.preventDefault();
		setIsSubmitting(true);
		setMessage("");
		setIsError(false);
		try {
			const result = await onEnter(playerName);
			setMessage(result.message);
			setIsError(!result.ok);
		} finally {
			setIsSubmitting(false);
		}
	}
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 text-foreground",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, { density: "calm" }), /* @__PURE__ */ jsx(ArcadeCabinetFrame, { children: /* @__PURE__ */ jsxs("form", {
			onSubmit: handleSubmit,
			className: "relative z-10 flex w-full flex-col items-center gap-5 text-center sm:gap-7",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "space-y-3",
					children: [/* @__PURE__ */ jsx("h1", {
						className: "pixel-title max-w-2xl text-3xl leading-relaxed text-arcade-ink sm:text-5xl md:text-6xl",
						children: "MAGISTERIUM ARCADE"
					}), /* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.62rem] text-arcade-violet sm:text-xs",
						children: "QUAL É O SEU NOME?"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "flex w-full max-w-xl flex-col gap-2 text-left",
					children: [/* @__PURE__ */ jsx("span", {
						className: "sr-only",
						children: "Seu nome"
					}), /* @__PURE__ */ jsx("input", {
						value: playerName,
						onChange: (event) => setPlayerName(event.target.value),
						maxLength: 18,
						minLength: 1,
						required: true,
						autoComplete: "nickname",
						autoFocus: true,
						placeholder: "SEU NOME",
						className: "h-12 w-full rounded-sm border-2 border-arcade-panel-border bg-arcade-panel px-3 font-arcade text-xs uppercase text-arcade-panel-foreground outline-none transition focus:border-arcade-cyan focus:ring-4 focus:ring-arcade-cyan/40 sm:h-14 sm:text-sm"
					})]
				}),
				/* @__PURE__ */ jsx("div", {
					className: `min-h-6 max-w-xl text-center text-xs sm:text-sm ${isError ? "text-destructive" : "text-arcade-violet"}`,
					role: isError ? "alert" : "status",
					"aria-live": "polite",
					children: message
				}),
				/* @__PURE__ */ jsx(Button, {
					type: "submit",
					variant: "arcade",
					size: "arcade",
					className: "w-full max-w-xs",
					disabled: isSubmitting,
					children: isSubmitting ? "ENTRANDO…" : "ENTRAR"
				})
			]
		}) })]
	});
}
//#endregion
//#region src/features/spellbound/components/CurrencyRewardCard.tsx
function CurrencyRewardCard({ receipts, className = "" }) {
	if (receipts.length === 0) return null;
	return /* @__PURE__ */ jsxs("section", {
		className: `relative mt-4 overflow-hidden rounded-sm border-2 border-arcade-gold bg-arcade-sky/90 p-3 text-left shadow-[5px_5px_0_var(--color-arcade-shadow)] sm:p-4 ${className}`,
		"aria-label": "Recompensa de moedas da partida",
		"aria-live": "polite",
		children: [
			/* @__PURE__ */ jsx("div", {
				className: "pointer-events-none absolute inset-x-0 top-0 flex justify-around",
				"aria-hidden": "true",
				children: Array.from({ length: 5 }, (_, index) => /* @__PURE__ */ jsx("span", {
					className: "coin-reward-particle font-game text-sm text-arcade-gold",
					style: { animationDelay: `${index * 90}ms` },
					children: "🪙"
				}, index))
			}),
			/* @__PURE__ */ jsx("h3", {
				className: "font-arcade text-[0.56rem] text-arcade-violet sm:text-[0.68rem]",
				children: "RECOMPENSA DE MOEDAS"
			}),
			/* @__PURE__ */ jsx("div", {
				className: "mt-2 grid gap-2",
				children: receipts.map((receipt) => {
					const formattedTotal = receipt.total.toLocaleString("pt-BR");
					const totalDigitCount = formattedTotal.replace(/\D/g, "").length;
					const useWideBalance = totalDigitCount >= 7;
					const balanceTextSize = totalDigitCount >= 13 ? "text-[0.625rem] sm:text-xs" : useWideBalance ? "text-sm sm:text-base" : "text-base sm:text-lg";
					return /* @__PURE__ */ jsxs("article", {
						className: "grid min-w-0 gap-2 border-t border-arcade-panel-border/60 pt-2 first:border-0 first:pt-0",
						children: [receipts.length > 1 && /* @__PURE__ */ jsx("p", {
							className: "truncate font-game text-sm font-bold text-arcade-ink",
							children: receipt.playerName
						}), /* @__PURE__ */ jsxs("div", {
							className: `grid min-w-0 gap-2 ${useWideBalance ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-[0.9fr_1.1fr]"}`,
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex min-w-0 items-center justify-center gap-3 border-2 border-arcade-gold/70 bg-arcade-panel/75 px-3 py-2",
								children: [/* @__PURE__ */ jsx("span", {
									className: "coin-reward-icon shrink-0 text-3xl leading-none sm:text-4xl",
									"aria-hidden": "true",
									children: "🪙"
								}), /* @__PURE__ */ jsxs("div", {
									className: "min-w-0 text-center",
									children: [/* @__PURE__ */ jsx("p", {
										className: "font-arcade text-[0.48rem] text-arcade-violet sm:text-[0.56rem]",
										children: "MOEDAS GANHAS"
									}), /* @__PURE__ */ jsxs("p", {
										className: "coin-reward-amount mt-1 font-arcade text-2xl leading-none text-arcade-gold sm:text-3xl",
										children: ["+", receipt.amount.toLocaleString("pt-BR")]
									})]
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "flex min-w-0 flex-col items-center justify-center border-2 border-arcade-panel-border bg-arcade-sky/70 px-2 py-2",
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.48rem] text-arcade-violet sm:text-[0.56rem]",
									children: "SALDO TOTAL"
								}), /* @__PURE__ */ jsx("div", {
									className: "mt-1 w-full min-w-0 overflow-x-auto",
									children: /* @__PURE__ */ jsxs("p", {
										className: `flex w-max min-w-full items-center justify-center gap-1 whitespace-nowrap font-arcade leading-none text-arcade-ink ${balanceTextSize}`,
										"aria-label": `Saldo total: ${formattedTotal} moedas`,
										children: [/* @__PURE__ */ jsx("span", {
											className: "shrink-0",
											"aria-hidden": "true",
											children: "🪙"
										}), /* @__PURE__ */ jsx("span", {
											className: "shrink-0",
											children: formattedTotal
										})]
									})
								})]
							})]
						})]
					}, receipt.walletId);
				})
			})
		]
	});
}
//#endregion
//#region src/features/spellbound/audio/presets.ts
function sequence(notes, duration, waveform, gain, spacing = duration * .72) {
	return notes.map((frequency, index) => ({
		frequency,
		duration,
		offset: index * spacing,
		waveform,
		gain
	}));
}
var ARCADE_SFX = {
	"ui-hover": {
		tones: [{
			frequency: 660,
			endFrequency: 790,
			duration: .045,
			offset: 0,
			waveform: "square",
			gain: .11
		}],
		cooldownMs: 65,
		priority: "ui"
	},
	"ui-click": {
		tones: [{
			frequency: 690,
			endFrequency: 510,
			duration: .075,
			offset: 0,
			waveform: "square",
			gain: .2
		}],
		cooldownMs: 35,
		priority: "ui"
	},
	"ui-confirm": {
		tones: sequence([587, 784], .09, "triangle", .2, .055),
		cooldownMs: 50,
		priority: "ui"
	},
	"ui-back": {
		tones: sequence([520, 392], .085, "triangle", .17, .045),
		cooldownMs: 70,
		priority: "ui"
	},
	"menu-open": {
		tones: sequence([
			440,
			554,
			698
		], .085, "triangle", .17, .05),
		cooldownMs: 60,
		priority: "ui"
	},
	"menu-close": {
		tones: sequence([
			698,
			554,
			440
		], .075, "triangle", .15, .045),
		cooldownMs: 60,
		priority: "ui"
	},
	"game-start": {
		tones: sequence([
			523,
			659,
			784,
			1047
		], .12, "triangle", .24, .085),
		cooldownMs: 160,
		priority: "important",
		duckMusic: true
	},
	countdown: {
		tones: [{
			frequency: 660,
			duration: .12,
			offset: 0,
			waveform: "square",
			gain: .21
		}, {
			frequency: 880,
			duration: .18,
			offset: .28,
			waveform: "square",
			gain: .24
		}],
		cooldownMs: 120,
		priority: "important",
		duckMusic: true
	},
	flap: {
		tones: [{
			frequency: 620,
			endFrequency: 760,
			duration: .06,
			offset: 0,
			waveform: "triangle",
			gain: .15
		}],
		cooldownMs: 55,
		priority: "pickup"
	},
	jump: {
		tones: [{
			frequency: 220,
			endFrequency: 620,
			duration: .12,
			offset: 0,
			waveform: "triangle",
			gain: .2
		}],
		cooldownMs: 85,
		priority: "pickup"
	},
	"piece-drop": {
		tones: [{
			frequency: 340,
			endFrequency: 145,
			duration: .15,
			offset: 0,
			waveform: "triangle",
			gain: .23
		}, {
			frequency: 185,
			endFrequency: 115,
			duration: .1,
			offset: .08,
			waveform: "sine",
			gain: .12
		}],
		cooldownMs: 80,
		priority: "pickup"
	},
	score: {
		tones: sequence([880, 1175], .065, "square", .14, .05),
		cooldownMs: 220,
		priority: "pickup"
	},
	record: {
		tones: sequence([
			659,
			784,
			988,
			1319,
			1568
		], .15, "triangle", .26, .095),
		cooldownMs: 300,
		priority: "important",
		duckMusic: true
	},
	lose: {
		tones: sequence([
			523,
			440,
			349,
			262
		], .16, "triangle", .23, .12),
		cooldownMs: 260,
		priority: "important",
		duckMusic: true
	},
	win: {
		tones: sequence([
			523,
			659,
			784,
			1047,
			1319
		], .15, "triangle", .24, .09),
		cooldownMs: 300,
		priority: "important",
		duckMusic: true
	},
	"level-clear": {
		tones: sequence([
			659,
			784,
			988,
			1175
		], .13, "triangle", .23, .085),
		cooldownMs: 260,
		priority: "important",
		duckMusic: true
	},
	coin: {
		tones: [{
			frequency: 988,
			duration: .075,
			offset: 0,
			waveform: "sine",
			gain: .22
		}, {
			frequency: 1480,
			duration: .11,
			offset: .045,
			waveform: "triangle",
			gain: .18
		}],
		cooldownMs: 150,
		priority: "pickup"
	},
	collect: {
		tones: sequence([
			659,
			784,
			988
		], .075, "triangle", .18, .055),
		cooldownMs: 90,
		priority: "pickup"
	},
	"rune-spawn": {
		tones: [{
			frequency: 587,
			duration: .14,
			offset: 0,
			waveform: "sine",
			gain: .1
		}, {
			frequency: 880,
			duration: .19,
			offset: .11,
			waveform: "triangle",
			gain: .12
		}],
		cooldownMs: 650,
		priority: "pickup"
	},
	rune: {
		tones: sequence([
			523,
			659,
			784,
			1047,
			1319
		], .13, "sine", .22, .072),
		cooldownMs: 220,
		priority: "important",
		duckMusic: true
	},
	"power-ice": {
		tones: [
			{
				frequency: 784,
				duration: .14,
				offset: 0,
				waveform: "triangle",
				gain: .2
			},
			{
				frequency: 1175,
				endFrequency: 1760,
				duration: .22,
				offset: .045,
				waveform: "sine",
				gain: .21
			},
			{
				frequency: 1568,
				duration: .16,
				offset: .13,
				waveform: "sine",
				gain: .12
			}
		],
		cooldownMs: 220,
		priority: "important",
		duckMusic: true
	},
	"power-teleport": {
		tones: [
			{
				frequency: 988,
				endFrequency: 220,
				duration: .2,
				offset: 0,
				waveform: "sawtooth",
				gain: .16
			},
			{
				frequency: 660,
				endFrequency: 1320,
				duration: .13,
				offset: .11,
				waveform: "triangle",
				gain: .18
			},
			{
				frequency: 1319,
				duration: .07,
				offset: .21,
				waveform: "sine",
				gain: .13
			}
		],
		cooldownMs: 220,
		priority: "important",
		duckMusic: true
	},
	"power-shuriken": {
		tones: [
			{
				frequency: 1760,
				endFrequency: 740,
				duration: .12,
				offset: 0,
				waveform: "sawtooth",
				gain: .17
			},
			{
				frequency: 1320,
				endFrequency: 520,
				duration: .1,
				offset: .04,
				waveform: "triangle",
				gain: .13
			},
			{
				frequency: 1047,
				duration: .055,
				offset: .11,
				waveform: "square",
				gain: .12
			}
		],
		cooldownMs: 200,
		priority: "important",
		duckMusic: true
	},
	"power-time": {
		tones: [
			{
				frequency: 392,
				endFrequency: 784,
				duration: .28,
				offset: 0,
				waveform: "sine",
				gain: .2
			},
			{
				frequency: 587,
				endFrequency: 440,
				duration: .3,
				offset: .08,
				waveform: "triangle",
				gain: .13
			},
			{
				frequency: 1175,
				duration: .16,
				offset: .19,
				waveform: "sine",
				gain: .12
			}
		],
		cooldownMs: 220,
		priority: "important",
		duckMusic: true
	},
	"power-swamp": {
		tones: [
			{
				frequency: 250,
				endFrequency: 360,
				duration: .11,
				offset: 0,
				waveform: "sine",
				gain: .22
			},
			{
				frequency: 370,
				endFrequency: 490,
				duration: .12,
				offset: .09,
				waveform: "triangle",
				gain: .19
			},
			{
				frequency: 740,
				duration: .09,
				offset: .17,
				waveform: "sine",
				gain: .11
			}
		],
		cooldownMs: 220,
		priority: "important",
		duckMusic: true
	},
	"power-forge": {
		tones: [
			{
				frequency: 330,
				endFrequency: 660,
				duration: .16,
				offset: 0,
				waveform: "sawtooth",
				gain: .17
			},
			{
				frequency: 660,
				endFrequency: 990,
				duration: .13,
				offset: .09,
				waveform: "square",
				gain: .14
			},
			{
				frequency: 880,
				duration: .1,
				offset: .18,
				waveform: "triangle",
				gain: .14
			}
		],
		cooldownMs: 220,
		priority: "important",
		duckMusic: true
	},
	blocked: {
		tones: [{
			frequency: 220,
			endFrequency: 150,
			duration: .1,
			offset: 0,
			waveform: "square",
			gain: .17
		}, {
			frequency: 130,
			duration: .08,
			offset: .06,
			waveform: "triangle",
			gain: .13
		}],
		cooldownMs: 170,
		priority: "pickup"
	},
	"cooldown-ready": {
		tones: sequence([
			659,
			880,
			1175
		], .075, "sine", .15, .055),
		cooldownMs: 220,
		priority: "pickup"
	},
	hit: {
		tones: [{
			frequency: 295,
			endFrequency: 120,
			duration: .13,
			offset: 0,
			waveform: "sawtooth",
			gain: .2
		}, {
			frequency: 185,
			endFrequency: 95,
			duration: .1,
			offset: .025,
			waveform: "triangle",
			gain: .11
		}],
		cooldownMs: 100,
		priority: "important",
		duckMusic: true
	},
	"life-lost": {
		tones: sequence([
			392,
			311,
			233
		], .16, "triangle", .22, .13),
		cooldownMs: 220,
		priority: "important",
		duckMusic: true
	},
	"game-over": {
		tones: sequence([
			440,
			349,
			294,
			220
		], .2, "triangle", .25, .14),
		cooldownMs: 300,
		priority: "important",
		duckMusic: true
	},
	"exit-unlocked": {
		tones: sequence([
			523,
			659,
			784,
			1047
		], .12, "sine", .2, .075),
		cooldownMs: 250,
		priority: "important",
		duckMusic: true
	},
	"ghost-near": {
		tones: [{
			frequency: 165,
			duration: .12,
			offset: 0,
			waveform: "sine",
			gain: .12
		}, {
			frequency: 132,
			duration: .14,
			offset: .2,
			waveform: "sine",
			gain: .1
		}],
		cooldownMs: 5e3,
		priority: "pickup"
	}
};
//#endregion
//#region src/features/spellbound/audio/ArcadeAudioProvider.tsx
var SETTINGS_KEY = "spellbound-arcade-audio-settings-v1";
var DEFAULT_SETTINGS = {
	musicVolume: .26,
	sfxVolume: .62,
	musicEnabled: true,
	sfxEnabled: true,
	silentMode: false
};
var MAX_ACTIVE_VOICES = 26;
var ArcadeAudioContext = createContext(null);
function clamp$5(value, min = 0, max = 1) {
	return Math.min(max, Math.max(min, value));
}
function musicUrlForTrack(track) {
	if (track === "sky-run") return "/audio/music/sky-run.mp3?v=sky-run-arcade-v8";
	return `/audio/music/${track}.mp3`;
}
function readSettings() {
	if (typeof window === "undefined") return DEFAULT_SETTINGS;
	try {
		const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null");
		if (!parsed || typeof parsed !== "object") return DEFAULT_SETTINGS;
		const value = parsed;
		return {
			musicVolume: typeof value.musicVolume === "number" ? clamp$5(value.musicVolume) : DEFAULT_SETTINGS.musicVolume,
			sfxVolume: typeof value.sfxVolume === "number" ? clamp$5(value.sfxVolume) : DEFAULT_SETTINGS.sfxVolume,
			musicEnabled: typeof value.musicEnabled === "boolean" ? value.musicEnabled : DEFAULT_SETTINGS.musicEnabled,
			sfxEnabled: typeof value.sfxEnabled === "boolean" ? value.sfxEnabled : DEFAULT_SETTINGS.sfxEnabled,
			silentMode: typeof value.silentMode === "boolean" ? value.silentMode : DEFAULT_SETTINGS.silentMode
		};
	} catch {
		return DEFAULT_SETTINGS;
	}
}
function isSfxName(value) {
	return Object.prototype.hasOwnProperty.call(ARCADE_SFX, value);
}
function getUiTarget(target) {
	if (!(target instanceof Element)) return null;
	const element = target.closest("button, a[href], [role='button']");
	if (!element || element.getAttribute("aria-disabled") === "true") return null;
	if (element instanceof HTMLButtonElement && element.disabled) return null;
	return element;
}
function uiSfxForTarget(target, fallback) {
	const requested = target.dataset["audioSfx"];
	if (requested && isSfxName(requested)) return requested;
	const accessibleLabel = [
		target.textContent,
		target.getAttribute("aria-label"),
		target.title
	].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
	return /\b(voltar|back|return|cancelar|cancel)\b/i.test(accessibleLabel) ? "ui-back" : fallback;
}
function ArcadeAudioProvider({ track, children }) {
	const [settings, setSettings] = useState(readSettings);
	const settingsRef = useRef(settings);
	const trackRef = useRef(track);
	const audioContextRef = useRef(null);
	const musicElementRef = useRef(null);
	const musicSourceRef = useRef(null);
	const musicGainRef = useRef(null);
	const sfxGainRef = useRef(null);
	const currentTrackRef = useRef(null);
	const audioUnlockedRef = useRef(false);
	const musicIntensityRef = useRef(1);
	const skyRunIntensityProgressRef = useRef(0);
	const skyRunPlaybackRateRef = useRef(1);
	const musicDuckRef = useRef(1);
	const duckTimeoutRef = useRef(null);
	const switchTimeoutRef = useRef(null);
	const lastSfxAtRef = useRef(/* @__PURE__ */ new Map());
	const coinPitchStepRef = useRef(0);
	const activeVoicesRef = useRef(/* @__PURE__ */ new Set());
	const syncMusicRef = useRef(() => void 0);
	const unlockAudioRef = useRef(() => void 0);
	const playSfxRef = useRef(() => void 0);
	settingsRef.current = settings;
	trackRef.current = track;
	const updateSettings = useCallback((patch) => {
		setSettings((current) => ({
			...current,
			...patch
		}));
	}, []);
	const rampMusicGainTo = useCallback((targetValue, duration = .18) => {
		const context = audioContextRef.current;
		const gain = musicGainRef.current;
		if (!context || !gain) return;
		const now = context.currentTime;
		gain.gain.cancelScheduledValues(now);
		gain.gain.setValueAtTime(gain.gain.value, now);
		gain.gain.linearRampToValueAtTime(clamp$5(targetValue, 0, .42), now + Math.max(.025, duration));
	}, []);
	const scheduleMusicGain = useCallback((duration = .18) => {
		const currentSettings = settingsRef.current;
		const musicElement = musicElementRef.current;
		if (musicElement) if (trackRef.current === "sky-run") {
			skyRunPlaybackRateRef.current = Math.max(skyRunPlaybackRateRef.current, 1 + skyRunIntensityProgressRef.current * .1);
			musicElement.playbackRate = skyRunPlaybackRateRef.current;
		} else {
			skyRunIntensityProgressRef.current = 0;
			skyRunPlaybackRateRef.current = 1;
			musicElement.playbackRate = 1;
		}
		const target = currentSettings.musicEnabled && !currentSettings.silentMode && trackRef.current !== null ? clamp$5(currentSettings.musicVolume * musicIntensityRef.current * musicDuckRef.current, 0, .42) : 0;
		rampMusicGainTo(target, duration);
	}, [rampMusicGainTo]);
	const ensureAudioGraph = useCallback(() => {
		if (audioContextRef.current && musicElementRef.current) return audioContextRef.current;
		if (typeof window === "undefined" || typeof window.AudioContext === "undefined") return null;
		try {
			const context = new window.AudioContext();
			const musicElement = new Audio();
			musicElement.loop = true;
			musicElement.preload = "none";
			musicElement.volume = 1;
			const musicSource = context.createMediaElementSource(musicElement);
			const musicGain = context.createGain();
			musicGain.gain.value = 0;
			musicSource.connect(musicGain).connect(context.destination);
			const sfxGain = context.createGain();
			sfxGain.gain.value = 1;
			sfxGain.connect(context.destination);
			audioContextRef.current = context;
			musicElementRef.current = musicElement;
			musicSourceRef.current = musicSource;
			musicGainRef.current = musicGain;
			sfxGainRef.current = sfxGain;
			return context;
		} catch {
			return null;
		}
	}, []);
	const syncMusic = useCallback(() => {
		const context = audioContextRef.current;
		const musicElement = musicElementRef.current;
		if (!audioUnlockedRef.current || !context || !musicElement) return;
		if (context.state === "suspended") context.resume().catch(() => void 0);
		if (switchTimeoutRef.current !== null) {
			window.clearTimeout(switchTimeoutRef.current);
			switchTimeoutRef.current = null;
		}
		const desiredTrack = trackRef.current;
		if (!(desiredTrack !== null && settingsRef.current.musicEnabled && !settingsRef.current.silentMode && document.visibilityState !== "hidden")) {
			scheduleMusicGain(.22);
			switchTimeoutRef.current = window.setTimeout(() => {
				if (!trackRef.current || !settingsRef.current.musicEnabled || settingsRef.current.silentMode || document.visibilityState === "hidden") musicElement.pause();
				if (!trackRef.current) {
					currentTrackRef.current = null;
					musicElement.removeAttribute("src");
					musicElement.load();
				}
				switchTimeoutRef.current = null;
			}, 240);
			return;
		}
		if (currentTrackRef.current === desiredTrack) {
			if (musicElement.paused) musicElement.play().then(() => scheduleMusicGain(.28)).catch(() => void 0);
			else scheduleMusicGain(.22);
			return;
		}
		rampMusicGainTo(0, .2);
		switchTimeoutRef.current = window.setTimeout(() => {
			const nextTrack = trackRef.current;
			if (!(nextTrack !== null && settingsRef.current.musicEnabled && !settingsRef.current.silentMode && document.visibilityState !== "hidden") || !nextTrack) {
				musicElement.pause();
				switchTimeoutRef.current = null;
				return;
			}
			musicElement.pause();
			musicElement.removeAttribute("src");
			musicElement.load();
			musicElement.src = musicUrlForTrack(nextTrack);
			musicElement.currentTime = 0;
			skyRunPlaybackRateRef.current = 1;
			musicElement.playbackRate = 1;
			currentTrackRef.current = nextTrack;
			musicElement.play().then(() => scheduleMusicGain(.42)).catch(() => {
				currentTrackRef.current = null;
			});
			switchTimeoutRef.current = null;
		}, 220);
	}, [rampMusicGainTo, scheduleMusicGain]);
	syncMusicRef.current = syncMusic;
	unlockAudioRef.current = useCallback(() => {
		const context = ensureAudioGraph();
		if (!context) return;
		audioUnlockedRef.current = true;
		if (context.state === "suspended") context.resume().catch(() => void 0);
		syncMusicRef.current();
	}, [ensureAudioGraph]);
	const setMusicIntensity = useCallback((intensity) => {
		musicIntensityRef.current = clamp$5(intensity, .72, 1.25);
		skyRunIntensityProgressRef.current = trackRef.current === "sky-run" ? clamp$5((musicIntensityRef.current - .86) / .32, 0, 1) : 0;
		scheduleMusicGain(.32);
	}, [scheduleMusicGain]);
	const playSfx = useCallback((name, options = {}) => {
		const currentSettings = settingsRef.current;
		if (!currentSettings.sfxEnabled || currentSettings.silentMode || currentSettings.sfxVolume <= 0) return;
		const context = audioContextRef.current;
		const destination = sfxGainRef.current;
		if (!context || !destination) return;
		if (context.state === "suspended") context.resume().catch(() => void 0);
		const preset = ARCADE_SFX[name];
		const nowMs = performance.now();
		if (nowMs - (lastSfxAtRef.current.get(name) ?? -Infinity) < preset.cooldownMs) return;
		lastSfxAtRef.current.set(name, nowMs);
		const pitch = clamp$5(options.pitch ?? 1, .82, 1.22);
		if (name === "coin") coinPitchStepRef.current = (coinPitchStepRef.current + 1) % 5;
		const pitchRatio = pitch * (name === "coin" ? 1 + (coinPitchStepRef.current - 2) * .018 : 1);
		const priorityGain = preset.priority === "important" ? 1 : preset.priority === "pickup" ? .78 : .62;
		const eventGain = clamp$5(options.volume ?? 1, 0, 1.4);
		const volume = currentSettings.sfxVolume * priorityGain * eventGain;
		if (preset.duckMusic) {
			musicDuckRef.current = .72;
			scheduleMusicGain(.1);
			if (duckTimeoutRef.current !== null) window.clearTimeout(duckTimeoutRef.current);
			duckTimeoutRef.current = window.setTimeout(() => {
				musicDuckRef.current = 1;
				scheduleMusicGain(.26);
				duckTimeoutRef.current = null;
			}, 520);
		}
		for (const tone of preset.tones) {
			if (activeVoicesRef.current.size >= MAX_ACTIVE_VOICES) {
				if (preset.priority === "ui" || name === "coin") continue;
				const oldestVoice = activeVoicesRef.current.values().next().value;
				if (oldestVoice) try {
					oldestVoice.stop(context.currentTime + .004);
				} catch {
					activeVoicesRef.current.delete(oldestVoice);
				}
			}
			const oscillator = context.createOscillator();
			const envelope = context.createGain();
			const startAt = context.currentTime + tone.offset;
			const duration = Math.max(.035, tone.duration);
			const endAt = startAt + duration;
			const peak = Math.max(1e-4, tone.gain * volume);
			oscillator.type = tone.waveform;
			oscillator.frequency.setValueAtTime(tone.frequency * pitchRatio, startAt);
			if (tone.endFrequency !== void 0) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endFrequency * pitchRatio), endAt);
			envelope.gain.setValueAtTime(1e-4, startAt);
			envelope.gain.exponentialRampToValueAtTime(peak, startAt + Math.min(.009, duration * .2));
			envelope.gain.setValueAtTime(peak * .68, startAt + duration * .58);
			envelope.gain.exponentialRampToValueAtTime(1e-4, endAt);
			oscillator.connect(envelope).connect(destination);
			oscillator.start(startAt);
			oscillator.stop(endAt + .015);
			activeVoicesRef.current.add(oscillator);
			oscillator.addEventListener("ended", () => {
				activeVoicesRef.current.delete(oscillator);
				oscillator.disconnect();
				envelope.disconnect();
			}, { once: true });
		}
	}, [scheduleMusicGain]);
	playSfxRef.current = playSfx;
	useEffect(() => {
		try {
			window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
		} catch {}
		syncMusic();
	}, [settings, syncMusic]);
	useEffect(() => {
		syncMusic();
	}, [track, syncMusic]);
	useEffect(() => {
		const intervalId = window.setInterval(() => {
			const musicElement = musicElementRef.current;
			if (!musicElement) return;
			if (trackRef.current !== "sky-run") {
				skyRunIntensityProgressRef.current = 0;
				skyRunPlaybackRateRef.current = 1;
				if (musicElement.playbackRate !== 1) musicElement.playbackRate = 1;
				return;
			}
			const duration = musicElement.duration;
			const songProgress = Number.isFinite(duration) && duration > 0 ? clamp$5(musicElement.currentTime / duration, 0, 1) : 0;
			const runProgress = skyRunIntensityProgressRef.current;
			const targetRate = 1 + Math.max(songProgress * .12, runProgress * .1);
			skyRunPlaybackRateRef.current = Math.max(skyRunPlaybackRateRef.current, targetRate);
			if (Math.abs(musicElement.playbackRate - skyRunPlaybackRateRef.current) > .001) musicElement.playbackRate = skyRunPlaybackRateRef.current;
		}, 500);
		return () => window.clearInterval(intervalId);
	}, []);
	useEffect(() => {
		const activeVoices = activeVoicesRef.current;
		const onPointerDown = (event) => {
			unlockAudioRef.current();
			const target = getUiTarget(event.target);
			if (!target) return;
			playSfxRef.current(uiSfxForTarget(target, "ui-click"));
		};
		const onPointerOver = (event) => {
			if (event.pointerType !== "mouse") return;
			const target = getUiTarget(event.target);
			if (!target) return;
			if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
			const requested = target.dataset["audioHoverSfx"];
			playSfxRef.current(requested && isSfxName(requested) ? requested : "ui-hover");
		};
		const onKeyDown = (event) => {
			if (event.repeat) return;
			if (event.code === "Escape") {
				unlockAudioRef.current();
				playSfxRef.current("ui-back");
				return;
			}
			if (event.code !== "Enter" && event.code !== "Space") return;
			const target = getUiTarget(event.target);
			if (!target) return;
			unlockAudioRef.current();
			playSfxRef.current(uiSfxForTarget(target, "ui-confirm"));
		};
		const onVisibilityChange = () => {
			const context = audioContextRef.current;
			const musicElement = musicElementRef.current;
			if (document.visibilityState === "hidden") {
				musicElement?.pause();
				if (context?.state === "running") context.suspend().catch(() => void 0);
			} else {
				if (context?.state === "suspended") context.resume().catch(() => void 0);
				syncMusicRef.current();
			}
		};
		document.addEventListener("pointerdown", onPointerDown, true);
		document.addEventListener("pointerover", onPointerOver, true);
		document.addEventListener("keydown", onKeyDown, true);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown, true);
			document.removeEventListener("pointerover", onPointerOver, true);
			document.removeEventListener("keydown", onKeyDown, true);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			if (switchTimeoutRef.current !== null) window.clearTimeout(switchTimeoutRef.current);
			if (duckTimeoutRef.current !== null) window.clearTimeout(duckTimeoutRef.current);
			const musicElement = musicElementRef.current;
			musicElement?.pause();
			if (musicElement) {
				musicElement.removeAttribute("src");
				musicElement.load();
			}
			const context = audioContextRef.current;
			if (context && context.state !== "closed") context.close().catch(() => void 0);
			activeVoices.clear();
			musicElementRef.current = null;
			musicSourceRef.current = null;
			musicGainRef.current = null;
			sfxGainRef.current = null;
			audioContextRef.current = null;
			audioUnlockedRef.current = false;
		};
	}, []);
	const value = useMemo(() => ({
		settings,
		updateSettings,
		playSfx,
		setMusicIntensity
	}), [
		settings,
		updateSettings,
		playSfx,
		setMusicIntensity
	]);
	return /* @__PURE__ */ jsx(ArcadeAudioContext.Provider, {
		value,
		children
	});
}
function useArcadeAudio() {
	const context = useContext(ArcadeAudioContext);
	if (!context) throw new Error("useArcadeAudio deve ser usado dentro de ArcadeAudioProvider.");
	return context;
}
//#endregion
//#region src/features/spellbound/tower/config.ts
/** Tower arena configuration (world units = canvas pixels). */
var TOWER_CONFIG = {
	width: 400,
	height: 720,
	cell: 24,
	platformWidth: 168,
	platformTop: 640,
	/** Target height in cells above the platform. */
	goalCells: 20,
	/** Displayed meta in meters. */
	goalMeters: 15,
	spawnY: 80,
	fallSpeed: 55,
	/** Same safe descent range the bots use — fast, but never enough to tunnel. */
	softDropSpeed: 190,
	moveStep: 12,
	maxLostPieces: 7,
	/** Seconds the tower must stay stable above the line to win. */
	winHoldSeconds: 5,
	/** Rabbit ability cooldown after a confirmed hit. */
	shurikenCooldownSeconds: 5,
	/** Time between confirming a target and removing it. */
	shurikenFlightSeconds: .36,
	/** Fox ability: freeze duration and cooldown. */
	freezeSeconds: 3,
	freezeCooldownSeconds: 6,
	/** Frog ability: max pull distance (px), drag speed (px/s) and cooldown. */
	tonguePull: 48,
	tonguePullSpeed: 360,
	tongueCooldownSeconds: 5,
	/** Raccoon ability: short forging sequence, warm-metal visual and cooldown. */
	forgeAnimationSeconds: .8,
	forgedHeatSeconds: 3,
	forgeCooldownSeconds: 10,
	/** Owl ability: global time-stop window and cooldown after the forecast is used. */
	timeVisionSeconds: 5,
	timeVisionCooldownSeconds: 10,
	timeVisionFadeSeconds: .4,
	/** Capybara ability: finer horizontal control for the next piece, then a short cooldown. */
	capybaraMarginMoveFactor: .6,
	capybaraMarginCooldownSeconds: 10,
	/** Axolotl passive: tolerate up to ten lost pieces before the usual loss condition. */
	axolotlMaxLostPieces: 10
};
var FINISH_Y = TOWER_CONFIG.platformTop - TOWER_CONFIG.goalCells * TOWER_CONFIG.cell;
var METERS_PER_PX = TOWER_CONFIG.goalMeters / (TOWER_CONFIG.goalCells * TOWER_CONFIG.cell);
//#endregion
//#region src/features/spellbound/tower/bots.ts
var BOT_LABELS = {
	easy: "FÁCIL",
	medium: "MÉDIO",
	hard: "DIFÍCIL"
};
var PROFILES = {
	easy: {
		thinkTime: .35,
		moveInterval: .09,
		dropSpeed: 170
	},
	medium: {
		thinkTime: .5,
		moveInterval: .08,
		dropSpeed: 150
	},
	hard: {
		thinkTime: .6,
		moveInterval: .07,
		dropSpeed: 140
	}
};
var CENTER = TOWER_CONFIG.width / 2;
var HALF_BASE = TOWER_CONFIG.platformWidth / 2;
/** Candidate x positions snapped to the engine's move step. */
function candidateXs(from) {
	const xs = [];
	for (let dx = -HALF_BASE - TOWER_CONFIG.cell; dx <= HALF_BASE + TOWER_CONFIG.cell; dx += TOWER_CONFIG.moveStep) xs.push(from + Math.round((CENTER + dx - from) / TOWER_CONFIG.moveStep) * TOWER_CONFIG.moveStep);
	return [...new Set(xs)];
}
function choosePlan(engine, difficulty) {
	const startX = engine.active.position.x;
	const candidates = [];
	for (let rot = 0; rot < 4; rot++) for (const x of candidateXs(startX)) {
		const landing = engine.probe(rot, x);
		if (!landing) continue;
		const centerX = (landing.minX + landing.maxX) / 2;
		const offCenter = Math.abs(centerX - CENTER);
		const overhang = Math.max(0, CENTER - HALF_BASE - landing.minX) + Math.max(0, landing.maxX - (CENTER + HALF_BASE));
		const heightGain = Math.max(0, TOWER_CONFIG.platformTop - landing.landY);
		const score = landing.support * (difficulty === "hard" ? 24 : 19) + landing.supportBalance * (difficulty === "hard" ? 52 : 38) + landing.supportSpan * (difficulty === "hard" ? .2 : .16) + heightGain * (difficulty === "hard" ? .18 : .12) - offCenter * (difficulty === "hard" ? .16 : .24) - overhang * (difficulty === "hard" ? 7 : 5);
		candidates.push({
			rot,
			x,
			score
		});
	}
	if (candidates.length === 0) return {
		rot: 0,
		x: startX
	};
	if (difficulty === "easy") return candidates[Math.floor(Math.random() * candidates.length)];
	candidates.sort((a, b) => b.score - a.score);
	const lookAheadCount = difficulty === "hard" ? 6 : 4;
	const futureWeight = difficulty === "hard" ? .42 : .24;
	for (const candidate of candidates.slice(0, lookAheadCount)) candidate.score += engine.futurePlacementQuality(candidate.rot, candidate.x, engine.nextType) * futureWeight;
	candidates.sort((a, b) => b.score - a.score);
	const bestScore = candidates[0].score;
	const tieWindow = difficulty === "medium" ? 8 : .05;
	const nearBest = candidates.filter((candidate) => bestScore - candidate.score <= tieWindow);
	return difficulty === "medium" ? nearBest[Math.floor(Math.random() * nearBest.length)] : candidates[0];
}
/** Drives a TowerEngine exactly like a player would: rotate, move, drop. */
var TowerBot = class {
	engine;
	difficulty;
	profile;
	piece = null;
	plan = null;
	rotationsLeft = 0;
	timer = 0;
	constructor(engine, difficulty) {
		this.engine = engine;
		this.difficulty = difficulty;
		this.profile = PROFILES[difficulty];
		engine.dropSpeed = this.profile.dropSpeed;
	}
	update(dt) {
		const e = this.engine;
		if (e.status !== "playing" || !e.active) {
			this.piece = null;
			return;
		}
		if (e.active !== this.piece) {
			this.piece = e.active;
			this.plan = null;
			this.timer = this.profile.thinkTime * (.7 + Math.random() * .6);
			e.softDrop = false;
		}
		this.timer -= dt;
		if (this.timer > 0) return;
		if (!this.plan) {
			this.plan = choosePlan(e, this.difficulty);
			this.rotationsLeft = this.plan.rot;
			this.timer = this.profile.moveInterval;
			return;
		}
		this.timer = this.profile.moveInterval;
		if (this.rotationsLeft > 0) {
			const rotated = e.rotate();
			this.rotationsLeft--;
			if (!rotated) {
				this.plan = {
					rot: 0,
					x: e.active.position.x
				};
				this.rotationsLeft = 0;
			}
			return;
		}
		const dx = this.plan.x - e.active.position.x;
		if (Math.abs(dx) >= TOWER_CONFIG.moveStep / 2) {
			if (!e.move(dx > 0 ? 1 : -1)) {
				this.plan = null;
				this.rotationsLeft = 0;
				this.timer = 0;
				e.softDrop = false;
			}
			return;
		}
		if (this.difficulty !== "hard") e.softDrop = true;
	}
};
var BOT_SEATS = [
	"easy",
	"medium",
	"hard"
];
var DEFAULT_BOT_CHARACTERS = [
	"white-fox-ice-mage",
	"purple-rabbit-ninja",
	"swamp-frog-mage",
	"forge-raccoon-mage",
	"time-owl-mage"
];
/** Fox, Rabbit, Frog by default — swapping out whichever one the player picked. */
function pickBotLineup(playerId) {
	const pool = DEFAULT_BOT_CHARACTERS.filter((id) => id !== playerId);
	return BOT_SEATS.map((difficulty, i) => ({
		difficulty,
		characterId: pool[i]
	}));
}
//#endregion
//#region src/features/spellbound/tower/pieces.ts
var TETROMINO_TYPES = [
	"I",
	"O",
	"T",
	"S",
	"Z",
	"J",
	"L"
];
/** Cell coordinates (x, y) of each classic tetromino. */
var TETROMINO_SHAPES = {
	I: [
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 0]
	],
	O: [
		[0, 0],
		[1, 0],
		[0, 1],
		[1, 1]
	],
	T: [
		[0, 0],
		[1, 0],
		[2, 0],
		[1, 1]
	],
	S: [
		[1, 0],
		[2, 0],
		[0, 1],
		[1, 1]
	],
	Z: [
		[0, 0],
		[1, 0],
		[1, 1],
		[2, 1]
	],
	J: [
		[0, 0],
		[0, 1],
		[1, 1],
		[2, 1]
	],
	L: [
		[2, 0],
		[0, 1],
		[1, 1],
		[2, 1]
	]
};
/** Pixel-art block colors: [fill, light, shadow]. */
var TETROMINO_COLORS = {
	I: [
		"#5ee6ff",
		"#c9f7ff",
		"#2a9cc4"
	],
	O: [
		"#ff8ad8",
		"#ffd0f0",
		"#c24fa0"
	],
	T: [
		"#b58cff",
		"#e2d2ff",
		"#7a52d0"
	],
	S: [
		"#6ee7b7",
		"#c8f8e4",
		"#2fa77c"
	],
	Z: [
		"#ff7a9a",
		"#ffc6d4",
		"#c2466a"
	],
	J: [
		"#5a86ff",
		"#c4d4ff",
		"#2f52c4"
	],
	L: [
		"#3fd0c8",
		"#b8f2ee",
		"#1f8f8a"
	]
};
/** 7-bag randomizer so every piece appears regularly. */
function createBag() {
	let bag = [];
	return () => {
		if (bag.length === 0) bag = [...TETROMINO_TYPES].sort(() => Math.random() - .5);
		return bag.pop();
	};
}
//#endregion
//#region src/features/spellbound/tower/engine.ts
var COLLISION_DEPTH_EPSILON = .025;
var BODY_SLOP = .005;
/** Tricky-Towers-style engine: controlled falling piece + real physics once it lands. */
var TowerEngine = class {
	engine = Matter.Engine.create({
		positionIterations: 18,
		velocityIterations: 12,
		enableSleeping: true
	});
	platform;
	active = null;
	pieces = [];
	stablePieces = /* @__PURE__ */ new Set();
	status = "playing";
	lostPieces = 0;
	maxLostPieces = TOWER_CONFIG.maxLostPieces;
	placed = 0;
	heightMeters = 0;
	topY = TOWER_CONFIG.platformTop;
	lostFx = [];
	restTime = /* @__PURE__ */ new Map();
	/** Fox ability: pieces temporarily removed from simulation (seconds left). */
	frozen = /* @__PURE__ */ new Map();
	freezeFx = [];
	/** Raccoon ability: remaining visual heat only; it never changes body physics. */
	forged = /* @__PURE__ */ new Map();
	softDrop = false;
	/** Optional fixed descent speed (used by bots). */
	dropSpeed = null;
	nextPiece = createBag();
	nextType;
	spawnTimer = 0;
	winTimer = 0;
	positioningMarginArmed = false;
	positioningMarginActive = false;
	constructor(maxLostPieces = TOWER_CONFIG.maxLostPieces) {
		this.setMaxLostPieces(maxLostPieces);
		this.engine.gravity.y = 1;
		this.platform = Matter.Bodies.rectangle(TOWER_CONFIG.width / 2, TOWER_CONFIG.platformTop + 20, TOWER_CONFIG.platformWidth, 40, {
			isStatic: true,
			friction: 1,
			frictionStatic: 2,
			slop: BODY_SLOP,
			label: "platform"
		});
		Matter.Composite.add(this.engine.world, this.platform);
		this.nextType = this.nextPiece();
		this.spawn();
	}
	makePiece(type, x, y) {
		const cells = TETROMINO_SHAPES[type];
		const cx = cells.reduce((s, c) => s + c[0], 0) / cells.length;
		const cy = cells.reduce((s, c) => s + c[1], 0) / cells.length;
		const parts = cells.map(([gx, gy]) => Matter.Bodies.rectangle(x + (gx - cx) * TOWER_CONFIG.cell, y + (gy - cy) * TOWER_CONFIG.cell, TOWER_CONFIG.cell, TOWER_CONFIG.cell, { slop: BODY_SLOP }));
		const body = Matter.Body.create({
			parts,
			friction: 1,
			frictionStatic: 3,
			frictionAir: .015,
			restitution: 0,
			density: .002,
			slop: BODY_SLOP
		});
		body.pieceType = type;
		return body;
	}
	spawn() {
		if (this.status !== "playing" || this.winTimer > 0) return;
		const type = this.nextType;
		this.nextType = this.nextPiece();
		const body = this.makePiece(type, TOWER_CONFIG.width / 2, TOWER_CONFIG.spawnY);
		Matter.Body.setStatic(body, true);
		const spawnPosition = this.findSafeSpawnPosition(body, TOWER_CONFIG.width / 2, TOWER_CONFIG.spawnY);
		if (!spawnPosition) {
			this.status = "lost";
			this.winTimer = 0;
			return;
		}
		Matter.Body.setPosition(body, spawnPosition);
		Matter.Composite.add(this.engine.world, body);
		this.active = body;
		this.positioningMarginActive = this.positioningMarginArmed;
		this.positioningMarginArmed = false;
	}
	get positioningMarginState() {
		if (this.positioningMarginActive) return "active";
		return this.positioningMarginArmed ? "armed" : null;
	}
	/** Arms finer horizontal movement for the piece spawned after the current one. */
	activatePositioningMargin() {
		if (!this.active || this.status !== "playing" || this.positioningMarginArmed || this.positioningMarginActive) return false;
		this.positioningMarginArmed = true;
		return true;
	}
	cancelPositioningMargin() {
		this.positioningMarginArmed = false;
		this.positioningMarginActive = false;
	}
	setMaxLostPieces(limit) {
		this.maxLostPieces = Math.max(TOWER_CONFIG.maxLostPieces, Math.floor(limit));
		if (this.status === "playing" && this.lostPieces >= this.maxLostPieces) {
			this.status = "lost";
			this.winTimer = 0;
		}
	}
	findSafeSpawnPosition(body, preferredX, y) {
		const original = {
			x: body.position.x,
			y: body.position.y
		};
		const maxSteps = Math.ceil(TOWER_CONFIG.width / TOWER_CONFIG.moveStep);
		for (let step = 0; step <= maxSteps; step += 1) {
			const offsets = step === 0 ? [0] : [-step * TOWER_CONFIG.moveStep, step * TOWER_CONFIG.moveStep];
			for (const offset of offsets) {
				const x = preferredX + offset;
				Matter.Body.setPosition(body, {
					x,
					y
				});
				const bounds = body.bounds;
				if (bounds.min.x >= 0 && bounds.max.x <= TOWER_CONFIG.width && !this.collides(body)) return {
					x,
					y
				};
			}
		}
		Matter.Body.setPosition(body, original);
		return null;
	}
	collides(body) {
		const others = [this.platform, ...this.pieces];
		return (body.parts.length > 1 ? body.parts.slice(1) : body.parts).some((p) => Matter.Query.collides(p, others).some((collision) => collision.depth > COLLISION_DEPTH_EPSILON));
	}
	maxOverlapDepth(body) {
		const others = [this.platform, ...this.pieces.filter((piece) => piece !== body)];
		const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
		let maxDepth = 0;
		for (const part of parts) for (const collision of Matter.Query.collides(part, others)) maxDepth = Math.max(maxDepth, collision.depth);
		return maxDepth;
	}
	/** Applies a small physical correction to residual overlaps left by the solver. */
	resolveResidualOverlaps() {
		const pieceSet = new Set(this.pieces);
		const maxIterations = Math.min(64, Math.max(8, this.pieces.length * 4));
		for (let iteration = 0; iteration < maxIterations; iteration += 1) {
			let deepest = null;
			for (const piece of this.pieces) {
				const others = [this.platform, ...this.pieces.filter((candidate) => candidate !== piece)];
				const parts = piece.parts.length > 1 ? piece.parts.slice(1) : piece.parts;
				for (const part of parts) for (const collision of Matter.Query.collides(part, others)) {
					if (collision.depth <= COLLISION_DEPTH_EPSILON) continue;
					const { parentA: a, parentB: b, normal, depth } = collision;
					if (a === b) continue;
					if (!deepest || depth > deepest.depth) deepest = {
						a,
						b,
						nx: normal.x,
						ny: normal.y,
						depth
					};
				}
			}
			if (!deepest) return;
			const { a, b, nx, ny, depth } = deepest;
			const moveA = pieceSet.has(a) && !a.isStatic;
			const moveB = pieceSet.has(b) && !b.isStatic;
			if (!moveA && !moveB) return;
			let target;
			let direction;
			if (moveA && !moveB) {
				target = a;
				direction = {
					x: nx,
					y: ny
				};
			} else if (moveB && !moveA) {
				target = b;
				direction = {
					x: -nx,
					y: -ny
				};
			} else if (Math.abs(ny) >= Math.abs(nx)) {
				target = ny > 0 ? b : a;
				direction = target === a ? {
					x: nx,
					y: ny
				} : {
					x: -nx,
					y: -ny
				};
			} else {
				target = b;
				direction = {
					x: -nx,
					y: -ny
				};
			}
			const correction = depth + BODY_SLOP;
			Matter.Body.setPosition(target, {
				x: target.position.x + direction.x * correction,
				y: target.position.y + direction.y * correction
			});
			Matter.Sleeping.set(target, false);
			this.restTime.set(target, 0);
			this.stablePieces.delete(target);
		}
	}
	/** Replaces only the controlled piece at the normal spawn point, using standard piece physics. */
	forgeActivePiece(type, heatSeconds) {
		const previous = this.active;
		if (!previous || this.status !== "playing") return null;
		const body = this.makePiece(type, previous.position.x, previous.position.y);
		Matter.Body.setStatic(body, true);
		const safePosition = this.findSafeSpawnPosition(body, previous.position.x, previous.position.y);
		if (!safePosition) return null;
		Matter.Composite.remove(this.engine.world, previous);
		Matter.Body.setPosition(body, safePosition);
		Matter.Composite.add(this.engine.world, body);
		this.active = body;
		this.softDrop = false;
		this.forged.set(body, heatSeconds);
		return body;
	}
	tryTransform(apply, undo) {
		if (!this.active || this.status !== "playing") return false;
		apply();
		const b = this.active.bounds;
		if (this.collides(this.active) || b.min.x < 0 || b.max.x > TOWER_CONFIG.width) {
			undo();
			return false;
		}
		return true;
	}
	move(dir) {
		const body = this.active;
		if (!body) return false;
		const d = dir * (this.positioningMarginActive ? TOWER_CONFIG.moveStep * TOWER_CONFIG.capybaraMarginMoveFactor : TOWER_CONFIG.moveStep);
		return this.tryTransform(() => Matter.Body.setPosition(body, {
			x: body.position.x + d,
			y: body.position.y
		}), () => Matter.Body.setPosition(body, {
			x: body.position.x - d,
			y: body.position.y
		}));
	}
	rotate() {
		const body = this.active;
		if (!body) return false;
		return this.tryTransform(() => Matter.Body.rotate(body, Math.PI / 2), () => Matter.Body.rotate(body, -Math.PI / 2));
	}
	/** Returns a settled tetromino under a world-space point. Active/preview pieces are excluded. */
	getPlacedPieceAt(point) {
		const hits = Matter.Query.point(this.pieces, point);
		for (const hit of hits) {
			const piece = this.pieces.find((candidate) => candidate === hit || candidate === hit.parent || candidate.parts.includes(hit));
			if (piece && piece !== this.active && piece.bounds.max.y <= TOWER_CONFIG.height) return piece;
		}
		return null;
	}
	/** Removes one exact placed tetromino and lets every remaining body react naturally. */
	removePlacedPiece(piece) {
		const index = this.pieces.indexOf(piece);
		if (index < 0 || piece === this.active) return false;
		const [removed] = this.pieces.splice(index, 1);
		if (!removed) return false;
		this.restTime.delete(removed);
		this.stablePieces.delete(removed);
		this.frozen.delete(removed);
		this.forged.delete(removed);
		Matter.Composite.remove(this.engine.world, removed);
		this.stablePieces.clear();
		for (const remaining of this.pieces) {
			this.restTime.set(remaining, 0);
			if (!remaining.isStatic) Matter.Sleeping.set(remaining, false);
		}
		return true;
	}
	/** Freezes one placed piece in place: it simply stops being simulated, no forces applied. */
	freezePiece(piece, seconds) {
		if (!this.pieces.includes(piece) || piece === this.active) return false;
		Matter.Body.setVelocity(piece, {
			x: 0,
			y: 0
		});
		Matter.Body.setAngularVelocity(piece, 0);
		Matter.Body.setStatic(piece, true);
		this.frozen.set(piece, seconds);
		this.freezeFx.push({
			x: piece.position.x,
			y: piece.position.y,
			t: 0
		});
		return true;
	}
	/** Frog ability: holds a placed piece still while the tongue is attached. */
	grabPiece(piece) {
		if (!this.pieces.includes(piece) || piece === this.active) return false;
		this.frozen.delete(piece);
		Matter.Body.setVelocity(piece, {
			x: 0,
			y: 0
		});
		Matter.Body.setAngularVelocity(piece, 0);
		Matter.Body.setStatic(piece, true);
		return true;
	}
	/** Total overlap of a piece against everything else (used so a pull never pushes deeper). */
	overlapOf(piece) {
		const others = [this.platform, ...this.pieces.filter((p) => p !== piece)];
		const parts = piece.parts.length > 1 ? piece.parts.slice(1) : piece.parts;
		let sum = 0;
		for (const part of parts) for (const c of Matter.Query.collides(part, others)) sum += c.depth;
		return sum;
	}
	/**
	* Starts a strong, collision-respecting pull. The piece stays held while the tongue
	* drags it fast across several frames (see tickPull), stopping at walls, floor or
	* other pieces, then hands it back to normal physics with no leftover velocity.
	*/
	releaseGrab(piece, dir, distance) {
		if (!this.pieces.includes(piece)) return;
		if (dir) {
			const len = Math.hypot(dir.x, dir.y) || 1;
			this.pull = {
				piece,
				ux: dir.x / len,
				uy: dir.y / len,
				left: distance
			};
		} else this.finishPull(piece);
	}
	/** Active tongue pull, dragged in fast small steps so it never tunnels. */
	pull = null;
	/** True while the tongue is still dragging this piece. */
	isPulling(piece) {
		return this.pull?.piece === piece;
	}
	/** Strong drag: many 1px steps per frame, stopping the moment it would overlap. */
	tickPull(dt) {
		const p = this.pull;
		if (!p) return;
		if (!this.pieces.includes(p.piece)) {
			this.pull = null;
			return;
		}
		let steps = Math.max(2, Math.round(TOWER_CONFIG.tonguePullSpeed * dt));
		let base = this.overlapOf(p.piece);
		while (steps-- > 0 && p.left > 0) {
			Matter.Body.setPosition(p.piece, {
				x: p.piece.position.x + p.ux,
				y: p.piece.position.y + p.uy
			});
			const b = p.piece.bounds;
			const over = this.overlapOf(p.piece);
			if (b.min.x < 0 || b.max.x > TOWER_CONFIG.width || b.min.y < 0 || over > base + .3) {
				Matter.Body.setPosition(p.piece, {
					x: p.piece.position.x - p.ux,
					y: p.piece.position.y - p.uy
				});
				p.left = 0;
				break;
			}
			base = Math.min(base, over);
			p.left--;
		}
		if (p.left <= 0) {
			this.pull = null;
			this.finishPull(p.piece);
		}
	}
	/** Returns a pulled piece to normal physics: no force, no velocity, fully awake. */
	finishPull(piece) {
		Matter.Body.setStatic(piece, false);
		Matter.Body.setVelocity(piece, {
			x: 0,
			y: 0
		});
		Matter.Body.setAngularVelocity(piece, 0);
		Matter.Sleeping.set(piece, false);
		this.restTime.set(piece, 0);
		for (const other of this.pieces) if (!other.isStatic) Matter.Sleeping.set(other, false);
		this.freezeFx.push({
			x: piece.position.x,
			y: piece.position.y,
			t: .3
		});
	}
	tickFrozen(dt) {
		for (const [piece, left] of [...this.frozen]) {
			const t = left - dt;
			if (t > 0) {
				this.frozen.set(piece, t);
				continue;
			}
			this.frozen.delete(piece);
			Matter.Body.setStatic(piece, false);
			Matter.Body.setVelocity(piece, {
				x: 0,
				y: 0
			});
			Matter.Body.setAngularVelocity(piece, 0);
			Matter.Sleeping.set(piece, false);
			this.restTime.set(piece, 0);
		}
	}
	hardDrop() {
		const body = this.active;
		if (!body || this.status !== "playing") return;
		for (let i = 0; i < 900; i++) {
			Matter.Body.setPosition(body, {
				x: body.position.x,
				y: body.position.y + 1
			});
			if (this.collides(body) || body.position.y > TOWER_CONFIG.height) {
				Matter.Body.setPosition(body, {
					x: body.position.x,
					y: body.position.y - 1
				});
				break;
			}
		}
		this.release();
	}
	/** During the Owl's time stop, only an intentional soft-drop input may advance the active piece. */
	stepControlledPiece(dt) {
		const body = this.active;
		if (!body || this.status !== "playing" || !this.softDrop) return;
		let remaining = TOWER_CONFIG.softDropSpeed * dt;
		while (remaining > 0 && this.active === body) {
			const dy = Math.min(1, remaining);
			remaining -= dy;
			Matter.Body.setPosition(body, {
				x: body.position.x,
				y: body.position.y + dy
			});
			if (this.collides(body)) {
				Matter.Body.setPosition(body, {
					x: body.position.x,
					y: body.position.y - dy
				});
				this.release();
			} else if (body.bounds.min.y > TOWER_CONFIG.height) this.release();
		}
	}
	/**
	* Simulates dropping the active piece with `rot` quarter turns at x, using the real
	* collision shapes. Restores the piece afterwards. Used by bots to evaluate moves.
	*/
	probe(rot, x) {
		const body = this.active;
		if (!body || this.status !== "playing") return null;
		const pos = {
			x: body.position.x,
			y: body.position.y
		};
		const originalAngle = body.angle;
		let result = null;
		try {
			let reachable = !this.collides(body);
			for (let turn = 0; turn < rot && reachable; turn += 1) {
				Matter.Body.rotate(body, Math.PI / 2);
				if (this.collides(body)) reachable = false;
			}
			let pathX = body.position.x;
			while (reachable && Math.abs(x - pathX) > .001) {
				const dx = Math.sign(x - pathX) * Math.min(TOWER_CONFIG.moveStep, Math.abs(x - pathX));
				pathX += dx;
				Matter.Body.setPosition(body, {
					x: pathX,
					y: pos.y
				});
				const pathBounds = body.bounds;
				if (pathBounds.min.x < 0 || pathBounds.max.x > TOWER_CONFIG.width || this.collides(body)) reachable = false;
			}
			if (reachable) {
				let y = pos.y;
				while (y < TOWER_CONFIG.height + 40) {
					const candidateY = Math.min(y + 3, TOWER_CONFIG.height + 40);
					Matter.Body.setPosition(body, {
						x,
						y: candidateY
					});
					if (this.collides(body)) {
						for (let back = 1; back <= 2; back += 1) {
							const refinedY = candidateY - back;
							Matter.Body.setPosition(body, {
								x,
								y: refinedY
							});
							if (!this.collides(body)) {
								y = refinedY;
								break;
							}
						}
						break;
					}
					y = candidateY;
				}
				Matter.Body.setPosition(body, {
					x,
					y
				});
				if (y < TOWER_CONFIG.height) {
					Matter.Body.setPosition(body, {
						x,
						y: y + 3
					});
					const others = [this.platform, ...this.pieces];
					const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
					const supportingParts = [];
					const supportContactXs = [];
					for (const part of parts) {
						const contacts = Matter.Query.collides(part, others).filter((collision) => collision.depth > COLLISION_DEPTH_EPSILON && Math.abs(collision.normal.y) >= .5);
						if (contacts.length === 0) continue;
						supportingParts.push(part);
						for (const collision of contacts) for (const contact of collision.supports) if (contact) supportContactXs.push(contact.x);
					}
					const supportXs = supportContactXs.length ? supportContactXs : supportingParts.map((part) => part.position.x);
					const supportMinX = supportXs.length ? Math.min(...supportXs) : body.position.x;
					const supportMaxX = supportXs.length ? Math.max(...supportXs) : body.position.x;
					const supportCenterX = supportXs.length ? supportXs.reduce((sum, value) => sum + value, 0) / supportXs.length : body.position.x;
					const supportSpan = supportXs.length ? supportMaxX - supportMinX + TOWER_CONFIG.cell : 0;
					const halfSupportSpan = Math.max(TOWER_CONFIG.cell / 2, supportSpan / 2);
					const balanceMargin = halfSupportSpan - Math.abs(body.position.x - supportCenterX);
					const supportBalance = supportXs.length ? Math.max(-1, Math.min(1, balanceMargin / halfSupportSpan)) : -1;
					Matter.Body.setPosition(body, {
						x,
						y
					});
					result = {
						x: body.position.x,
						y: body.position.y,
						landY: body.bounds.max.y,
						support: supportingParts.length,
						minX: body.bounds.min.x,
						maxX: body.bounds.max.x,
						supportSpan,
						supportBalance
					};
				}
			}
		} finally {
			Matter.Body.setPosition(body, pos);
			Matter.Body.setAngle(body, originalAngle);
			Matter.Body.setPosition(body, pos);
		}
		return result;
	}
	/** Scores the next visible piece on a temporary copy of the candidate landing. */
	futurePlacementQuality(rot, x, nextType) {
		const current = this.active;
		if (!current?.pieceType || this.status !== "playing") return -100;
		const landing = this.probe(rot, x);
		if (!landing) return -100;
		const previousTopY = this.topY;
		const previousActive = this.active;
		const previousPieceCount = this.pieces.length;
		const shadow = this.makePiece(current.pieceType, landing.x, landing.y);
		Matter.Body.rotate(shadow, rot * (Math.PI / 2));
		Matter.Body.setStatic(shadow, true);
		const future = this.makePiece(nextType, TOWER_CONFIG.width / 2, TOWER_CONFIG.spawnY);
		Matter.Body.setStatic(future, true);
		try {
			this.pieces.push(shadow);
			this.topY = Math.min(this.topY, shadow.bounds.min.y);
			const spawnPosition = this.findSafeSpawnPosition(future, TOWER_CONFIG.width / 2, TOWER_CONFIG.spawnY);
			if (!spawnPosition) return -100;
			Matter.Body.setPosition(future, spawnPosition);
			this.active = future;
			const offsets = [
				-TOWER_CONFIG.platformWidth / 2,
				-TOWER_CONFIG.platformWidth / 4,
				0,
				TOWER_CONFIG.platformWidth / 4,
				TOWER_CONFIG.platformWidth / 2,
				landing.x - TOWER_CONFIG.width / 2
			];
			const xs = [...new Set(offsets.map((offset) => spawnPosition.x + Math.round(offset / TOWER_CONFIG.moveStep) * TOWER_CONFIG.moveStep))];
			const platformLeft = (TOWER_CONFIG.width - TOWER_CONFIG.platformWidth) / 2;
			const platformRight = platformLeft + TOWER_CONFIG.platformWidth;
			let best = -Infinity;
			for (let nextRot = 0; nextRot < 4; nextRot += 1) for (const nextX of xs) {
				const nextLanding = this.probe(nextRot, nextX);
				if (!nextLanding) continue;
				const centerX = (nextLanding.minX + nextLanding.maxX) / 2;
				const overhang = Math.max(0, platformLeft - nextLanding.minX) + Math.max(0, nextLanding.maxX - platformRight);
				const quality = nextLanding.support * 18 + nextLanding.supportBalance * 26 + nextLanding.supportSpan * .14 + Math.max(0, TOWER_CONFIG.platformTop - nextLanding.landY) * .1 - overhang * 4 - Math.abs(centerX - TOWER_CONFIG.width / 2) * .08;
				best = Math.max(best, quality);
			}
			return Number.isFinite(best) ? best : -100;
		} finally {
			this.pieces.length = previousPieceCount;
			this.topY = previousTopY;
			this.active = previousActive;
		}
	}
	/** Suggests a stable, reachable landing using the same collision-accurate probes as bots. */
	recommendActivePlacement() {
		const active = this.active;
		if (!active || this.status !== "playing") return null;
		const platformLeft = (TOWER_CONFIG.width - TOWER_CONFIG.platformWidth) / 2;
		const platformRight = platformLeft + TOWER_CONFIG.platformWidth;
		const maxSteps = Math.ceil(TOWER_CONFIG.width / TOWER_CONFIG.moveStep);
		let best = null;
		let bestScore = -Infinity;
		for (let quarterTurns = 0; quarterTurns < 4; quarterTurns++) for (let step = -maxSteps; step <= maxSteps; step++) {
			const x = active.position.x + step * TOWER_CONFIG.moveStep;
			const landing = this.probe(quarterTurns, x);
			if (!landing) continue;
			const centerX = (landing.minX + landing.maxX) / 2;
			const overhang = Math.max(0, platformLeft - landing.minX) + Math.max(0, landing.maxX - platformRight);
			const score = landing.support * 40 + landing.landY * .12 - overhang * 5 - Math.abs(centerX - TOWER_CONFIG.width / 2) * .16 - quarterTurns * 1.5;
			if (score > bestScore) {
				bestScore = score;
				best = {
					x: landing.x,
					y: landing.y,
					quarterTurns,
					support: landing.support
				};
			}
		}
		return best;
	}
	/** Every piece — player or bot — enters the simulation the exact same way: at rest. */
	release() {
		const body = this.active;
		if (!body) return;
		if (this.collides(body) && !this.separateFromOverlap(body)) {
			Matter.Composite.remove(this.engine.world, body);
			this.active = null;
			this.positioningMarginActive = false;
			this.positioningMarginArmed = false;
			this.status = "lost";
			this.winTimer = 0;
			return;
		}
		Matter.Body.setStatic(body, false);
		Matter.Sleeping.set(body, false);
		Matter.Body.setVelocity(body, {
			x: 0,
			y: 0
		});
		Matter.Body.setAngularVelocity(body, 0);
		this.pieces.push(body);
		this.restTime.set(body, 0);
		this.stablePieces.delete(body);
		this.active = null;
		this.positioningMarginActive = false;
		this.placed++;
		this.spawnTimer = .45;
	}
	/** Finds the nearest clear pixel around an unexpectedly embedded active body. */
	separateFromOverlap(body) {
		const origin = {
			x: body.position.x,
			y: body.position.y
		};
		const maxDistance = TOWER_CONFIG.cell * 2;
		for (let distance = .25; distance <= maxDistance; distance += .25) {
			const candidates = [
				{
					x: origin.x,
					y: origin.y - distance
				},
				{
					x: origin.x - distance,
					y: origin.y
				},
				{
					x: origin.x + distance,
					y: origin.y
				},
				{
					x: origin.x - distance,
					y: origin.y - distance
				},
				{
					x: origin.x + distance,
					y: origin.y - distance
				}
			];
			for (const candidate of candidates) {
				Matter.Body.setPosition(body, candidate);
				const bounds = body.bounds;
				if (bounds.min.x >= 0 && bounds.max.x <= TOWER_CONFIG.width && bounds.min.y >= 0 && !this.collides(body)) return true;
			}
		}
		Matter.Body.setPosition(body, origin);
		return false;
	}
	step(dt) {
		this.lostFx = this.lostFx.filter((f) => (f.t += dt) < .8);
		this.freezeFx = this.freezeFx.filter((f) => (f.t += dt) < .6);
		for (const [piece, left] of [...this.forged]) {
			const remaining = left - dt;
			if (remaining > 0 && (piece === this.active || this.pieces.includes(piece))) this.forged.set(piece, remaining);
			else this.forged.delete(piece);
		}
		this.tickFrozen(dt);
		this.tickPull(dt);
		if (this.status !== "playing") {
			Matter.Engine.update(this.engine, dt * 1e3);
			this.resolveResidualOverlaps();
			return;
		}
		const body = this.active;
		if (body) {
			const base = this.dropSpeed ?? TOWER_CONFIG.fallSpeed;
			let remaining = Math.min(TOWER_CONFIG.softDropSpeed, this.softDrop ? Math.max(TOWER_CONFIG.softDropSpeed, base) : base) * dt;
			while (remaining > 0 && this.active === body) {
				const dy = Math.min(1, remaining);
				remaining -= dy;
				Matter.Body.setPosition(body, {
					x: body.position.x,
					y: body.position.y + dy
				});
				if (this.collides(body)) {
					Matter.Body.setPosition(body, {
						x: body.position.x,
						y: body.position.y - dy
					});
					this.release();
				} else if (body.bounds.min.y > TOWER_CONFIG.height) this.release();
			}
		} else if (this.winTimer <= 0 && this.spawnTimer > 0) {
			this.spawnTimer -= dt;
			if (this.spawnTimer <= 0) this.spawn();
		}
		const sub = 3;
		for (let i = 0; i < sub; i += 1) {
			Matter.Engine.update(this.engine, dt * 1e3 / sub);
			this.clampVelocities();
			this.resolveResidualOverlaps();
		}
		for (const p of [...this.pieces]) if (p.position.y > TOWER_CONFIG.height + 60) {
			Matter.Composite.remove(this.engine.world, p);
			this.pieces = this.pieces.filter((x) => x !== p);
			this.frozen.delete(p);
			this.forged.delete(p);
			this.restTime.delete(p);
			this.stablePieces.delete(p);
			this.lostPieces++;
			this.lostFx.push({
				x: Math.max(20, Math.min(TOWER_CONFIG.width - 20, p.position.x)),
				t: 0
			});
		}
		if (this.lostPieces >= this.maxLostPieces) {
			this.status = "lost";
			this.winTimer = 0;
			return;
		}
		for (const p of this.pieces) {
			if (this.maxOverlapDepth(p) > COLLISION_DEPTH_EPSILON) {
				this.restTime.set(p, 0);
				this.stablePieces.delete(p);
				if (p.isSleeping && !p.isStatic) Matter.Sleeping.set(p, false);
				continue;
			}
			if (p.isSleeping || p.isStatic) continue;
			if (p.speed < .12 && p.angularSpeed < .004) {
				const t = (this.restTime.get(p) ?? 0) + dt;
				this.restTime.set(p, t);
				if (t > .5) {
					Matter.Body.setVelocity(p, {
						x: 0,
						y: 0
					});
					Matter.Body.setAngularVelocity(p, 0);
					Matter.Sleeping.set(p, true);
					this.stablePieces.add(p);
				} else this.stablePieces.delete(p);
			} else {
				this.restTime.set(p, 0);
				this.stablePieces.delete(p);
			}
		}
		let top = TOWER_CONFIG.platformTop;
		for (const p of this.pieces) if (p.bounds.max.y <= TOWER_CONFIG.platformTop + 30 && p.position.x > -20 && p.position.x < TOWER_CONFIG.width + 20) top = Math.min(top, p.bounds.min.y);
		this.topY = top;
		this.heightMeters = Math.max(0, Math.round((TOWER_CONFIG.platformTop - top) * METERS_PER_PX * 10) / 10);
		const reachedFinish = top <= FINISH_Y;
		if (this.winTimer > 0 || reachedFinish) {
			this.winTimer += dt;
			if (this.winTimer >= TOWER_CONFIG.winHoldSeconds) if (reachedFinish) this.status = "won";
			else this.winTimer = 0;
		}
	}
	/** Safety limits: a glitchy contact can never launch a piece. */
	clampVelocities() {
		const maxSpeed = 6;
		const maxAngular = .12;
		for (const p of this.pieces) {
			if (p.isSleeping || p.isStatic) continue;
			let { x, y } = p.velocity;
			const sp = Math.hypot(x, y);
			if (sp > maxSpeed) {
				x = x / sp * maxSpeed;
				y = y / sp * maxSpeed;
			}
			if (y < -.6) y = -.6;
			if (x !== p.velocity.x || y !== p.velocity.y) Matter.Body.setVelocity(p, {
				x,
				y
			});
			if (Math.abs(p.angularVelocity) > maxAngular) Matter.Body.setAngularVelocity(p, Math.sign(p.angularVelocity) * maxAngular);
		}
	}
	get winProgress() {
		return Math.min(1, this.winTimer / TOWER_CONFIG.winHoldSeconds);
	}
	/** Completes the existing player status when all three opponents are defeated. */
	awardEliminationVictoryIfAllBotsLost(botEngines) {
		if (this.status !== "playing" || botEngines.length !== 3 || !botEngines.every((bot) => bot.status === "lost")) return false;
		this.status = "won";
		this.winTimer = 0;
		return true;
	}
	snapshot() {
		const winConfirming = this.status === "playing" && this.winTimer > 0;
		return {
			status: this.status,
			heightMeters: this.heightMeters,
			topY: this.topY,
			lostPieces: this.lostPieces,
			maxLostPieces: this.maxLostPieces,
			positioningMarginState: this.positioningMarginState,
			nextType: this.nextType,
			placed: this.placed,
			stablePieces: this.stablePieces.size,
			winConfirming,
			winSecondsRemaining: winConfirming ? Math.max(0, TOWER_CONFIG.winHoldSeconds - this.winTimer) : 0
		};
	}
	destroy() {
		Matter.Composite.clear(this.engine.world, false);
		Matter.Engine.clear(this.engine);
	}
};
//#endregion
//#region src/features/spellbound/tower/rewards.ts
var TOWER_REWARD_RULES = {
	coinsPerStablePiece: 5,
	coinsPerPeakMeter: 1,
	victoryBonus: 25
};
function nonNegativeInteger(value) {
	return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
/**
* Calculates Tower rewards from finalized match results only. `stablePieces` is the engine's
* settled-piece count at match end; active/falling pieces do not earn coins.
*/
function calculateTowerRewardBreakdown({ status, peakHeightTenths, stablePieces }) {
	if (status === "playing") return {
		stablePieceBonus: 0,
		heightBonus: 0,
		victoryBonus: 0,
		total: 0
	};
	const stablePieceBonus = nonNegativeInteger(stablePieces) * TOWER_REWARD_RULES.coinsPerStablePiece;
	const heightBonus = Math.floor(nonNegativeInteger(peakHeightTenths) / 10) * TOWER_REWARD_RULES.coinsPerPeakMeter;
	const victoryBonus = status === "won" ? TOWER_REWARD_RULES.victoryBonus : 0;
	return {
		stablePieceBonus,
		heightBonus,
		victoryBonus,
		total: stablePieceBonus + heightBonus + victoryBonus
	};
}
//#endregion
//#region src/features/spellbound/tower/render.ts
function drawBlock(ctx, type, alpha = 1) {
	const [fill, light, shadow] = TETROMINO_COLORS[type];
	const s = TOWER_CONFIG.cell;
	const h = s / 2;
	ctx.globalAlpha = alpha;
	ctx.fillStyle = "#1e2a5a";
	ctx.fillRect(-h, -h, s, s);
	ctx.fillStyle = shadow;
	ctx.fillRect(-h + 2, -h + 2, s - 4, s - 4);
	ctx.fillStyle = fill;
	ctx.fillRect(-h + 2, -h + 2, s - 7, s - 7);
	ctx.fillStyle = light;
	ctx.fillRect(-h + 4, -h + 4, 6, 3);
	ctx.fillRect(-h + 4, -h + 4, 3, 6);
	ctx.globalAlpha = 1;
}
function drawPiece(ctx, body, alpha = 1) {
	const type = body.pieceType ?? "T";
	const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
	for (const p of parts) {
		ctx.save();
		ctx.translate(p.position.x, p.position.y);
		ctx.rotate(body.angle);
		drawBlock(ctx, type, alpha);
		ctx.restore();
	}
}
function drawForgedHeat(ctx, body, left, time) {
	const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
	const strength = Math.min(1, left / TOWER_CONFIG.forgedHeatSeconds);
	ctx.save();
	for (const part of parts) {
		ctx.beginPath();
		part.vertices.forEach((vertex, index) => index === 0 ? ctx.moveTo(vertex.x, vertex.y) : ctx.lineTo(vertex.x, vertex.y));
		ctx.closePath();
		ctx.fillStyle = `rgba(239,72,56,${.18 + strength * .5})`;
		ctx.fill();
		ctx.strokeStyle = `rgba(255,126,79,${.25 + strength * .7})`;
		ctx.lineWidth = 2;
		ctx.stroke();
	}
	for (let index = 0; index < 7; index++) {
		const cycle = (time * 1.8 + index * .19) % 1;
		ctx.globalAlpha = strength * (1 - cycle);
		ctx.fillStyle = index % 3 === 0 ? "#fff4ef" : index % 2 ? "#ff7e4f" : "#ef4838";
		const width = Math.max(1, body.bounds.max.x - body.bounds.min.x);
		const x = body.bounds.min.x + (index * 29 + 7) % width;
		ctx.fillRect(Math.round(x), Math.round(body.bounds.min.y - cycle * 18), index % 2 ? 3 : 2, index % 2 ? 3 : 2);
	}
	for (let index = 0; index < 3; index++) {
		const cycle = (time * .35 + index * .32) % 1;
		ctx.globalAlpha = strength * .22 * (1 - cycle);
		ctx.fillStyle = "#e8f6ff";
		ctx.fillRect(Math.round(body.position.x - 8 + index * 8), Math.round(body.bounds.min.y - 8 - cycle * 15), 6, 6);
	}
	ctx.restore();
}
function drawIsland$1(ctx) {
	const x0 = (TOWER_CONFIG.width - TOWER_CONFIG.platformWidth) / 2;
	const top = TOWER_CONFIG.platformTop;
	ctx.fillStyle = "#1e2a5a";
	ctx.fillRect(x0 - 2, top - 2, TOWER_CONFIG.platformWidth + 4, 12);
	ctx.fillStyle = "#e8f6ff";
	ctx.fillRect(x0, top, TOWER_CONFIG.platformWidth, 8);
	ctx.fillStyle = "#9ee8ff";
	for (let x = x0; x < x0 + TOWER_CONFIG.platformWidth; x += 12) ctx.fillRect(x, top + 6, 6, 2);
	[
		"#5a6ee0",
		"#4a58c8",
		"#3c46a8",
		"#7a4ec8",
		"#5a3a9a"
	].forEach((color, i) => {
		const inset = i * 14;
		ctx.fillStyle = "#1e2a5a";
		ctx.fillRect(x0 + inset - 2, top + 10 + i * 12, TOWER_CONFIG.platformWidth - inset * 2 + 4, 14);
		ctx.fillStyle = color;
		ctx.fillRect(x0 + inset, top + 10 + i * 12, TOWER_CONFIG.platformWidth - inset * 2, 12);
	});
	ctx.fillStyle = "#b8f4ff";
	ctx.fillRect(TOWER_CONFIG.width / 2 - 3, top + 70, 6, 8);
}
function drawFinishLine(ctx, time, progress, closeness, won) {
	const y = FINISH_Y;
	const pulse = .5 + .5 * Math.sin(time * 6);
	const glow = won ? 1 : closeness > .75 ? (closeness - .75) * 4 : 0;
	ctx.fillStyle = `rgba(200,184,255,${.18 + glow * .3 * pulse})`;
	ctx.fillRect(0, y - 6 - glow * 6, TOWER_CONFIG.width, 12 + glow * 12);
	if (glow > 0) {
		for (let i = 0; i < 14; i++) {
			const px = (i * 53 + time * 30) % TOWER_CONFIG.width;
			const py = y - 10 - (i * 17 + time * 25) % 40;
			ctx.fillStyle = i % 2 ? "#ffffff" : "#9ee8ff";
			ctx.globalAlpha = glow * (1 - (i * 17 + time * 25) % 40 / 40);
			ctx.fillRect(Math.floor(px), Math.floor(py), 3, 3);
		}
		ctx.globalAlpha = 1;
	}
	const offset = Math.floor(time * 20) % 16;
	for (let x = -16 + offset; x < TOWER_CONFIG.width; x += 16) {
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(x, y - 2, 8, 4);
		ctx.fillStyle = "#b58cff";
		ctx.fillRect(x + 8, y - 2, 8, 4);
	}
	if (progress > 0) {
		ctx.fillStyle = "#5ee6ff";
		ctx.fillRect(0, y + 4, TOWER_CONFIG.width * progress, 3);
	}
	ctx.font = "8px 'Press Start 2P', monospace";
	ctx.fillStyle = "#1e2a5a";
	ctx.fillText("LINHA DE CHEGADA", 9, y - 9);
	ctx.fillStyle = "#ffffff";
	ctx.fillText("LINHA DE CHEGADA", 8, y - 10);
}
/** Disposable geometry for a visual estimate; the real active body and world are never modified. */
function estimateLanding(engine) {
	const active = engine.active;
	if (!active) return null;
	const cells = active.parts.length > 1 ? active.parts.slice(1) : active.parts;
	const ghost = Matter.Body.create({ parts: cells.map((part) => Matter.Bodies.rectangle(part.position.x, part.position.y, TOWER_CONFIG.cell, TOWER_CONFIG.cell, { angle: active.angle })) });
	const obstacles = [engine.platform, ...engine.pieces];
	const collides = () => Matter.Query.collides(ghost, obstacles).some((hit) => hit.depth > .1);
	if (collides()) return null;
	let distance = 0;
	const limit = TOWER_CONFIG.height - active.bounds.max.y + TOWER_CONFIG.cell;
	while (distance + 4 <= limit) {
		Matter.Body.setPosition(ghost, {
			x: active.position.x,
			y: active.position.y + distance + 4
		});
		if (collides()) break;
		distance += 4;
	}
	while (distance + 1 <= limit) {
		Matter.Body.setPosition(ghost, {
			x: active.position.x,
			y: active.position.y + distance + 1
		});
		if (collides()) break;
		distance += 1;
	}
	return distance;
}
function drawLandingGuide(ctx, engine) {
	const active = engine.active;
	if (!active) return;
	const distance = estimateLanding(engine);
	if (distance === null || distance < 2) return;
	const cells = active.parts.length > 1 ? active.parts.slice(1) : active.parts;
	const colors = getComputedStyle(ctx.canvas);
	ctx.save();
	ctx.strokeStyle = colors.getPropertyValue("--arcade-cyan").trim();
	ctx.globalAlpha = .55;
	ctx.lineWidth = 2;
	ctx.setLineDash([4, 7]);
	ctx.beginPath();
	ctx.moveTo(Math.round(active.position.x) + .5, Math.round(active.bounds.max.y) + 4);
	ctx.lineTo(Math.round(active.position.x) + .5, Math.round(active.bounds.min.y + distance) - 4);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.fillStyle = colors.getPropertyValue("--arcade-lilac").trim();
	ctx.strokeStyle = colors.getPropertyValue("--arcade-cloud").trim();
	ctx.lineWidth = 1;
	ctx.globalAlpha = .4;
	for (const cell of cells) {
		ctx.beginPath();
		cell.vertices.forEach((vertex, index) => {
			if (index === 0) ctx.moveTo(vertex.x, vertex.y + distance);
			else ctx.lineTo(vertex.x, vertex.y + distance);
		});
		ctx.closePath();
		ctx.fill();
		ctx.stroke();
	}
	ctx.restore();
}
function drawFrost(ctx, body, left, time) {
	const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
	ctx.save();
	const blink = left < 1 && Math.floor(time * 8) % 2 === 0 ? .25 : .45;
	for (const part of parts) {
		ctx.beginPath();
		part.vertices.forEach((v, i) => i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y));
		ctx.closePath();
		ctx.fillStyle = `rgba(158,232,255,${blink})`;
		ctx.fill();
		ctx.strokeStyle = "#e8fbff";
		ctx.lineWidth = 2;
		ctx.stroke();
		ctx.fillStyle = "#ffffff";
		for (const v of part.vertices) ctx.fillRect(Math.round(v.x) - 2, Math.round(v.y) - 2, 3, 3);
	}
	for (let i = 0; i < 4; i++) {
		const k = (time * .7 + i * .25) % 1;
		const x = body.bounds.min.x + (i * 37 + 11) % Math.max(1, body.bounds.max.x - body.bounds.min.x);
		ctx.globalAlpha = 1 - k;
		ctx.fillStyle = i % 2 ? "#c8b8ff" : "#ffffff";
		ctx.fillRect(Math.round(x), Math.round(body.bounds.min.y - k * 14), 2, 2);
	}
	ctx.restore();
}
var FROG_MOUTH = {
	x: 34,
	y: TOWER_CONFIG.height - 70
};
function drawTongue(ctx, t, time) {
	const p = t.body.position;
	ctx.save();
	const dx = p.x - FROG_MOUTH.x;
	const dy = p.y - FROG_MOUTH.y;
	const steps = Math.max(1, Math.floor(Math.hypot(dx, dy) / 4));
	for (let i = 0; i <= steps; i++) {
		const k = i / steps;
		const wob = Math.sin(time * 12 + i * .6) * 1.5 * (1 - k);
		ctx.fillStyle = "#1f6b3a";
		ctx.fillRect(Math.round(FROG_MOUTH.x + dx * k) - 3, Math.round(FROG_MOUTH.y + dy * k + wob) - 3, 6, 6);
		ctx.fillStyle = i % 2 ? "#5fd67a" : "#8ef0a2";
		ctx.fillRect(Math.round(FROG_MOUTH.x + dx * k) - 2, Math.round(FROG_MOUTH.y + dy * k + wob) - 2, 4, 4);
	}
	ctx.fillStyle = "#5ee6ff";
	ctx.fillRect(Math.round(p.x) - 5, Math.round(p.y) - 5, 10, 10);
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
	for (let i = 0; i < 6; i++) {
		const a = i / 6 * Math.PI * 2 + time * 2;
		ctx.fillStyle = i % 3 === 2 ? "#c8b8ff" : "#5fd67a";
		ctx.fillRect(Math.round(p.x + Math.cos(a) * 14), Math.round(p.y + Math.sin(a) * 14), 3, 3);
	}
	if (t.dir) {
		const len = Math.hypot(t.dir.x, t.dir.y) || 1;
		const ux = t.dir.x / len;
		const uy = t.dir.y / len;
		const ex = p.x + ux * (t.reach + 14);
		const ey = p.y + uy * (t.reach + 14);
		ctx.strokeStyle = "#5ee6ff";
		ctx.lineWidth = 3;
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(p.x, p.y);
		ctx.lineTo(ex, ey);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.fillStyle = "#ffffff";
		ctx.beginPath();
		ctx.moveTo(ex + ux * 6, ey + uy * 6);
		ctx.lineTo(ex - uy * 6, ey + ux * 6);
		ctx.lineTo(ex + uy * 6, ey - ux * 6);
		ctx.closePath();
		ctx.fill();
	}
	ctx.restore();
}
function drawPieceOutline(ctx, body, ice = false, color) {
	const parts = body.parts.length > 1 ? body.parts.slice(1) : body.parts;
	ctx.save();
	ctx.strokeStyle = color ?? (ice ? "#9ee8ff" : "#d9b8ff");
	ctx.lineWidth = 5;
	ctx.shadowColor = ice ? "#5ee6ff" : "#9d6cff";
	ctx.shadowBlur = 10;
	for (const part of parts) {
		ctx.beginPath();
		part.vertices.forEach((vertex, index) => {
			if (index === 0) ctx.moveTo(vertex.x, vertex.y);
			else ctx.lineTo(vertex.x, vertex.y);
		});
		ctx.closePath();
		ctx.stroke();
	}
	ctx.restore();
}
function drawTimeVision(ctx, engine, recommendation, time) {
	const active = engine.active;
	if (!active?.pieceType) return;
	const cells = TETROMINO_SHAPES[active.pieceType];
	const centerX = cells.reduce((sum, [x]) => sum + x, 0) / cells.length;
	const centerY = cells.reduce((sum, [, y]) => sum + y, 0) / cells.length;
	const pulse = .68 + Math.sin(time * 6) * .12;
	ctx.save();
	ctx.globalAlpha = .8;
	ctx.strokeStyle = "#b58cff";
	ctx.lineWidth = 3;
	ctx.shadowColor = "#9d6cff";
	ctx.shadowBlur = 10;
	ctx.setLineDash([4, 6]);
	ctx.beginPath();
	ctx.moveTo(active.position.x, active.position.y);
	ctx.lineTo(recommendation.x, active.position.y);
	ctx.lineTo(recommendation.x, recommendation.y);
	ctx.stroke();
	ctx.setLineDash([]);
	for (let i = 0; i < 10; i++) {
		const t = (time * .18 + i / 10) % 1;
		const x = recommendation.x + Math.sin(t * Math.PI * 2) * (i % 2 ? 4 : 1);
		const y = active.position.y + (recommendation.y - active.position.y) * t;
		ctx.globalAlpha = .35 + i % 3 * .15;
		ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#d9b8ff" : "#9d6cff";
		ctx.fillRect(Math.round(x), Math.round(y), i % 2 ? 3 : 2, i % 2 ? 3 : 2);
	}
	ctx.save();
	ctx.translate(recommendation.x, recommendation.y);
	ctx.rotate(active.angle + recommendation.quarterTurns * (Math.PI / 2));
	ctx.globalAlpha = .3 * pulse;
	ctx.fillStyle = "#9d6cff";
	ctx.strokeStyle = "#f4ecff";
	ctx.lineWidth = 2;
	for (const [x, y] of cells) {
		const px = (x - centerX) * TOWER_CONFIG.cell;
		const py = (y - centerY) * TOWER_CONFIG.cell;
		ctx.fillRect(px - TOWER_CONFIG.cell / 2, py - TOWER_CONFIG.cell / 2, TOWER_CONFIG.cell, TOWER_CONFIG.cell);
		ctx.strokeRect(px - TOWER_CONFIG.cell / 2, py - TOWER_CONFIG.cell / 2, TOWER_CONFIG.cell, TOWER_CONFIG.cell);
		ctx.globalAlpha = .85 * pulse;
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(px - TOWER_CONFIG.cell / 2 + 4, py - TOWER_CONFIG.cell / 2 + 4, 4, 3);
		ctx.globalAlpha = .3 * pulse;
		ctx.fillStyle = "#9d6cff";
	}
	ctx.restore();
	const radius = 28 + Math.sin(time * 4) * 2;
	ctx.globalAlpha = .66;
	ctx.strokeStyle = "#d9b8ff";
	ctx.lineWidth = 2;
	ctx.setLineDash([3, 5]);
	ctx.beginPath();
	ctx.ellipse(recommendation.x, recommendation.y, radius + 8, radius, time * .2, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	for (let i = 0; i < 8; i++) {
		const angle = i / 8 * Math.PI * 2 + time * .5;
		const x = recommendation.x + Math.cos(angle) * (radius + 8);
		const y = recommendation.y + Math.sin(angle) * radius;
		ctx.fillStyle = i % 2 ? "#b58cff" : "#ffffff";
		ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
	}
	ctx.globalAlpha = .9;
	ctx.fillStyle = "#f4ecff";
	ctx.font = "7px 'Press Start 2P', monospace";
	ctx.fillText(recommendation.quarterTurns ? `GIRO ${recommendation.quarterTurns}x` : "SEM GIRO", Math.max(4, recommendation.x - 34), Math.max(15, recommendation.y - radius - 8));
	ctx.restore();
}
function drawTimeFreeze(ctx, time, opacity) {
	ctx.save();
	ctx.globalAlpha = .45 * opacity;
	ctx.strokeStyle = "#b58cff";
	ctx.lineWidth = 3;
	ctx.strokeRect(2, 2, TOWER_CONFIG.width - 4, TOWER_CONFIG.height - 4);
	ctx.fillStyle = "#f4ecff";
	ctx.font = "8px 'Press Start 2P', monospace";
	ctx.fillText("⧗", TOWER_CONFIG.width - 22, 19);
	for (let i = 0; i < 12; i++) {
		const phase = (time * .12 + i / 12) % 1;
		const x = (i * 67 + 21) % TOWER_CONFIG.width;
		const y = TOWER_CONFIG.height - phase * (TOWER_CONFIG.height - 28) - 14;
		ctx.globalAlpha = (.18 + i % 3 * .1) * (.65 + Math.sin(time * 2 + i) * .2) * opacity;
		ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#d9b8ff" : "#9d6cff";
		ctx.fillRect(Math.round(x), Math.round(y), i % 2 ? 3 : 2, i % 2 ? 3 : 2);
	}
	ctx.restore();
}
function renderTower(ctx, engine, time, options = {}) {
	ctx.clearRect(0, 0, TOWER_CONFIG.width, TOWER_CONFIG.height);
	ctx.imageSmoothingEnabled = false;
	if (engine.active) {
		const b = engine.active.bounds;
		ctx.fillStyle = "rgba(255,255,255,0.12)";
		ctx.fillRect(b.min.x, b.max.y, b.max.x - b.min.x, TOWER_CONFIG.height);
	}
	drawIsland$1(ctx);
	const closeness = (TOWER_CONFIG.platformTop - engine.topY) / (TOWER_CONFIG.platformTop - FINISH_Y);
	drawFinishLine(ctx, time, engine.winProgress, closeness, engine.status === "won");
	if (engine.topY < TOWER_CONFIG.platformTop - 2) {
		ctx.fillStyle = "rgba(94,230,255,0.55)";
		for (let x = 0; x < TOWER_CONFIG.width; x += 10) ctx.fillRect(x, Math.floor(engine.topY), 5, 2);
	}
	for (const p of engine.pieces) drawPiece(ctx, p);
	for (const [p, left] of engine.forged) if (engine.pieces.includes(p)) drawForgedHeat(ctx, p, left, time);
	for (const [p, left] of engine.frozen) drawFrost(ctx, p, left, time);
	for (const f of engine.freezeFx) {
		const k = f.t / .6;
		ctx.globalAlpha = 1 - k;
		ctx.fillStyle = "rgba(158,232,255,0.5)";
		ctx.beginPath();
		ctx.arc(f.x, f.y, 10 + k * 26, 0, Math.PI * 2);
		ctx.fill();
		for (let i = 0; i < 12; i++) {
			const a = i / 12 * Math.PI * 2;
			const r = 6 + k * 34;
			ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#9ee8ff" : "#c8b8ff";
			ctx.fillRect(Math.floor(f.x + Math.cos(a) * r), Math.floor(f.y + Math.sin(a) * r), 3, 3);
		}
		ctx.globalAlpha = 1;
	}
	if (options.showLandingGuide) drawLandingGuide(ctx, engine);
	if (options.highlightedPiece && engine.pieces.includes(options.highlightedPiece)) drawPieceOutline(ctx, options.highlightedPiece, options.highlightIce, options.highlightColor);
	if (options.tongue && engine.pieces.includes(options.tongue.body)) {
		drawPieceOutline(ctx, options.tongue.body, false, "#8ef0a2");
		drawTongue(ctx, options.tongue, time);
	}
	for (const f of engine.lostFx) {
		const k = f.t / .8;
		ctx.globalAlpha = 1 - k;
		for (let i = 0; i < 10; i++) {
			const a = i / 10 * Math.PI - Math.PI;
			const r = 8 + k * 60;
			ctx.fillStyle = i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#9ee8ff" : "#c8b8ff";
			ctx.fillRect(Math.floor(f.x + Math.cos(a) * r), Math.floor(TOWER_CONFIG.height - 6 + Math.sin(a) * r), 4, 4);
		}
		ctx.globalAlpha = 1;
	}
	if (engine.active) {
		drawPiece(ctx, engine.active);
		const heat = engine.forged.get(engine.active);
		if (heat !== void 0) drawForgedHeat(ctx, engine.active, heat, time);
	}
	if (options.timeVision) drawTimeVision(ctx, engine, options.timeVision, options.effectTime ?? time);
	if (options.timeFrozen) drawTimeFreeze(ctx, options.effectTime ?? time, 1);
	else if (options.timeFreezeFade && options.timeFreezeFade > 0) drawTimeFreeze(ctx, options.effectTime ?? time, options.timeFreezeFade);
}
function renderPiecePreview(ctx, type, cells) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
	const minX = Math.min(...cells.map((c) => c[0]));
	const maxX = Math.max(...cells.map((c) => c[0]));
	const minY = Math.min(...cells.map((c) => c[1]));
	const maxY = Math.max(...cells.map((c) => c[1]));
	const ox = (ctx.canvas.width - (maxX - minX + 1) * TOWER_CONFIG.cell) / 2;
	const oy = (ctx.canvas.height - (maxY - minY + 1) * TOWER_CONFIG.cell) / 2;
	for (const [x, y] of cells) {
		ctx.save();
		ctx.translate(ox + (x - minX + .5) * TOWER_CONFIG.cell, oy + (y - minY + .5) * TOWER_CONFIG.cell);
		drawBlock(ctx, type);
		ctx.restore();
	}
}
//#endregion
//#region src/features/spellbound/tower/useTowerControls.ts
/** Keyboard controls: A/D ←/→ move, W/↑ rotate, S/↓ soft drop, Space hard drop. */
function useTowerControls(getEngine) {
	useEffect(() => {
		const onDown = (e) => {
			const engine = getEngine();
			if (!engine) return;
			const k = e.key.toLowerCase();
			if ([
				"arrowleft",
				"arrowright",
				"arrowup",
				"arrowdown",
				" "
			].includes(k)) e.preventDefault();
			if (k === "a" || k === "arrowleft") engine.move(-1);
			else if (k === "d" || k === "arrowright") engine.move(1);
			else if ((k === "w" || k === "arrowup") && !e.repeat) engine.rotate();
			else if (k === "s" || k === "arrowdown") engine.softDrop = true;
			else if (k === " " && !e.repeat) engine.hardDrop();
		};
		const onUp = (e) => {
			const k = e.key.toLowerCase();
			const engine = getEngine();
			if (engine && (k === "s" || k === "arrowdown")) engine.softDrop = false;
		};
		window.addEventListener("keydown", onDown);
		window.addEventListener("keyup", onUp);
		return () => {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
		};
	}, [getEngine]);
}
//#endregion
//#region src/features/spellbound/tower/CharacterSwap.tsx
/** Visual-only swap flavour per character (no gameplay effect). */
var SWAP_FX = {
	"white-fox-ice-mage": {
		colors: [
			"#ffffff",
			"#bdf3ff",
			"#7fd8ff"
		],
		glyphs: [
			"❄",
			"✦",
			"·"
		]
	},
	"purple-rabbit-ninja": {
		colors: [
			"#e3cbff",
			"#b58cff",
			"#ffffff"
		],
		glyphs: [
			"✦",
			"»",
			"·"
		]
	},
	"swamp-frog-mage": {
		colors: [
			"#9fe8b0",
			"#5fcf8a",
			"#d8ffe0"
		],
		glyphs: [
			"✿",
			"•",
			"·"
		]
	},
	"forge-raccoon-mage": {
		colors: [
			"#ffc4b8",
			"#ff9e9e",
			"#ffffff"
		],
		glyphs: [
			"✧",
			"•",
			"·"
		]
	},
	"time-owl-mage": {
		colors: [
			"#9fb8ff",
			"#b58cff",
			"#ffffff"
		],
		glyphs: [
			"⧗",
			"◷",
			"✦"
		]
	},
	"calm-capybara-mage": {
		colors: [
			"#9de8cf",
			"#72d9e8",
			"#ffffff"
		],
		glyphs: [
			"≈",
			"✦",
			"·"
		]
	},
	"axolotl-mage": {
		colors: [
			"#ff9edb",
			"#82e9ff",
			"#ffffff"
		],
		glyphs: [
			"♥",
			"✦",
			"·"
		]
	}
};
function CharacterSwapModal({ current, unlockedCharacterIds, onPick, onClose }) {
	return /* @__PURE__ */ jsx("div", {
		className: "absolute inset-0 z-30 flex items-center justify-center bg-arcade-ink/45 p-3",
		onClick: onClose,
		children: /* @__PURE__ */ jsxs("div", {
			role: "dialog",
			"aria-label": "Trocar personagem",
			className: "swap-pop w-full max-w-[360px] border-4 border-arcade-panel-border bg-arcade-panel p-3 shadow-lg",
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-2 flex items-center justify-between",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "pixel-title text-sm text-arcade-ink",
						children: "TROCAR PERSONAGEM"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						className: "font-arcade text-[0.5rem] text-arcade-violet hover:text-arcade-ink",
						"aria-label": "Fechar",
						children: "ESC ✕"
					})]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "grid grid-cols-3 gap-1.5 sm:grid-cols-6",
					children: playableCharacterSeeds.filter((c) => unlockedCharacterIds.includes(c.id)).map((c) => {
						const active = c.id === current;
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => onPick(c.id),
							"aria-pressed": active,
							className: `flex flex-col items-center gap-1 border-2 px-1 py-1.5 transition-transform hover:-translate-y-0.5 ${active ? "border-arcade-cyan bg-arcade-cyan/25 ring-2 ring-arcade-violet" : "border-arcade-panel-border bg-background/40"}`,
							children: [
								/* @__PURE__ */ jsx(GameplaySprite, {
									characterId: c.id,
									animation: active ? "victory" : "idle",
									size: 40
								}),
								/* @__PURE__ */ jsx("span", {
									className: "font-arcade text-[0.4rem] leading-tight text-arcade-ink",
									children: c.shortName
								}),
								active && /* @__PURE__ */ jsx("span", {
									className: "font-arcade text-[0.35rem] text-arcade-violet",
									children: "ATUAL"
								})
							]
						}, c.id);
					})
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 text-center font-arcade text-[0.4rem] text-arcade-violet",
					children: "PARTIDA PAUSADA"
				})
			]
		})
	});
}
/** Renders the player's hero; animates old → particles → new whenever characterId changes. */
function SwapHero({ characterId, animation, size }) {
	const [shown, setShown] = useState(characterId);
	const [fx, setFx] = useState(null);
	useEffect(() => {
		if (characterId === shown || !characterId) return;
		const key = Date.now();
		setFx({
			from: shown,
			to: characterId,
			key
		});
		const t1 = window.setTimeout(() => setShown(characterId), 250);
		const t2 = window.setTimeout(() => setFx((f) => f?.key === key ? null : f), 650);
		return () => {
			window.clearTimeout(t1);
			window.clearTimeout(t2);
			setShown(characterId);
		};
	}, [characterId]);
	if (!shown) return null;
	const leaving = fx && shown === fx.from;
	const style = fx ? SWAP_FX[fx.to] : null;
	return /* @__PURE__ */ jsxs("div", {
		className: "relative",
		style: {
			width: size,
			height: size
		},
		children: [/* @__PURE__ */ jsx("div", {
			className: fx ? leaving ? "swap-out" : "swap-in" : "",
			children: /* @__PURE__ */ jsx(GameplaySprite, {
				characterId: shown,
				animation: fx && !leaving ? "victory" : animation,
				size
			})
		}, `${shown}-${fx?.key ?? 0}`), fx && style && /* @__PURE__ */ jsxs("div", {
			className: "pointer-events-none absolute inset-0",
			"aria-hidden": "true",
			children: [/* @__PURE__ */ jsx("span", {
				className: "swap-flash absolute inset-[-30%]",
				style: { background: `radial-gradient(circle, ${style.colors[0]}, ${style.colors[1]}88 45%, transparent 70%)` }
			}), Array.from({ length: 12 }).map((_, i) => {
				const ang = i / 12 * Math.PI * 2;
				const r = size * (.55 + i % 3 * .15);
				return /* @__PURE__ */ jsx("span", {
					className: "swap-particle absolute left-1/2 top-1/2 font-arcade text-[0.6rem] leading-none",
					style: {
						color: style.colors[i % style.colors.length],
						textShadow: `0 0 4px ${style.colors[1]}`,
						"--dx": `${Math.cos(ang) * r}px`,
						"--dy": `${Math.sin(ang) * r}px`,
						animationDelay: `${i % 4 * 30}ms`
					},
					children: style.glyphs[i % style.glyphs.length]
				}, i);
			})]
		}, fx.key)]
	});
}
//#endregion
//#region src/features/spellbound/tower/ShurikenFx.tsx
/** Short player-arena-only projectile and impact effect. */
function ShurikenFx({ shotKey, target, phase }) {
	const vars = {
		"--shuriken-x": `${target.x}%`,
		"--shuriken-y": `${target.y}%`
	};
	return /* @__PURE__ */ jsx("div", {
		className: "pointer-events-none absolute inset-0 z-20 overflow-hidden",
		style: vars,
		"aria-hidden": "true",
		children: phase === "flight" ? /* @__PURE__ */ jsxs(Fragment$1, { children: [Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ jsx("span", {
			className: `shuriken-trail absolute ${i % 3 === 0 ? "shuriken-trail-spark" : ""}`,
			style: {
				"--trail-delay": `${(i + 1) * .025}s`,
				"--trail-offset": `${(i % 3 - 1) * 7}px`
			}
		}, i)), /* @__PURE__ */ jsxs("svg", {
			className: "shuriken-projectile absolute",
			viewBox: "0 0 24 24",
			shapeRendering: "crispEdges",
			children: [/* @__PURE__ */ jsx("path", {
				d: "M10 1h4v7l6-4 2 4-6 4 6 4-2 4-6-4v7h-4v-7l-6 4-2-4-6-4-6-4 2-4 6 4V1Z",
				fill: "currentColor"
			}), /* @__PURE__ */ jsx("rect", {
				x: "10",
				y: "10",
				width: "4",
				height: "4",
				fill: "var(--arcade-cloud)"
			})]
		})] }) : /* @__PURE__ */ jsxs("div", {
			className: "shuriken-impact absolute",
			style: {
				left: `${target.x}%`,
				top: `${target.y}%`
			},
			children: [/* @__PURE__ */ jsx("span", { className: "shuriken-impact-flash" }), Array.from({ length: 16 }).map((_, i) => /* @__PURE__ */ jsx("span", {
				className: "shuriken-fragment",
				style: {
					"--burst-angle": `${i * 22.5}deg`,
					"--burst-distance": `${14 + i % 4 * 7}px`
				}
			}, i))]
		})
	}, `${shotKey}-${phase}`);
}
//#endregion
//#region src/features/spellbound/tower/ForgeAbility.tsx
function ForgePicker({ onPick, onCancel }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "forge-picker absolute right-2 top-20 z-30 w-[210px] border-2 border-arcade-violet bg-arcade-panel/95 p-2 shadow-lg",
		role: "dialog",
		"aria-label": "Escolher peça para forjar",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mb-2 flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ jsx("p", {
					className: "font-arcade text-[0.43rem] text-arcade-ink",
					children: "ESCOLHA UMA PEÇA"
				}), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcadePanel",
					onClick: onCancel,
					className: "h-6 rounded-sm px-1 text-[0.35rem]",
					"aria-label": "Cancelar forja",
					children: "ESC ✕"
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-4 gap-1",
				children: TETROMINO_TYPES.map((type) => /* @__PURE__ */ jsxs(Button, {
					type: "button",
					variant: "arcadePanel",
					onClick: () => onPick(type),
					className: "forge-piece-option h-12 rounded-sm p-1",
					"aria-label": `Forjar peça ${type}`,
					children: [/* @__PURE__ */ jsx("span", {
						className: "relative block h-8 w-10",
						"aria-hidden": "true",
						children: TETROMINO_SHAPES[type].map(([x, y], index) => /* @__PURE__ */ jsx("span", {
							className: "absolute h-2.5 w-2.5 border border-arcade-panel-border bg-arcade-lilac shadow-[inset_2px_2px_0_var(--arcade-cloud)]",
							style: {
								left: `${x * 9 + 2}px`,
								top: `${y * 9 + 3}px`
							}
						}, `${x}-${y}-${index}`))
					}), /* @__PURE__ */ jsx("span", {
						className: "font-arcade text-[0.38rem] text-arcade-ink",
						children: type
					})]
				}, type))
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-1.5 text-center font-arcade text-[0.32rem] text-arcade-violet",
				children: "Z PARA CANCELAR"
			})
		]
	});
}
function ForgeSequence({ type }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "forge-sequence pointer-events-none absolute bottom-[7%] left-[8%] z-20 h-24 w-28",
		"aria-live": "polite",
		children: [
			/* @__PURE__ */ jsx("div", { className: "forge-smoke absolute left-10 top-0 h-3 w-3 bg-arcade-cloud/60" }),
			/* @__PURE__ */ jsxs("div", {
				className: "forge-hammer absolute left-1 top-1 h-14 w-5 origin-bottom-right",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ jsx("span", { className: "absolute left-2 top-4 h-10 w-2 bg-arcade-violet" }), /* @__PURE__ */ jsx("span", { className: "absolute left-0 top-1 h-5 w-5 border-2 border-arcade-panel-border bg-arcade-cloud" })]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "forge-anvil absolute bottom-1 left-8 h-11 w-16 border-2 border-arcade-panel-border bg-arcade-violet",
				children: [
					/* @__PURE__ */ jsx("span", { className: "absolute -left-2 -right-2 -top-2 h-3 border-2 border-arcade-panel-border bg-arcade-cloud" }),
					/* @__PURE__ */ jsx("span", { className: "forge-fire absolute -top-7 left-2 h-7 w-10" }),
					/* @__PURE__ */ jsx("span", {
						className: "forge-piece-silhouette absolute left-1/2 top-0 h-8 w-10 -translate-x-1/2",
						children: TETROMINO_SHAPES[type].map(([x, y], index) => /* @__PURE__ */ jsx("span", {
							className: "absolute h-2.5 w-2.5 border border-forge-shadow bg-forge-hot shadow-[inset_2px_2px_0_var(--forge-white)]",
							style: {
								left: `${x * 8 + 2}px`,
								top: `${y * 8 + 2}px`
							}
						}, `${x}-${y}-${index}`))
					})
				]
			}),
			Array.from({ length: 10 }).map((_, index) => /* @__PURE__ */ jsx("span", {
				className: "forge-spark absolute bottom-10 left-14 h-1.5 w-1.5 bg-forge-hot",
				style: {
					"--spark-x": `${(index % 5 - 2) * 11}px`,
					"--spark-y": `${-18 - index % 3 * 9}px`,
					animationDelay: `${index * 25}ms`
				}
			}, index)),
			/* @__PURE__ */ jsxs("p", {
				className: "absolute -bottom-4 left-0 w-full text-center font-arcade text-[0.38rem] text-forge-hot",
				children: [
					"FORJANDO ",
					type,
					"!"
				]
			})
		]
	});
}
//#endregion
//#region src/features/spellbound/tower/WinCountdown.tsx
function WinCountdown({ snapshot }) {
	if (!snapshot?.winConfirming) return null;
	return /* @__PURE__ */ jsxs("div", {
		className: "pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center",
		role: "status",
		"aria-live": "polite",
		"aria-atomic": "true",
		children: [/* @__PURE__ */ jsx("span", {
			className: "pixel-panel border-2 border-arcade-cyan bg-arcade-panel px-4 py-2 font-arcade text-2xl leading-none text-arcade-violet shadow-[0_0_12px_#b58cff]",
			children: Math.max(1, Math.ceil(snapshot.winSecondsRemaining))
		}), /* @__PURE__ */ jsx("span", {
			className: "mt-2 border border-arcade-panel-border bg-arcade-panel px-2 py-1 font-arcade text-[0.48rem] text-arcade-violet",
			children: "CONFIRMANDO..."
		})]
	});
}
//#endregion
//#region src/features/spellbound/tower/TowerScreen.tsx
var TOWER_BEST_HEIGHT_KEY = "spellbound-tower-best-height-tenths-v1";
function readBestTowerHeightTenths() {
	try {
		const value = Number(window.localStorage.getItem(TOWER_BEST_HEIGHT_KEY));
		return Number.isSafeInteger(value) ? Math.max(0, value) : 0;
	} catch {
		return 0;
	}
}
function TowerScreen({ characterId: initialCharacterId, unlockedCharacterIds, playerName, primaryWalletId, onBack, onChangeGame }) {
	const canvasRef = useRef(null);
	const nextRef = useRef(null);
	const engineRef = useRef(null);
	const { playSfx, setMusicIntensity } = useArcadeAudio();
	const [round, setRound] = useState(0);
	const matchSessionId = useRef(createMatchId("tower"));
	const tallestHeightTenthsRef = useRef(0);
	const [snap, setSnap] = useState(null);
	const audioRoundRef = useRef(round);
	const audioBestAtStartRef = useRef(readBestTowerHeightTenths());
	const audioRecordPlayedRef = useRef(false);
	const previousAudioSnapRef = useRef(null);
	const lineup = useMemo(() => pickBotLineup(initialCharacterId), [initialCharacterId]);
	const [characterId, setCharacterId] = useState(initialCharacterId);
	const [swapOpen, setSwapOpen] = useState(false);
	const [aimingShuriken, setAimingShuriken] = useState(false);
	const [cooldown, setCooldown] = useState(0);
	const [aimingFreeze, setAimingFreeze] = useState(false);
	const [freezeCooldown, setFreezeCooldown] = useState(0);
	const freezeUntilRef = useRef(0);
	const [aimingTongue, setAimingTongue] = useState(false);
	const [tongueCooldown, setTongueCooldown] = useState(0);
	const tongueUntilRef = useRef(0);
	const [forgeOpen, setForgeOpen] = useState(false);
	const [forgingType, setForgingType] = useState(null);
	const [forgeCooldown, setForgeCooldown] = useState(0);
	const forgeUntilRef = useRef(0);
	const [timeVisionActive, setTimeVisionActive] = useState(false);
	const [timeVisionFading, setTimeVisionFading] = useState(false);
	const [timeVisionCooldown, setTimeVisionCooldown] = useState(0);
	const [capybaraCooldown, setCapybaraCooldown] = useState(0);
	const [timeVisionRecommendation, setTimeVisionRecommendation] = useState(null);
	const timeVisionActiveRef = useRef(false);
	const timeVisionRecommendationRef = useRef(null);
	const timeVisionUntilRef = useRef(0);
	const timeVisionTimeoutRef = useRef(null);
	const timeVisionFadeUntilRef = useRef(0);
	const timeVisionFadeTimeoutRef = useRef(null);
	const timeVisionCooldownUntilRef = useRef(0);
	const capybaraCooldownUntilRef = useRef(0);
	/** Piece currently held by the frog's tongue + chosen pull direction. */
	const tongueRef = useRef(null);
	const [tongueHeld, setTongueHeld] = useState(false);
	/** True while the engine is still dragging the grabbed piece. */
	const pullingRef = useRef(false);
	const [shurikenShot, setShurikenShot] = useState(null);
	const [shurikenImpact, setShurikenImpact] = useState(null);
	const highlightedPieceRef = useRef(null);
	const cooldownUntilRef = useRef(0);
	const pausedRef = useRef(false);
	pausedRef.current = swapOpen || aimingShuriken || aimingFreeze || aimingTongue || tongueHeld && !pullingRef.current || shurikenShot !== null || forgeOpen || forgingType !== null;
	const aimingFreezeRef = useRef(false);
	aimingFreezeRef.current = aimingFreeze;
	const aimingTongueRef = useRef(false);
	aimingTongueRef.current = aimingTongue;
	const botCanvasRefs = useRef([]);
	const [botSnaps, setBotSnaps] = useState([
		null,
		null,
		null
	]);
	/** Participant indexes (0 = player, 1..3 = bots) in the order they reached the goal. */
	const [finishOrder, setFinishOrder] = useState([]);
	const getEngine = useCallback(() => pausedRef.current ? null : engineRef.current, []);
	useTowerControls(getEngine);
	const cancelShuriken = useCallback(() => {
		highlightedPieceRef.current = null;
		setAimingShuriken(false);
		setAimingFreeze(false);
		setAimingTongue(false);
		setForgeOpen(false);
		const held = tongueRef.current;
		if (held) engineRef.current?.releaseGrab(held.body, null, 0);
		pullingRef.current = false;
		tongueRef.current = null;
		setTongueHeld(false);
	}, []);
	const finishTimeVision = useCallback(() => {
		if (!timeVisionActiveRef.current) return;
		timeVisionActiveRef.current = false;
		if (timeVisionTimeoutRef.current !== null) {
			window.clearTimeout(timeVisionTimeoutRef.current);
			timeVisionTimeoutRef.current = null;
		}
		timeVisionUntilRef.current = 0;
		timeVisionRecommendationRef.current = null;
		setTimeVisionActive(false);
		setTimeVisionRecommendation(null);
		timeVisionFadeUntilRef.current = performance.now() + TOWER_CONFIG.timeVisionFadeSeconds * 1e3;
		setTimeVisionFading(true);
		if (timeVisionFadeTimeoutRef.current !== null) window.clearTimeout(timeVisionFadeTimeoutRef.current);
		timeVisionFadeTimeoutRef.current = window.setTimeout(() => {
			setTimeVisionFading(false);
			timeVisionFadeTimeoutRef.current = null;
		}, TOWER_CONFIG.timeVisionFadeSeconds * 1e3);
		timeVisionCooldownUntilRef.current = performance.now() + TOWER_CONFIG.timeVisionCooldownSeconds * 1e3;
		setTimeVisionCooldown(TOWER_CONFIG.timeVisionCooldownSeconds);
	}, []);
	const toggleTimeVision = useCallback(() => {
		if (characterId !== "time-owl-mage") return;
		if (timeVisionCooldownUntilRef.current > performance.now()) {
			playSfx("blocked");
			return;
		}
		if (timeVisionActiveRef.current) {
			finishTimeVision();
			return;
		}
		const engine = engineRef.current;
		if (pausedRef.current || engine?.status !== "playing" || !engine.active) return;
		engine.softDrop = false;
		cancelShuriken();
		if (timeVisionFadeTimeoutRef.current !== null) {
			window.clearTimeout(timeVisionFadeTimeoutRef.current);
			timeVisionFadeTimeoutRef.current = null;
		}
		timeVisionFadeUntilRef.current = 0;
		setTimeVisionFading(false);
		timeVisionActiveRef.current = true;
		timeVisionUntilRef.current = performance.now() + TOWER_CONFIG.timeVisionSeconds * 1e3;
		const recommendation = engine.recommendActivePlacement();
		if (!recommendation) {
			timeVisionActiveRef.current = false;
			timeVisionUntilRef.current = 0;
			return;
		}
		timeVisionRecommendationRef.current = recommendation;
		setTimeVisionRecommendation(recommendation);
		setTimeVisionActive(true);
		playSfx("power-time");
		setTimeVisionCooldown(0);
		timeVisionTimeoutRef.current = window.setTimeout(finishTimeVision, Math.max(0, timeVisionUntilRef.current - performance.now()));
	}, [
		cancelShuriken,
		characterId,
		finishTimeVision,
		playSfx
	]);
	const activateCapybaraMargin = useCallback(() => {
		if (characterId !== "calm-capybara-mage") return;
		if (capybaraCooldownUntilRef.current > performance.now()) {
			playSfx("blocked");
			return;
		}
		const engine = engineRef.current;
		if (pausedRef.current || engine?.status !== "playing" || !engine.active) return;
		if (!engine.activatePositioningMargin()) {
			playSfx("blocked");
			return;
		}
		engine.softDrop = false;
		capybaraCooldownUntilRef.current = performance.now() + TOWER_CONFIG.capybaraMarginCooldownSeconds * 1e3;
		setCapybaraCooldown(TOWER_CONFIG.capybaraMarginCooldownSeconds);
		setSnap(engine.snapshot());
		playSfx("power-time");
	}, [characterId, playSfx]);
	const toggleForge = useCallback(() => {
		if (characterId !== "forge-raccoon-mage" || forgingType) return;
		if (forgeUntilRef.current > performance.now()) {
			playSfx("blocked");
			return;
		}
		if (forgeOpen) {
			setForgeOpen(false);
			return;
		}
		if (engineRef.current?.status !== "playing" || !engineRef.current.active) return;
		engineRef.current.softDrop = false;
		cancelShuriken();
		setForgeOpen(true);
	}, [
		cancelShuriken,
		characterId,
		forgeOpen,
		forgingType,
		playSfx
	]);
	const chooseForgePiece = useCallback((type) => {
		if (characterId !== "forge-raccoon-mage" || !forgeOpen || !engineRef.current?.active) return;
		setForgeOpen(false);
		setForgingType(type);
	}, [characterId, forgeOpen]);
	const toggleTongue = useCallback(() => {
		if (characterId !== "swamp-frog-mage") return;
		if (tongueUntilRef.current > performance.now()) {
			playSfx("blocked");
			return;
		}
		if (aimingTongue || tongueRef.current) {
			cancelShuriken();
			return;
		}
		if (engineRef.current?.status !== "playing") return;
		engineRef.current.softDrop = false;
		setAimingTongue(true);
	}, [
		aimingTongue,
		cancelShuriken,
		characterId,
		playSfx
	]);
	const toggleFreeze = useCallback(() => {
		if (characterId !== "white-fox-ice-mage") return;
		if (freezeUntilRef.current > performance.now()) {
			playSfx("blocked");
			return;
		}
		if (aimingFreeze) {
			cancelShuriken();
			return;
		}
		if (engineRef.current?.status !== "playing") return;
		engineRef.current.softDrop = false;
		setAimingFreeze(true);
	}, [
		aimingFreeze,
		cancelShuriken,
		characterId,
		playSfx
	]);
	const toggleShuriken = useCallback(() => {
		if (characterId !== "purple-rabbit-ninja" || shurikenShot) return;
		if (cooldownUntilRef.current > performance.now()) {
			playSfx("blocked");
			return;
		}
		if (aimingShuriken) {
			cancelShuriken();
			return;
		}
		if (engineRef.current?.status !== "playing") return;
		if (engineRef.current) engineRef.current.softDrop = false;
		setAimingShuriken(true);
	}, [
		aimingShuriken,
		cancelShuriken,
		characterId,
		playSfx,
		shurikenShot
	]);
	const openSwap = useCallback(() => {
		if (engineRef.current) engineRef.current.softDrop = false;
		finishTimeVision();
		cancelShuriken();
		setSwapOpen(true);
	}, [cancelShuriken, finishTimeVision]);
	const pickCharacter = useCallback((id) => {
		if (!unlockedCharacterIds.includes(id)) return;
		finishTimeVision();
		cancelShuriken();
		const engine = engineRef.current;
		if (id !== "calm-capybara-mage") engine?.cancelPositioningMargin();
		engine?.setMaxLostPieces(id === "axolotl-mage" ? TOWER_CONFIG.axolotlMaxLostPieces : TOWER_CONFIG.maxLostPieces);
		if (engine) setSnap(engine.snapshot());
		setSwapOpen(false);
		setCharacterId(id);
	}, [
		cancelShuriken,
		finishTimeVision,
		unlockedCharacterIds
	]);
	useEffect(() => {
		const onKey = (e) => {
			if (e.key === "Tab") {
				e.preventDefault();
				if (e.repeat) return;
				if (swapOpen) setSwapOpen(false);
				else openSwap();
			} else if (e.key.toLowerCase() === "z") {
				if (e.repeat || swapOpen) return;
				e.preventDefault();
				if (characterId === "time-owl-mage") toggleTimeVision();
				else if (characterId === "calm-capybara-mage") activateCapybaraMargin();
				else if (characterId === "white-fox-ice-mage") toggleFreeze();
				else if (characterId === "swamp-frog-mage") toggleTongue();
				else if (characterId === "forge-raccoon-mage") toggleForge();
				else toggleShuriken();
			} else if (e.key === "Escape" && (swapOpen || aimingShuriken || aimingFreeze || aimingTongue || tongueHeld || forgeOpen || timeVisionActive)) {
				e.preventDefault();
				setSwapOpen(false);
				finishTimeVision();
				cancelShuriken();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		aimingFreeze,
		aimingShuriken,
		aimingTongue,
		activateCapybaraMargin,
		cancelShuriken,
		characterId,
		forgeOpen,
		finishTimeVision,
		openSwap,
		swapOpen,
		timeVisionActive,
		tongueHeld,
		toggleForge,
		toggleFreeze,
		toggleShuriken,
		toggleTimeVision,
		toggleTongue
	]);
	useEffect(() => {
		finishTimeVision();
		cancelShuriken();
	}, [
		cancelShuriken,
		characterId,
		finishTimeVision
	]);
	const isShurikenCooldownActive = cooldown > 0;
	const isTongueCooldownActive = tongueCooldown > 0;
	const isFreezeCooldownActive = freezeCooldown > 0;
	const isForgeCooldownActive = forgeCooldown > 0;
	const isTimeVisionCooldownActive = timeVisionCooldown > 0;
	const isCapybaraCooldownActive = capybaraCooldown > 0;
	const previousCooldownStateRef = useRef([
		false,
		false,
		false,
		false,
		false,
		false
	]);
	useEffect(() => {
		const current = [
			isShurikenCooldownActive,
			isTongueCooldownActive,
			isFreezeCooldownActive,
			isForgeCooldownActive,
			isTimeVisionCooldownActive,
			isCapybaraCooldownActive
		];
		if (current.some((active, index) => previousCooldownStateRef.current[index] && !active)) playSfx("cooldown-ready");
		previousCooldownStateRef.current = current;
	}, [
		isForgeCooldownActive,
		isFreezeCooldownActive,
		isShurikenCooldownActive,
		isTimeVisionCooldownActive,
		isCapybaraCooldownActive,
		isTongueCooldownActive,
		playSfx
	]);
	useEffect(() => {
		if (!isShurikenCooldownActive) return;
		const timer = window.setInterval(() => {
			const remaining = Math.max(0, (cooldownUntilRef.current - performance.now()) / 1e3);
			setCooldown(remaining);
			if (remaining <= 0) window.clearInterval(timer);
		}, 100);
		return () => window.clearInterval(timer);
	}, [isShurikenCooldownActive]);
	useEffect(() => {
		if (!isTongueCooldownActive) return;
		const timer = window.setInterval(() => {
			const remaining = Math.max(0, (tongueUntilRef.current - performance.now()) / 1e3);
			setTongueCooldown(remaining);
			if (remaining <= 0) window.clearInterval(timer);
		}, 100);
		return () => window.clearInterval(timer);
	}, [isTongueCooldownActive]);
	useEffect(() => {
		if (!isFreezeCooldownActive) return;
		const timer = window.setInterval(() => {
			const remaining = Math.max(0, (freezeUntilRef.current - performance.now()) / 1e3);
			setFreezeCooldown(remaining);
			if (remaining <= 0) window.clearInterval(timer);
		}, 100);
		return () => window.clearInterval(timer);
	}, [isFreezeCooldownActive]);
	useEffect(() => {
		if (!isForgeCooldownActive) return;
		const timer = window.setInterval(() => {
			const remaining = Math.max(0, (forgeUntilRef.current - performance.now()) / 1e3);
			setForgeCooldown(remaining);
			if (remaining <= 0) window.clearInterval(timer);
		}, 100);
		return () => window.clearInterval(timer);
	}, [isForgeCooldownActive]);
	useEffect(() => {
		if (!isTimeVisionCooldownActive) return;
		const timer = window.setInterval(() => {
			const remaining = Math.max(0, (timeVisionCooldownUntilRef.current - performance.now()) / 1e3);
			setTimeVisionCooldown(remaining);
			if (remaining <= 0) window.clearInterval(timer);
		}, 100);
		return () => window.clearInterval(timer);
	}, [isTimeVisionCooldownActive]);
	useEffect(() => {
		if (!isCapybaraCooldownActive) return;
		const timer = window.setInterval(() => {
			const remaining = Math.max(0, (capybaraCooldownUntilRef.current - performance.now()) / 1e3);
			setCapybaraCooldown(remaining);
			if (remaining <= 0) window.clearInterval(timer);
		}, 100);
		return () => window.clearInterval(timer);
	}, [isCapybaraCooldownActive]);
	useEffect(() => () => {
		if (timeVisionTimeoutRef.current !== null) window.clearTimeout(timeVisionTimeoutRef.current);
		if (timeVisionFadeTimeoutRef.current !== null) window.clearTimeout(timeVisionFadeTimeoutRef.current);
	}, []);
	useEffect(() => {
		if (!forgingType) return;
		const type = forgingType;
		const timer = window.setTimeout(() => {
			const forged = engineRef.current?.forgeActivePiece(type, TOWER_CONFIG.forgedHeatSeconds);
			setForgingType(null);
			if (!forged) return;
			playSfx("power-forge");
			forgeUntilRef.current = performance.now() + TOWER_CONFIG.forgeCooldownSeconds * 1e3;
			setForgeCooldown(TOWER_CONFIG.forgeCooldownSeconds);
		}, TOWER_CONFIG.forgeAnimationSeconds * 1e3);
		return () => window.clearTimeout(timer);
	}, [forgingType, playSfx]);
	useEffect(() => {
		if (!shurikenShot) return;
		const timer = window.setTimeout(() => {
			engineRef.current?.removePlacedPiece(shurikenShot.body);
			setShurikenImpact({
				key: shurikenShot.key,
				x: shurikenShot.x,
				y: shurikenShot.y
			});
			highlightedPieceRef.current = null;
			setShurikenShot(null);
		}, TOWER_CONFIG.shurikenFlightSeconds * 1e3);
		return () => window.clearTimeout(timer);
	}, [shurikenShot]);
	useEffect(() => {
		if (!shurikenImpact) return;
		const timer = window.setTimeout(() => setShurikenImpact(null), 480);
		return () => window.clearTimeout(timer);
	}, [shurikenImpact]);
	useEffect(() => {
		const engine = new TowerEngine(initialCharacterId === "axolotl-mage" ? TOWER_CONFIG.axolotlMaxLostPieces : TOWER_CONFIG.maxLostPieces);
		engineRef.current = engine;
		const bots = lineup.map((b) => new TowerBot(new TowerEngine(), b.difficulty));
		const botCtxs = bots.map((_, i) => botCanvasRefs.current[i]?.getContext("2d") ?? null);
		const botEngines = bots.map((bot) => bot.engine);
		const all = [engine, ...botEngines];
		const done = /* @__PURE__ */ new Set();
		setFinishOrder([]);
		setBotSnaps([
			null,
			null,
			null
		]);
		const ctx = canvasRef.current?.getContext("2d");
		let raf = 0;
		let last = performance.now();
		let sceneTime = 0;
		let lastKey = "";
		const botKeys = [
			"",
			"",
			""
		];
		const loop = (now) => {
			const dt = Math.min(.033, (now - last) / 1e3);
			last = now;
			const timeFrozen = timeVisionActiveRef.current;
			const timeFreezeFade = timeFrozen ? 0 : Math.max(0, (timeVisionFadeUntilRef.current - now) / (TOWER_CONFIG.timeVisionFadeSeconds * 1e3));
			if (!timeFrozen) sceneTime += dt;
			if (timeFrozen) {
				engine.stepControlledPiece(dt);
				if (!engine.active || now >= timeVisionUntilRef.current) finishTimeVision();
			} else if (!pausedRef.current || pullingRef.current) engine.step(dt);
			if (pullingRef.current && tongueRef.current && !engine.isPulling(tongueRef.current.body)) {
				pullingRef.current = false;
				tongueRef.current = null;
				setTongueHeld(false);
			}
			if (ctx) renderTower(ctx, engine, sceneTime, {
				highlightedPiece: highlightedPieceRef.current,
				highlightIce: aimingFreezeRef.current,
				highlightColor: aimingTongueRef.current ? "#8ef0a2" : void 0,
				tongue: tongueRef.current ? {
					...tongueRef.current,
					reach: TOWER_CONFIG.tonguePull
				} : null,
				showLandingGuide: true,
				timeFrozen,
				timeVision: timeFrozen ? timeVisionRecommendationRef.current : null,
				effectTime: now / 1e3,
				timeFreezeFade
			});
			bots.forEach((bot, i) => {
				if (!timeFrozen) {
					bot.update(dt);
					bot.engine.step(dt);
				}
				engine.awardEliminationVictoryIfAllBotsLost(botEngines);
				const bctx = botCtxs[i];
				if (bctx) renderTower(bctx, bot.engine, sceneTime, {
					timeFrozen,
					effectTime: now / 1e3,
					timeFreezeFade
				});
				const bs = bot.engine.snapshot();
				const bk = `${bs.status}|${bs.heightMeters}|${bs.lostPieces}|${bs.winConfirming}|${Math.ceil(bs.winSecondsRemaining)}`;
				if (bk !== botKeys[i]) {
					botKeys[i] = bk;
					setBotSnaps((prev) => prev.map((p, j) => j === i ? bs : p));
				}
			});
			all.forEach((e, i) => {
				if (e.status === "won" && !done.has(i)) {
					done.add(i);
					setFinishOrder((o) => [...o, i]);
				}
			});
			const s = engine.snapshot();
			tallestHeightTenthsRef.current = Math.max(tallestHeightTenthsRef.current, Math.max(0, Math.round(s.heightMeters * 10)));
			const key = `${s.status}|${s.heightMeters}|${s.lostPieces}|${s.nextType}|${s.placed}|${s.stablePieces}|${s.winConfirming}|${Math.ceil(s.winSecondsRemaining)}`;
			if (key !== lastKey) {
				lastKey = key;
				setSnap(s);
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(raf);
			engine.destroy();
			bots.forEach((b) => b.engine.destroy());
			engineRef.current = null;
		};
	}, [
		finishTimeVision,
		round,
		lineup
	]);
	useEffect(() => {
		const ctx = nextRef.current?.getContext("2d");
		if (ctx && snap) renderPiecePreview(ctx, snap.nextType, TETROMINO_SHAPES[snap.nextType]);
	}, [snap?.nextType, snap]);
	const status = snap?.status ?? "playing";
	const matchOver = status !== "playing" && botSnaps.every((b) => b && b.status !== "playing");
	const matchId = `${matchSessionId.current}:${round}`;
	const currentHeightMeters = snap?.heightMeters;
	const playerHasFinished = snap !== null && snap.status !== "playing";
	const rewardBreakdown = calculateTowerRewardBreakdown({
		status,
		peakHeightTenths: tallestHeightTenthsRef.current,
		stablePieces: snap?.stablePieces ?? 0
	});
	useEffect(() => {
		if (!playerHasFinished) return;
		const bestHeightTenths = tallestHeightTenthsRef.current;
		if (bestHeightTenths <= readBestTowerHeightTenths()) return;
		try {
			window.localStorage.setItem(TOWER_BEST_HEIGHT_KEY, String(bestHeightTenths));
		} catch {}
		submitGlobalRecord("tower", bestHeightTenths);
	}, [currentHeightMeters, playerHasFinished]);
	const rewardReceipts = useMatchCurrencyRewards(matchId, matchOver && snap ? [{
		walletId: primaryWalletId,
		playerId: "player-1",
		playerName,
		amount: rewardBreakdown.total
	}] : [], primaryWalletId);
	const participants = [{
		idx: 0,
		characterId,
		label: playerName.toUpperCase(),
		snap
	}, ...lineup.map((b, i) => ({
		idx: i + 1,
		characterId: b.characterId,
		label: `BOT ${BOT_LABELS[b.difficulty]}`,
		snap: botSnaps[i]
	}))];
	const ranking = [...finishOrder.map((i) => participants[i]), ...participants.filter((p) => !finishOrder.includes(p.idx)).sort((a, b) => (b.snap?.heightMeters ?? 0) - (a.snap?.heightMeters ?? 0))];
	const playerPlace = finishOrder.indexOf(0) + 1;
	const height = snap?.heightMeters ?? 0;
	const lostCount = snap?.lostPieces ?? 0;
	const maxLostPieces = snap?.maxLostPieces ?? (characterId === "axolotl-mage" ? TOWER_CONFIG.axolotlMaxLostPieces : TOWER_CONFIG.maxLostPieces);
	const stablePieceCount = snap?.stablePieces ?? 0;
	useEffect(() => {
		if (audioRoundRef.current !== round) {
			audioRoundRef.current = round;
			audioBestAtStartRef.current = readBestTowerHeightTenths();
			audioRecordPlayedRef.current = false;
			previousAudioSnapRef.current = null;
			return;
		}
		if (!snap) return;
		const previous = previousAudioSnapRef.current;
		if (!previous) {
			previousAudioSnapRef.current = snap;
			if (snap.status === "playing") playSfx("game-start");
			return;
		}
		if (snap.placed > previous.placed) playSfx("piece-drop");
		if (snap.lostPieces > previous.lostPieces) playSfx("hit");
		if (Math.max(0, Math.round(snap.heightMeters * 10)) > audioBestAtStartRef.current && !audioRecordPlayedRef.current) {
			audioRecordPlayedRef.current = true;
			playSfx("record");
		}
		if (previous.status === "playing" && snap.status === "won") playSfx("win");
		if (previous.status === "playing" && snap.status === "lost") playSfx("game-over");
		previousAudioSnapRef.current = snap;
	}, [
		playSfx,
		round,
		snap
	]);
	const arenaRef = useRef(null);
	useEffect(() => {
		if (lostCount > 0) arenaRef.current?.animate([
			{ transform: "translate(0,0)" },
			{ transform: "translate(-4px,2px)" },
			{ transform: "translate(4px,-2px)" },
			{ transform: "translate(-2px,1px)" },
			{ transform: "translate(0,0)" }
		], {
			duration: 300,
			easing: "steps(5)"
		});
	}, [lostCount]);
	const progress = Math.min(1, height / TOWER_CONFIG.goalMeters);
	const heroAnim = status === "won" ? "victory" : status === "lost" ? "defeat" : "idle";
	const heightIntensityBand = Math.floor(progress * 4);
	useEffect(() => {
		const intensity = status === "playing" ? .9 + heightIntensityBand * .045 + Math.min(lostCount * .015, .075) : .92;
		setMusicIntensity(intensity);
	}, [
		heightIntensityBand,
		lostCount,
		setMusicIntensity,
		status
	]);
	useEffect(() => () => setMusicIntensity(1), [setMusicIntensity]);
	const pointerPosition = useCallback((event) => {
		const canvas = canvasRef.current;
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		if (rect.width <= 0 || rect.height <= 0) return null;
		return {
			x: (event.clientX - rect.left) / rect.width * TOWER_CONFIG.width,
			y: (event.clientY - rect.top) / rect.height * TOWER_CONFIG.height
		};
	}, []);
	const aimAtPointer = useCallback((event) => {
		const held = tongueRef.current;
		if (held) {
			const point = pointerPosition(event);
			if (point) {
				const dx = point.x - held.body.position.x;
				const dy = point.y - held.body.position.y;
				held.dir = Math.hypot(dx, dy) > 6 ? {
					x: dx,
					y: dy
				} : null;
			}
			return;
		}
		if (!aimingShuriken && !aimingFreeze && !aimingTongue || shurikenShot) return;
		const point = pointerPosition(event);
		highlightedPieceRef.current = point && engineRef.current ? engineRef.current.getPlacedPieceAt(point) : null;
	}, [
		aimingFreeze,
		aimingShuriken,
		aimingTongue,
		pointerPosition,
		shurikenShot
	]);
	const castFreeze = useCallback((event) => {
		const point = pointerPosition(event);
		const engine = engineRef.current;
		const body = point && engine ? engine.getPlacedPieceAt(point) : null;
		if (!body || !engine?.freezePiece(body, TOWER_CONFIG.freezeSeconds)) return;
		playSfx("power-ice");
		highlightedPieceRef.current = null;
		setAimingFreeze(false);
		freezeUntilRef.current = performance.now() + TOWER_CONFIG.freezeCooldownSeconds * 1e3;
		setFreezeCooldown(TOWER_CONFIG.freezeCooldownSeconds);
	}, [playSfx, pointerPosition]);
	const fireShuriken = useCallback((event) => {
		if (aimingFreeze) return castFreeze(event);
		if (tongueRef.current) {
			const held = tongueRef.current;
			if (!held.dir) return;
			engineRef.current?.releaseGrab(held.body, held.dir, TOWER_CONFIG.tonguePull);
			playSfx("power-swamp");
			pullingRef.current = true;
			tongueUntilRef.current = performance.now() + TOWER_CONFIG.tongueCooldownSeconds * 1e3;
			setTongueCooldown(TOWER_CONFIG.tongueCooldownSeconds);
			return;
		}
		if (aimingTongue) {
			const point = pointerPosition(event);
			const engine = engineRef.current;
			const body = point && engine ? engine.getPlacedPieceAt(point) : null;
			if (!body || !engine?.grabPiece(body)) return;
			highlightedPieceRef.current = null;
			tongueRef.current = {
				body,
				dir: null
			};
			setAimingTongue(false);
			setTongueHeld(true);
			return;
		}
		if (!aimingShuriken || shurikenShot) return;
		const point = pointerPosition(event);
		const body = point && engineRef.current ? engineRef.current.getPlacedPieceAt(point) : null;
		if (!body) return;
		playSfx("power-shuriken");
		const shot = {
			key: Date.now(),
			body,
			x: body.position.x / TOWER_CONFIG.width * 100,
			y: body.position.y / TOWER_CONFIG.height * 100
		};
		highlightedPieceRef.current = null;
		setAimingShuriken(false);
		setShurikenShot(shot);
		cooldownUntilRef.current = performance.now() + TOWER_CONFIG.shurikenCooldownSeconds * 1e3;
		setCooldown(TOWER_CONFIG.shurikenCooldownSeconds);
	}, [
		aimingFreeze,
		aimingShuriken,
		aimingTongue,
		castFreeze,
		playSfx,
		pointerPosition,
		shurikenShot
	]);
	const touch = (fn) => () => {
		const e = getEngine();
		if (e) fn(e);
	};
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, {}), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-3",
			children: [
				/* @__PURE__ */ jsxs("header", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.55rem] text-arcade-violet",
						children: "MAGISTERIUM ARCADE"
					}), /* @__PURE__ */ jsx("h1", {
						className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl",
						children: "TOWER"
					})] }), /* @__PURE__ */ jsx(Button, {
						type: "button",
						variant: "arcade",
						size: "arcade",
						onClick: onBack,
						children: "VOLTAR ÀS OPÇÕES"
					})]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "overflow-x-auto pb-2",
					children: /* @__PURE__ */ jsxs("section", {
						className: "relative grid min-w-[960px] grid-cols-4 items-start gap-2",
						"aria-label": "Torres da partida",
						children: [
							/* @__PURE__ */ jsxs("div", {
								ref: arenaRef,
								className: "pixel-panel relative flex min-w-0 flex-col gap-1 rounded-sm border-arcade-cyan p-1.5 ring-2 ring-arcade-cyan/60",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "flex min-h-8 items-center gap-1",
										children: [characterId && /* @__PURE__ */ jsx(GameplaySprite, {
											characterId,
											animation: shurikenShot || forgingType || timeVisionActive ? "ability" : heroAnim,
											size: 24
										}), /* @__PURE__ */ jsxs("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ jsx("p", {
												className: "font-arcade text-[0.5rem] text-arcade-ink",
												children: "VOCÊ"
											}), /* @__PURE__ */ jsxs("p", {
												className: "font-arcade text-[0.38rem] text-arcade-violet",
												children: [
													height.toFixed(1),
													" / ",
													TOWER_CONFIG.goalMeters,
													" m · ",
													lostCount,
													"/",
													maxLostPieces,
													" ·",
													" ",
													stablePieceCount,
													" estáveis · 🪙 ",
													stablePieceCount * 5
												]
											})]
										})]
									}),
									lostCount > 0 && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
										className: "tower-flash pointer-events-none absolute inset-0 z-10",
										style: { background: "radial-gradient(circle, rgba(255,255,255,0.6), rgba(94,230,255,0.35) 60%, rgba(122,78,200,0.45))" },
										"aria-hidden": "true"
									}), /* @__PURE__ */ jsxs("p", {
										className: "tower-lost-pop pointer-events-none absolute left-1/2 top-[45%] z-10 whitespace-nowrap border-2 border-arcade-panel-border bg-arcade-panel px-3 py-2 font-arcade text-[0.6rem] text-arcade-violet sm:text-xs",
										role: "status",
										children: [
											"✦ PEÇA PERDIDA! ",
											lostCount,
											"/",
											maxLostPieces,
											" ✦"
										]
									})] }, `lost-${lostCount}`),
									/* @__PURE__ */ jsxs("div", {
										className: "relative mx-auto w-full max-w-[calc(64vh*400/720)]",
										style: { aspectRatio: `${TOWER_CONFIG.width} / ${TOWER_CONFIG.height}` },
										children: [
											/* @__PURE__ */ jsx("canvas", {
												ref: canvasRef,
												width: TOWER_CONFIG.width,
												height: TOWER_CONFIG.height,
												className: `block h-full w-full [image-rendering:pixelated] ${aimingShuriken || aimingFreeze || aimingTongue || tongueHeld ? "cursor-crosshair" : ""}`,
												onPointerMove: aimAtPointer,
												onPointerLeave: () => {
													highlightedPieceRef.current = null;
												},
												onPointerDown: fireShuriken
											}),
											/* @__PURE__ */ jsx(WinCountdown, { snapshot: snap }),
											shurikenShot && /* @__PURE__ */ jsx(ShurikenFx, {
												shotKey: shurikenShot.key,
												target: {
													x: shurikenShot.x,
													y: shurikenShot.y
												},
												phase: "flight"
											}),
											shurikenImpact && /* @__PURE__ */ jsx(ShurikenFx, {
												shotKey: shurikenImpact.key,
												target: {
													x: shurikenImpact.x,
													y: shurikenImpact.y
												},
												phase: "impact"
											}),
											forgingType && /* @__PURE__ */ jsx(ForgeSequence, { type: forgingType })
										]
									}),
									characterId && /* @__PURE__ */ jsxs("div", {
										className: `pointer-events-none absolute bottom-[8%] left-[3%] z-20 relative transition-all duration-300 ${timeVisionActive ? "drop-shadow-[0_0_10px_#b58cff]" : ""}`,
										children: [(timeVisionActive || timeVisionFading) && /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("span", {
											className: `absolute -inset-2 rounded-full border-2 border-arcade-lilac/80 shadow-[0_0_14px_#b58cff] animate-pulse transition-opacity duration-300 ${timeVisionActive ? "opacity-100" : "opacity-0"}`,
											"aria-hidden": "true"
										}), /* @__PURE__ */ jsx("span", {
											className: `absolute -right-1 -top-2 font-arcade text-[0.5rem] text-arcade-lilac [text-shadow:0_0_6px_#b58cff] transition-opacity duration-300 ${timeVisionActive ? "opacity-100" : "opacity-0"}`,
											"aria-hidden": "true",
											children: "⧗"
										})] }), /* @__PURE__ */ jsx(SwapHero, {
											characterId,
											animation: shurikenShot ? "idle" : heroAnim,
											size: 46
										})]
									}),
									aimingShuriken && /* @__PURE__ */ jsx("p", {
										className: "pointer-events-none absolute inset-x-2 top-12 z-20 border-2 border-arcade-violet bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.48rem] leading-relaxed text-arcade-ink",
										children: "CLIQUE EM UMA PEÇA PARA DESTRUÍ-LA!"
									}),
									(aimingTongue || tongueHeld) && /* @__PURE__ */ jsx("p", {
										className: "pointer-events-none absolute inset-x-2 top-12 z-20 border-2 border-arcade-cyan bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.48rem] leading-relaxed text-arcade-ink",
										children: tongueHeld ? "MIRE A DIREÇÃO E CLIQUE PARA PUXAR!" : "PUXE UMA PEÇA!"
									}),
									aimingFreeze && /* @__PURE__ */ jsx("p", {
										className: "pointer-events-none absolute inset-x-2 top-12 z-20 border-2 border-arcade-cyan bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.48rem] leading-relaxed text-arcade-ink",
										children: "CONGELE UMA PEÇA!"
									}),
									timeVisionActive && /* @__PURE__ */ jsxs("p", {
										className: "pointer-events-none absolute inset-x-2 top-20 z-20 border-2 border-arcade-lilac bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.42rem] leading-relaxed text-arcade-violet",
										role: "status",
										children: [
											"⧗ TEMPO CONGELADO ·",
											" ",
											timeVisionRecommendation?.quarterTurns ? `GIRE ${timeVisionRecommendation.quarterTurns}×` : "SEM GIRO",
											" ",
											"· MOVER / ESPAÇO SOLTA"
										]
									}),
									!matchOver && /* @__PURE__ */ jsxs(Button, {
										type: "button",
										onClick: openSwap,
										variant: "arcadePanel",
										className: "absolute left-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem]",
										"aria-label": "Trocar personagem (TAB)",
										children: [/* @__PURE__ */ jsx("span", {
											className: "text-arcade-violet",
											children: "TAB"
										}), " | ⇄ TROCAR"]
									}),
									swapOpen && !matchOver && /* @__PURE__ */ jsx(CharacterSwapModal, {
										current: characterId,
										unlockedCharacterIds,
										onPick: (id) => id === characterId ? setSwapOpen(false) : pickCharacter(id),
										onClose: () => setSwapOpen(false)
									}),
									forgeOpen && characterId === "forge-raccoon-mage" && !matchOver && /* @__PURE__ */ jsx(ForgePicker, {
										onPick: chooseForgePiece,
										onCancel: () => setForgeOpen(false)
									}),
									characterId === "time-owl-mage" && !matchOver && /* @__PURE__ */ jsxs(Button, {
										type: "button",
										variant: "arcadePanel",
										className: `absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${timeVisionActive ? "ring-2 ring-arcade-lilac shadow-[0_0_10px_#b58cff]" : ""}`,
										onClick: toggleTimeVision,
										disabled: timeVisionCooldown > 0 && !timeVisionActive,
										"aria-pressed": timeVisionActive,
										"aria-label": "Visão do Tempo: prever posição da peça",
										children: [
											"Z |",
											" ",
											timeVisionCooldown > 0 ? `${timeVisionCooldown.toFixed(1)}s` : timeVisionActive ? "CANCELAR" : "PREVER"
										]
									}),
									characterId === "calm-capybara-mage" && !matchOver && /* @__PURE__ */ jsxs(Button, {
										type: "button",
										variant: "arcadePanel",
										className: `absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${snap?.positioningMarginState ? "ring-2 ring-arcade-cyan shadow-[0_0_10px_#60e2ff]" : ""}`,
										onClick: activateCapybaraMargin,
										disabled: capybaraCooldown > 0 || snap?.positioningMarginState !== null,
										"aria-label": "Capivara: ampliar a margem de posicionamento da próxima peça",
										children: ["Z | ", capybaraCooldown > 0 ? `${capybaraCooldown.toFixed(1)}s` : snap?.positioningMarginState ? "ATIVA" : "ENCAIXE"]
									}),
									characterId === "purple-rabbit-ninja" && !matchOver && /* @__PURE__ */ jsxs(Button, {
										type: "button",
										variant: "arcadePanel",
										className: `absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${aimingShuriken ? "ring-2 ring-arcade-violet" : ""}`,
										onClick: toggleShuriken,
										disabled: cooldown > 0 || shurikenShot !== null,
										"aria-pressed": aimingShuriken,
										children: [
											"Z |",
											" ",
											cooldown > 0 ? `${cooldown.toFixed(1)}s` : aimingShuriken ? "CANCELAR" : "SHURIKEN"
										]
									}),
									characterId === "white-fox-ice-mage" && !matchOver && /* @__PURE__ */ jsxs(Button, {
										type: "button",
										variant: "arcadePanel",
										className: `absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${aimingFreeze ? "ring-2 ring-arcade-cyan" : ""}`,
										onClick: toggleFreeze,
										disabled: freezeCooldown > 0,
										"aria-pressed": aimingFreeze,
										children: [
											"Z |",
											" ",
											freezeCooldown > 0 ? `${freezeCooldown.toFixed(1)}s` : aimingFreeze ? "CANCELAR" : "CONGELAR"
										]
									}),
									characterId === "swamp-frog-mage" && !matchOver && /* @__PURE__ */ jsxs(Button, {
										type: "button",
										variant: "arcadePanel",
										className: `absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${aimingTongue || tongueHeld ? "ring-2 ring-arcade-cyan" : ""}`,
										onClick: toggleTongue,
										disabled: tongueCooldown > 0,
										"aria-pressed": aimingTongue || tongueHeld,
										children: [
											"Z |",
											" ",
											tongueCooldown > 0 ? `${tongueCooldown.toFixed(1)}s` : aimingTongue || tongueHeld ? "CANCELAR" : "LÍNGUA"
										]
									}),
									characterId === "forge-raccoon-mage" && !matchOver && /* @__PURE__ */ jsxs(Button, {
										type: "button",
										variant: "arcadePanel",
										className: `absolute right-2 top-12 z-10 h-7 rounded-sm px-1.5 py-1 text-[0.38rem] ${forgeOpen || forgingType ? "ring-2 ring-forge-hot" : ""}`,
										onClick: toggleForge,
										disabled: forgeCooldown > 0 || forgingType !== null,
										"aria-pressed": forgeOpen,
										children: [
											"Z |",
											" ",
											forgeCooldown > 0 ? `${forgeCooldown.toFixed(1)}s` : forgingType ? "FORJANDO" : forgeOpen ? "CANCELAR" : "FORJAR"
										]
									}),
									status !== "playing" && !matchOver && /* @__PURE__ */ jsx("div", {
										className: "pointer-events-none absolute inset-x-2 top-16 z-10 flex justify-center",
										children: /* @__PURE__ */ jsxs("p", {
											className: "border-2 border-arcade-panel-border bg-arcade-panel px-3 py-2 text-center font-arcade text-[0.55rem] text-arcade-violet sm:text-xs",
											children: [
												status === "won" ? `✦ VOCÊ CHEGOU EM ${playerPlace}º! ✦` : "VOCÊ FOI ELIMINADO",
												/* @__PURE__ */ jsx("br", {}),
												/* @__PURE__ */ jsx("span", {
													className: "text-arcade-ink",
													children: "AGUARDANDO OS BOTS..."
												})
											]
										})
									}),
									/* @__PURE__ */ jsx("div", {
										className: "h-2 border border-arcade-cyan bg-arcade-sky/30",
										children: /* @__PURE__ */ jsx("div", {
											className: "h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac",
											style: { width: `${progress * 100}%` }
										})
									})
								]
							}),
							lineup.map((b, i) => /* @__PURE__ */ jsx(BotCard, {
								characterId: b.characterId,
								botNumber: i + 1,
								label: BOT_LABELS[b.difficulty],
								snap: botSnaps[i] ?? null,
								place: finishOrder.indexOf(i + 1) + 1,
								canvasRef: (el) => botCanvasRefs.current[i] = el
							}, b.characterId)),
							matchOver && /* @__PURE__ */ jsxs("div", {
								className: "absolute inset-0 z-30 flex items-center justify-center bg-arcade-ink/40 p-4",
								children: [playerPlace === 1 && /* @__PURE__ */ jsx("div", {
									className: "pointer-events-none absolute inset-0 overflow-hidden",
									"aria-hidden": "true",
									children: Array.from({ length: 18 }).map((_, i) => /* @__PURE__ */ jsx("span", {
										className: "twinkle absolute h-2 w-2 bg-arcade-cyan",
										style: {
											left: `${i * 37 % 100}%`,
											top: `${i * 23 % 90}%`,
											animationDelay: `${i % 6 * .2}s`
										}
									}, i))
								}), /* @__PURE__ */ jsxs("div", {
									className: "pixel-panel relative flex flex-col items-center gap-4 rounded-sm p-5 text-center animate-scale-in",
									children: [
										playerPlace > 0 && /* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.6rem] text-arcade-violet sm:text-xs",
											children: "✦ TORRE CONCLUÍDA! ✦"
										}),
										/* @__PURE__ */ jsx("h2", {
											className: "pixel-title text-xl leading-relaxed text-arcade-ink sm:text-2xl",
											children: playerPlace === 1 ? "VOCÊ VENCEU!" : playerPlace > 0 ? `VOCÊ FICOU EM ${playerPlace}º!` : "A TORRE DESABOU!"
										}),
										/* @__PURE__ */ jsx("ol", {
											className: "w-full space-y-1 text-left",
											children: ranking.map((p, i) => {
												const ch = getCharacterById(p.characterId ?? null);
												const finished = finishOrder.includes(p.idx);
												return /* @__PURE__ */ jsxs("li", {
													className: `flex items-center gap-2 border-2 px-2 py-1 font-arcade text-[0.55rem] ${p.idx === 0 ? "border-arcade-violet bg-arcade-lilac/40" : "border-arcade-panel-border bg-arcade-sky/20"} text-arcade-ink`,
													children: [
														/* @__PURE__ */ jsxs("span", {
															className: "w-6",
															children: [i + 1, "º"]
														}),
														p.characterId && /* @__PURE__ */ jsx(GameplaySprite, {
															characterId: p.characterId,
															animation: finished ? "victory" : "defeat",
															size: 24
														}),
														/* @__PURE__ */ jsxs("span", {
															className: "flex-1",
															children: [
																ch?.shortName ?? "VOCÊ",
																" · ",
																p.label
															]
														}),
														/* @__PURE__ */ jsx("span", {
															className: "text-arcade-violet",
															children: finished ? "✦" : `${(p.snap?.heightMeters ?? 0).toFixed(1)} m`
														})
													]
												}, p.idx);
											})
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "w-full border-t-2 border-arcade-panel-border pt-2 text-left font-game text-xs text-arcade-ink",
											children: [
												/* @__PURE__ */ jsxs("p", { children: [
													"PEÇAS ESTÁVEIS (",
													stablePieceCount,
													" × 5): +",
													rewardBreakdown.stablePieceBonus.toLocaleString("pt-BR"),
													" 🪙"
												] }),
												/* @__PURE__ */ jsxs("p", { children: [
													"ALTURA MÁXIMA (1 🪙/m): +",
													rewardBreakdown.heightBonus.toLocaleString("pt-BR"),
													" ",
													"🪙"
												] }),
												/* @__PURE__ */ jsxs("p", { children: [
													"BÔNUS DE VITÓRIA: +",
													rewardBreakdown.victoryBonus.toLocaleString("pt-BR"),
													" 🪙"
												] })
											]
										}),
										/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
										/* @__PURE__ */ jsx(Button, {
											type: "button",
											variant: "arcade",
											size: "arcade",
											onClick: () => {
												tallestHeightTenthsRef.current = 0;
												setSnap(null);
												setBotSnaps([
													null,
													null,
													null
												]);
												setFinishOrder([]);
												setRound((r) => r + 1);
											},
											"aria-label": "Votar por revanche e jogar novamente com a mesma sala",
											children: "REVANCHE"
										}),
										/* @__PURE__ */ jsx(Button, {
											type: "button",
											variant: "arcadePanel",
											size: "arcade",
											onClick: onChangeGame,
											"aria-label": "Votar por mudar de jogo e voltar à seleção de minigames",
											children: "MUDAR DE JOGO"
										})
									]
								})]
							})
						]
					})
				}),
				/* @__PURE__ */ jsxs("aside", {
					className: "grid w-full grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1.3fr]",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: `pixel-panel flex-1 rounded-sm p-3 ${progress >= .8 && status === "playing" ? "ring-4 ring-arcade-cyan animate-pulse" : ""}`,
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-xs text-arcade-violet",
									children: "ALTURA"
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "pixel-title whitespace-nowrap text-3xl leading-snug text-arcade-ink",
									children: [height.toFixed(1), /* @__PURE__ */ jsx("span", {
										className: "text-lg",
										children: " m"
									})]
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mt-2 h-5 border-2 border-arcade-panel-border bg-arcade-sky/30",
									children: /* @__PURE__ */ jsx("div", {
										className: "h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac transition-all",
										style: { width: `${progress * 100}%` }
									})
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-2 font-arcade text-[0.6rem] text-arcade-ink",
									children: [
										height.toFixed(1),
										" / ",
										TOWER_CONFIG.goalMeters,
										" m"
									]
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-1 font-arcade text-[0.55rem] text-arcade-violet",
									children: [
										"META: ",
										TOWER_CONFIG.goalMeters,
										" m"
									]
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "pixel-panel flex-1 rounded-sm p-3",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.55rem] text-arcade-violet",
									children: "PRÓXIMA"
								}),
								/* @__PURE__ */ jsx("canvas", {
									ref: nextRef,
									width: 110,
									height: 60,
									className: "mx-auto block"
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-2 font-arcade text-[0.45rem] text-arcade-ink",
									children: [
										"PEÇAS PERDIDAS: ",
										snap?.lostPieces ?? 0,
										"/",
										maxLostPieces
									]
								})
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "pixel-panel col-span-2 hidden rounded-sm p-3 md:col-span-1 md:block",
							children: [/* @__PURE__ */ jsx("p", {
								className: "font-arcade text-[0.55rem] text-arcade-violet",
								children: "CONTROLES"
							}), /* @__PURE__ */ jsxs("ul", {
								className: "mt-2 space-y-1 font-game text-base leading-tight text-muted-foreground",
								children: [
									/* @__PURE__ */ jsx("li", { children: "A / D ← → mover" }),
									/* @__PURE__ */ jsx("li", { children: "W / ↑ girar" }),
									/* @__PURE__ */ jsx("li", { children: "S / ↓ acelerar" }),
									/* @__PURE__ */ jsx("li", { children: "ESPAÇO soltar" }),
									characterId === "calm-capybara-mage" && /* @__PURE__ */ jsx("li", { children: "Z: margem extra para a próxima peça (uso único)" }),
									characterId === "axolotl-mage" && /* @__PURE__ */ jsx("li", { children: "Axolote: suporta até 10 peças perdidas" })
								]
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-5 gap-2 md:hidden",
					children: [
						/* @__PURE__ */ jsx(Button, {
							variant: "arcadePanel",
							onClick: touch((e) => e.move(-1)),
							children: "←"
						}),
						/* @__PURE__ */ jsx(Button, {
							variant: "arcadePanel",
							onClick: touch((e) => e.rotate()),
							children: "↻"
						}),
						/* @__PURE__ */ jsx(Button, {
							variant: "arcadePanel",
							onPointerDown: touch((e) => e.softDrop = true),
							onPointerUp: touch((e) => e.softDrop = false),
							onPointerLeave: touch((e) => e.softDrop = false),
							children: "↓"
						}),
						/* @__PURE__ */ jsx(Button, {
							variant: "arcadePanel",
							onClick: touch((e) => e.hardDrop()),
							children: "⤓"
						}),
						/* @__PURE__ */ jsx(Button, {
							variant: "arcadePanel",
							onClick: touch((e) => e.move(1)),
							children: "→"
						})
					]
				}),
				characterId === "calm-capybara-mage" && /* @__PURE__ */ jsxs(Button, {
					type: "button",
					variant: "arcadePanel",
					className: "w-full md:hidden",
					onClick: activateCapybaraMargin,
					disabled: capybaraCooldown > 0 || snap?.positioningMarginState !== null,
					children: ["Z · ", capybaraCooldown > 0 ? `RECARGA ${capybaraCooldown.toFixed(1)}s` : snap?.positioningMarginState ? "MARGEM ATIVA" : "MARGEM NA PRÓXIMA PEÇA"]
				})
			]
		})]
	});
}
function BotCard({ characterId, botNumber, label, snap, place, canvasRef }) {
	const ch = getCharacterById(characterId);
	const status = snap?.status ?? "playing";
	const height = snap?.heightMeters ?? 0;
	const lost = snap?.lostPieces ?? 0;
	const progress = Math.min(1, height / TOWER_CONFIG.goalMeters);
	const [hurt, setHurt] = useState(false);
	useEffect(() => {
		if (lost === 0) return;
		setHurt(true);
		const t = setTimeout(() => setHurt(false), 600);
		return () => clearTimeout(t);
	}, [lost]);
	return /* @__PURE__ */ jsxs("div", {
		className: `pixel-panel relative flex min-w-0 flex-col gap-1 rounded-sm p-1.5 ${status === "won" ? "ring-4 ring-arcade-cyan" : ""} ${status === "lost" ? "opacity-60" : ""}`,
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-1",
				children: [/* @__PURE__ */ jsx(GameplaySprite, {
					characterId,
					animation: status === "won" ? "victory" : status === "lost" ? "defeat" : hurt ? "hurt" : "idle",
					size: 22
				}), /* @__PURE__ */ jsxs("p", {
					className: "min-w-0 flex-1 truncate font-arcade text-[0.45rem] leading-tight text-arcade-ink",
					children: [
						"BOT ",
						botNumber,
						" · ",
						ch?.shortName,
						/* @__PURE__ */ jsx("br", {}),
						/* @__PURE__ */ jsxs("span", {
							className: "text-arcade-violet",
							children: [
								height.toFixed(1),
								" / ",
								TOWER_CONFIG.goalMeters,
								" m · ",
								lost,
								"/",
								TOWER_CONFIG.maxLostPieces,
								" · ",
								label
							]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "relative",
				children: [
					/* @__PURE__ */ jsx("canvas", {
						ref: canvasRef,
						width: TOWER_CONFIG.width,
						height: TOWER_CONFIG.height,
						className: "block h-auto max-h-[64vh] w-full object-contain [image-rendering:pixelated]",
						style: { aspectRatio: `${TOWER_CONFIG.width} / ${TOWER_CONFIG.height}` }
					}),
					/* @__PURE__ */ jsx(WinCountdown, { snapshot: snap }),
					lost > 0 && status === "playing" && /* @__PURE__ */ jsxs("p", {
						className: "tower-lost-pop pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap border-2 border-arcade-panel-border bg-arcade-panel px-1 font-arcade text-[0.4rem] text-arcade-violet",
						children: [
							"PERDEU! ",
							lost,
							"/",
							TOWER_CONFIG.maxLostPieces
						]
					}, `bl-${lost}`),
					status !== "playing" && /* @__PURE__ */ jsx("p", {
						className: "absolute inset-x-0 top-2 text-center font-arcade text-[0.5rem] text-arcade-ink",
						children: /* @__PURE__ */ jsx("span", {
							className: "border-2 border-arcade-panel-border bg-arcade-panel px-1",
							children: status === "won" ? `✦ ${place}º ✦` : "ELIMINADO"
						})
					})
				]
			}),
			/* @__PURE__ */ jsx("div", {
				className: "h-2 border border-arcade-panel-border bg-arcade-sky/30",
				children: /* @__PURE__ */ jsx("div", {
					className: "h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac",
					style: { width: `${progress * 100}%` }
				})
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "flex justify-between font-arcade text-[0.4rem] text-arcade-ink",
				children: [/* @__PURE__ */ jsxs("span", { children: [height.toFixed(1), " m"] }), /* @__PURE__ */ jsxs("span", {
					className: "text-arcade-violet",
					children: [
						lost,
						"/",
						TOWER_CONFIG.maxLostPieces
					]
				})]
			})
		]
	});
}
//#endregion
//#region src/features/spellbound/tower/TowerLocalScreen.tsx
var BEST_HEIGHT_KEY = "spellbound-tower-best-height-tenths-v1";
var DUEL_CONTROLS = [{
	left: "KeyA",
	right: "KeyD",
	rotate: "KeyW",
	softDrop: "KeyS",
	hardDrop: "Space",
	label: "A / D mover · W girar · S acelerar · ESPAÇO soltar"
}, {
	left: "ArrowLeft",
	right: "ArrowRight",
	rotate: "ArrowUp",
	softDrop: "ArrowDown",
	hardDrop: "Enter",
	label: "← / → mover · ↑ girar · ↓ acelerar · ENTER soltar"
}];
var DUEL_KEY_BINDINGS = {
	KeyA: {
		playerIndex: 0,
		action: "left"
	},
	KeyD: {
		playerIndex: 0,
		action: "right"
	},
	KeyW: {
		playerIndex: 0,
		action: "rotate"
	},
	KeyS: {
		playerIndex: 0,
		action: "softDrop"
	},
	Space: {
		playerIndex: 0,
		action: "hardDrop"
	},
	ArrowLeft: {
		playerIndex: 1,
		action: "left"
	},
	ArrowRight: {
		playerIndex: 1,
		action: "right"
	},
	ArrowUp: {
		playerIndex: 1,
		action: "rotate"
	},
	ArrowDown: {
		playerIndex: 1,
		action: "softDrop"
	},
	Enter: {
		playerIndex: 1,
		action: "hardDrop"
	}
};
function playerStatusLabel(snapshot) {
	if (snapshot?.status === "won") return "META ALCANÇADA";
	if (snapshot?.status === "lost") return "ELIMINADO";
	return "JOGANDO";
}
function readSavedBestHeight() {
	try {
		const value = Number(window.localStorage.getItem(BEST_HEIGHT_KEY));
		return Number.isSafeInteger(value) ? Math.max(0, value) : 0;
	} catch {
		return 0;
	}
}
function TowerLocalScreen({ playerName, primaryWalletId, onBack, onChangeGame }) {
	const { playSfx } = useArcadeAudio();
	const [stage, setStage] = useState("setup");
	const [playerTwoName, setPlayerTwoName] = useState("JOGADOR 2");
	const [round, setRound] = useState(0);
	const [snapshots, setSnapshots] = useState([null, null]);
	const canvasRefs = useRef([]);
	const previewRefs = useRef([]);
	const enginesRef = useRef([null, null]);
	const peaksRef = useRef([0, 0]);
	const finishTimesRef = useRef([null, null]);
	const finishedPlayersRef = useRef(/* @__PURE__ */ new Set());
	const previousAudioSnapshotsRef = useRef([null, null]);
	const matchSessionIdRef = useRef(createMatchId("tower-local"));
	const submittedRecordRef = useRef(null);
	const names = [playerName.trim() || "JOGADOR 1", playerTwoName.trim() || "JOGADOR 2"];
	const matchId = `${matchSessionIdRef.current}:${round}`;
	const matchOver = snapshots.every((snapshot) => snapshot !== null && snapshot.status !== "playing");
	const winnerIndex = (() => {
		if (!matchOver) return null;
		const [first, second] = snapshots;
		if (!first || !second) return null;
		if (first.status === "won" && second.status !== "won") return 0;
		if (second.status === "won" && first.status !== "won") return 1;
		if (first.status === "won" && second.status === "won") {
			const firstTime = finishTimesRef.current[0];
			const secondTime = finishTimesRef.current[1];
			if (firstTime !== null && secondTime !== null && firstTime !== secondTime) return firstTime < secondTime ? 0 : 1;
		}
		const firstPeak = peaksRef.current[0];
		const secondPeak = peaksRef.current[1];
		if (firstPeak !== secondPeak) return firstPeak > secondPeak ? 0 : 1;
		if (first.stablePieces !== second.stablePieces) return first.stablePieces > second.stablePieces ? 0 : 1;
		return null;
	})();
	const rewardReceipts = useMatchCurrencyRewards(matchId, matchOver ? snapshots.flatMap((snapshot, index) => {
		if (!snapshot) return [];
		const reward = calculateTowerRewardBreakdown({
			status: snapshot.status,
			peakHeightTenths: peaksRef.current[index],
			stablePieces: snapshot.stablePieces
		});
		return [{
			walletId: index === 0 ? primaryWalletId : walletIdForLocalSlot(1),
			playerId: index === 0 ? "player-1" : "player-2",
			playerName: names[index],
			amount: reward.total
		}];
	}) : [], primaryWalletId);
	useEffect(() => {
		if (stage !== "match") return;
		const engines = [new TowerEngine(), new TowerEngine()];
		enginesRef.current = engines;
		peaksRef.current = [0, 0];
		finishTimesRef.current = [null, null];
		finishedPlayersRef.current.clear();
		previousAudioSnapshotsRef.current = [null, null];
		submittedRecordRef.current = null;
		setSnapshots([null, null]);
		const contexts = engines.map((_, index) => canvasRefs.current[index]?.getContext("2d") ?? null);
		const lastKeys = ["", ""];
		let lastFrame = performance.now();
		let elapsed = 0;
		let animationFrame = 0;
		const loop = (now) => {
			const dt = Math.min(.033, Math.max(0, (now - lastFrame) / 1e3));
			lastFrame = now;
			elapsed += dt;
			engines.forEach((engine, index) => {
				if (engine.status === "playing") engine.step(dt);
				const snapshot = engine.snapshot();
				const playerIndex = index;
				peaksRef.current[playerIndex] = Math.max(peaksRef.current[playerIndex], Math.max(0, Math.round(snapshot.heightMeters * 10)));
				if (snapshot.status === "won" && !finishedPlayersRef.current.has(index)) {
					finishedPlayersRef.current.add(index);
					finishTimesRef.current[playerIndex] = now;
				}
				const context = contexts[index];
				if (context) renderTower(context, engine, elapsed, { showLandingGuide: true });
				const key = `${snapshot.status}|${snapshot.heightMeters}|${snapshot.lostPieces}|${snapshot.nextType}|${snapshot.placed}|${snapshot.stablePieces}|${snapshot.winConfirming}|${Math.ceil(snapshot.winSecondsRemaining)}`;
				if (key !== lastKeys[index]) {
					lastKeys[index] = key;
					setSnapshots((current) => {
						const next = [...current];
						next[playerIndex] = snapshot;
						return next;
					});
				}
			});
			animationFrame = requestAnimationFrame(loop);
		};
		animationFrame = requestAnimationFrame(loop);
		return () => {
			cancelAnimationFrame(animationFrame);
			engines.forEach((engine) => engine.destroy());
			enginesRef.current = [null, null];
		};
	}, [round, stage]);
	useEffect(() => {
		snapshots.forEach((snapshot, index) => {
			const context = previewRefs.current[index]?.getContext("2d");
			if (context && snapshot) renderPiecePreview(context, snapshot.nextType, TETROMINO_SHAPES[snapshot.nextType]);
		});
	}, [snapshots]);
	useEffect(() => {
		if (stage !== "match") return;
		const onKeyDown = (event) => {
			const target = event.target;
			if (target instanceof HTMLElement && (target.isContentEditable || [
				"INPUT",
				"TEXTAREA",
				"SELECT",
				"BUTTON"
			].includes(target.tagName))) return;
			const binding = DUEL_KEY_BINDINGS[event.code];
			if (!binding) return;
			const engine = enginesRef.current[binding.playerIndex];
			if (!engine) return;
			if (event.code.startsWith("Arrow") || event.code === "Space") event.preventDefault();
			if (engine.status !== "playing") return;
			if (binding.action === "left") engine.move(-1);
			else if (binding.action === "right") engine.move(1);
			else if (binding.action === "rotate" && !event.repeat) engine.rotate();
			else if (binding.action === "softDrop") engine.softDrop = true;
			else if (binding.action === "hardDrop" && !event.repeat) engine.hardDrop();
		};
		const onKeyUp = (event) => {
			for (let index = 0; index < DUEL_CONTROLS.length; index += 1) if (event.code === DUEL_CONTROLS[index].softDrop) {
				const engine = enginesRef.current[index];
				if (engine) engine.softDrop = false;
			}
		};
		const onBlur = () => enginesRef.current.forEach((engine) => engine && (engine.softDrop = false));
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onBlur);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onBlur);
		};
	}, [stage, round]);
	useEffect(() => {
		let started = false;
		let pieceDropped = false;
		let pieceLost = false;
		let playerWon = false;
		let playerLost = false;
		const previous = previousAudioSnapshotsRef.current;
		snapshots.forEach((snapshot, index) => {
			if (!snapshot) return;
			const old = previous[index];
			if (!old) {
				if (index === 0 && snapshot.status === "playing") started = true;
				return;
			}
			if (snapshot.placed > old.placed) pieceDropped = true;
			if (snapshot.lostPieces > old.lostPieces) pieceLost = true;
			if (old.status === "playing" && snapshot.status === "won") playerWon = true;
			if (old.status === "playing" && snapshot.status === "lost") playerLost = true;
		});
		if (started) playSfx("game-start");
		else if (playerWon) playSfx("win");
		else if (playerLost) playSfx("game-over");
		else if (pieceLost) playSfx("hit");
		else if (pieceDropped) playSfx("piece-drop");
		previousAudioSnapshotsRef.current = snapshots;
	}, [playSfx, snapshots]);
	useEffect(() => {
		if (!matchOver) return;
		const bestTenths = peaksRef.current[0];
		if (bestTenths <= 0) return;
		const submissionKey = `${matchId}:${bestTenths}`;
		if (submittedRecordRef.current === submissionKey) return;
		submittedRecordRef.current = submissionKey;
		if (bestTenths <= readSavedBestHeight()) return;
		try {
			window.localStorage.setItem(BEST_HEIGHT_KEY, String(bestTenths));
		} catch {}
		submitGlobalRecord("tower", bestTenths);
	}, [matchId, matchOver]);
	const players = [{
		name: names[0],
		label: "P1",
		index: 0
	}, {
		name: names[1],
		label: "P2",
		index: 1
	}];
	const restart = () => {
		setSnapshots([null, null]);
		setRound((current) => current + 1);
	};
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, {}), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "font-arcade text-[0.55rem] text-arcade-violet",
					children: "MAGISTERIUM ARCADE"
				}), /* @__PURE__ */ jsxs("h1", {
					className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl",
					children: ["TOWER ", /* @__PURE__ */ jsx("span", {
						className: "text-arcade-cyan",
						children: "PARTIDA LOCAL"
					})]
				})] }), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "arcade",
					onClick: onBack,
					children: "VOLTAR ÀS OPÇÕES"
				})]
			}), stage === "setup" ? /* @__PURE__ */ jsxs("section", {
				className: "pixel-panel mx-auto w-full max-w-4xl rounded-sm p-4 sm:p-6",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs",
						children: "DUELO LOCAL · DOIS TABULEIROS INDEPENDENTES"
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl",
						children: "CONSTRUA SUA TORRE MAIS ALTA"
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5 grid gap-4 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs("article", {
							className: "border-2 border-arcade-cyan bg-arcade-sky/45 p-3 sm:p-4",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "font-arcade text-xs text-arcade-cyan",
								children: ["P1 · ", names[0].toUpperCase()]
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-3 font-game text-base text-muted-foreground",
								children: DUEL_CONTROLS[0].label
							})]
						}), /* @__PURE__ */ jsxs("article", {
							className: "border-2 border-arcade-violet bg-arcade-sky/45 p-3 sm:p-4",
							children: [/* @__PURE__ */ jsxs("label", {
								className: "block font-arcade text-xs text-arcade-violet",
								children: ["NOME DO P2", /* @__PURE__ */ jsx("input", {
									type: "text",
									value: playerTwoName,
									maxLength: 18,
									autoComplete: "off",
									onChange: (event) => setPlayerTwoName(event.target.value),
									className: "mt-2 w-full border-2 border-arcade-panel-border bg-arcade-panel/80 px-3 py-2 font-game text-lg text-arcade-ink outline-none focus-visible:ring-2 focus-visible:ring-arcade-violet",
									"aria-label": "Nome do jogador 2"
								})]
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-3 font-game text-base text-muted-foreground",
								children: DUEL_CONTROLS[1].label
							})]
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-4 border border-arcade-panel-border bg-arcade-sky/35 px-3 py-2 font-game text-sm text-muted-foreground",
						children: "Cada jogador tem seu próprio tabuleiro e compete pelas mesmas regras. Os poderes de personagem continuam disponíveis na partida Tower contra bots."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5 flex flex-wrap justify-center gap-3",
						children: [/* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "arcade",
							size: "arcade",
							onClick: () => setStage("match"),
							children: "COMEÇAR PARTIDA"
						}), /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "arcadePanel",
							size: "arcade",
							onClick: onBack,
							children: "VOLTAR"
						})]
					})
				]
			}) : /* @__PURE__ */ jsxs(Fragment$1, { children: [
				/* @__PURE__ */ jsx("section", {
					className: "grid gap-4 xl:grid-cols-2",
					"aria-label": "Tabuleiros independentes do Tower",
					children: players.map((player) => {
						const snapshot = snapshots[player.index];
						const height = snapshot?.heightMeters ?? 0;
						const progress = Math.min(1, height / TOWER_CONFIG.goalMeters);
						const status = snapshot?.status ?? "playing";
						const otherIndex = player.index === 0 ? 1 : 0;
						const waitingForOther = status !== "playing" && !matchOver;
						const boardClasses = status === "won" ? "ring-4 ring-arcade-cyan" : status === "lost" ? "opacity-75" : player.index === 0 ? "border-arcade-cyan" : "border-arcade-violet";
						return /* @__PURE__ */ jsxs("article", {
							className: `pixel-panel min-w-0 rounded-sm border-2 p-3 ${boardClasses}`,
							"aria-label": `Tabuleiro de ${player.label}, ${player.name}`,
							children: [
								/* @__PURE__ */ jsxs("header", {
									className: "mb-2 flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ jsxs("div", {
										className: "min-w-0",
										children: [/* @__PURE__ */ jsxs("p", {
											className: "truncate font-arcade text-[0.58rem] text-arcade-ink",
											children: [
												player.label,
												" · ",
												player.name.toUpperCase()
											]
										}), /* @__PURE__ */ jsxs("p", {
											className: "mt-1 font-arcade text-[0.43rem] text-arcade-violet",
											children: [
												height.toFixed(1),
												" / ",
												TOWER_CONFIG.goalMeters,
												" m · ",
												snapshot?.lostPieces ?? 0,
												"/",
												TOWER_CONFIG.maxLostPieces,
												" peças perdidas"
											]
										})]
									}), /* @__PURE__ */ jsx("span", {
										className: "shrink-0 border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1 font-arcade text-[0.4rem] text-arcade-cyan",
										children: playerStatusLabel(snapshot)
									})]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "relative mx-auto w-full max-w-[360px]",
									children: [
										/* @__PURE__ */ jsx("canvas", {
											ref: (element) => {
												canvasRefs.current[player.index] = element;
											},
											width: TOWER_CONFIG.width,
											height: TOWER_CONFIG.height,
											className: "mx-auto block h-auto max-h-[58vh] w-full [image-rendering:pixelated]",
											style: { aspectRatio: `${TOWER_CONFIG.width} / ${TOWER_CONFIG.height}` },
											"aria-label": `Tabuleiro ${player.label}; controles: ${DUEL_CONTROLS[player.index].label}`
										}),
										/* @__PURE__ */ jsx(WinCountdown, { snapshot }),
										waitingForOther && /* @__PURE__ */ jsxs("p", {
											role: "status",
											className: "absolute inset-x-2 top-1/2 -translate-y-1/2 border-2 border-arcade-panel-border bg-arcade-panel/95 px-2 py-2 text-center font-arcade text-[0.46rem] leading-relaxed text-arcade-violet",
											children: [
												status === "won" ? "CHEGOU À META" : "TABULEIRO ELIMINADO",
												/* @__PURE__ */ jsx("br", {}),
												players[otherIndex].label,
												" CONTINUA A DISPUTA"
											]
										})
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3",
									children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
										className: "h-3 border-2 border-arcade-panel-border bg-arcade-sky/30",
										children: /* @__PURE__ */ jsx("div", {
											className: "h-full bg-gradient-to-r from-arcade-cyan to-arcade-lilac",
											style: { width: `${progress * 100}%` }
										})
									}), /* @__PURE__ */ jsxs("p", {
										className: "mt-2 font-game text-xs text-muted-foreground",
										children: [
											snapshot?.stablePieces ?? 0,
											" peças estáveis · 🪙",
											" ",
											(snapshot?.stablePieces ?? 0) * 5
										]
									})] }), /* @__PURE__ */ jsxs("div", {
										className: "border border-arcade-panel-border bg-arcade-sky/35 p-1 text-center",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.4rem] text-arcade-violet",
											children: "PRÓXIMA"
										}), /* @__PURE__ */ jsx("canvas", {
											ref: (element) => {
												previewRefs.current[player.index] = element;
											},
											width: 110,
											height: 60,
											className: "mx-auto block",
											"aria-label": `Próxima peça de ${player.label}`
										})]
									})]
								})
							]
						}, player.label);
					})
				}),
				/* @__PURE__ */ jsx("section", {
					className: "pixel-panel grid gap-3 rounded-sm p-3 sm:grid-cols-2",
					"aria-label": "Controles do duelo local",
					children: players.map((player) => /* @__PURE__ */ jsxs("p", {
						className: "font-game text-sm text-muted-foreground",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "font-arcade text-[0.46rem] text-arcade-violet",
							children: [
								player.label,
								":",
								" "
							]
						}), DUEL_CONTROLS[player.index].label]
					}, player.label))
				}),
				matchOver && /* @__PURE__ */ jsxs("section", {
					className: "pixel-panel mx-auto w-full max-w-3xl rounded-sm p-4 text-center sm:p-6",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "font-arcade text-[0.58rem] text-arcade-violet",
							children: "FIM DO DUELO"
						}),
						/* @__PURE__ */ jsx("h2", {
							className: "pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl",
							children: winnerIndex === null ? "EMPATE!" : `${names[winnerIndex].toUpperCase()} VENCEU!`
						}),
						/* @__PURE__ */ jsx("ol", {
							className: "mt-4 space-y-2 text-left",
							children: [0, 1].sort((left, right) => {
								if (winnerIndex !== null) return left === winnerIndex ? -1 : 1;
								const heightDifference = peaksRef.current[right] - peaksRef.current[left];
								if (heightDifference !== 0) return heightDifference;
								return (snapshots[right]?.stablePieces ?? 0) - (snapshots[left]?.stablePieces ?? 0);
							}).map((index, place) => /* @__PURE__ */ jsxs("li", {
								className: `flex items-center justify-between gap-2 border-2 px-3 py-2 font-arcade text-[0.5rem] ${index === winnerIndex ? "border-arcade-cyan bg-arcade-lilac/30" : "border-arcade-panel-border bg-arcade-sky/30"} text-arcade-ink`,
								children: [/* @__PURE__ */ jsxs("span", { children: [
									winnerIndex === null ? "EMPATE" : place === 0 ? "1º" : "2º",
									" ·",
									" ",
									names[index].toUpperCase()
								] }), /* @__PURE__ */ jsxs("span", { children: [(peaksRef.current[index] / 10).toFixed(1), " m"] })]
							}, index))
						}),
						/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-4 flex flex-wrap justify-center gap-3",
							children: [/* @__PURE__ */ jsx(Button, {
								type: "button",
								variant: "arcade",
								size: "arcade",
								onClick: restart,
								children: "REVANCHE"
							}), /* @__PURE__ */ jsx(Button, {
								type: "button",
								variant: "arcadePanel",
								size: "arcade",
								onClick: onChangeGame,
								children: "MUDAR DE JOGO"
							})]
						})
					]
				})
			] })]
		})]
	});
}
//#endregion
//#region src/features/spellbound/skyflap/config.ts
var SKY_FLAP_CONFIG = {
	width: 960,
	height: 540,
	playerX: 230,
	playerHitWidth: 26,
	playerHitHeight: 24,
	gravity: 800,
	flapImpulse: -360,
	maxFallSpeed: 460,
	obstacleSpeed: 190,
	obstacleWidth: 76,
	gapHeight: 194,
	obstacleSpacing: 356,
	firstObstacleX: 700,
	spawnAhead: 280,
	maxGapShift: 78,
	safeGapMargin: 24,
	speedGainPerPoint: .01,
	maxSpeedMultiplier: 1.4,
	entryEffectDurationMs: 520,
	scoreEffectDurationMs: 460,
	gameOverBurstDurationMs: 520
};
//#endregion
//#region src/features/spellbound/skyflap/engine.ts
function clamp$4(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
function getSkyFlapCoinReward(score) {
	return Math.floor(Math.max(0, Number.isFinite(score) ? Math.floor(score) : 0) / 10);
}
function getScrollSpeedMultiplier(score) {
	const earnedPoints = Math.max(0, Math.floor(Number.isFinite(score) ? score : 0) - 4);
	return Math.min(SKY_FLAP_CONFIG.maxSpeedMultiplier, 1 + earnedPoints * SKY_FLAP_CONFIG.speedGainPerPoint);
}
function createSkyFlapPlayerState(id, playerY = SKY_FLAP_CONFIG.height / 2, playerX = SKY_FLAP_CONFIG.playerX) {
	return {
		id,
		playerX,
		playerY,
		playerVelocityY: 0,
		score: 0,
		bestScore: 0,
		phase: "ready"
	};
}
/** Shared world, obstacle, scoring, speed and per-player collision/physics core. */
var SkyFlapCore = class {
	scrollDistance = 0;
	obstacles = [];
	nextObstacleId = 1;
	randomState = 1;
	constructor(seed) {
		this.reset(seed);
	}
	reset(seed) {
		this.scrollDistance = 0;
		this.nextObstacleId = 1;
		this.randomState = (seed ?? (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0) || 1;
		const firstGap = SKY_FLAP_CONFIG.height / 2;
		const secondGap = this.nextGapCenter(firstGap);
		this.obstacles = [this.makeObstacle(SKY_FLAP_CONFIG.firstObstacleX, firstGap), this.makeObstacle(SKY_FLAP_CONFIG.firstObstacleX + SKY_FLAP_CONFIG.obstacleSpacing, secondGap)];
	}
	startPlayers(players) {
		for (const player of players) if (player.phase === "ready") player.phase = "playing";
	}
	flap(player) {
		if (player.phase === "eliminated") return false;
		player.phase = "playing";
		player.playerVelocityY = SKY_FLAP_CONFIG.flapImpulse;
		return true;
	}
	step(deltaSeconds, players) {
		const activePlayers = players.filter((player) => player.phase === "playing");
		const speedMultiplier = getScrollSpeedMultiplier(Math.max(0, ...players.map((player) => player.score)));
		const result = {
			scoredPlayerIds: [],
			eliminatedPlayerIds: [],
			speedMultiplier
		};
		const dt = clamp$4(deltaSeconds, 0, .05);
		if (dt === 0 || activePlayers.length === 0) return result;
		const obstacleSpeed = SKY_FLAP_CONFIG.obstacleSpeed * speedMultiplier;
		this.scrollDistance += obstacleSpeed * dt;
		for (const obstacle of this.obstacles) obstacle.x -= obstacleSpeed * dt;
		for (const player of activePlayers) {
			player.playerVelocityY = Math.min(SKY_FLAP_CONFIG.maxFallSpeed, player.playerVelocityY + SKY_FLAP_CONFIG.gravity * dt);
			player.playerY += player.playerVelocityY * dt;
			if (player.playerY - SKY_FLAP_CONFIG.playerHitHeight / 2 <= 0 || player.playerY + SKY_FLAP_CONFIG.playerHitHeight / 2 >= SKY_FLAP_CONFIG.height) {
				player.phase = "eliminated";
				result.eliminatedPlayerIds.push(player.id);
				continue;
			}
			const playerLeft = player.playerX - SKY_FLAP_CONFIG.playerHitWidth / 2;
			const playerRight = player.playerX + SKY_FLAP_CONFIG.playerHitWidth / 2;
			for (const obstacle of this.obstacles) {
				const obstacleRight = obstacle.x + SKY_FLAP_CONFIG.obstacleWidth;
				if (playerRight > obstacle.x && playerLeft < obstacleRight) {
					const gapTop = obstacle.gapCenter - SKY_FLAP_CONFIG.gapHeight / 2;
					const gapBottom = obstacle.gapCenter + SKY_FLAP_CONFIG.gapHeight / 2;
					const playerTop = player.playerY - SKY_FLAP_CONFIG.playerHitHeight / 2;
					const playerBottom = player.playerY + SKY_FLAP_CONFIG.playerHitHeight / 2;
					if (playerTop < gapTop || playerBottom > gapBottom) {
						player.phase = "eliminated";
						result.eliminatedPlayerIds.push(player.id);
						break;
					}
				}
				if (!obstacle.scoredByPlayerIds.includes(player.id) && obstacleRight < playerLeft) {
					obstacle.scoredByPlayerIds.push(player.id);
					player.score += 1;
					player.bestScore = Math.max(player.bestScore, player.score);
					result.scoredPlayerIds.push(player.id);
				}
			}
		}
		if (!players.some((player) => player.phase === "playing")) {
			result.speedMultiplier = getScrollSpeedMultiplier(Math.max(0, ...players.map((player) => player.score)));
			return result;
		}
		this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + SKY_FLAP_CONFIG.obstacleWidth >= 0);
		this.ensureObstacleAhead();
		result.speedMultiplier = getScrollSpeedMultiplier(Math.max(0, ...players.map((player) => player.score)));
		return result;
	}
	snapshotObstacles(playerId) {
		return this.obstacles.map((obstacle) => ({
			id: obstacle.id,
			x: obstacle.x,
			gapCenter: obstacle.gapCenter,
			scored: playerId ? obstacle.scoredByPlayerIds.includes(playerId) : obstacle.scoredByPlayerIds.length > 0,
			scoredByPlayerIds: [...obstacle.scoredByPlayerIds]
		}));
	}
	makeObstacle(x, gapCenter) {
		return {
			id: this.nextObstacleId++,
			x,
			gapCenter,
			scoredByPlayerIds: []
		};
	}
	ensureObstacleAhead() {
		let last = this.obstacles.at(-1);
		if (!last) {
			last = this.makeObstacle(SKY_FLAP_CONFIG.width + 100, SKY_FLAP_CONFIG.height / 2);
			this.obstacles.push(last);
		}
		while (last && last.x < SKY_FLAP_CONFIG.width + SKY_FLAP_CONFIG.spawnAhead) {
			const gapCenter = this.nextGapCenter(last.gapCenter);
			last = this.makeObstacle(last.x + SKY_FLAP_CONFIG.obstacleSpacing, gapCenter);
			this.obstacles.push(last);
		}
	}
	nextGapCenter(previous) {
		this.randomState = 1664525 * this.randomState + 1013904223 >>> 0;
		const random = this.randomState / 4294967296;
		const min = SKY_FLAP_CONFIG.gapHeight / 2 + SKY_FLAP_CONFIG.playerHitHeight / 2 + SKY_FLAP_CONFIG.safeGapMargin;
		const max = SKY_FLAP_CONFIG.height - min;
		return clamp$4(previous + (random * 2 - 1) * SKY_FLAP_CONFIG.maxGapShift, min, max);
	}
};
/** Solo adapter kept API-compatible with the original one-player screen. */
var SkyFlapEngine = class {
	core;
	player;
	constructor(seed) {
		this.core = new SkyFlapCore(seed);
		this.player = createSkyFlapPlayerState("solo");
	}
	get phase() {
		return this.player.phase === "eliminated" ? "gameover" : this.player.phase;
	}
	get playerY() {
		return this.player.playerY;
	}
	get playerVelocityY() {
		return this.player.playerVelocityY;
	}
	get score() {
		return this.player.score;
	}
	get bestScore() {
		return this.player.bestScore;
	}
	get scrollDistance() {
		return this.core.scrollDistance;
	}
	get obstacles() {
		return this.core.snapshotObstacles("solo");
	}
	setBestScore(score) {
		this.player.bestScore = Math.max(this.player.bestScore, Math.floor(score) || 0);
	}
	reset(seed) {
		const bestScore = this.player.bestScore;
		this.core.reset(seed);
		this.player = createSkyFlapPlayerState("solo");
		this.player.bestScore = bestScore;
	}
	flap() {
		return this.core.flap(this.player);
	}
	step(deltaSeconds) {
		this.core.step(deltaSeconds, [this.player]);
	}
	snapshot() {
		return {
			phase: this.phase,
			playerX: this.player.playerX,
			playerY: this.player.playerY,
			playerVelocityY: this.player.playerVelocityY,
			score: this.player.score,
			speedMultiplier: getScrollSpeedMultiplier(this.player.score),
			bestScore: this.player.bestScore,
			scrollDistance: this.core.scrollDistance,
			obstacles: this.core.snapshotObstacles("solo")
		};
	}
};
//#endregion
//#region src/features/spellbound/skyflap/render.ts
function wrap$1(value, span) {
	return (value % span + span) % span;
}
var ENTRY_SPARKS = [
	0,
	1,
	2,
	3,
	4,
	5
];
var PASS_SPARKS = [
	0,
	1,
	2,
	3,
	4
];
function drawSpeedStreaks(ctx, snapshot, time, speedProgress) {
	if (snapshot.phase !== "playing" || speedProgress <= 0) return;
	const intensity = Math.min(1, speedProgress);
	const count = 3 + Math.round(intensity * 5);
	const flowSpeed = 150 + intensity * 340;
	ctx.save();
	for (let i = 0; i < count; i++) {
		const x = wrap$1(SKY_FLAP_CONFIG.width - time * flowSpeed - i * 173, SKY_FLAP_CONFIG.width);
		const y = 42 + (i * 83 + 29) % (SKY_FLAP_CONFIG.height - 84);
		ctx.globalAlpha = .045 + intensity * .085;
		ctx.fillStyle = i % 3 === 0 ? "#d8ceff" : "#d7faff";
		ctx.fillRect(Math.round(x), Math.round(y), Math.round(5 + intensity * 8), 2);
	}
	ctx.restore();
}
function drawEntryParticles(ctx, snapshot, progress, time) {
	if (snapshot.phase === "gameover" || progress >= 1) return;
	const radius = 8 + progress * 24;
	ctx.save();
	ctx.globalAlpha = (1 - progress) * .8;
	for (const i of ENTRY_SPARKS) {
		const angle = i * (Math.PI * 2 / ENTRY_SPARKS.length) + time * .25;
		const x = snapshot.playerX + Math.cos(angle) * radius;
		const y = snapshot.playerY + Math.sin(angle) * radius;
		ctx.fillStyle = i % 2 === 0 ? "#e8fbff" : "#c9baff";
		ctx.fillRect(Math.round(x), Math.round(y), i % 3 === 0 ? 3 : 2, 2);
	}
	ctx.restore();
}
function drawScorePop(ctx, snapshot, progress) {
	if (progress <= 0 || progress >= 1 || snapshot.phase !== "playing") return;
	const rise = progress * 16;
	ctx.save();
	ctx.globalAlpha = 1 - progress;
	ctx.font = "bold 14px monospace";
	ctx.textAlign = "center";
	ctx.textBaseline = "middle";
	ctx.fillStyle = "#fff1a6";
	ctx.fillText("+1", snapshot.playerX + 25, snapshot.playerY - 26 - rise);
	for (const i of PASS_SPARKS) {
		const angle = i * (Math.PI * 2 / PASS_SPARKS.length) - Math.PI / 2;
		const radius = 5 + progress * 17;
		const x = snapshot.playerX + 18 + Math.cos(angle) * radius;
		const y = snapshot.playerY - 7 + Math.sin(angle) * radius;
		ctx.fillStyle = i % 2 === 0 ? "#e7fcff" : "#d4c7ff";
		ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
	}
	ctx.restore();
}
function drawCloud(ctx, x, y, scale) {
	const unit = 7 * scale;
	ctx.fillStyle = "rgba(206, 244, 255, 0.32)";
	ctx.fillRect(x + unit, y + unit, unit * 7, unit * 2);
	ctx.fillRect(x + unit * 2, y, unit * 3, unit * 3);
	ctx.fillRect(x + unit * 5, y + unit / 2, unit * 2, unit * 2.5);
	ctx.fillStyle = "rgba(244, 253, 255, 0.68)";
	ctx.fillRect(x + unit * 2, y + unit, unit * 3, unit);
	ctx.fillRect(x + unit * 5, y + unit * 1.5, unit, unit / 2);
}
function drawFloatingIsland(ctx, x, y, scale) {
	const unit = 6 * scale;
	ctx.fillStyle = "#8be8f1";
	ctx.fillRect(x + unit * 2, y, unit * 12, unit * 2);
	ctx.fillStyle = "#6758b7";
	ctx.fillRect(x, y + unit * 2, unit * 16, unit * 2);
	ctx.fillStyle = "#373878";
	ctx.fillRect(x + unit * 2, y + unit * 4, unit * 12, unit * 2);
	ctx.fillRect(x + unit * 4, y + unit * 6, unit * 8, unit);
	ctx.fillStyle = "rgba(200, 247, 255, 0.75)";
	ctx.fillRect(x + unit * 4, y + unit * 2, unit * 3, unit / 2);
}
function drawSky(ctx, snapshot, time) {
	const gradient = ctx.createLinearGradient(0, 0, 0, SKY_FLAP_CONFIG.height);
	gradient.addColorStop(0, "#172454");
	gradient.addColorStop(.48, "#344e9b");
	gradient.addColorStop(.82, "#5eb8df");
	gradient.addColorStop(1, "#b5f2ff");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, SKY_FLAP_CONFIG.width, SKY_FLAP_CONFIG.height);
	for (let i = 0; i < 42; i++) {
		const depth = i % 4 === 0 ? .2 : .055;
		const x = wrap$1(i * 173 + 29 - snapshot.scrollDistance * depth, SKY_FLAP_CONFIG.width);
		const y = (i * 97 + 31) % SKY_FLAP_CONFIG.height;
		const size = i % 7 === 0 ? 4 : 2;
		ctx.globalAlpha = .42 + (Math.sin(time * 2 + i * 1.7) + 1) / 2 * .5;
		ctx.fillStyle = i % 5 === 0 ? "#d4c7ff" : "#e5fbff";
		ctx.fillRect(x, y, size, size);
		if (size === 4 && i % 2 === 0) {
			ctx.fillRect(x + 1, y - 2, 2, 8);
			ctx.fillRect(x - 2, y + 1, 8, 2);
		}
	}
	ctx.globalAlpha = 1;
	for (const cloud of [
		{
			x: 70,
			y: 105,
			scale: 1.2
		},
		{
			x: 460,
			y: 225,
			scale: .85
		},
		{
			x: 780,
			y: 82,
			scale: .75
		},
		{
			x: 1060,
			y: 365,
			scale: 1.1
		}
	]) drawCloud(ctx, wrap$1(cloud.x - snapshot.scrollDistance * .12, SKY_FLAP_CONFIG.width + 180) - 90, cloud.y, cloud.scale);
	for (const island of [
		{
			x: 180,
			y: 438,
			scale: .85
		},
		{
			x: 660,
			y: 352,
			scale: .62
		},
		{
			x: 1110,
			y: 470,
			scale: .95
		}
	]) drawFloatingIsland(ctx, wrap$1(island.x - snapshot.scrollDistance * .28, SKY_FLAP_CONFIG.width + 210) - 105, island.y, island.scale);
	ctx.fillStyle = "rgba(209, 249, 255, 0.26)";
	ctx.fillRect(0, SKY_FLAP_CONFIG.height - 8, SKY_FLAP_CONFIG.width, 3);
	ctx.fillStyle = "rgba(174, 160, 255, 0.45)";
	ctx.fillRect(0, 0, SKY_FLAP_CONFIG.width, 3);
}
function drawCrystal(ctx, x, y) {
	ctx.fillStyle = "#d5fbff";
	ctx.fillRect(x + 5, y, 6, 4);
	ctx.fillStyle = "#80e8f7";
	ctx.fillRect(x + 2, y + 4, 12, 7);
	ctx.fillStyle = "#967cf0";
	ctx.fillRect(x + 5, y + 11, 6, 5);
	ctx.fillStyle = "#f0ffff";
	ctx.fillRect(x + 5, y + 4, 3, 4);
}
function drawGateColumn(ctx, x, y, height, isTop) {
	if (height <= 0) return;
	const width = SKY_FLAP_CONFIG.obstacleWidth;
	ctx.fillStyle = "#20265c";
	ctx.fillRect(x, y, width, height);
	ctx.fillStyle = "#55489f";
	ctx.fillRect(x + 6, y + 4, width - 12, Math.max(0, height - 8));
	ctx.fillStyle = "#70ddeb";
	ctx.fillRect(x + 8, y + 5, 4, Math.max(0, height - 10));
	ctx.fillStyle = "#a895ff";
	ctx.fillRect(x + width - 12, y + 5, 4, Math.max(0, height - 10));
	for (let runeY = y + 23; runeY < y + height - 24; runeY += 38) {
		ctx.fillStyle = "rgba(230, 246, 255, 0.9)";
		ctx.fillRect(x + 23, runeY, 8, 4);
		ctx.fillStyle = "#83e8f5";
		ctx.fillRect(x + 38, runeY + 9, 9, 4);
		ctx.fillStyle = "#ccbaff";
		ctx.fillRect(x + 26, runeY + 18, 6, 4);
	}
	const capY = isTop ? y + height - 22 : y;
	ctx.fillStyle = "#202454";
	ctx.fillRect(x - 8, capY, width + 16, 22);
	ctx.fillStyle = "#9275e8";
	ctx.fillRect(x - 4, capY + 3, width + 8, 14);
	ctx.fillStyle = "#a7f1f4";
	ctx.fillRect(x - 8, capY + (isTop ? 18 : 0), width + 16, 4);
	ctx.fillStyle = "#42367f";
	ctx.fillRect(x + 4, capY + 7, width - 8, 6);
	drawCrystal(ctx, x + width / 2 - 8, capY + (isTop ? 15 : -9));
}
function drawArcaneGate(ctx, obstacle) {
	const gapTop = obstacle.gapCenter - SKY_FLAP_CONFIG.gapHeight / 2;
	const gapBottom = obstacle.gapCenter + SKY_FLAP_CONFIG.gapHeight / 2;
	drawGateColumn(ctx, obstacle.x, 0, gapTop, true);
	drawGateColumn(ctx, obstacle.x, gapBottom, SKY_FLAP_CONFIG.height - gapBottom, false);
	ctx.globalAlpha = .55;
	ctx.fillStyle = "#d5caff";
	ctx.fillRect(obstacle.x + 30, gapTop + 12, 4, 4);
	ctx.fillStyle = "#a9f7ff";
	ctx.fillRect(obstacle.x + 42, gapBottom - 16, 4, 4);
	ctx.globalAlpha = 1;
}
function drawPlayerTrail(ctx, snapshot, time, speedProgress) {
	if (snapshot.phase === "gameover") return;
	const y = snapshot.playerY;
	const pulse = Math.min(1, (.45 + (Math.sin(time * 12) + 1) / 2 * .35) * (1 + speedProgress * .35));
	const trail = speedProgress * 10;
	ctx.globalAlpha = pulse;
	ctx.fillStyle = "#e9ffff";
	ctx.fillRect(snapshot.playerX - 31 - trail, y - 2, 8, 4);
	ctx.fillStyle = "#86ecff";
	ctx.fillRect(snapshot.playerX - 43 - trail, y + 4, 5, 3);
	ctx.fillStyle = "#baa7ff";
	ctx.fillRect(snapshot.playerX - 52 - trail, y - 7, 4, 3);
	ctx.globalAlpha = 1;
}
function drawSkyFlap(ctx, snapshot, time, effects = {
	entryProgress: 1,
	scoreProgress: 0
}) {
	drawSkyFlapWorld(ctx, snapshot, time);
	drawSkyFlapPlayerEffects(ctx, snapshot, time, effects);
}
function drawSkyFlapWorld(ctx, snapshot, time) {
	ctx.imageSmoothingEnabled = false;
	drawSky(ctx, snapshot, time);
	drawSpeedStreaks(ctx, snapshot, time, Math.min(1, Math.max(0, (snapshot.speedMultiplier - 1) / (SKY_FLAP_CONFIG.maxSpeedMultiplier - 1))));
	for (const obstacle of snapshot.obstacles) drawArcaneGate(ctx, obstacle);
}
function drawSkyFlapPlayerEffects(ctx, snapshot, time, effects = {
	entryProgress: 1,
	scoreProgress: 0
}) {
	ctx.imageSmoothingEnabled = false;
	drawPlayerTrail(ctx, snapshot, time, Math.min(1, Math.max(0, (snapshot.speedMultiplier - 1) / (SKY_FLAP_CONFIG.maxSpeedMultiplier - 1))));
	drawEntryParticles(ctx, snapshot, effects.entryProgress, time);
	drawScorePop(ctx, snapshot, effects.scoreProgress);
}
//#endregion
//#region src/features/spellbound/skyflap/SkyFlapScreen.tsx
var BEST_SCORE_KEY$1 = "spellbound-sky-flap-best-v1";
function readBestScore$2() {
	try {
		const saved = Number(window.localStorage.getItem(BEST_SCORE_KEY$1));
		return Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : 0;
	} catch {
		return 0;
	}
}
var MAGIC_CLOUD_THEMES = {
	"white-fox-ice-mage": {
		outline: "#63b9e5",
		body: "#c6efff",
		highlight: "#f7fdff",
		underside: "#84d2f3",
		glow: "rgba(104, 210, 255, 0.68)"
	},
	"purple-rabbit-ninja": {
		outline: "#6849a9",
		body: "#987bd5",
		highlight: "#e2d2ff",
		underside: "#7557bc",
		glow: "rgba(177, 136, 255, 0.58)"
	},
	"swamp-frog-mage": {
		outline: "#286c58",
		body: "#65ae7c",
		highlight: "#c8efb5",
		underside: "#3a8b7c",
		glow: "rgba(112, 229, 167, 0.54)"
	},
	"forge-raccoon-mage": {
		outline: "#713b3b",
		body: "#b85b42",
		highlight: "#ffc16d",
		underside: "#923d3b",
		glow: "rgba(255, 122, 57, 0.62)"
	},
	"time-owl-mage": {
		outline: "#514b91",
		body: "#8077c5",
		highlight: "#e0d9ff",
		underside: "#625ca8",
		glow: "rgba(164, 143, 255, 0.62)"
	},
	"calm-capybara-mage": {
		outline: "#516650",
		body: "#9a7157",
		highlight: "#d8b891",
		underside: "#6c5549",
		glow: "rgba(157, 232, 207, 0.58)"
	},
	"axolotl-mage": {
		outline: "#744565",
		body: "#ef8cc7",
		highlight: "#ffe1f3",
		underside: "#b65e9e",
		glow: "rgba(255, 158, 219, 0.62)"
	}
};
var CLOUD_SPEED_TRAIL_PARTICLES = [
	{
		x: 1,
		y: 16,
		size: 2
	},
	{
		x: 5,
		y: 11,
		size: 1.5
	},
	{
		x: 7,
		y: 22,
		size: 2
	},
	{
		x: 11,
		y: 6,
		size: 1.5
	}
];
function PlayerMagicCloudDetails({ characterId }) {
	switch (characterId) {
		case "white-fox-ice-mage": return /* @__PURE__ */ jsxs("g", { children: [
			/* @__PURE__ */ jsx("path", {
				d: "M13 9 17 1l4 8h-3l-1 4-2-4zM52 10l3-7 4 7h-3l-1 3-1-3z",
				fill: "#e5faff"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M17 3v8M55 5v7",
				stroke: "#83dfff",
				strokeWidth: "1"
			}),
			/* @__PURE__ */ jsx("g", {
				className: "animate-pulse",
				fill: "#f4fdff",
				children: /* @__PURE__ */ jsx("path", { d: "M4 13h4v1H4zM5 12h1v4H5zM65 6h4v1h-4zM66 5h1v4h-1z" })
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "10",
				y: "3",
				width: "2",
				height: "2",
				fill: "#a8edff"
			})
		] });
		case "purple-rabbit-ninja": return /* @__PURE__ */ jsxs("g", { children: [
			/* @__PURE__ */ jsx("path", {
				d: "M2 17h3v-4h3v2H6v4H3v3H1v-3H2zM67 17h2v-4h2v6h-2v3h-2z",
				fill: "#b69bff",
				opacity: "0.8"
			}),
			/* @__PURE__ */ jsx("g", {
				className: "animate-pulse",
				fill: "#e8dcff",
				children: /* @__PURE__ */ jsx("path", { d: "M3 8 6 10l4-2-2 4 2 4-4-2-4 2 2-4z" })
			}),
			/* @__PURE__ */ jsx("path", {
				d: "m61 7 3 3 4-2-2 4 3 3-5 1-1 4-3-4-4 1 2-4-3-3 5-1z",
				fill: "#d1baff"
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "10",
				y: "5",
				width: "2",
				height: "2",
				fill: "#a98ce8"
			})
		] });
		case "swamp-frog-mage": return /* @__PURE__ */ jsxs("g", { children: [
			/* @__PURE__ */ jsx("path", {
				d: "M8 9h3v3h3v2h-3v-1H8zM53 8h3v3h3v2h-3v-1h-3z",
				fill: "#bde995"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M10 14h3v-2h2v4h-3v2h-2zM55 13h3v-2h2v4h-3v2h-2z",
				fill: "#75ce9a"
			}),
			/* @__PURE__ */ jsxs("g", {
				fill: "none",
				stroke: "#c9ffe0",
				strokeWidth: "1",
				children: [/* @__PURE__ */ jsx("circle", {
					cx: "5",
					cy: "17",
					r: "2"
				}), /* @__PURE__ */ jsx("circle", {
					cx: "67",
					cy: "9",
					r: "1.5"
				})]
			}),
			/* @__PURE__ */ jsxs("g", {
				className: "animate-pulse",
				fill: "#a9f3cc",
				children: [/* @__PURE__ */ jsx("circle", {
					cx: "8",
					cy: "5",
					r: "1"
				}), /* @__PURE__ */ jsx("circle", {
					cx: "63",
					cy: "19",
					r: "1.2"
				})]
			})
		] });
		case "forge-raccoon-mage": return /* @__PURE__ */ jsxs("g", { children: [
			/* @__PURE__ */ jsx("path", {
				d: "M12 16v-4h2V8h2v4h2v5h-2v2h-4zM54 16v-3h2V9h2v4h2v4h-2v2h-4z",
				fill: "#ff9a46"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M11 7h3v2h-3zM59 5h2v3h-2zM64 19h3v2h-3z",
				fill: "#ffd77c",
				className: "animate-pulse"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M20 18h3v2h-3zM49 18h3v2h-3z",
				fill: "#f26b40"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M6 12h3v1H6zM7 11h1v3H7z",
				fill: "#ffe19a"
			})
		] });
		case "time-owl-mage": return /* @__PURE__ */ jsxs("g", { children: [
			/* @__PURE__ */ jsx("path", {
				d: "M9 9h2v2h2v2h-2v-1H9zM15 5h1v3h2v1h-2v3h-1V9h-2V8h2z",
				fill: "#d1c8ff"
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "64",
				cy: "12",
				r: "4",
				fill: "#6e68b5",
				stroke: "#e1d9ff",
				strokeWidth: "1"
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M64 9v3l2 1M62 12h1",
				fill: "none",
				stroke: "#f4eaff",
				strokeWidth: "1"
			}),
			/* @__PURE__ */ jsxs("g", {
				className: "animate-pulse",
				fill: "#f0eaff",
				children: [
					/* @__PURE__ */ jsx("rect", {
						x: "3",
						y: "17",
						width: "2",
						height: "2"
					}),
					/* @__PURE__ */ jsx("rect", {
						x: "7",
						y: "20",
						width: "2",
						height: "2"
					}),
					/* @__PURE__ */ jsx("rect", {
						x: "11",
						y: "22",
						width: "1.5",
						height: "1.5"
					})
				]
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M55 5h2v2h-2zM59 4h1v3h-1z",
				fill: "#b8a9ff"
			})
		] });
		case "calm-capybara-mage": return /* @__PURE__ */ jsxs("g", {
			fill: "#b3efd7",
			className: "animate-pulse",
			children: [
				/* @__PURE__ */ jsx("circle", {
					cx: "9",
					cy: "11",
					r: "2"
				}),
				/* @__PURE__ */ jsx("circle", {
					cx: "61",
					cy: "7",
					r: "1.5"
				}),
				/* @__PURE__ */ jsx("path", { d: "M15 18h4v1h-4zM52 14h3v1h-3z" })
			]
		});
		case "axolotl-mage": return /* @__PURE__ */ jsxs("g", {
			fill: "#ffd2ed",
			className: "animate-pulse",
			children: [
				/* @__PURE__ */ jsx("path", { d: "M8 8h3v4H8zM60 14h3v4h-3z" }),
				/* @__PURE__ */ jsx("circle", {
					cx: "17",
					cy: "20",
					r: "1.5"
				}),
				/* @__PURE__ */ jsx("circle", {
					cx: "54",
					cy: "5",
					r: "1.5"
				})
			]
		});
	}
	return null;
}
function PlayerMagicCloudSpeedParticle({ characterId, particle, theme, speedProgress }) {
	return /* @__PURE__ */ jsxs("g", {
		className: "animate-pulse",
		transform: `translate(${particle.x} ${particle.y}) scale(${particle.size / 2})`,
		opacity: .55 + speedProgress * .35,
		children: [
			characterId === "white-fox-ice-mage" && /* @__PURE__ */ jsx("path", {
				d: "M1 0h2v1h1v2H3v1H1V3H0V1h1z",
				fill: theme.highlight
			}),
			characterId === "purple-rabbit-ninja" && /* @__PURE__ */ jsx("path", {
				d: "m2 0 .6 1.4L4 2l-1.4.6L2 4l-.6-1.4L0 2l1.4-.6z",
				fill: theme.highlight
			}),
			characterId === "swamp-frog-mage" && /* @__PURE__ */ jsxs("g", {
				fill: "none",
				stroke: theme.highlight,
				strokeWidth: "1",
				children: [/* @__PURE__ */ jsx("circle", {
					cx: "2",
					cy: "2",
					r: "1.6"
				}), /* @__PURE__ */ jsx("path", { d: "M2 0v1" })]
			}),
			characterId === "forge-raccoon-mage" && /* @__PURE__ */ jsx("path", {
				d: "M1 4V2h1V0h1v2h1v2H3v1H2V4z",
				fill: theme.highlight
			}),
			characterId === "time-owl-mage" && /* @__PURE__ */ jsx("path", {
				d: "M1 0h2v1h1v1H3v2H2V2H0V1h1z",
				fill: theme.highlight
			})
		]
	});
}
function PlayerMagicCloud({ characterId, speedProgress }) {
	const theme = MAGIC_CLOUD_THEMES[characterId];
	const trailCount = Math.ceil(speedProgress * CLOUD_SPEED_TRAIL_PARTICLES.length);
	return /* @__PURE__ */ jsxs("svg", {
		className: "pointer-events-none absolute left-1/2 top-[52px] z-0 h-7 w-[4.5rem] -translate-x-1/2",
		viewBox: "0 0 72 28",
		shapeRendering: "crispEdges",
		"aria-hidden": "true",
		"data-cloud-theme": characterId,
		"data-speed-trail-count": trailCount,
		style: { filter: `drop-shadow(0 0 ${7 + speedProgress * 4}px ${theme.glow})` },
		children: [
			/* @__PURE__ */ jsx("path", {
				d: "M9 25v-3H5v-4h3v-4h4v-4h5V7h7V4h8V1h8v3h7V2h7v3h6v4h5v4h4v4h3v5h-5v4H11v-1z",
				fill: theme.outline
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M13 22v-3H9v-2h4v-4h4V9h6V6h7V4h7v3h7V5h6v3h6v4h5v4h4v3h-4v3h-5v2H14v-2z",
				fill: theme.body
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M14 21h46v2h-5v2H17v-2h-3z",
				fill: theme.underside
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "19",
				y: "10",
				width: "10",
				height: "2",
				fill: theme.highlight
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "28",
				y: "7",
				width: "8",
				height: "2",
				fill: theme.highlight
			}),
			/* @__PURE__ */ jsx("rect", {
				x: "46",
				y: "8",
				width: "7",
				height: "2",
				fill: theme.highlight
			}),
			CLOUD_SPEED_TRAIL_PARTICLES.slice(0, trailCount).map((particle, index) => /* @__PURE__ */ jsx(PlayerMagicCloudSpeedParticle, {
				characterId,
				particle,
				theme,
				speedProgress
			}, `${characterId}-speed-trail-${index}`)),
			/* @__PURE__ */ jsx(PlayerMagicCloudDetails, { characterId })
		]
	});
}
function PlayerGameOverBurst({ characterId, x, y, id, onComplete }) {
	const theme = MAGIC_CLOUD_THEMES[characterId];
	return /* @__PURE__ */ jsx("div", {
		className: "pointer-events-none absolute z-0",
		style: {
			left: `${x / SKY_FLAP_CONFIG.width * 100}%`,
			top: `${y / SKY_FLAP_CONFIG.height * 100}%`,
			transform: "translate(-50%, -50%)"
		},
		children: /* @__PURE__ */ jsxs("svg", {
			className: "h-14 w-14 animate-ping",
			viewBox: "0 0 64 64",
			shapeRendering: "crispEdges",
			"aria-hidden": "true",
			"data-burst-theme": characterId,
			onAnimationEnd: () => onComplete(id),
			style: {
				filter: `drop-shadow(0 0 8px ${theme.glow})`,
				animationDuration: `${SKY_FLAP_CONFIG.gameOverBurstDurationMs}ms`,
				animationIterationCount: 1
			},
			children: [
				/* @__PURE__ */ jsx("path", {
					d: "M29 2h6v5h-6zM57 29h5v6h-5zM29 57h6v5h-6zM2 29h5v6H2z",
					fill: theme.highlight
				}),
				characterId === "white-fox-ice-mage" && /* @__PURE__ */ jsxs("g", {
					fill: "#c9f4ff",
					children: [/* @__PURE__ */ jsx("path", { d: "m17 12 6-10 6 14h-5v8h-4v-8zM39 40l5-10 5 13h-4v8h-4v-8zM9 34l4-7 4 9h-3v5h-3v-5z" }), /* @__PURE__ */ jsx("path", {
						d: "m45 12 2-5 3 6h-2v4h-2v-4z",
						fill: "#fff"
					})]
				}),
				characterId === "purple-rabbit-ninja" && /* @__PURE__ */ jsxs("g", {
					fill: "#d7c2ff",
					children: [/* @__PURE__ */ jsx("path", { d: "m13 14 7 3 7-5-3 8 5 7-9-2-5 7-1-9-8-4 9-1zM43 40l6 2 6-4-2 7 4 5-8-1-4 6-1-7-6-3 7-1z" }), /* @__PURE__ */ jsx("path", {
						d: "m40 11 2-5 2 5 5 2-5 2-2 5-2-5-5-2z",
						fill: "#f0e6ff"
					})]
				}),
				characterId === "swamp-frog-mage" && /* @__PURE__ */ jsxs("g", {
					fill: "#b8ec9a",
					children: [
						/* @__PURE__ */ jsx("path", { d: "M12 18h5v5h5v4h-5v-2h-5zM43 38h5v5h5v4h-5v-2h-5z" }),
						/* @__PURE__ */ jsx("circle", {
							cx: "46",
							cy: "16",
							r: "4",
							fill: "none",
							stroke: "#d7ffe2",
							strokeWidth: "2"
						}),
						/* @__PURE__ */ jsx("circle", {
							cx: "17",
							cy: "44",
							r: "3",
							fill: "none",
							stroke: "#d7ffe2",
							strokeWidth: "2"
						})
					]
				}),
				characterId === "forge-raccoon-mage" && /* @__PURE__ */ jsxs("g", {
					fill: "#ffac55",
					children: [/* @__PURE__ */ jsx("path", { d: "M15 24v-8h4v-8h4v9h4v8h-4v5h-8zM39 50v-8h4v-8h4v9h4v8h-4v5h-8z" }), /* @__PURE__ */ jsx("path", {
						d: "M45 17h4v4h-4zM12 43h4v4h-4zM53 27h4v4h-4z",
						fill: "#ffe295"
					})]
				}),
				characterId === "time-owl-mage" && /* @__PURE__ */ jsxs("g", {
					fill: "#d9ceff",
					stroke: "#f0eaff",
					strokeWidth: "1",
					children: [
						/* @__PURE__ */ jsx("circle", {
							cx: "47",
							cy: "17",
							r: "8",
							fill: "#7168b8"
						}),
						/* @__PURE__ */ jsx("path", {
							d: "M47 11v6l4 2M17 43h3v4h3v3h-3v-2h-3zM18 12h2v4h3v2h-3v4h-2v-4h-3v-2h3z",
							fill: "none"
						}),
						/* @__PURE__ */ jsx("path", {
							d: "M12 31h4v2h-4zM49 43h3v3h-3z",
							fill: "none"
						})
					]
				})
			]
		}, id)
	});
}
function SkyFlapScreen({ characterId: selectedCharacterId, playerName, primaryWalletId, onBack }) {
	const engineRef = useRef(null);
	if (!engineRef.current) engineRef.current = new SkyFlapEngine();
	const engine = engineRef.current;
	const { playSfx } = useArcadeAudio();
	const characterId = selectedCharacterId ?? "white-fox-ice-mage";
	const character = getCharacterById(characterId);
	const canvasRef = useRef(null);
	const playerRef = useRef(null);
	const playerSpriteRef = useRef(null);
	const [hud, setHud] = useState(() => ({
		phase: engine.phase,
		score: engine.score,
		bestScore: engine.bestScore,
		distance: engine.scrollDistance
	}));
	const [gameOverBurst, setGameOverBurst] = useState(null);
	const [matchId, setMatchId] = useState(() => createMatchId("sky-flap"));
	const previousPhaseRef = useRef(engine.phase);
	const previousScoreRef = useRef(engine.score);
	const audioMatchIdRef = useRef(matchId);
	const audioBestAtStartRef = useRef(0);
	const audioRecordPlayedRef = useRef(false);
	const audioSnapshotRef = useRef(null);
	const scoreEffectStartedAtRef = useRef(null);
	const entryStartedAtRef = useRef(null);
	const rewardReceipts = useMatchCurrencyRewards(matchId, hud.phase === "gameover" ? [{
		walletId: primaryWalletId,
		playerId: "player-1",
		playerName,
		amount: getSkyFlapCoinReward(hud.score)
	}] : [], primaryWalletId);
	const speedMultiplier = getScrollSpeedMultiplier(hud.score);
	const speedProgress = Math.min(1, (speedMultiplier - 1) / (SKY_FLAP_CONFIG.maxSpeedMultiplier - 1));
	useEffect(() => {
		engine.setBestScore(readBestScore$2());
		setHud({
			phase: engine.phase,
			score: engine.score,
			bestScore: engine.bestScore,
			distance: engine.scrollDistance
		});
	}, [engine]);
	useEffect(() => {
		audioMatchIdRef.current = matchId;
		audioBestAtStartRef.current = engine.bestScore;
		audioRecordPlayedRef.current = false;
		audioSnapshotRef.current = {
			phase: engine.phase,
			score: engine.score,
			bestScore: engine.bestScore
		};
	}, [engine, matchId]);
	useEffect(() => {
		const current = {
			phase: hud.phase,
			score: hud.score,
			bestScore: hud.bestScore
		};
		const previous = audioSnapshotRef.current;
		if (!previous || audioMatchIdRef.current !== matchId) {
			audioMatchIdRef.current = matchId;
			audioBestAtStartRef.current = current.bestScore;
			audioRecordPlayedRef.current = false;
			audioSnapshotRef.current = current;
			return;
		}
		if (previous.phase !== "playing" && current.phase === "playing") playSfx("game-start");
		if (current.phase === "playing" && current.bestScore > audioBestAtStartRef.current && !audioRecordPlayedRef.current) {
			audioRecordPlayedRef.current = true;
			playSfx("record");
		} else if (current.phase === "playing" && current.score > previous.score) playSfx("score");
		if (previous.phase === "playing" && current.phase === "gameover") playSfx("game-over");
		audioSnapshotRef.current = current;
	}, [
		hud.bestScore,
		hud.phase,
		hud.score,
		matchId,
		playSfx
	]);
	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		let frame = 0;
		let previous = performance.now();
		let lastHudKey = "";
		let savedBest = engine.bestScore;
		let submittedBest = savedBest;
		const loop = (now) => {
			const dt = Math.min(.05, Math.max(0, (now - previous) / 1e3));
			previous = now;
			engine.step(dt);
			const snapshot = engine.snapshot();
			if (entryStartedAtRef.current === null) entryStartedAtRef.current = now;
			const entryProgress = Math.min(1, (now - entryStartedAtRef.current) / SKY_FLAP_CONFIG.entryEffectDurationMs);
			if (snapshot.score > previousScoreRef.current) scoreEffectStartedAtRef.current = now;
			else if (snapshot.score < previousScoreRef.current) scoreEffectStartedAtRef.current = null;
			previousScoreRef.current = snapshot.score;
			if (snapshot.phase !== previousPhaseRef.current) {
				if (snapshot.phase === "gameover" && previousPhaseRef.current === "playing") setGameOverBurst({
					x: snapshot.playerX,
					y: snapshot.playerY,
					id: now
				});
				else if (snapshot.phase === "ready") setGameOverBurst(null);
				previousPhaseRef.current = snapshot.phase;
			}
			const scoreEffectStartedAt = scoreEffectStartedAtRef.current;
			const scoreProgress = scoreEffectStartedAt === null ? 1 : Math.min(1, (now - scoreEffectStartedAt) / SKY_FLAP_CONFIG.scoreEffectDurationMs);
			drawSkyFlap(ctx, snapshot, now / 1e3, {
				entryProgress,
				scoreProgress
			});
			const player = playerRef.current;
			if (player) {
				const angle = Math.max(-20, Math.min(34, snapshot.playerVelocityY * .045));
				const scale = .9 + entryProgress * .1;
				player.style.left = `${snapshot.playerX / SKY_FLAP_CONFIG.width * 100}%`;
				player.style.top = `${snapshot.playerY / SKY_FLAP_CONFIG.height * 100}%`;
				player.style.opacity = `${.65 + entryProgress * .35}`;
				player.style.transform = `translate(-50%, -50%) scale(${scale})`;
				if (playerSpriteRef.current) playerSpriteRef.current.style.transform = `rotate(${angle}deg)`;
			}
			const hudKey = `${snapshot.phase}|${snapshot.score}|${snapshot.bestScore}`;
			if (hudKey !== lastHudKey) {
				lastHudKey = hudKey;
				setHud({
					phase: snapshot.phase,
					score: snapshot.score,
					bestScore: snapshot.bestScore,
					distance: snapshot.scrollDistance
				});
			}
			if (snapshot.bestScore > savedBest) {
				savedBest = snapshot.bestScore;
				try {
					window.localStorage.setItem(BEST_SCORE_KEY$1, String(savedBest));
				} catch {}
			}
			if (snapshot.phase === "gameover" && snapshot.bestScore > submittedBest) {
				submittedBest = snapshot.bestScore;
				submitGlobalRecord("sky-flap", snapshot.bestScore);
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	}, [engine]);
	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.code !== "Space" || event.repeat) return;
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("button, input, textarea, select, [contenteditable='true']")) return;
			event.preventDefault();
			const wasPlaying = engine.phase === "playing";
			if (engine.flap() && wasPlaying) playSfx("flap");
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [engine, playSfx]);
	const handleCanvasPointerDown = (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		const wasPlaying = engine.phase === "playing";
		if (engine.flap() && wasPlaying) playSfx("flap");
	};
	const restart = () => {
		engine.reset();
		setMatchId(createMatchId("sky-flap"));
		const snapshot = engine.snapshot();
		entryStartedAtRef.current = performance.now();
		previousPhaseRef.current = snapshot.phase;
		previousScoreRef.current = snapshot.score;
		scoreEffectStartedAtRef.current = null;
		setGameOverBurst(null);
		setHud({
			phase: snapshot.phase,
			score: snapshot.score,
			bestScore: snapshot.bestScore,
			distance: snapshot.scrollDistance
		});
	};
	const completeGameOverBurst = (id) => {
		setGameOverBurst((current) => current?.id === id ? null : current);
	};
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6 sm:py-7",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, { density: "calm" }), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.55rem] text-arcade-violet",
						children: "MAGISTERIUM ARCADE"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl",
						children: "SKY FLAP"
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mt-1 font-game text-base text-muted-foreground sm:text-lg",
						children: ["VOANDO COM ", character?.shortName ?? "RAPOSA"]
					})
				] }), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "arcade",
					onClick: onBack,
					children: "VOLTAR À MODALIDADE"
				})]
			}), /* @__PURE__ */ jsxs("section", {
				className: "pixel-panel rounded-sm p-3 sm:p-5",
				"aria-label": "Minigame Sky Flap",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mb-3 flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ jsx("p", {
							className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-xs",
							children: "PORTAIS CELESTIAIS"
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/45 px-3 py-2 font-arcade text-[0.5rem] text-arcade-ink sm:text-[0.62rem]",
							"aria-live": "polite",
							"aria-label": `Pontos ${hud.score}, moedas ${getSkyFlapCoinReward(hud.score)}, melhor ${hud.bestScore}`,
							children: [
								/* @__PURE__ */ jsxs("span", { children: ["PONTOS: ", hud.score] }),
								/* @__PURE__ */ jsxs("span", {
									className: "text-arcade-gold",
									children: ["🪙 ", getSkyFlapCoinReward(hud.score)]
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "text-arcade-violet",
									children: ["MELHOR: ", hud.bestScore]
								})
							]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "relative aspect-video w-full overflow-hidden border-[3px] border-arcade-panel-border bg-arcade-sky-deep shadow-[0_8px_0_var(--color-arcade-shadow)]",
						children: [
							/* @__PURE__ */ jsx("canvas", {
								ref: canvasRef,
								width: SKY_FLAP_CONFIG.width,
								height: SKY_FLAP_CONFIG.height,
								className: "absolute inset-0 h-full w-full cursor-pointer touch-none [image-rendering:pixelated]",
								onPointerDown: handleCanvasPointerDown,
								role: "button",
								tabIndex: 0,
								"aria-label": "Sky Flap: pressione espaço ou clique para voar"
							}),
							/* @__PURE__ */ jsxs("div", {
								ref: playerRef,
								className: "pointer-events-none absolute z-10 h-16 w-16",
								style: {
									left: `${SKY_FLAP_CONFIG.playerX / SKY_FLAP_CONFIG.width * 100}%`,
									top: "50%",
									transform: "translate(-50%, -50%)"
								},
								"aria-hidden": "true",
								children: [hud.phase !== "gameover" && /* @__PURE__ */ jsx(PlayerMagicCloud, {
									characterId,
									speedProgress
								}), /* @__PURE__ */ jsxs("div", {
									ref: playerSpriteRef,
									className: "absolute inset-0 z-10 flex items-center justify-center",
									children: [/* @__PURE__ */ jsx("span", { className: "absolute h-11 w-11 bg-arcade-cyan/20 shadow-[0_0_20px_var(--color-arcade-cyan)]" }), /* @__PURE__ */ jsx(GameplaySprite, {
										characterId,
										animation: hud.phase === "gameover" ? "hurt" : "jump",
										size: 48,
										className: "relative drop-shadow-[0_0_7px_rgba(210,250,255,0.85)] [image-rendering:pixelated]"
									})]
								})]
							}),
							hud.phase === "ready" && /* @__PURE__ */ jsx("div", {
								className: "pointer-events-none absolute inset-0 flex items-center justify-center bg-arcade-ink/15 p-3",
								children: /* @__PURE__ */ jsxs("div", {
									className: "border-2 border-arcade-cloud bg-arcade-panel/95 px-4 py-3 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)] sm:px-7 sm:py-5",
									children: [/* @__PURE__ */ jsx("p", {
										className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-sm",
										children: "PRESSIONE ESPAÇO PARA VOAR"
									}), /* @__PURE__ */ jsx("p", {
										className: "mt-2 font-game text-base text-arcade-ink sm:text-xl",
										children: "ou clique para dar um impulso"
									})]
								})
							}),
							hud.phase === "gameover" && /* @__PURE__ */ jsxs("div", {
								className: "absolute inset-0 flex items-center justify-center bg-arcade-ink/65 p-3",
								children: [gameOverBurst && /* @__PURE__ */ jsx(PlayerGameOverBurst, {
									...gameOverBurst,
									characterId,
									onComplete: completeGameOverBurst
								}), /* @__PURE__ */ jsxs("div", {
									className: "pixel-panel relative z-10 w-full max-w-sm rounded-sm p-4 text-center sm:p-6",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-sm text-arcade-violet sm:text-lg",
											children: "GAME OVER"
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-4 font-arcade text-[0.6rem] text-arcade-ink sm:text-xs",
											children: ["PONTOS: ", hud.score]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-2 font-arcade text-[0.55rem] text-arcade-ink sm:text-xs",
											children: ["DISTÂNCIA: ", Math.floor(hud.distance).toLocaleString("pt-BR")]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-2 font-arcade text-[0.55rem] text-arcade-cyan sm:text-[0.65rem]",
											children: ["MELHOR: ", hud.bestScore]
										}),
										/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
										/* @__PURE__ */ jsx(Button, {
											type: "button",
											variant: "arcade",
											size: "arcade",
											className: "mt-5 w-full",
											onClick: restart,
											children: "JOGAR NOVAMENTE"
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 text-center font-game text-base text-muted-foreground sm:text-lg",
						children: "ESPAÇO ou CLIQUE = impulso para cima · mantenha o voo entre os portais"
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/features/spellbound/skyflap/SkyFlapModeSelectScreen.tsx
function SkyFlapModeSelectScreen({ onSolo, onMultiplayer, onBack }) {
	return /* @__PURE__ */ jsx(GameModeSelectorScreen, {
		gameId: "sky-flap",
		onSingleplayer: onSolo,
		onMultiplayer,
		onBack
	});
}
//#endregion
//#region src/features/spellbound/skyflap/bots.ts
var BOT_PROFILES$1 = {
	casual: {
		liftThreshold: 34,
		decisionInterval: .16,
		mistakeChance: .14
	},
	balanced: {
		liftThreshold: 27,
		decisionInterval: .12,
		mistakeChance: .07
	},
	skilled: {
		liftThreshold: 21,
		decisionInterval: .1,
		mistakeChance: .025
	}
};
/** Sky Flap-specific controller: gently regulates altitude toward the next portal's opening. */
var SkyFlapBot = class {
	difficulty;
	profile;
	nextDecisionIn = 0;
	randomState;
	constructor(difficulty, seed) {
		this.difficulty = difficulty;
		this.profile = BOT_PROFILES$1[difficulty];
		this.randomState = seed >>> 0 || 1;
	}
	update(core, player, obstacles, speedMultiplier, deltaSeconds) {
		if (player.phase !== "playing") return;
		this.nextDecisionIn -= deltaSeconds;
		if (this.nextDecisionIn > 0) return;
		this.nextDecisionIn = this.profile.decisionInterval;
		const next = obstacles.find((obstacle) => obstacle.x + SKY_FLAP_CONFIG.obstacleWidth >= player.playerX - SKY_FLAP_CONFIG.playerHitWidth / 2);
		if (!next) return;
		if (next.x - (player.playerX + SKY_FLAP_CONFIG.playerHitWidth / 2) < -SKY_FLAP_CONFIG.obstacleWidth) return;
		const liftThreshold = this.profile.liftThreshold - Math.min(8, (speedMultiplier - 1) * 20);
		if (!(player.playerY > next.gapCenter + liftThreshold && player.playerVelocityY > -65) || this.random() < this.profile.mistakeChance) return;
		core.flap(player);
	}
	random() {
		this.randomState = 1664525 * this.randomState + 1013904223 >>> 0;
		return this.randomState / 4294967296;
	}
};
var SKY_FLAP_PLAYER_CONTROLS = [
	"SPACE / CLIQUE",
	"ENTER",
	"W",
	"↑"
];
var RESULTS_DISPLAY_SECONDS$1 = 2.4;
var DECISION_DISPLAY_SECONDS$1 = 2.2;
function clamp$3(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
function emptyStepResult(speedMultiplier) {
	return {
		scoredPlayerIds: [],
		eliminatedPlayerIds: [],
		speedMultiplier
	};
}
/** One shared course/speed curve; each participant owns independent physics and elimination state. */
var SkyFlapMultiplayerEngine = class {
	core;
	players;
	phase = "countdown";
	winnerId = null;
	voteDecision = null;
	countdownElapsed = 0;
	goLabelRemaining = 0;
	nextEliminationOrder = 1;
	phaseElapsedSeconds = 0;
	botControllers;
	votes = /* @__PURE__ */ new Map();
	constructor(participants, seed) {
		if (participants.length < 2 || participants.length > 4) throw new RangeError(`Sky Flap Multiplayer aceita de 2 a 4 participantes.`);
		this.core = new SkyFlapCore(seed);
		const verticalSpacing = 40;
		this.players = participants.map((participant, index) => {
			return {
				...createSkyFlapPlayerState(participant.id, SKY_FLAP_CONFIG.height / 2 + (index - (participants.length - 1) / 2) * verticalSpacing),
				name: participant.name.trim() || `JOGADOR ${index + 1}`,
				characterId: participant.characterId,
				isBot: participant.isBot ?? false,
				eliminationOrder: null
			};
		});
		const botSeedBase = seed ?? Date.now() ^ 5370206;
		this.botControllers = new Map(participants.flatMap((participant, index) => participant.isBot ? [[participant.id, new SkyFlapBot(participant.botDifficulty ?? "balanced", botSeedBase + (index + 1) * 2654435769)]] : []));
	}
	get speedMultiplier() {
		return getScrollSpeedMultiplier(Math.max(0, ...this.players.map((player) => player.score)));
	}
	get countdownLabel() {
		if (this.phase === "countdown") return String(Math.max(1, 3 - Math.floor(this.countdownElapsed)));
		return this.phase === "playing" && this.goLabelRemaining > 0 ? "VAI!" : null;
	}
	get humanVoterCount() {
		return this.players.filter((player) => !player.isBot).length;
	}
	vote(playerId, choice) {
		if (this.phase !== "voting") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot) return false;
		this.votes.set(playerId, choice);
		if (this.votes.size >= this.humanVoterCount) this.resolveVote();
		return true;
	}
	flap(playerId) {
		if (this.phase !== "playing") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || player.phase !== "playing") return false;
		return this.core.flap(player);
	}
	step(deltaSeconds) {
		const dt = clamp$3(deltaSeconds, 0, .05);
		if (dt === 0) return emptyStepResult(this.speedMultiplier);
		if (this.phase === "countdown") {
			this.countdownElapsed += dt;
			if (this.countdownElapsed >= 3) {
				this.phase = "playing";
				this.core.startPlayers(this.players);
				this.goLabelRemaining = .55;
			}
			return emptyStepResult(this.speedMultiplier);
		}
		if (this.phase === "results") {
			this.phaseElapsedSeconds += dt;
			if (this.phaseElapsedSeconds >= RESULTS_DISPLAY_SECONDS$1) {
				this.phase = "voting";
				this.phaseElapsedSeconds = 0;
			}
			return emptyStepResult(this.speedMultiplier);
		}
		if (this.phase === "voting") {
			this.phaseElapsedSeconds += dt;
			if (this.phaseElapsedSeconds >= 10) this.resolveVote();
			return emptyStepResult(this.speedMultiplier);
		}
		if (this.phase === "decision") {
			this.phaseElapsedSeconds += dt;
			if (this.phaseElapsedSeconds >= DECISION_DISPLAY_SECONDS$1) this.phase = this.voteDecision === "change-game" ? "change-game" : "rematch";
			return emptyStepResult(this.speedMultiplier);
		}
		if (this.phase !== "playing") return emptyStepResult(this.speedMultiplier);
		this.goLabelRemaining = Math.max(0, this.goLabelRemaining - dt);
		const obstacles = this.core.snapshotObstacles();
		const speedMultiplier = this.speedMultiplier;
		for (const player of this.players) {
			if (!player.isBot || player.phase !== "playing") continue;
			this.botControllers.get(player.id)?.update(this.core, player, obstacles, speedMultiplier, dt);
		}
		const result = this.core.step(dt, this.players);
		for (const playerId of result.eliminatedPlayerIds) {
			const player = this.players.find((candidate) => candidate.id === playerId);
			if (player) player.eliminationOrder = this.nextEliminationOrder++;
		}
		const remainingPlayers = this.players.filter((player) => player.phase === "playing");
		if (remainingPlayers.length <= 1) {
			this.phase = "results";
			this.phaseElapsedSeconds = 0;
			this.winnerId = remainingPlayers[0]?.id ?? null;
		}
		result.speedMultiplier = this.speedMultiplier;
		return result;
	}
	snapshot() {
		const clone = (player) => ({ ...player });
		return {
			phase: this.phase,
			countdownLabel: this.countdownLabel,
			scrollDistance: this.core.scrollDistance,
			speedMultiplier: this.speedMultiplier,
			winnerId: this.winnerId,
			players: this.players.map(clone),
			ranking: this.rankedPlayers().map(clone),
			obstacles: this.core.snapshotObstacles(),
			votingSecondsRemaining: this.phase === "voting" ? Math.max(0, Math.ceil(10 - this.phaseElapsedSeconds)) : 0,
			decisionSecondsRemaining: this.phase === "decision" ? Math.max(0, DECISION_DISPLAY_SECONDS$1 - this.phaseElapsedSeconds) : 0,
			voteCounts: this.voteCounts(),
			votesByPlayer: Object.fromEntries(this.players.map((player) => [player.id, this.votes.get(player.id) ?? null])),
			humanVoterCount: this.humanVoterCount,
			voteDecision: this.voteDecision
		};
	}
	resolveVote() {
		if (this.phase !== "voting") return;
		const counts = this.voteCounts();
		const requiredVotes = this.humanVoterCount / 2;
		this.voteDecision = counts["change-game"] > requiredVotes ? "change-game" : "rematch";
		this.phase = "decision";
		this.phaseElapsedSeconds = 0;
	}
	voteCounts() {
		let rematch = 0;
		let changeGame = 0;
		for (const [playerId, choice] of this.votes) {
			const player = this.players.find((candidate) => candidate.id === playerId);
			if (!player || player.isBot) continue;
			if (choice === "rematch") rematch += 1;
			else changeGame += 1;
		}
		return {
			rematch,
			"change-game": changeGame
		};
	}
	rankedPlayers() {
		return [...this.players].sort((a, b) => {
			if (a.id === this.winnerId) return -1;
			if (b.id === this.winnerId) return 1;
			if (a.score !== b.score) return b.score - a.score;
			return (b.eliminationOrder ?? 0) - (a.eliminationOrder ?? 0);
		});
	}
};
//#endregion
//#region src/features/spellbound/skyflap/SkyFlapMultiplayerScreen.tsx
var PLAYER_KEYS$1 = [
	"Space",
	"Enter",
	"KeyW",
	"ArrowUp"
];
function makeInitialParticipants(selectedCharacterId, mode, playerName) {
	if (mode === "bots") return [
		{
			id: "player-1",
			name: playerName.trim() || "JOGADOR",
			characterId: selectedCharacterId ?? playableCharacterSeeds[0].id,
			isBot: false
		},
		{
			id: "bot-1",
			name: "BOT FÁCIL",
			characterId: playableCharacterSeeds[1].id,
			isBot: true,
			botDifficulty: "casual"
		},
		{
			id: "bot-2",
			name: "BOT MÉDIO",
			characterId: playableCharacterSeeds[2].id,
			isBot: true,
			botDifficulty: "balanced"
		},
		{
			id: "bot-3",
			name: "BOT HÁBIL",
			characterId: playableCharacterSeeds[3].id,
			isBot: true,
			botDifficulty: "skilled"
		}
	];
	return [{
		id: "player-1",
		name: playerName.trim() || "JOGADOR 1",
		characterId: selectedCharacterId ?? playableCharacterSeeds[0].id,
		isBot: false
	}, {
		id: "player-2",
		name: "JOGADOR 2",
		characterId: playableCharacterSeeds[1].id,
		isBot: false
	}];
}
function playerKeyLabel(index) {
	return SKY_FLAP_PLAYER_CONTROLS[index] ?? "";
}
function playerSnapshotForRender(player, snapshot) {
	return {
		phase: player.phase === "eliminated" ? "gameover" : player.phase,
		playerX: player.playerX,
		playerY: player.playerY,
		playerVelocityY: player.playerVelocityY,
		score: player.score,
		speedMultiplier: snapshot.speedMultiplier,
		bestScore: player.bestScore,
		scrollDistance: snapshot.scrollDistance,
		obstacles: snapshot.obstacles
	};
}
function PlayerSetupCard({ participant, index, onNameChange, onCharacterChange }) {
	return /* @__PURE__ */ jsxs("article", {
		className: "pixel-panel rounded-sm border-2 border-arcade-panel-border p-3 sm:p-4",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "mb-3 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "font-arcade text-[0.62rem] text-arcade-violet sm:text-xs",
					children: participant.isBot ? `BOT ${index}` : `JOGADOR ${index + 1}`
				}), /* @__PURE__ */ jsx("span", {
					className: "border border-arcade-cyan/70 bg-arcade-sky/45 px-2 py-1 font-arcade text-[0.48rem] text-arcade-ink sm:text-[0.55rem]",
					children: participant.isBot ? `IA · ${(participant.botDifficulty ?? "balanced").toUpperCase()}` : playerKeyLabel(index)
				})]
			}),
			/* @__PURE__ */ jsxs("label", {
				className: "block font-arcade text-[0.48rem] text-muted-foreground sm:text-[0.55rem]",
				children: ["NOME DO JOGADOR", /* @__PURE__ */ jsx("input", {
					type: "text",
					value: participant.name,
					maxLength: 18,
					autoComplete: "off",
					onChange: (event) => onNameChange(participant.id, event.target.value),
					className: "mt-2 w-full border-2 border-arcade-panel-border bg-arcade-sky/55 px-3 py-2 font-game text-lg text-arcade-ink outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan",
					"aria-label": `Nome do jogador ${index + 1}`
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mb-2 mt-4 font-arcade text-[0.48rem] text-muted-foreground sm:text-[0.55rem]",
				children: "ESCOLHA SEU PERSONAGEM"
			}),
			/* @__PURE__ */ jsx("div", {
				className: "grid grid-cols-5 gap-1.5",
				role: "group",
				"aria-label": `Personagem do jogador ${index + 1}`,
				children: playableCharacterSeeds.map((character) => {
					const selected = character.id === participant.characterId;
					return /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => onCharacterChange(participant.id, character.id),
						"aria-label": character.name,
						"aria-pressed": selected,
						className: `flex min-w-0 flex-col items-center gap-1 border-2 px-1 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan ${selected ? "border-arcade-cyan bg-arcade-sky/75" : "border-arcade-panel-border bg-arcade-panel/60 hover:bg-arcade-sky/50"}`,
						children: [/* @__PURE__ */ jsx("img", {
							src: character.sprite,
							alt: "",
							"aria-hidden": "true",
							width: 34,
							height: 34,
							className: "h-8 w-8 object-contain [image-rendering:pixelated]"
						}), /* @__PURE__ */ jsx("span", {
							className: "font-arcade text-[0.36rem] leading-tight text-arcade-ink sm:text-[0.43rem]",
							children: character.shortName
						})]
					}, character.id);
				})
			})
		]
	});
}
function PlayerHudRow({ player, index }) {
	const character = playableCharacterSeeds.find((entry) => entry.id === player.characterId);
	const eliminated = player.phase === "eliminated";
	const isLocalPlayer = player.id === "player-1" && !player.isBot;
	return /* @__PURE__ */ jsxs("div", {
		className: `grid grid-cols-[1.7rem_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-arcade-panel-border/50 px-2 py-1 last:border-0 ${isLocalPlayer ? "bg-arcade-cyan/20 ring-1 ring-inset ring-arcade-gold/80" : "opacity-75"} ${eliminated ? "opacity-55" : ""}`,
		"aria-label": `${player.name}, ${character?.shortName ?? "personagem"}, ${eliminated ? "eliminado" : `${player.score} pontos`}`,
		children: [
			/* @__PURE__ */ jsx("img", {
				src: character?.sprite,
				alt: "",
				"aria-hidden": "true",
				width: 28,
				height: 28,
				className: "h-7 w-7 object-contain [image-rendering:pixelated]"
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "min-w-0 truncate font-arcade text-[0.42rem] text-arcade-ink sm:text-[0.5rem]",
				children: [
					player.name.toLocaleUpperCase(),
					" ",
					/* @__PURE__ */ jsx("span", {
						className: "text-arcade-violet",
						children: player.isBot ? `BOT ${index}` : isLocalPlayer ? "VOCÊ" : `P${index + 1}`
					})
				]
			}),
			/* @__PURE__ */ jsx("span", {
				className: "whitespace-nowrap font-arcade text-[0.42rem] text-arcade-cyan sm:text-[0.5rem]",
				children: eliminated ? "ELIMINADO" : `${player.score} PTS · 🪙 ${getSkyFlapCoinReward(player.score)}`
			})
		]
	});
}
function SkyFlapMultiplayerScreen({ selectedCharacterId, primaryWalletId, playerName = "JOGADOR", mode = "local", onBack, onChangeGame }) {
	const { playSfx, setMusicIntensity } = useArcadeAudio();
	const [stage, setStage] = useState("setup");
	const [participants, setParticipants] = useState(() => makeInitialParticipants(selectedCharacterId, mode, playerName));
	const [snapshot, setSnapshot] = useState(null);
	const previousAudioSnapshotRef = useRef(null);
	const audioEndPlayedRef = useRef(false);
	const [matchId, setMatchId] = useState(() => createMatchId("sky-flap"));
	const submittedGlobalRecordRef = useRef(null);
	const [bursts, setBursts] = useState([]);
	const [isSpectating, setIsSpectating] = useState(false);
	const canvasRef = useRef(null);
	const playerElementsRef = useRef(/* @__PURE__ */ new Map());
	const spriteElementsRef = useRef(/* @__PURE__ */ new Map());
	const engineRef = useRef(null);
	const previousScoresRef = useRef({});
	const scoreEffectStartedAtRef = useRef({});
	const entryStartedAtRef = useRef(null);
	const matchIsFinal = snapshot !== null && [
		"results",
		"voting",
		"decision",
		"rematch",
		"change-game"
	].includes(snapshot.phase);
	const rewardReceipts = useMatchCurrencyRewards(matchId, snapshot?.players.flatMap((player) => {
		if (player.isBot || player.phase !== "eliminated" && !matchIsFinal) return [];
		const humanSlot = snapshot.players.filter((candidate) => !candidate.isBot).findIndex((c) => c.id === player.id);
		return [{
			walletId: humanSlot === 0 ? primaryWalletId : walletIdForLocalSlot(humanSlot),
			playerId: player.id,
			playerName: player.name,
			amount: getSkyFlapCoinReward(player.score)
		}];
	}) ?? [], primaryWalletId);
	useEffect(() => {
		if (!matchIsFinal || !snapshot) return;
		const primaryPlayer = snapshot.players.find((player) => player.id === "player-1" && !player.isBot);
		if (!primaryPlayer || primaryPlayer.score <= 0) return;
		const submissionKey = `${matchId}:${primaryPlayer.score}`;
		if (submittedGlobalRecordRef.current === submissionKey) return;
		submittedGlobalRecordRef.current = submissionKey;
		submitGlobalRecord("sky-flap", primaryPlayer.score);
	}, [
		matchId,
		matchIsFinal,
		snapshot
	]);
	useEffect(() => {
		if (!snapshot) return;
		const previous = previousAudioSnapshotRef.current;
		if (!previous) {
			if (snapshot.phase === "countdown") playSfx("countdown");
			previousAudioSnapshotRef.current = snapshot;
			return;
		}
		if (snapshot.phase === "countdown" && previous.phase === "countdown" && snapshot.countdownLabel !== previous.countdownLabel) playSfx("countdown");
		if (previous.phase === "countdown" && snapshot.phase === "playing") playSfx("game-start");
		for (const player of snapshot.players) {
			if (player.isBot) continue;
			const oldPlayer = previous.players.find((entry) => entry.id === player.id);
			if (!oldPlayer || player.score <= oldPlayer.score) continue;
			if (player.bestScore > oldPlayer.bestScore) playSfx("record");
			else playSfx("score");
		}
		const primary = snapshot.players.find((player) => player.id === "player-1" && !player.isBot);
		const oldPrimary = previous.players.find((player) => player.id === "player-1" && !player.isBot);
		if (!audioEndPlayedRef.current && primary?.phase === "eliminated" && oldPrimary?.phase !== "eliminated") {
			audioEndPlayedRef.current = true;
			playSfx("game-over");
		} else if (!audioEndPlayedRef.current && previous.phase === "playing" && snapshot.phase === "results" && primary) {
			audioEndPlayedRef.current = true;
			playSfx(snapshot.winnerId === primary.id ? "win" : "game-over");
		}
		previousAudioSnapshotRef.current = snapshot;
	}, [playSfx, snapshot]);
	const flapMusicIntensity = Math.min(1.16, .9 + Math.floor(Math.max(0, (snapshot?.speedMultiplier ?? 1) - 1) * 10) * .035);
	useEffect(() => {
		setMusicIntensity(flapMusicIntensity);
	}, [flapMusicIntensity, setMusicIntensity]);
	useEffect(() => () => setMusicIntensity(1), [setMusicIntensity]);
	const updateName = (id, name) => {
		setParticipants((current) => current.map((player) => player.id === id ? {
			...player,
			name
		} : player));
	};
	const updateCharacter = (id, characterId) => {
		setParticipants((current) => current.map((player) => player.id === id ? {
			...player,
			characterId
		} : player));
	};
	const addParticipant = () => {
		setParticipants((current) => {
			if (current.length >= 4) return current;
			const index = current.length;
			const character = playableCharacterSeeds[index % playableCharacterSeeds.length];
			const isBot = mode === "bots";
			const difficulty = index % 3 === 1 ? "casual" : index % 3 === 2 ? "balanced" : "skilled";
			return [...current, {
				id: isBot ? `bot-${index}` : `player-${index + 1}`,
				name: isBot ? `BOT ${difficulty.toUpperCase()}` : `JOGADOR ${index + 1}`,
				characterId: character.id,
				isBot,
				...isBot ? { botDifficulty: difficulty } : {}
			}];
		});
	};
	const removeParticipant = () => {
		setParticipants((current) => current.length <= 2 ? current : current.slice(0, -1));
	};
	const startMatch = () => {
		const engine = new SkyFlapMultiplayerEngine(participants.map((player, index) => ({
			id: player.id,
			name: player.name.trim() || `JOGADOR ${index + 1}`,
			characterId: player.characterId,
			isBot: player.isBot,
			...player.botDifficulty ? { botDifficulty: player.botDifficulty } : {}
		})));
		engineRef.current = engine;
		const firstSnapshot = engine.snapshot();
		previousScoresRef.current = Object.fromEntries(firstSnapshot.players.map((player) => [player.id, player.score]));
		scoreEffectStartedAtRef.current = {};
		entryStartedAtRef.current = null;
		setIsSpectating(false);
		previousAudioSnapshotRef.current = null;
		audioEndPlayedRef.current = false;
		setMatchId(createMatchId("sky-flap"));
		setSnapshot(firstSnapshot);
		setBursts([]);
		setStage("match");
	};
	const castVote = (playerId, choice) => {
		const engine = engineRef.current;
		if (engine?.vote(playerId, choice)) setSnapshot(engine.snapshot());
	};
	useEffect(() => {
		if (snapshot?.phase === "rematch") {
			engineRef.current = null;
			setSnapshot(null);
			setBursts([]);
			setIsSpectating(false);
			setStage("setup");
		} else if (snapshot?.phase === "change-game") onChangeGame();
	}, [onChangeGame, snapshot?.phase]);
	useEffect(() => {
		if (stage !== "match") return;
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context || !engineRef.current) return;
		let frame = 0;
		let previousTime = performance.now();
		let previousHudKey = "";
		const loop = (now) => {
			const activeEngine = engineRef.current;
			if (!activeEngine) return;
			const deltaSeconds = Math.min(.05, Math.max(0, (now - previousTime) / 1e3));
			previousTime = now;
			const events = activeEngine.step(deltaSeconds);
			const current = activeEngine.snapshot();
			if (current.phase === "playing" && entryStartedAtRef.current === null) entryStartedAtRef.current = now;
			const entryStartedAt = entryStartedAtRef.current;
			const entryProgress = entryStartedAt === null ? 1 : Math.min(1, (now - entryStartedAt) / SKY_FLAP_CONFIG.entryEffectDurationMs);
			for (const playerId of events.scoredPlayerIds) scoreEffectStartedAtRef.current[playerId] = now;
			if (events.eliminatedPlayerIds.length > 0) {
				const newBursts = events.eliminatedPlayerIds.flatMap((playerId, index) => {
					const player = current.players.find((candidate) => candidate.id === playerId);
					if (!player) return [];
					return [{
						playerId,
						characterId: player.characterId,
						x: player.playerX,
						y: player.playerY,
						id: now + index
					}];
				});
				setBursts((existing) => [...existing, ...newBursts]);
			}
			const worldSnapshot = {
				phase: current.phase === "playing" ? "playing" : current.phase === "countdown" ? "ready" : "gameover",
				speedMultiplier: current.speedMultiplier,
				scrollDistance: current.scrollDistance,
				obstacles: current.obstacles
			};
			drawSkyFlapWorld(context, worldSnapshot, now / 1e3);
			for (const player of current.players) {
				const element = playerElementsRef.current.get(player.id);
				if (element) {
					element.style.left = `${player.playerX / SKY_FLAP_CONFIG.width * 100}%`;
					element.style.top = `${player.playerY / SKY_FLAP_CONFIG.height * 100}%`;
					element.style.opacity = player.id === "player-1" ? "1" : "0.72";
				}
				const spriteElement = spriteElementsRef.current.get(player.id);
				if (spriteElement) {
					const angle = Math.max(-20, Math.min(34, player.playerVelocityY * .045));
					spriteElement.style.transform = `rotate(${angle}deg)`;
				}
				const scoreStartedAt = scoreEffectStartedAtRef.current[player.id];
				const scoreProgress = scoreStartedAt === void 0 ? 1 : Math.min(1, (now - scoreStartedAt) / SKY_FLAP_CONFIG.scoreEffectDurationMs);
				drawSkyFlapPlayerEffects(context, playerSnapshotForRender(player, current), now / 1e3, {
					entryProgress,
					scoreProgress
				});
			}
			const hudKey = [
				current.phase,
				current.countdownLabel,
				current.winnerId,
				current.speedMultiplier.toFixed(3),
				current.votingSecondsRemaining,
				current.decisionSecondsRemaining.toFixed(2),
				current.voteCounts.rematch,
				current.voteCounts["change-game"],
				current.voteDecision,
				...current.players.flatMap((player) => [
					player.id,
					player.name,
					player.phase,
					player.score,
					current.votesByPlayer[player.id]
				])
			].join("|");
			if (hudKey !== previousHudKey) {
				previousHudKey = hudKey;
				setSnapshot(current);
			}
			frame = window.requestAnimationFrame(loop);
		};
		frame = window.requestAnimationFrame(loop);
		return () => window.cancelAnimationFrame(frame);
	}, [stage]);
	useEffect(() => {
		if (stage !== "match") return;
		const handleKeyDown = (event) => {
			if (event.repeat) return;
			const index = PLAYER_KEYS$1.indexOf(event.code);
			if (index < 0) return;
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("button, input, textarea, select, [contenteditable='true']")) return;
			const engine = engineRef.current;
			if (!engine || engine.phase !== "playing") return;
			const playerId = `player-${index + 1}`;
			if (isSpectating && playerId === "player-1") return;
			event.preventDefault();
			if (engine.flap(playerId)) playSfx("flap");
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		isSpectating,
		playSfx,
		stage
	]);
	const handleCanvasPointerDown = (event) => {
		if (event.button !== 0 || isSpectating) return;
		event.preventDefault();
		if (engineRef.current?.flap("player-1")) playSfx("flap");
	};
	const removeBurst = (id) => {
		setBursts((current) => current.filter((burst) => burst.id !== id));
	};
	const localPlayer = snapshot?.players.find((player) => player.id === "player-1" && !player.isBot);
	const showEliminationChoice = snapshot?.phase === "playing" && localPlayer?.phase === "eliminated" && !isSpectating;
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6 sm:py-7",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, { density: "calm" }), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.55rem] text-arcade-violet",
						children: "MAGISTERIUM ARCADE"
					}),
					/* @__PURE__ */ jsxs("h1", {
						className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl",
						children: ["SKY FLAP ", /* @__PURE__ */ jsx("span", {
							className: "text-arcade-cyan",
							children: "MULTIPLAYER"
						})]
					}),
					stage === "match" && isSpectating && /* @__PURE__ */ jsx("span", {
						className: "mt-1 inline-block border border-arcade-cyan bg-arcade-panel/90 px-2 py-1 font-arcade text-[0.45rem] text-arcade-cyan",
						children: "MODO ESPECTADOR"
					})
				] }), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "arcade",
					onClick: onBack,
					children: "VOLTAR ÀS OPÇÕES"
				})]
			}), stage === "setup" ? /* @__PURE__ */ jsxs("section", {
				className: "pixel-panel rounded-sm p-4 sm:p-6",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mb-5 flex flex-wrap items-end justify-between gap-3",
						children: [/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsx("p", {
								className: "font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs",
								children: mode === "bots" ? "PARTIDA CONTRA BOTS · MESMO PERCURSO" : "PARTIDA LOCAL · MESMO PERCURSO"
							}),
							/* @__PURE__ */ jsx("h2", {
								className: "pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl",
								children: "PREPARE OS JOGADORES"
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-2 font-game text-base text-muted-foreground sm:text-lg",
								children: mode === "bots" ? "Cada bot tem personagem, estratégia de voo e estado próprios." : "Cada vaga tem física própria e controla somente seu personagem."
							})
						] }), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ jsx(Button, {
									type: "button",
									variant: "arcade",
									size: "arcade",
									onClick: removeParticipant,
									disabled: participants.length <= 2,
									"aria-label": "Remover o último jogador",
									children: "−"
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "min-w-24 text-center font-arcade text-[0.55rem] text-arcade-violet",
									children: [participants.length, " JOGADORES"]
								}),
								/* @__PURE__ */ jsx(Button, {
									type: "button",
									variant: "arcade",
									size: "arcade",
									onClick: addParticipant,
									disabled: participants.length >= 4,
									"aria-label": "Adicionar jogador",
									children: "+"
								})
							]
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "grid gap-3 lg:grid-cols-2",
						children: participants.map((participant, index) => /* @__PURE__ */ jsx(PlayerSetupCard, {
							participant,
							index,
							onNameChange: updateName,
							onCharacterChange: updateCharacter
						}, participant.id))
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5 flex flex-col items-center gap-3",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-center font-game text-base text-muted-foreground",
							children: mode === "bots" ? "VOCÊ: SPACE/CLIQUE · OS BOTS VOAM COM IA PRÓPRIA" : "CONTROLES: P1 Space/clique · P2 Enter · P3 W · P4 ↑"
						}), /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "arcade",
							size: "arcade",
							className: "w-full max-w-md",
							onClick: startMatch,
							children: "INICIAR PARTIDA"
						})]
					})
				]
			}) : /* @__PURE__ */ jsxs("section", {
				className: "pixel-panel rounded-sm p-3 sm:p-5",
				"aria-label": "Sky Flap Multiplayer",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mb-3 flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ jsxs("p", {
							className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-xs",
							children: [
								"PORTAIS CELESTIAIS · ",
								snapshot?.speedMultiplier.toFixed(2),
								"×"
							]
						}), /* @__PURE__ */ jsx("div", {
							className: "w-full max-w-64 border-2 border-arcade-panel-border bg-arcade-sky/65 sm:w-60",
							"aria-live": "polite",
							"aria-label": "Placar multiplayer",
							children: snapshot?.players.map((player, index) => /* @__PURE__ */ jsx(PlayerHudRow, {
								player,
								index
							}, player.id))
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "relative aspect-video w-full overflow-hidden border-[3px] border-arcade-panel-border bg-arcade-sky-deep shadow-[0_8px_0_var(--color-arcade-shadow)]",
						children: [
							/* @__PURE__ */ jsx("canvas", {
								ref: canvasRef,
								width: SKY_FLAP_CONFIG.width,
								height: SKY_FLAP_CONFIG.height,
								className: "absolute inset-0 h-full w-full cursor-pointer touch-none [image-rendering:pixelated]",
								onPointerDown: handleCanvasPointerDown,
								role: "button",
								tabIndex: 0,
								"aria-label": "Clique para impulsionar o jogador 1; os demais usam suas teclas de vaga"
							}),
							snapshot?.players.map((player, index) => {
								const isLocalPlayer = player.id === "player-1" && !player.isBot;
								if (player.phase === "eliminated" || isLocalPlayer && isSpectating) return null;
								return /* @__PURE__ */ jsxs("div", {
									ref: (element) => {
										if (element) playerElementsRef.current.set(player.id, element);
										else playerElementsRef.current.delete(player.id);
									},
									className: `pointer-events-none absolute h-16 w-16 ${isLocalPlayer ? "z-30" : "z-10"}`,
									style: {
										left: `${player.playerX / SKY_FLAP_CONFIG.width * 100}%`,
										top: `${player.playerY / SKY_FLAP_CONFIG.height * 100}%`,
										transform: "translate(-50%, -50%)",
										opacity: isLocalPlayer ? 1 : .72
									},
									"aria-hidden": "true",
									"data-player-id": player.id,
									"data-local-player": isLocalPlayer,
									children: [
										player.phase === "playing" && /* @__PURE__ */ jsx(PlayerMagicCloud, {
											characterId: player.characterId,
											speedProgress: Math.min(1, (snapshot.speedMultiplier - 1) / (SKY_FLAP_CONFIG.maxSpeedMultiplier - 1))
										}),
										isLocalPlayer && /* @__PURE__ */ jsx("span", {
											className: "absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap border-2 border-arcade-gold bg-arcade-ink px-2 py-1 font-arcade text-[0.48rem] text-arcade-gold shadow-[0_0_12px_var(--color-arcade-gold)] sm:text-[0.55rem]",
											children: "▼ VOCÊ"
										}),
										isLocalPlayer && /* @__PURE__ */ jsx("span", {
											className: "absolute -top-5 left-1/2 max-w-32 -translate-x-1/2 truncate border border-arcade-gold bg-arcade-panel/95 px-1.5 py-0.5 font-arcade text-[0.4rem] text-arcade-ink sm:text-[0.46rem]",
											children: player.name.toLocaleUpperCase()
										}),
										!isLocalPlayer && /* @__PURE__ */ jsx("span", {
											className: `absolute -top-4 whitespace-nowrap border border-arcade-panel-border bg-arcade-panel/90 px-1 py-0.5 font-arcade text-[0.4rem] text-arcade-violet ${index % 2 === 0 ? "left-0" : "right-0"}`,
											children: player.isBot ? `BOT ${index}` : `P${index + 1}`
										}),
										/* @__PURE__ */ jsxs("div", {
											ref: (element) => {
												if (element) spriteElementsRef.current.set(player.id, element);
												else spriteElementsRef.current.delete(player.id);
											},
											className: "absolute inset-0 z-10 flex items-center justify-center",
											children: [/* @__PURE__ */ jsx("span", { className: isLocalPlayer ? "absolute h-14 w-14 border-2 border-arcade-gold bg-arcade-cyan/25 shadow-[0_0_20px_var(--color-arcade-cyan)]" : "absolute h-9 w-9 bg-arcade-violet/10 shadow-[0_0_7px_var(--color-arcade-violet)]" }), /* @__PURE__ */ jsx(GameplaySprite, {
												characterId: player.characterId,
												animation: "jump",
												size: isLocalPlayer ? 42 : 34,
												className: `relative [image-rendering:pixelated] ${isLocalPlayer ? "" : "opacity-80"}`
											})]
										}),
										/* @__PURE__ */ jsxs("span", {
											className: "sr-only",
											children: [
												"Vaga ",
												index + 1,
												": ",
												player.name
											]
										})
									]
								}, player.id);
							}),
							bursts.map((burst) => /* @__PURE__ */ jsx(PlayerGameOverBurst, {
								...burst,
								onComplete: removeBurst
							}, `${burst.playerId}-${burst.id}`)),
							snapshot?.countdownLabel && /* @__PURE__ */ jsx("div", {
								className: "pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-arcade-ink/15",
								children: /* @__PURE__ */ jsx("div", {
									className: "pixel-panel min-w-36 px-7 py-5 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)]",
									children: /* @__PURE__ */ jsx("p", {
										className: "font-arcade text-3xl text-arcade-violet sm:text-5xl",
										children: snapshot.countdownLabel
									})
								})
							}),
							showEliminationChoice && /* @__PURE__ */ jsx("div", {
								className: "absolute inset-0 z-40 flex items-center justify-center bg-arcade-ink/75 p-3 sm:p-5",
								children: /* @__PURE__ */ jsxs("section", {
									className: "pixel-panel w-full max-w-md rounded-sm p-4 text-center shadow-[6px_6px_0_var(--color-arcade-shadow)] sm:p-6",
									role: "dialog",
									"aria-modal": "true",
									"aria-labelledby": "sky-flap-eliminated-title",
									children: [
										/* @__PURE__ */ jsx("h2", {
											id: "sky-flap-eliminated-title",
											className: "font-arcade text-sm text-arcade-violet sm:text-lg",
											children: "VOCÊ FOI ELIMINADO"
										}),
										/* @__PURE__ */ jsx("p", {
											className: "mt-3 font-game text-base text-muted-foreground",
											children: "O que você deseja fazer?"
										}),
										/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts.filter((receipt) => receipt.playerId === localPlayer?.id) }),
										/* @__PURE__ */ jsxs("div", {
											className: "mt-5 grid gap-3",
											children: [/* @__PURE__ */ jsx(Button, {
												type: "button",
												variant: "arcade",
												size: "arcade",
												onClick: onBack,
												children: "SAIR DA SALA"
											}), /* @__PURE__ */ jsx(Button, {
												type: "button",
												variant: "arcade",
												size: "arcade",
												onClick: () => setIsSpectating(true),
												children: "CONTINUAR COMO ESPECTADOR"
											})]
										})
									]
								})
							}),
							snapshot && (snapshot.phase === "results" || snapshot.phase === "voting" || snapshot.phase === "decision") && /* @__PURE__ */ jsx("div", {
								className: "absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-arcade-ink/80 p-3 sm:p-5",
								children: /* @__PURE__ */ jsxs("div", {
									className: "pixel-panel my-auto w-full max-w-xl rounded-sm p-4 text-center sm:p-6",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-sm text-arcade-violet sm:text-lg",
											children: "FLAPP SKY FINALIZADO!"
										}),
										snapshot.winnerId ? (() => {
											const winner = snapshot.players.find((player) => player.id === snapshot.winnerId);
											const character = playableCharacterSeeds.find((entry) => entry.id === winner.characterId);
											return /* @__PURE__ */ jsxs("div", {
												className: "mt-3 flex items-center justify-center gap-3",
												children: [/* @__PURE__ */ jsx("img", {
													src: character?.sprite,
													alt: "",
													"aria-hidden": "true",
													width: 48,
													height: 48,
													className: "h-12 w-12 object-contain [image-rendering:pixelated]"
												}), /* @__PURE__ */ jsxs("p", {
													className: "text-left font-arcade text-[0.6rem] leading-relaxed text-arcade-ink sm:text-xs",
													children: [
														"🏆 1º · ",
														winner.name.toLocaleUpperCase(),
														" · ",
														character?.shortName,
														/* @__PURE__ */ jsx("br", {}),
														/* @__PURE__ */ jsxs("span", {
															className: "text-arcade-cyan",
															children: [
																winner.score,
																" PONTOS · 🪙 ",
																getSkyFlapCoinReward(winner.score)
															]
														})
													]
												})]
											});
										})() : /* @__PURE__ */ jsx("p", {
											className: "mt-2 font-game text-base text-muted-foreground",
											children: "Todos foram eliminados. A classificação considera pontuação e ordem de sobrevivência."
										}),
										/* @__PURE__ */ jsx("h2", {
											className: "mt-5 font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs",
											children: "CLASSIFICAÇÃO FINAL"
										}),
										/* @__PURE__ */ jsx("ol", {
											className: "mt-2 space-y-1 text-left",
											children: snapshot.ranking.map((player, index) => {
												const character = playableCharacterSeeds.find((entry) => entry.id === player.characterId);
												return /* @__PURE__ */ jsxs("li", {
													className: "grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 border-b border-arcade-panel-border/50 py-1.5 text-left",
													children: [/* @__PURE__ */ jsxs("span", {
														className: "font-arcade text-[0.48rem] text-arcade-violet",
														children: [index + 1, "º"]
													}), /* @__PURE__ */ jsxs("span", {
														className: "min-w-0",
														children: [/* @__PURE__ */ jsxs("span", {
															className: "block truncate font-arcade text-[0.46rem] text-arcade-ink sm:text-[0.58rem]",
															children: [
																player.name.toLocaleUpperCase(),
																" — ",
																character?.shortName
															]
														}), /* @__PURE__ */ jsxs("span", {
															className: "block font-game text-sm text-muted-foreground",
															children: [
																player.id === snapshot.winnerId ? "VENCEDOR" : "ELIMINADO",
																" ·",
																" ",
																player.score,
																" PONTOS · 🪙 ",
																getSkyFlapCoinReward(player.score)
															]
														})]
													})]
												}, player.id);
											})
										}),
										/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
										snapshot.phase === "results" && /* @__PURE__ */ jsx("p", {
											className: "mt-4 font-game text-sm text-muted-foreground",
											children: "Resultado final registrado. A votação multiplayer será aberta em instantes."
										}),
										snapshot.phase === "voting" && /* @__PURE__ */ jsxs("section", {
											className: "mt-5 border-t-2 border-arcade-panel-border pt-4 text-left",
											children: [
												/* @__PURE__ */ jsxs("h2", {
													className: "text-center font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs",
													children: [
														"VOTAÇÃO MULTIPLAYER · ",
														snapshot.votingSecondsRemaining,
														"/",
														10,
														"s"
													]
												}),
												/* @__PURE__ */ jsxs("p", {
													className: "mt-2 text-center font-game text-sm text-muted-foreground",
													children: [
														"Votaram",
														" ",
														snapshot.voteCounts.rematch + snapshot.voteCounts["change-game"],
														" de",
														" ",
														snapshot.humanVoterCount,
														" humanos · empate ou timeout prioriza revanche."
													]
												}),
												/* @__PURE__ */ jsx("div", {
													className: "mt-3 max-h-48 space-y-2 overflow-y-auto pr-1",
													children: snapshot.players.filter((voter) => !voter.isBot).map((voter) => {
														const playerVote = snapshot.votesByPlayer[voter.id];
														return /* @__PURE__ */ jsxs("div", {
															className: "border border-arcade-panel-border bg-arcade-sky/35 p-2",
															children: [/* @__PURE__ */ jsxs("p", {
																className: "mb-2 truncate font-arcade text-[0.48rem] text-arcade-ink",
																children: [
																	voter.name.toLocaleUpperCase(),
																	voter.id === "player-1" ? " · VOCÊ" : "",
																	playerVote ? ` · VOTO: ${playerVote === "rematch" ? "REVANCHE" : "MUDAR DE JOGO"}` : " · AGUARDANDO"
																]
															}), /* @__PURE__ */ jsxs("div", {
																className: "grid gap-2 sm:grid-cols-2",
																children: [/* @__PURE__ */ jsx(Button, {
																	type: "button",
																	variant: "arcade",
																	size: "arcade",
																	"aria-pressed": playerVote === "rematch",
																	className: playerVote === "rematch" ? "ring-2 ring-arcade-gold" : "",
																	onClick: () => castVote(voter.id, "rematch"),
																	children: "REVANCHE"
																}), /* @__PURE__ */ jsx(Button, {
																	type: "button",
																	variant: "arcade",
																	size: "arcade",
																	"aria-pressed": playerVote === "change-game",
																	className: playerVote === "change-game" ? "ring-2 ring-arcade-gold" : "",
																	onClick: () => castVote(voter.id, "change-game"),
																	children: "MUDAR DE JOGO"
																})]
															})]
														}, voter.id);
													})
												})
											]
										}),
										snapshot.phase === "decision" && /* @__PURE__ */ jsxs("div", {
											className: "mt-5 border-t-2 border-arcade-panel-border pt-4",
											children: [/* @__PURE__ */ jsxs("p", {
												className: "font-arcade text-xs text-arcade-cyan",
												children: [
													"VOTAÇÃO ENCERRADA ·",
													" ",
													snapshot.voteDecision === "change-game" ? "MUDAR DE JOGO" : "REVANCHE"
												]
											}), /* @__PURE__ */ jsx("p", {
												className: "mt-2 font-game text-sm text-muted-foreground",
												children: snapshot.voteDecision === "change-game" ? "A maioria escolheu voltar à seleção de minigames." : "A revanche retorna à pré-partida com os mesmos participantes."
											})]
										})
									]
								})
							})
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 text-center font-game text-sm text-muted-foreground sm:text-base",
						children: "P1: SPACE/CLIQUE · P2: ENTER · P3: W · P4: ↑ · cada comando afeta apenas sua vaga"
					})
				]
			})]
		})]
	});
}
var SKY_RUN_CONFIG = {
	width: 960,
	height: 540,
	groundY: 430,
	playerX: 220,
	playerHitWidth: 28,
	playerSpriteWidth: 60,
	playerSpriteHeight: 60,
	multiplayerPlayerSpriteSize: 48,
	gravity: 1400,
	jumpImpulse: 470,
	maxFallSpeed: 700,
	baseRunSpeed: 270,
	distancePerPoint: 12,
	firstObstacleX: 650,
	minObstacleSpacing: 390,
	maxObstacleSpacing: 460,
	spawnAhead: 520,
	maxObstacles: 4,
	maxSpeedMultiplier: 1.18,
	speedMultiplierIncreasePerPoint: 3e-5,
	speedMultiplierIncreasePerCycle: .03,
	worldSegmentDistance: 10800,
	worldTransitionDurationSeconds: 2.2,
	jumpEffectDurationMs: 300,
	collisionEffectDurationMs: 520
};
var SKY_RUN_WORLD_NAMES = [
	"CÉU ENCANTADO",
	"FLORESTA ENCANTADA",
	"RUÍNAS MÁGICAS",
	"REINO DE GELO",
	"DIMENSÃO ARCANA",
	"MUNDO DOCE"
];
var SKY_RUN_MAP_COUNT = SKY_RUN_WORLD_NAMES.length;
var SKY_RUN_TOTAL_DISTANCE = SKY_RUN_CONFIG.worldSegmentDistance * SKY_RUN_MAP_COUNT;
//#endregion
//#region src/features/spellbound/skyrun/engine.ts
function clamp$2(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
/** Shared one-step jump integration used by gameplay and bot prediction. */
function stepSkyRunJump(jumpHeight, velocityY, dt) {
	const nextVelocityY = Math.max(-SKY_RUN_CONFIG.maxFallSpeed, velocityY - SKY_RUN_CONFIG.gravity * dt);
	const nextHeight = Math.max(0, jumpHeight + nextVelocityY * dt);
	const isGrounded = nextHeight === 0;
	return {
		jumpHeight: nextHeight,
		playerVelocityY: isGrounded ? 0 : nextVelocityY,
		isGrounded
	};
}
/** Predict the safe part of the real jump arc using the same integration as gameplay. */
function getSkyRunJumpClearanceWindow(requiredHeight, predictionStepSeconds = 1 / 120) {
	if (!Number.isFinite(requiredHeight) || requiredHeight < 0) return null;
	const step = clamp$2(predictionStepSeconds, 1 / 240, .05);
	let height = 0;
	let velocityY = SKY_RUN_CONFIG.jumpImpulse;
	let firstSafeSecond = null;
	let lastSafeSecond = 0;
	for (let index = 1; index <= 240; index++) {
		const next = stepSkyRunJump(height, velocityY, step);
		height = next.jumpHeight;
		velocityY = next.playerVelocityY;
		const elapsed = index * step;
		if (height >= requiredHeight) {
			firstSafeSecond ??= elapsed;
			lastSafeSecond = elapsed;
		}
		if (next.isGrounded) break;
	}
	if (firstSafeSecond === null || lastSafeSecond <= firstSafeSecond) return null;
	return {
		firstSafeSecond,
		lastSafeSecond
	};
}
/** Continuous pace curve: +3% per 1,000 points, capped at 1.18×. */
function getSkyRunSpeedMultiplier(score) {
	const points = Number.isFinite(score) ? Math.max(0, score) : 0;
	return Math.min(SKY_RUN_CONFIG.maxSpeedMultiplier, 1 + points * SKY_RUN_CONFIG.speedMultiplierIncreasePerPoint);
}
/** Solo pace grows smoothly by 3% per complete six-world cycle, within the shared speed cap. */
function getSkyRunSingleplayerSpeedMultiplier(distance) {
	const completedCycleProgress = (Number.isFinite(distance) ? Math.max(0, distance) : 0) / SKY_RUN_TOTAL_DISTANCE;
	return Math.min(SKY_RUN_CONFIG.maxSpeedMultiplier, 1 + completedCycleProgress * SKY_RUN_CONFIG.speedMultiplierIncreasePerCycle);
}
var SkyRunEngine = class {
	playerX;
	loopWorlds;
	phase = "ready";
	jumpHeight = 0;
	playerVelocityY = 0;
	isGrounded = true;
	score = 0;
	bestScore = 0;
	distance = 0;
	obstacles = [];
	coins = [];
	coinsCollected = 0;
	worldIndex = 0;
	transitionFromWorldIndex = null;
	worldTransitionProgress = 1;
	nextObstacleId = 1;
	nextCoinId = 1;
	randomState = 1;
	worldTransitionElapsedSeconds = 0;
	constructor(seed, playerX = SKY_RUN_CONFIG.playerX, options = {}) {
		this.playerX = playerX;
		this.loopWorlds = options.loopWorlds ?? false;
		this.reset(seed);
	}
	setBestScore(score) {
		this.bestScore = Math.max(this.bestScore, Math.floor(score) || 0);
	}
	/** Reset this mode without remounting the app or discarding its saved record. */
	reset(seed) {
		this.phase = "ready";
		this.jumpHeight = 0;
		this.playerVelocityY = 0;
		this.isGrounded = true;
		this.score = 0;
		this.distance = 0;
		this.obstacles = [];
		this.coins = [];
		this.coinsCollected = 0;
		this.worldIndex = 0;
		this.transitionFromWorldIndex = null;
		this.worldTransitionProgress = 1;
		this.worldTransitionElapsedSeconds = 0;
		this.nextObstacleId = 1;
		this.nextCoinId = 1;
		this.randomState = (seed ?? (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0) || 1;
	}
	/** First press starts the run; later presses jump only while grounded. */
	pressJump() {
		if (this.phase === "gameover") return "ignored";
		if (this.phase === "ready") {
			this.phase = "playing";
			return "started";
		}
		if (!this.isGrounded) return "ignored";
		this.isGrounded = false;
		this.playerVelocityY = SKY_RUN_CONFIG.jumpImpulse;
		return "jumped";
	}
	step(deltaSeconds) {
		if (this.phase !== "playing") return;
		const dt = clamp$2(deltaSeconds, 0, .05);
		if (dt === 0) return;
		const speed = SKY_RUN_CONFIG.baseRunSpeed * this.currentSpeedMultiplier();
		this.distance += speed * dt;
		this.score = Math.floor(this.distance / SKY_RUN_CONFIG.distancePerPoint);
		this.bestScore = Math.max(this.bestScore, this.score);
		const absoluteWorldIndex = Math.floor(this.distance / SKY_RUN_CONFIG.worldSegmentDistance);
		const nextWorldIndex = this.loopWorlds ? absoluteWorldIndex % SKY_RUN_WORLD_NAMES.length : Math.min(SKY_RUN_WORLD_NAMES.length - 1, absoluteWorldIndex);
		if (nextWorldIndex !== this.worldIndex) {
			this.transitionFromWorldIndex = this.worldIndex;
			this.worldIndex = nextWorldIndex;
			this.worldTransitionElapsedSeconds = 0;
			this.worldTransitionProgress = 0;
		}
		if (this.transitionFromWorldIndex !== null) {
			this.worldTransitionElapsedSeconds = Math.min(SKY_RUN_CONFIG.worldTransitionDurationSeconds, this.worldTransitionElapsedSeconds + dt);
			this.worldTransitionProgress = this.worldTransitionElapsedSeconds / SKY_RUN_CONFIG.worldTransitionDurationSeconds;
			if (this.worldTransitionProgress >= 1) {
				this.transitionFromWorldIndex = null;
				this.worldTransitionProgress = 1;
			}
		}
		if (!this.isGrounded) {
			const jump = stepSkyRunJump(this.jumpHeight, this.playerVelocityY, dt);
			this.jumpHeight = jump.jumpHeight;
			this.playerVelocityY = jump.playerVelocityY;
			this.isGrounded = jump.isGrounded;
		}
		for (const obstacle of this.obstacles) obstacle.x -= speed * dt;
		for (const coin of this.coins) coin.x -= speed * dt;
		const playerLeft = this.playerX - SKY_RUN_CONFIG.playerHitWidth / 2;
		const playerRight = this.playerX + SKY_RUN_CONFIG.playerHitWidth / 2;
		const playerCenterY = SKY_RUN_CONFIG.groundY - this.jumpHeight - SKY_RUN_CONFIG.playerSpriteHeight / 2;
		this.coins = this.coins.filter((coin) => {
			const overlapsPlayer = coin.x + 11 >= playerLeft && coin.x - 11 <= playerRight && Math.abs(coin.y - playerCenterY) <= SKY_RUN_CONFIG.playerSpriteHeight * .36 + 11;
			if (overlapsPlayer) this.coinsCollected += 1;
			return !overlapsPlayer && coin.x >= -11;
		});
		for (const obstacle of this.obstacles) {
			if (obstacle.objectType !== "GROUND_OBSTACLE") continue;
			const overlapsHorizontally = playerRight > obstacle.x && playerLeft < obstacle.x + obstacle.width;
			const playerFeetY = SKY_RUN_CONFIG.groundY - this.jumpHeight;
			const obstacleTopY = obstacle.surfaceY - obstacle.height;
			if (overlapsHorizontally && playerFeetY > obstacleTopY && playerFeetY <= obstacle.surfaceY) {
				this.phase = "gameover";
				return;
			}
		}
		this.obstacles = this.obstacles.filter((obstacle) => obstacle.x + obstacle.width >= 0);
		this.ensureObstaclesAhead();
	}
	snapshot() {
		return {
			phase: this.phase,
			jumpHeight: this.jumpHeight,
			playerVelocityY: this.playerVelocityY,
			isGrounded: this.isGrounded,
			score: this.score,
			bestScore: this.bestScore,
			distance: this.distance,
			speedMultiplier: this.currentSpeedMultiplier(),
			worldIndex: this.worldIndex,
			transitionFromWorldIndex: this.transitionFromWorldIndex,
			worldTransitionProgress: this.worldTransitionProgress,
			obstacles: this.obstacles.map((obstacle) => ({ ...obstacle })),
			coins: this.coins.map((coin) => ({ ...coin })),
			coinsCollected: this.coinsCollected
		};
	}
	currentSpeedMultiplier() {
		return this.loopWorlds ? getSkyRunSingleplayerSpeedMultiplier(this.distance) : getSkyRunSpeedMultiplier(this.distance / SKY_RUN_CONFIG.distancePerPoint);
	}
	makeObstacle(x) {
		const roll = this.random();
		const candyKinds = [
			"lollipop",
			"chocolate-bar",
			"cookie-block",
			"sugar-crystal",
			"marshmallow-stack",
			"cupcake"
		];
		const kind = this.worldIndex === 5 ? candyKinds[Math.floor(roll * candyKinds.length)] ?? "cookie-block" : roll < .38 ? "crystal" : roll < .72 ? "rune-pillar" : "cloud-stone";
		const heights = this.worldIndex === 5 ? [
			32,
			38,
			44,
			48
		] : [
			24,
			32,
			40,
			48
		];
		const height = heights[Math.floor(this.random() * heights.length)] ?? 24;
		const width = kind === "crystal" || kind === "sugar-crystal" ? 30 + Math.round(this.random() * 8) : kind === "chocolate-bar" || kind === "cupcake" ? 42 + Math.round(this.random() * 10) : 34 + Math.round(this.random() * 8);
		return {
			id: this.nextObstacleId++,
			x,
			width,
			height,
			kind,
			objectType: "GROUND_OBSTACLE",
			surfaceY: SKY_RUN_CONFIG.groundY,
			worldIndex: this.worldIndex
		};
	}
	ensureObstaclesAhead() {
		let last = this.obstacles.at(-1);
		if (!last && this.obstacles.length < SKY_RUN_CONFIG.maxObstacles) {
			last = this.makeObstacle(SKY_RUN_CONFIG.firstObstacleX);
			this.obstacles.push(last);
		}
		while (last && last.x < SKY_RUN_CONFIG.width + SKY_RUN_CONFIG.spawnAhead && this.obstacles.length < SKY_RUN_CONFIG.maxObstacles) {
			const gap = SKY_RUN_CONFIG.minObstacleSpacing + this.random() * (SKY_RUN_CONFIG.maxObstacleSpacing - SKY_RUN_CONFIG.minObstacleSpacing);
			const previous = last;
			const next = this.makeObstacle(previous.x + gap);
			const freeGap = next.x - (previous.x + previous.width);
			if (freeGap > 24) this.coins.push({
				id: this.nextCoinId++,
				x: previous.x + previous.width + freeGap / 2,
				y: SKY_RUN_CONFIG.groundY - SKY_RUN_CONFIG.playerSpriteHeight / 2
			});
			last = next;
			this.obstacles.push(next);
		}
	}
	random() {
		this.randomState = 1664525 * this.randomState + 1013904223 >>> 0;
		return this.randomState / 4294967296;
	}
};
//#endregion
//#region src/features/spellbound/skyrun/render.ts
var STAR_COUNT = 42;
var FOREST_PARTICLE_COUNT = 20;
var RUINS_PARTICLE_COUNT = 18;
var SNOWFLAKE_COUNT = 26;
var ARCANE_PARTICLE_COUNT = 22;
var CANDY_PARTICLE_COUNT = 14;
var SPEED_LINE_COUNT = 8;
var RUN_TRAIL_COUNT = 4;
var BURST_PARTICLE_COUNT = 6;
var BURST_DIRECTIONS = [
	0,
	1,
	2,
	3,
	4,
	5
];
var SKY_PALETTE = {
	skyTop: "#172454",
	skyMiddle: "#344e9b",
	skyHorizon: "#5eb8df",
	skyGlow: "#aeefff",
	ground: "#272b66",
	groundTop: "#7466be",
	groundLine: "#b9f5ff",
	groundTile: "#a7a1ed",
	groundAccent: "#94deec",
	obstacleOutline: "#15172f",
	obstacleMain: "#5a4ba5",
	obstacleDark: "#302c70",
	obstacleLight: "#c9f8ff",
	obstacleAccent: "#7ce4f2"
};
var BIOME_PALETTES = [
	SKY_PALETTE,
	{
		skyTop: "#102f3a",
		skyMiddle: "#215c57",
		skyHorizon: "#79bb94",
		skyGlow: "#c2e9bd",
		ground: "#183d37",
		groundTop: "#4e8e67",
		groundLine: "#c7f3b1",
		groundTile: "#78d48d",
		groundAccent: "#b694e5",
		obstacleOutline: "#102827",
		obstacleMain: "#4a3d68",
		obstacleDark: "#243448",
		obstacleLight: "#a0f28f",
		obstacleAccent: "#dfb7ff"
	},
	{
		skyTop: "#191a3e",
		skyMiddle: "#36315f",
		skyHorizon: "#776c91",
		skyGlow: "#c1a77b",
		ground: "#292746",
		groundTop: "#655c80",
		groundLine: "#ead193",
		groundTile: "#bda46d",
		groundAccent: "#79dce9",
		obstacleOutline: "#111326",
		obstacleMain: "#55506c",
		obstacleDark: "#343149",
		obstacleLight: "#f0cd7e",
		obstacleAccent: "#83eaf1"
	},
	{
		skyTop: "#b8edff",
		skyMiddle: "#91cceb",
		skyHorizon: "#d8f4ff",
		skyGlow: "#f4fdff",
		ground: "#274d78",
		groundTop: "#5a91c0",
		groundLine: "#f4ffff",
		groundTile: "#c3f2ff",
		groundAccent: "#83dff1",
		obstacleOutline: "#173150",
		obstacleMain: "#3c7eaa",
		obstacleDark: "#235271",
		obstacleLight: "#f2ffff",
		obstacleAccent: "#8ceeff"
	},
	{
		skyTop: "#1b123b",
		skyMiddle: "#38236c",
		skyHorizon: "#62519b",
		skyGlow: "#9b87c7",
		ground: "#281d50",
		groundTop: "#583e91",
		groundLine: "#c8b7ff",
		groundTile: "#9a85da",
		groundAccent: "#70e6ed",
		obstacleOutline: "#eee5ff",
		obstacleMain: "#60418e",
		obstacleDark: "#38275f",
		obstacleLight: "#f1eaff",
		obstacleAccent: "#72f1ed"
	},
	{
		skyTop: "#8c78c8",
		skyMiddle: "#e9a6cf",
		skyHorizon: "#a7e6ed",
		skyGlow: "#fff0cf",
		ground: "#644351",
		groundTop: "#d98aad",
		groundLine: "#fff7dc",
		groundTile: "#ffe6a2",
		groundAccent: "#8ce3e5",
		obstacleOutline: "#39283d",
		obstacleMain: "#d65a7a",
		obstacleDark: "#794258",
		obstacleLight: "#fff2d4",
		obstacleAccent: "#86dfe3"
	}
];
var CHARACTER_FX = {
	"white-fox-ice-mage": {
		main: "#76dfff",
		light: "#e5fbff"
	},
	"purple-rabbit-ninja": {
		main: "#a888ed",
		light: "#e2d2ff"
	},
	"swamp-frog-mage": {
		main: "#58bd7b",
		light: "#c8f0a8"
	},
	"forge-raccoon-mage": {
		main: "#e66c43",
		light: "#ffc16d"
	},
	"time-owl-mage": {
		main: "#8275d2",
		light: "#e0d9ff"
	},
	"calm-capybara-mage": {
		main: "#83c9aa",
		light: "#d9f7e9"
	},
	"axolotl-mage": {
		main: "#e878b7",
		light: "#ffe1f3"
	}
};
function wrap(value, span) {
	return (value % span + span) % span;
}
var GROUND_SURFACE = {
	objectType: "DECORATION",
	kind: "ground",
	y: SKY_RUN_CONFIG.groundY
};
function topFromSurface(surface, height) {
	return surface.y - height;
}
function paletteFor(worldIndex) {
	return BIOME_PALETTES[Math.max(0, Math.min(BIOME_PALETTES.length - 1, worldIndex))] ?? SKY_PALETTE;
}
function drawGradientSky(ctx, palette) {
	const gradient = ctx.createLinearGradient(0, 0, 0, SKY_RUN_CONFIG.groundY);
	gradient.addColorStop(0, palette.skyTop);
	gradient.addColorStop(.48, palette.skyMiddle);
	gradient.addColorStop(.84, palette.skyHorizon);
	gradient.addColorStop(1, palette.skyGlow);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, SKY_RUN_CONFIG.width, SKY_RUN_CONFIG.height);
}
function drawStarField(ctx, snapshot, time, worldIndex) {
	const layerAlpha = ctx.globalAlpha;
	ctx.save();
	for (let i = 0; i < STAR_COUNT; i++) {
		const depth = i % 5 === 0 ? .16 : .045;
		const drift = worldIndex === 1 ? .6 : 1;
		const x = wrap(i * 191 + 17 - snapshot.distance * depth * drift, SKY_RUN_CONFIG.width);
		const y = (i * 89 + 23) % (SKY_RUN_CONFIG.groundY - 36);
		const size = i % 8 === 0 ? 3 : 2;
		ctx.globalAlpha = layerAlpha * (.3 + (Math.sin(time * 2.1 + i * 1.6) + 1) / 2 * .42);
		ctx.fillStyle = i % 4 === 0 ? "#d6caff" : "#e9fbff";
		ctx.fillRect(Math.round(x), y, size, size);
		if (size === 3 && i % 2 === 0) {
			ctx.fillRect(Math.round(x) + 1, y - 2, 1, 7);
			ctx.fillRect(Math.round(x) - 2, y + 1, 7, 1);
		}
	}
	ctx.restore();
}
function drawPixelCloud(ctx, x, y, scale) {
	const cloudAnchor = {
		objectType: "DECORATION",
		kind: "air",
		y
	};
	const u = 6 * scale;
	ctx.fillStyle = "rgba(220, 248, 255, 0.28)";
	ctx.fillRect(x + u, cloudAnchor.y + u, u * 7, u * 2);
	ctx.fillRect(x + u * 2, cloudAnchor.y, u * 3, u * 3);
	ctx.fillRect(x + u * 5, cloudAnchor.y + u / 2, u * 2, u * 2);
	ctx.fillStyle = "rgba(247, 254, 255, 0.58)";
	ctx.fillRect(x + u * 2, y + u, u * 3, u);
	ctx.fillRect(x + u * 5, y + u, u, u / 2);
}
function drawIsland(ctx, x, y, scale) {
	const u = 6 * scale;
	const islandTop = topFromSurface({
		objectType: "DECORATION",
		kind: "floating",
		y: y + u * 7
	}, u * 7);
	ctx.fillStyle = "#83e8d0";
	ctx.fillRect(x + u * 2, islandTop, u * 12, u * 2);
	ctx.fillStyle = "#6b5cb3";
	ctx.fillRect(x, islandTop + u * 2, u * 16, u * 2);
	ctx.fillStyle = "#35346f";
	ctx.fillRect(x + u * 2, islandTop + u * 4, u * 12, u * 2);
	ctx.fillRect(x + u * 4, islandTop + u * 6, u * 8, u);
	ctx.fillStyle = "rgba(220, 251, 255, 0.72)";
	ctx.fillRect(x + u * 4, islandTop + u * 2, u * 3, u / 2);
}
function drawEnchantedSky(ctx, snapshot, time) {
	drawGradientSky(ctx, paletteFor(0));
	drawStarField(ctx, snapshot, time, 0);
	const cloud1X = wrap(88 - snapshot.distance * .1, SKY_RUN_CONFIG.width + 170) - 85;
	const cloud2X = wrap(520 - snapshot.distance * .075, SKY_RUN_CONFIG.width + 160) - 80;
	const cloud3X = wrap(990 - snapshot.distance * .11, SKY_RUN_CONFIG.width + 180) - 90;
	drawPixelCloud(ctx, cloud1X, 108, 1.05);
	drawPixelCloud(ctx, cloud2X, 228, .72);
	drawPixelCloud(ctx, cloud3X, 72, .88);
	const island1X = wrap(175 - snapshot.distance * .22, SKY_RUN_CONFIG.width + 210) - 105;
	const island2X = wrap(705 - snapshot.distance * .17, SKY_RUN_CONFIG.width + 210) - 105;
	drawIsland(ctx, island1X, 348, .75);
	drawIsland(ctx, island2X, 386, .56);
	ctx.fillStyle = "#91eafa";
	ctx.fillRect(wrap(365 - snapshot.distance * .12, SKY_RUN_CONFIG.width), 184, 4, 9);
	ctx.fillRect(wrap(366 - snapshot.distance * .12, SKY_RUN_CONFIG.width), 181, 2, 3);
	ctx.fillStyle = "#c9b9ff";
	ctx.fillRect(wrap(836 - snapshot.distance * .09, SKY_RUN_CONFIG.width), 282, 5, 8);
}
function drawForest(ctx, snapshot, time) {
	drawGradientSky(ctx, paletteFor(1));
	for (let i = 0; i < 6; i++) {
		const x = wrap(i * 190 + 35 - snapshot.distance * .12, SKY_RUN_CONFIG.width + 150) - 75;
		const baseY = GROUND_SURFACE.y + 10;
		const topY = 90 + i % 3 * 34;
		const crownColor = i % 2 === 0 ? "#174342" : "#1b4b47";
		ctx.fillStyle = "#173a3b";
		ctx.fillRect(x + 19, topY + 35, 18, baseY - topY - 35);
		ctx.fillStyle = crownColor;
		ctx.fillRect(x + 6, topY + 30, 45, 48);
		ctx.fillRect(x, topY + 52, 59, 39);
		ctx.fillRect(x + 15, topY + 9, 29, 34);
		ctx.fillStyle = "#28634f";
		ctx.fillRect(x + 13, topY + 39, 13, 8);
		ctx.fillRect(x + 35, topY + 60, 15, 8);
		ctx.fillStyle = "#6cc48b";
		ctx.fillRect(x + 24, topY + 18, 5, 4);
		ctx.fillRect(x + 7, topY + 61, 4, 3);
	}
	const layerAlpha = ctx.globalAlpha;
	ctx.save();
	for (let i = 0; i < FOREST_PARTICLE_COUNT; i++) {
		const x = wrap(i * 73 + 24 - snapshot.distance * .2 + time * (9 + i % 4 * 3), SKY_RUN_CONFIG.width);
		const y = (i * 61 + 42 + Math.round(Math.sin(time * 1.4 + i) * 8)) % (SKY_RUN_CONFIG.groundY - 80);
		ctx.globalAlpha = layerAlpha * (.32 + i % 4 * .12);
		ctx.fillStyle = i % 3 === 0 ? "#d2b8ff" : i % 3 === 1 ? "#b4f098" : "#77e4c9";
		ctx.fillRect(Math.round(x), y, i % 5 === 0 ? 4 : 2, 3);
		if (i % 5 === 0) ctx.fillRect(Math.round(x) + 1, y - 2, 2, 7);
	}
	ctx.restore();
	for (let i = 0; i < 4; i++) {
		const x = wrap(105 + i * 275 - snapshot.distance * .15, SKY_RUN_CONFIG.width + 100) - 50;
		const stemHeight = 17 + i % 2 * 2;
		const capHeight = 9 + i % 3;
		const capY = topFromSurface(GROUND_SURFACE, stemHeight + capHeight - 2);
		const stemY = capY + capHeight - 2;
		ctx.fillStyle = "#263a46";
		ctx.fillRect(x + 11, stemY, 8, GROUND_SURFACE.y - stemY);
		ctx.fillStyle = i % 2 === 0 ? "#a47bd0" : "#db8cdb";
		ctx.fillRect(x + 1, capY + 4, 28, capHeight - 2);
		ctx.fillRect(x + 5, capY, 20, 7);
		ctx.fillStyle = "#c7ffad";
		ctx.fillRect(x + 8, capY + 5, 4, 3);
		ctx.fillRect(x + 19, capY + 3, 3, 2);
		ctx.fillStyle = "#536b58";
		ctx.fillRect(x + 7, GROUND_SURFACE.y - 1, 17, 1);
	}
	ctx.save();
	ctx.globalAlpha *= .09;
	ctx.fillStyle = "#d7f4d1";
	const fogOffset = wrap(snapshot.distance * .04, SKY_RUN_CONFIG.width);
	ctx.fillRect(-fogOffset, 333, SKY_RUN_CONFIG.width, 29);
	ctx.fillRect(SKY_RUN_CONFIG.width - fogOffset, 355, SKY_RUN_CONFIG.width, 22);
	ctx.restore();
}
function drawRuins(ctx, snapshot, time) {
	drawGradientSky(ctx, paletteFor(2));
	drawStarField(ctx, snapshot, time, 2);
	const ruinsPlatform = {
		objectType: "DECORATION",
		kind: "platform",
		y: GROUND_SURFACE.y - 137
	};
	const platformThickness = 28;
	ctx.fillStyle = "#292845";
	ctx.fillRect(0, ruinsPlatform.y, SKY_RUN_CONFIG.width, platformThickness);
	for (let i = 0; i < 6; i++) {
		const x = wrap(i * 190 + 100 - snapshot.distance * .11, SKY_RUN_CONFIG.width + 170) - 85;
		ctx.fillStyle = "#292845";
		ctx.fillRect(x + 21, ruinsPlatform.y + platformThickness, 14, GROUND_SURFACE.y - (ruinsPlatform.y + platformThickness));
		ctx.fillStyle = "#655c80";
		ctx.fillRect(x + 24, ruinsPlatform.y + platformThickness, 4, GROUND_SURFACE.y - ruinsPlatform.y - platformThickness);
		ctx.fillRect(x + 15, GROUND_SURFACE.y - 5, 26, 5);
	}
	ctx.fillStyle = "#393653";
	for (let i = 0; i < 5; i++) {
		const x = wrap(i * 225 + 35 - snapshot.distance * .11, SKY_RUN_CONFIG.width + 170) - 85;
		const height = 148 - i % 3 * 42;
		const top = topFromSurface(ruinsPlatform, height);
		ctx.fillRect(x + 10, top + 12, 38, height);
		ctx.fillRect(x + 3, top + 4, 52, 13);
		ctx.fillRect(x, top, 58, 8);
		ctx.fillStyle = i % 2 === 0 ? "#a98a61" : "#7b7190";
		ctx.fillRect(x + 15, top + 25, 4, 15);
		ctx.fillRect(x + 32, top + 49, 4, 12);
		ctx.fillStyle = "#393653";
	}
	const layerAlpha = ctx.globalAlpha;
	ctx.save();
	for (let i = 0; i < RUINS_PARTICLE_COUNT; i++) {
		const x = wrap(i * 107 + 31 - snapshot.distance * .08 + time * (3 + i % 3 * 2), SKY_RUN_CONFIG.width);
		const y = (i * 47 + 34 + Math.round(Math.sin(time + i * .7) * 5)) % 310;
		ctx.globalAlpha = layerAlpha * (.34 + i % 3 * .14);
		ctx.fillStyle = i % 2 === 0 ? "#f0ca82" : "#8aeaf0";
		ctx.fillRect(Math.round(x), y, 3, 3);
		if (i % 4 === 0) ctx.fillRect(Math.round(x) - 2, y + 1, 7, 1);
	}
	ctx.restore();
	for (let i = 0; i < 7; i++) {
		const x = wrap(i * 153 + 64 - snapshot.distance * .13, SKY_RUN_CONFIG.width);
		const y = 94 + i * 39 % 203;
		ctx.fillStyle = "rgba(239, 205, 127, 0.74)";
		ctx.fillRect(x, y, 8, 2);
		ctx.fillRect(x + 3, y - 4, 2, 10);
		ctx.fillStyle = "rgba(146, 220, 231, 0.68)";
		ctx.fillRect(x + 11, y + 4, 2, 7);
		ctx.fillRect(x + 8, y + 7, 8, 2);
	}
}
function drawPixelMountain(ctx, x, baseY, height, width, color) {
	ctx.fillStyle = color;
	const steps = 8;
	for (let row = 0; row < steps; row++) {
		const rowWidth = Math.round(width * ((row + 1) / steps));
		const y = baseY - Math.round(height * ((steps - row) / steps));
		ctx.fillRect(Math.round(x + (width - rowWidth) / 2), y, rowWidth, Math.ceil(height / steps) + 2);
	}
}
function drawIceRealm(ctx, snapshot, time) {
	drawGradientSky(ctx, paletteFor(3));
	const iceShelf = {
		objectType: "DECORATION",
		kind: "ground",
		y: GROUND_SURFACE.y + 10
	};
	for (let i = 0; i < 5; i++) {
		const x = wrap(i * 240 - 85 - snapshot.distance * .08, SKY_RUN_CONFIG.width + 260) - 130;
		const height = 104 + i % 3 * 38;
		const mountainTop = topFromSurface(iceShelf, height);
		drawPixelMountain(ctx, x, iceShelf.y, height, 205 + i % 2 * 45, i % 2 === 0 ? "#83b7df" : "#739fce");
		ctx.fillStyle = "#eefcff";
		ctx.fillRect(x + 86, mountainTop + 4, 20, 8);
		ctx.fillRect(x + 72, mountainTop + 12, 13, 7);
	}
	for (let i = 0; i < 5; i++) {
		const x = wrap(i * 215 + 22 - snapshot.distance * .15, SKY_RUN_CONFIG.width + 120) - 60;
		const top = topFromSurface(GROUND_SURFACE, 137 + i % 3 * 21);
		const baseY = GROUND_SURFACE.y;
		ctx.fillStyle = "#275278";
		ctx.fillRect(x + 12, top + 34, 11, baseY - (top + 34));
		ctx.fillRect(x + 3, top + 45, 29, 12);
		ctx.fillRect(x + 6, top + 27, 23, 14);
		ctx.fillRect(x + 9, top + 12, 17, 13);
		ctx.fillRect(x + 12, top, 11, 11);
		ctx.fillStyle = "#e7fbff";
		ctx.fillRect(x + 8, top + 30, 4, 4);
		ctx.fillRect(x + 23, top + 18, 4, 4);
		ctx.fillStyle = "#91d9f0";
		ctx.fillRect(x + 13, top + 57, 3, 39);
	}
	const layerAlpha = ctx.globalAlpha;
	ctx.save();
	for (let i = 0; i < SNOWFLAKE_COUNT; i++) {
		const x = wrap(i * 137 + 13 - snapshot.distance * .1 + time * (11 + i % 3 * 5), SKY_RUN_CONFIG.width);
		const y = wrap(i * 71 + time * (24 + i % 5 * 4), SKY_RUN_CONFIG.groundY - 30);
		const size = i % 6 === 0 ? 4 : 2;
		ctx.globalAlpha = layerAlpha * (.42 + i % 4 * .12);
		ctx.fillStyle = i % 3 === 0 ? "#ffffff" : "#c8f5ff";
		ctx.fillRect(Math.round(x), Math.round(y), size, size);
		if (size === 4) {
			ctx.fillRect(Math.round(x) + 1, Math.round(y) - 2, 2, 8);
			ctx.fillRect(Math.round(x) - 2, Math.round(y) + 1, 8, 2);
		}
	}
	ctx.restore();
}
function drawArcaneDimension(ctx, snapshot, time) {
	drawGradientSky(ctx, paletteFor(4));
	drawStarField(ctx, snapshot, time, 4);
	for (let i = 0; i < 3; i++) {
		const x = wrap(116 + i * 385 - snapshot.distance * .12, SKY_RUN_CONFIG.width + 180) - 90;
		const y = 88 + i % 2 * 71;
		const width = 56 + i % 2 * 12;
		const height = 111 + i % 2 * 22;
		ctx.fillStyle = "#d5c6ff";
		ctx.fillRect(x, y, 7, height);
		ctx.fillRect(x + width - 7, y, 7, height);
		ctx.fillRect(x, y, width, 7);
		ctx.fillRect(x, y + height - 7, width, 7);
		ctx.fillStyle = "rgba(97, 68, 159, 0.62)";
		ctx.fillRect(x + 7, y + 7, width - 14, height - 14);
		ctx.fillStyle = "#70e9ef";
		ctx.fillRect(x + width / 2 - 2, y + 12, 4, height - 24);
		ctx.fillStyle = "#f2dcff";
		ctx.fillRect(x + width / 2 - 7, y + 18 + Math.round(Math.sin(time * 2 + i) * 4), 14, 3);
	}
	for (let i = 0; i < 5; i++) {
		const x = wrap(i * 217 + 36 - snapshot.distance * .2, SKY_RUN_CONFIG.width + 160) - 80;
		const y = 342 + i % 3 * 24;
		const width = 44 + i % 2 * 18;
		const floatingSurface = {
			objectType: "DECORATION",
			kind: "floating",
			y: y + 21
		};
		const platformTop = topFromSurface(floatingSurface, 21);
		ctx.fillStyle = "#382b6f";
		ctx.fillRect(x + 8, platformTop + 11, width - 16, 10);
		ctx.fillRect(x + 2, platformTop + 4, width - 4, 8);
		ctx.fillStyle = "#8672c8";
		ctx.fillRect(x + 6, platformTop, width - 12, 7);
		ctx.fillStyle = "#76edf0";
		ctx.fillRect(x + 12, platformTop + 2, 8, 2);
		ctx.save();
		for (let step = 0; step < 3; step++) {
			const beamY = floatingSurface.y + 5 + step * 8;
			if (beamY >= GROUND_SURFACE.y - 7) continue;
			ctx.globalAlpha = .26 - step * .055;
			ctx.fillStyle = step % 2 === 0 ? "#76edf0" : "#d5c6ff";
			ctx.fillRect(x + Math.floor(width / 2) - 1, beamY, 2, 3);
			if (step === 0) ctx.fillRect(x + 5, beamY + 2, 2, 2);
		}
		ctx.restore();
	}
	const layerAlpha = ctx.globalAlpha;
	ctx.save();
	for (let i = 0; i < ARCANE_PARTICLE_COUNT; i++) {
		const x = wrap(i * 97 + 20 - snapshot.distance * .17 + time * (5 + i % 4 * 4), SKY_RUN_CONFIG.width);
		const y = (i * 59 + 31 + Math.round(Math.sin(time * 1.6 + i) * 10)) % (SKY_RUN_CONFIG.groundY - 38);
		ctx.globalAlpha = layerAlpha * (.35 + i % 4 * .12);
		ctx.fillStyle = i % 2 === 0 ? "#8cf4f3" : "#dfc8ff";
		ctx.fillRect(Math.round(x), y, 3, 3);
		if (i % 4 === 0) ctx.fillRect(Math.round(x) + 1, y - 3, 1, 9);
	}
	ctx.restore();
}
function drawCandyWorld(ctx, snapshot, time) {
	drawGradientSky(ctx, paletteFor(5));
	const cloud1X = wrap(92 - snapshot.distance * .07, SKY_RUN_CONFIG.width + 180) - 90;
	const cloud2X = wrap(615 - snapshot.distance * .05, SKY_RUN_CONFIG.width + 180) - 90;
	drawPixelCloud(ctx, cloud1X, 92, 1.05);
	drawPixelCloud(ctx, cloud2X, 194, .72);
	for (let i = 0; i < 5; i++) {
		const x = wrap(i * 230 + 5 - snapshot.distance * .065, SKY_RUN_CONFIG.width + 300) - 150;
		const width = 210 + i % 2 * 36;
		const height = 86 + i % 3 * 22;
		drawPixelMountain(ctx, x, 394, height, width, i % 2 === 0 ? "#bf83bd" : "#82c9d5");
		drawPixelMountain(ctx, x + 24, 399, Math.round(height * .64), width - 42, "#f6c9d9");
		ctx.fillStyle = "#fff0c8";
		ctx.fillRect(x + Math.round(width * .48), 394 - height + 12, 17, 5);
		ctx.fillRect(x + Math.round(width * .48) + 5, 394 - height + 7, 8, 5);
	}
	for (let i = 0; i < 4; i++) {
		const x = wrap(76 + i * 285 - snapshot.distance * .17, SKY_RUN_CONFIG.width + 220) - 110;
		const trunkTop = 207 + i % 2 * 18;
		ctx.fillStyle = "#8b5260";
		ctx.fillRect(x + 20, trunkTop + 30, 12, GROUND_SURFACE.y - trunkTop - 30);
		ctx.fillStyle = "#ffeeb9";
		for (let row = 0; row < 4; row++) ctx.fillRect(x + 9 + row * 4, trunkTop + row * 7, 35 - row * 8, 7);
		ctx.fillStyle = i % 2 === 0 ? "#e46f9a" : "#8bcbd7";
		ctx.fillRect(x + 4, trunkTop + 2, 44, 21);
		ctx.fillRect(x + 10, trunkTop - 5, 32, 10);
		ctx.fillRect(x + 17, trunkTop - 11, 18, 8);
		ctx.fillStyle = "#fff0cf";
		ctx.fillRect(x + 14, trunkTop + 7, 5, 4);
		ctx.fillRect(x + 33, trunkTop + 12, 5, 4);
		const bushX = wrap(172 + i * 250 - snapshot.distance * .2, SKY_RUN_CONFIG.width + 170) - 85;
		ctx.fillStyle = "#e9b5d0";
		ctx.fillRect(bushX + 3, GROUND_SURFACE.y - 15, 39, 14);
		ctx.fillRect(bushX + 9, GROUND_SURFACE.y - 22, 24, 9);
		ctx.fillStyle = "#fff4dd";
		ctx.fillRect(bushX + 13, GROUND_SURFACE.y - 17, 5, 3);
		ctx.fillRect(bushX + 29, GROUND_SURFACE.y - 13, 5, 3);
	}
	for (let i = 0; i < 4; i++) {
		const x = wrap(210 + i * 260 - snapshot.distance * .15, SKY_RUN_CONFIG.width + 140) - 70;
		const capY = GROUND_SURFACE.y - 30 - i % 2 * 4;
		ctx.fillStyle = "#8b5260";
		ctx.fillRect(x + 11, capY + 13, 8, GROUND_SURFACE.y - capY - 13);
		ctx.fillStyle = i % 2 === 0 ? "#ee8caf" : "#9c88d4";
		ctx.fillRect(x + 2, capY + 7, 27, 10);
		ctx.fillRect(x + 7, capY + 2, 17, 8);
		ctx.fillRect(x + 12, capY, 8, 5);
		ctx.fillStyle = "#fff2d6";
		ctx.fillRect(x + 8, capY + 9, 4, 3);
		ctx.fillRect(x + 20, capY + 6, 4, 3);
	}
	for (let i = 0; i < 3; i++) {
		const x = wrap(160 + i * 360 - snapshot.distance * .19, SKY_RUN_CONFIG.width + 180) - 90;
		const y = 345 + i % 2 * 17;
		ctx.fillStyle = "#9d654e";
		ctx.fillRect(x + 12, y + 8, 82, 13);
		ctx.fillStyle = "#e8bc79";
		ctx.fillRect(x + 7, y, 92, 12);
		ctx.fillStyle = "#fff0c8";
		ctx.fillRect(x + 13, y + 2, 80, 3);
		ctx.fillStyle = "#9d654e";
		ctx.fillRect(x + 19, y + 21, 8, GROUND_SURFACE.y - y - 21);
		ctx.fillRect(x + 79, y + 21, 8, GROUND_SURFACE.y - y - 21);
		ctx.fillStyle = "#d99565";
		ctx.fillRect(x + 32, y + 5, 5, 4);
		ctx.fillRect(x + 61, y + 5, 5, 4);
	}
	const chocolateOffset = wrap(snapshot.distance * .09, SKY_RUN_CONFIG.width);
	ctx.fillStyle = "#754251";
	ctx.fillRect(-chocolateOffset, 382, SKY_RUN_CONFIG.width, 17);
	ctx.fillRect(SKY_RUN_CONFIG.width - chocolateOffset, 382, SKY_RUN_CONFIG.width, 17);
	ctx.fillStyle = "#c77b80";
	ctx.fillRect(-chocolateOffset, 382, SKY_RUN_CONFIG.width, 3);
	ctx.fillRect(SKY_RUN_CONFIG.width - chocolateOffset, 382, SKY_RUN_CONFIG.width, 3);
	const layerAlpha = ctx.globalAlpha;
	ctx.save();
	for (let i = 0; i < CANDY_PARTICLE_COUNT; i++) {
		const x = wrap(i * 83 + 29 - snapshot.distance * .14 + time * (4 + i % 4 * 2), SKY_RUN_CONFIG.width);
		const y = (i * 67 + 58 + Math.round(Math.sin(time * 1.5 + i) * 9)) % (SKY_RUN_CONFIG.groundY - 54);
		ctx.globalAlpha = layerAlpha * (.34 + i % 3 * .11);
		ctx.fillStyle = [
			"#fff0ca",
			"#f48db1",
			"#92e3e9",
			"#c3a5ef"
		][i % 4];
		ctx.fillRect(Math.round(x), y, i % 3 === 0 ? 4 : 2, 2);
		if (i % 4 === 0) ctx.fillRect(Math.round(x) + 1, y - 2, 2, 6);
	}
	ctx.restore();
	for (let i = 0; i < 5; i++) {
		const x = wrap(i * 197 + 22 - snapshot.distance * .12, SKY_RUN_CONFIG.width);
		const y = 112 + i * 53 % 179;
		ctx.fillStyle = "rgba(255, 244, 215, 0.66)";
		ctx.fillRect(x + 3, y, 2, 9);
		ctx.fillRect(x, y + 3, 8, 2);
	}
}
function drawWorldBackdrop(ctx, snapshot, time, worldIndex) {
	if (worldIndex === 1) drawForest(ctx, snapshot, time);
	else if (worldIndex === 2) drawRuins(ctx, snapshot, time);
	else if (worldIndex === 3) drawIceRealm(ctx, snapshot, time);
	else if (worldIndex === 4) drawArcaneDimension(ctx, snapshot, time);
	else if (worldIndex === 5) drawCandyWorld(ctx, snapshot, time);
	else drawEnchantedSky(ctx, snapshot, time);
}
function drawGround(ctx, snapshot, worldIndex) {
	const palette = paletteFor(worldIndex);
	ctx.fillStyle = palette.ground;
	ctx.fillRect(0, SKY_RUN_CONFIG.groundY, SKY_RUN_CONFIG.width, SKY_RUN_CONFIG.height - SKY_RUN_CONFIG.groundY);
	ctx.fillStyle = palette.groundTop;
	ctx.fillRect(0, SKY_RUN_CONFIG.groundY + 8, SKY_RUN_CONFIG.width, 18);
	ctx.fillStyle = palette.ground;
	ctx.fillRect(0, SKY_RUN_CONFIG.groundY + 26, SKY_RUN_CONFIG.width, SKY_RUN_CONFIG.height - SKY_RUN_CONFIG.groundY - 26);
	ctx.fillStyle = palette.groundLine;
	ctx.fillRect(0, SKY_RUN_CONFIG.groundY, SKY_RUN_CONFIG.width, 5);
	ctx.fillStyle = palette.groundAccent;
	ctx.fillRect(0, SKY_RUN_CONFIG.groundY + 5, SKY_RUN_CONFIG.width, 3);
	const tileWidth = 88;
	const offset = wrap(snapshot.distance * .6, tileWidth);
	for (let i = -1; i < 13; i++) {
		const x = Math.round(i * tileWidth - offset);
		ctx.fillStyle = palette.groundTile;
		if (worldIndex === 1) {
			ctx.fillRect(x + 14, SKY_RUN_CONFIG.groundY + 13, 19, 4);
			ctx.fillRect(x + 22, SKY_RUN_CONFIG.groundY + 10, 4, 3);
			ctx.fillStyle = "#306c53";
			ctx.fillRect(x + 20, SKY_RUN_CONFIG.groundY + 18, 3, 5);
		} else if (worldIndex === 2) {
			ctx.fillRect(x + 10, SKY_RUN_CONFIG.groundY + 12, 27, 5);
			ctx.fillRect(x + 14, SKY_RUN_CONFIG.groundY + 19, 18, 3);
			ctx.fillStyle = "#413958";
			ctx.fillRect(x + 43, SKY_RUN_CONFIG.groundY + 11, 20, 4);
		} else if (worldIndex === 3) {
			ctx.fillRect(x + 14, SKY_RUN_CONFIG.groundY + 12, 18, 4);
			ctx.fillRect(x + 50, SKY_RUN_CONFIG.groundY + 18, 16, 3);
			ctx.fillStyle = "#dffaff";
			ctx.fillRect(x + 18, SKY_RUN_CONFIG.groundY + 13, 7, 2);
		} else if (worldIndex === 4) {
			ctx.fillRect(x + 13, SKY_RUN_CONFIG.groundY + 13, 21, 4);
			ctx.fillRect(x + 21, SKY_RUN_CONFIG.groundY + 10, 5, 3);
			ctx.fillStyle = "#3b286e";
			ctx.fillRect(x + 54, SKY_RUN_CONFIG.groundY + 19, 9, 3);
		} else if (worldIndex === 5) {
			ctx.fillRect(x + 10, SKY_RUN_CONFIG.groundY + 12, 24, 5);
			ctx.fillRect(x + 17, SKY_RUN_CONFIG.groundY + 19, 5, 3);
			ctx.fillStyle = "#8a5260";
			ctx.fillRect(x + 47, SKY_RUN_CONFIG.groundY + 11, 22, 5);
			ctx.fillStyle = "#fff0c8";
			ctx.fillRect(x + 51, SKY_RUN_CONFIG.groundY + 12, 5, 2);
		} else {
			ctx.fillRect(x + 16, SKY_RUN_CONFIG.groundY + 14, 12, 3);
			ctx.fillStyle = "#373875";
			ctx.fillRect(x + 21, SKY_RUN_CONFIG.groundY + 13, 3, 5);
			ctx.fillStyle = "rgba(219, 244, 255, 0.56)";
			ctx.fillRect(x + 52, SKY_RUN_CONFIG.groundY + 21, 7, 2);
		}
	}
}
function drawWorldLayer(ctx, snapshot, time, worldIndex, alpha) {
	ctx.save();
	ctx.globalAlpha = alpha;
	drawWorldBackdrop(ctx, snapshot, time, worldIndex);
	drawGround(ctx, snapshot, worldIndex);
	ctx.restore();
}
function drawObstacleOutline(ctx, obstacle, palette) {
	const x = Math.round(obstacle.x);
	const top = obstacle.surfaceY - obstacle.height;
	ctx.fillStyle = palette.obstacleOutline;
	ctx.fillRect(x - 2, top - 2, obstacle.width + 4, obstacle.height + 4);
	ctx.fillStyle = palette.obstacleDark;
	ctx.fillRect(x, top, obstacle.width, obstacle.height);
	return {
		x,
		top,
		mid: x + Math.floor(obstacle.width / 2),
		width: obstacle.width
	};
}
function drawSpireObstacle(ctx, obstacle) {
	const palette = paletteFor(obstacle.worldIndex);
	const { x, top, mid, width } = drawObstacleOutline(ctx, obstacle, palette);
	const height = obstacle.height;
	if (obstacle.worldIndex === 1) {
		ctx.fillStyle = palette.obstacleMain;
		ctx.fillRect(mid - 5, top + 11, 10, height - 11);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 2, top + 5, width - 4, 11);
		ctx.fillRect(x + 5, top + 1, width - 10, 6);
		ctx.fillStyle = palette.obstacleLight;
		ctx.fillRect(x + 7, top + 7, 4, 3);
		ctx.fillRect(x + width - 12, top + 5, 4, 3);
	} else {
		ctx.fillStyle = palette.obstacleMain;
		ctx.fillRect(mid - 8, top + 10, 16, height - 10);
		ctx.fillRect(mid - 6, top + 5, 12, 6);
		ctx.fillRect(mid - 3, top + 1, 6, 5);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(mid - 5, top + 11, 4, Math.max(4, height - 16));
		ctx.fillStyle = palette.obstacleLight;
		ctx.fillRect(mid - 2, top + 4, 3, 6);
		ctx.fillStyle = palette.obstacleMain;
		ctx.fillRect(x + 2, obstacle.surfaceY - 5, width - 4, 3);
	}
	if (obstacle.worldIndex === 2) {
		ctx.fillStyle = palette.obstacleLight;
		ctx.fillRect(x + 4, top + 17, 3, 3);
		ctx.fillRect(x + width - 7, top + 25, 3, 3);
	} else if (obstacle.worldIndex === 3) {
		ctx.fillStyle = palette.obstacleLight;
		ctx.fillRect(mid + 4, top + 12, 3, Math.max(4, height - 18));
		ctx.fillRect(mid - 11, top + 20, 3, 4);
	} else if (obstacle.worldIndex === 4) {
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(mid + 6, top + 15, 3, Math.max(4, height - 21));
		ctx.fillRect(mid - 11, top + 8, 3, 4);
	}
}
function drawColumnObstacle(ctx, obstacle) {
	const palette = paletteFor(obstacle.worldIndex);
	const { x, top, width } = drawObstacleOutline(ctx, obstacle, palette);
	const height = obstacle.height;
	ctx.fillStyle = palette.obstacleMain;
	ctx.fillRect(x + 7, top + 9, width - 14, height - 9);
	ctx.fillStyle = palette.obstacleLight;
	if (obstacle.worldIndex === 1) {
		ctx.fillRect(x + 2, top + 8, width - 4, 8);
		ctx.fillRect(x + 5, top + 3, width - 10, 7);
		ctx.fillRect(x + 9, top + 1, width - 18, 4);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 3, obstacle.surfaceY - 6, 8, 5);
		ctx.fillRect(x + width - 11, obstacle.surfaceY - 5, 8, 4);
	} else if (obstacle.worldIndex === 2) {
		ctx.fillRect(x + 3, top + 4, width - 6, 6);
		ctx.fillRect(x + 1, top + 1, width - 2, 5);
		ctx.fillRect(x + 5, top + 14, 3, 5);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + width - 10, top + 22, 3, 6);
	} else if (obstacle.worldIndex === 3) {
		ctx.fillRect(x + 4, top + 2, width - 8, 5);
		ctx.fillRect(x + 9, top + 8, 4, height - 12);
		ctx.fillRect(x + width - 13, top + 12, 4, height - 17);
	} else if (obstacle.worldIndex === 4) {
		ctx.fillRect(x + 3, top + 2, width - 6, 5);
		ctx.fillRect(x + 3, obstacle.surfaceY - 6, width - 6, 5);
		ctx.fillRect(x + 6, top + 8, 4, height - 15);
		ctx.fillRect(x + width - 10, top + 8, 4, height - 15);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + Math.floor(width / 2) - 2, top + 12, 4, height - 24);
	} else {
		ctx.fillRect(x + 2, top + 1, width - 4, 8);
		ctx.fillRect(x + 4, top + 6, width - 8, 3);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 11, top + 17, 4, 4);
		ctx.fillRect(x + width - 16, top + 24, 4, 4);
	}
}
function drawMoundObstacle(ctx, obstacle) {
	const palette = paletteFor(obstacle.worldIndex);
	const { x, top, width } = drawObstacleOutline(ctx, obstacle, palette);
	const height = obstacle.height;
	ctx.fillStyle = palette.obstacleMain;
	ctx.fillRect(x + 3, top + 12, width - 6, height - 12);
	ctx.fillRect(x + 7, top + 7, width - 14, height - 7);
	ctx.fillStyle = palette.obstacleLight;
	if (obstacle.worldIndex === 1) {
		ctx.fillRect(x + 3, top + 8, width - 6, 6);
		ctx.fillRect(x + 9, top + 4, width - 18, 6);
		ctx.fillRect(x + 13, top + 1, width - 26, 4);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 1, obstacle.surfaceY - 7, 11, 4);
		ctx.fillRect(x + width - 12, obstacle.surfaceY - 8, 11, 5);
	} else if (obstacle.worldIndex === 2) {
		ctx.fillRect(x + 4, top + 6, width - 8, 5);
		ctx.fillRect(x + 10, top + 14, 3, 6);
		ctx.fillRect(x + width - 14, top + 20, 4, 5);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 5, top + 2, 8, 3);
	} else if (obstacle.worldIndex === 3) {
		ctx.fillRect(x + 3, top + 10, width - 6, 5);
		ctx.fillRect(x + 7, top + 5, width - 14, 7);
		ctx.fillRect(x + 14, top + 1, width - 28, 6);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 7, top + 17, 4, 3);
	} else if (obstacle.worldIndex === 4) {
		ctx.fillRect(x + 4, top + 10, width - 8, 4);
		ctx.fillRect(x + 9, top + 5, width - 18, 7);
		ctx.fillRect(x + 13, top + 1, width - 26, 6);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 2, top + 18, 6, 3);
		ctx.fillRect(x + width - 9, top + 23, 7, 3);
	} else {
		ctx.fillRect(x + 7, top + 5, width - 14, 4);
		ctx.fillRect(x + 11, top + 2, width - 22, 4);
		ctx.fillStyle = palette.obstacleAccent;
		ctx.fillRect(x + 8, top + 16, 5, 3);
		ctx.fillRect(x + width - 13, top + 20, 5, 2);
	}
}
function drawCandyObstacle(ctx, obstacle) {
	const x = Math.round(obstacle.x);
	const top = obstacle.surfaceY - obstacle.height;
	const width = obstacle.width;
	const mid = x + Math.floor(width / 2);
	const outline = "#39283d";
	if (obstacle.kind === "lollipop") {
		const candyWidth = Math.min(28, width - 8);
		const candyHeight = Math.min(26, obstacle.height - 12);
		const candyX = mid - Math.floor(candyWidth / 2);
		const candyY = top + 1;
		ctx.fillStyle = outline;
		ctx.fillRect(mid - 4, candyY + candyHeight - 1, 8, obstacle.surfaceY - candyY - candyHeight + 1);
		ctx.fillRect(candyX + 4, candyY, candyWidth - 8, candyHeight);
		ctx.fillRect(candyX, candyY + 4, candyWidth, candyHeight - 8);
		ctx.fillStyle = "#e85f91";
		ctx.fillRect(candyX + 4, candyY + 4, candyWidth - 8, candyHeight - 8);
		ctx.fillRect(candyX + 2, candyY + 8, candyWidth - 4, candyHeight - 16);
		ctx.fillStyle = "#fff0d3";
		ctx.fillRect(candyX + 6, candyY + 7, 5, 4);
		ctx.fillRect(candyX + candyWidth - 11, candyY + 13, 5, 4);
		ctx.fillStyle = "#f8a6c6";
		ctx.fillRect(mid - 3, candyY + candyHeight, 6, obstacle.surfaceY - candyY - candyHeight);
	} else if (obstacle.kind === "chocolate-bar") {
		ctx.fillStyle = outline;
		ctx.fillRect(x + 1, top + 3, width - 2, obstacle.height - 3);
		ctx.fillStyle = "#824450";
		ctx.fillRect(x + 4, top + 2, width - 8, obstacle.height - 4);
		ctx.fillStyle = "#bd765b";
		ctx.fillRect(x + 6, top + 5, width - 12, 6);
		const segmentWidth = Math.max(8, Math.floor((width - 12) / 3));
		for (let segment = 0; segment < 3; segment++) {
			const segmentX = x + 6 + segment * segmentWidth;
			ctx.fillStyle = segment % 2 === 0 ? "#9c594e" : "#ad6552";
			ctx.fillRect(segmentX, top + 13, segmentWidth - 2, obstacle.height - 17);
			ctx.fillStyle = "#e9a16d";
			ctx.fillRect(segmentX + 2, top + 15, Math.max(2, segmentWidth - 7), 3);
		}
	} else if (obstacle.kind === "cookie-block") {
		ctx.fillStyle = outline;
		ctx.fillRect(x + 3, top, width - 6, obstacle.height);
		ctx.fillRect(x, top + 4, width, obstacle.height - 8);
		ctx.fillStyle = "#dca967";
		ctx.fillRect(x + 4, top + 4, width - 8, obstacle.height - 8);
		ctx.fillStyle = "#f4d395";
		ctx.fillRect(x + 7, top + 7, width - 14, 5);
		ctx.fillStyle = "#754b4c";
		for (let chip = 0; chip < 5; chip++) {
			const chipX = x + 7 + (chip * 11 + 3) % Math.max(8, width - 14);
			const chipY = top + 16 + chip * 7 % Math.max(6, obstacle.height - 22);
			ctx.fillRect(chipX, chipY, 4, 3);
		}
	} else if (obstacle.kind === "sugar-crystal") {
		ctx.fillStyle = outline;
		ctx.fillRect(mid - 10, top + 10, 20, obstacle.height - 10);
		ctx.fillRect(mid - 6, top + 4, 12, 8);
		ctx.fillRect(mid - 3, top, 6, 6);
		ctx.fillStyle = "#84dfe4";
		ctx.fillRect(mid - 7, top + 12, 14, obstacle.height - 12);
		ctx.fillRect(mid - 4, top + 5, 8, 8);
		ctx.fillRect(mid - 2, top + 1, 4, 5);
		ctx.fillStyle = "#f1ffff";
		ctx.fillRect(mid - 4, top + 14, 3, Math.max(4, obstacle.height - 21));
		ctx.fillRect(mid + 2, top + 7, 2, 6);
	} else if (obstacle.kind === "marshmallow-stack") {
		ctx.fillStyle = outline;
		ctx.fillRect(x + 4, top + 1, width - 8, 14);
		ctx.fillRect(x, top + 7, width, 15);
		ctx.fillRect(x + 4, top + 14, width - 8, obstacle.height - 14);
		ctx.fillStyle = "#fff1dd";
		ctx.fillRect(x + 6, top + 3, width - 12, 9);
		ctx.fillRect(x + 2, top + 9, width - 4, 9);
		ctx.fillRect(x + 6, top + 17, width - 12, obstacle.height - 18);
		ctx.fillStyle = "#f2a6c4";
		ctx.fillRect(x + 7, top + 12, width - 14, 3);
		ctx.fillRect(x + 8, top + 25, width - 16, 3);
	} else {
		ctx.fillStyle = outline;
		ctx.fillRect(x + 7, top + 18, width - 14, obstacle.height - 18);
		ctx.fillRect(x + 3, top + 23, width - 6, obstacle.height - 23);
		ctx.fillRect(mid - 13, top + 9, 26, 17);
		ctx.fillRect(mid - 9, top + 3, 18, 12);
		ctx.fillRect(mid - 4, top, 8, 7);
		ctx.fillStyle = "#d78665";
		ctx.fillRect(x + 9, top + 22, width - 18, obstacle.height - 24);
		ctx.fillStyle = "#f7c87f";
		ctx.fillRect(mid - 11, top + 11, 22, 11);
		ctx.fillRect(mid - 7, top + 5, 14, 10);
		ctx.fillStyle = "#fff1d5";
		ctx.fillRect(mid - 3, top + 2, 6, 7);
		ctx.fillStyle = "#e86c93";
		ctx.fillRect(mid - 8, top + 15, 6, 3);
		ctx.fillRect(mid + 3, top + 10, 5, 3);
	}
}
function drawObstacle(ctx, obstacle) {
	if (obstacle.objectType !== "GROUND_OBSTACLE") return;
	if (obstacle.worldIndex === 5) drawCandyObstacle(ctx, obstacle);
	else if (obstacle.kind === "crystal") drawSpireObstacle(ctx, obstacle);
	else if (obstacle.kind === "rune-pillar") drawColumnObstacle(ctx, obstacle);
	else drawMoundObstacle(ctx, obstacle);
}
function drawFinalPortal(ctx, snapshot, time) {
	if (snapshot.worldIndex !== 5) return;
	const distanceRemaining = SKY_RUN_TOTAL_DISTANCE - snapshot.distance;
	if (distanceRemaining > SKY_RUN_CONFIG.width - SKY_RUN_CONFIG.playerX + 58 || distanceRemaining < -118) return;
	const centerX = Math.round(SKY_RUN_CONFIG.playerX + distanceRemaining);
	const portalX = centerX - 47;
	const portalY = SKY_RUN_CONFIG.groundY - 174;
	const pulse = .72 + (Math.sin(time * 4) + 1) / 2 * .28;
	ctx.save();
	ctx.globalAlpha = pulse;
	ctx.shadowColor = "#fff0b8";
	ctx.shadowBlur = 22;
	ctx.fillStyle = "#fff0cf";
	ctx.fillRect(portalX + 17, portalY, 60, 8);
	ctx.fillRect(portalX + 8, portalY + 8, 10, 18);
	ctx.fillRect(portalX + 78, portalY + 8, 10, 18);
	ctx.fillRect(portalX + 2, portalY + 26, 10, 116);
	ctx.fillRect(portalX + 84, portalY + 26, 10, 116);
	ctx.fillRect(portalX + 10, portalY + 142, 74, 10);
	ctx.shadowBlur = 0;
	ctx.fillStyle = "#cf8d69";
	ctx.fillRect(portalX + 18, portalY + 8, 60, 6);
	ctx.fillRect(portalX + 12, portalY + 14, 6, 122);
	ctx.fillRect(portalX + 78, portalY + 14, 6, 122);
	ctx.fillRect(portalX + 18, portalY + 136, 60, 6);
	ctx.fillStyle = "#df719e";
	ctx.fillRect(portalX + 22, portalY + 13, 5, 12);
	ctx.fillRect(portalX + 67, portalY + 13, 5, 12);
	ctx.fillRect(portalX + 12, portalY + 36, 6, 8);
	ctx.fillRect(portalX + 78, portalY + 58, 6, 8);
	ctx.fillStyle = "#8b70c8";
	ctx.fillRect(portalX + 17, portalY + 26, 61, 108);
	const portalGlow = ctx.createLinearGradient(0, portalY + 29, 0, portalY + 132);
	portalGlow.addColorStop(0, "#ffd5e8");
	portalGlow.addColorStop(.48, "#9eeaf1");
	portalGlow.addColorStop(1, "#c6a9ef");
	ctx.fillStyle = portalGlow;
	ctx.fillRect(portalX + 23, portalY + 32, 49, 96);
	ctx.fillStyle = "rgba(255,255,255,0.68)";
	ctx.fillRect(portalX + 31, portalY + 45, 4, 41);
	ctx.fillRect(portalX + 56, portalY + 84, 4, 31);
	ctx.fillStyle = "#fff3c5";
	ctx.fillRect(portalX + 43, portalY + 61, 8, 3);
	ctx.fillRect(portalX + 46, portalY + 58, 3, 9);
	ctx.fillStyle = "#fff7dc";
	ctx.fillRect(portalX + 43, portalY + 17, 8, 3);
	ctx.fillRect(portalX + 46, portalY + 14, 3, 9);
	for (let i = 0; i < 6; i++) {
		const angle = time * 1.2 + i * (Math.PI / 3);
		const x = centerX + Math.cos(angle) * (56 + i % 2 * 5);
		const y = portalY + 76 + Math.sin(angle) * 75;
		ctx.globalAlpha = pulse * (.55 + i % 3 * .12);
		ctx.fillStyle = i % 2 === 0 ? "#fff5ca" : "#91e9ee";
		ctx.fillRect(Math.round(x), Math.round(y), 4, 4);
	}
	ctx.restore();
}
function drawSpeedLines(ctx, snapshot, time) {
	if (snapshot.phase !== "playing") return;
	const progress = Math.min(1, Math.max(0, (snapshot.speedMultiplier - 1) / (SKY_RUN_CONFIG.maxSpeedMultiplier - 1)));
	if (progress <= 0) return;
	const activeCount = Math.min(SPEED_LINE_COUNT, 2 + Math.ceil(progress * 6));
	ctx.save();
	for (let i = 0; i < activeCount; i++) {
		const x = wrap(SKY_RUN_CONFIG.width - time * (160 + progress * 360) - i * 157, SKY_RUN_CONFIG.width);
		const y = 54 + (i * 71 + 19) % (SKY_RUN_CONFIG.groundY - 90);
		ctx.globalAlpha = .035 + progress * .075;
		ctx.fillStyle = i % 3 === 0 ? "#dbd1ff" : "#d7faff";
		ctx.fillRect(Math.round(x), y, Math.round(5 + progress * 9), 2);
	}
	ctx.restore();
}
function drawCharacterParticle(ctx, characterId, x, y, size, phase) {
	const colors = CHARACTER_FX[characterId];
	const px = Math.round(x);
	const py = Math.round(y);
	ctx.fillStyle = phase % 2 === 0 ? colors.main : colors.light;
	if (characterId === "white-fox-ice-mage") {
		ctx.fillRect(px + 1, py, size, 2);
		ctx.fillRect(px + 2, py - 1, Math.max(1, size - 1), 4);
	} else if (characterId === "purple-rabbit-ninja") {
		ctx.fillRect(px + 1, py, 2, size + 2);
		ctx.fillRect(px, py + 1, size + 2, 2);
	} else if (characterId === "swamp-frog-mage") {
		ctx.fillRect(px + 1, py, size, 1);
		ctx.fillRect(px, py + 1, 1, size);
		ctx.fillRect(px + size + 1, py + 1, 1, size);
		ctx.fillRect(px + 1, py + size + 1, size, 1);
		ctx.fillRect(px + 2, py + 2, 1, 1);
	} else if (characterId === "forge-raccoon-mage") {
		ctx.fillRect(px + 1, py + size, size + 1, 2);
		ctx.fillRect(px + 2, py + 1, size, size);
		ctx.fillRect(px + 3, py, 1, 2);
	} else {
		ctx.fillRect(px, py, 1, size + 3);
		ctx.fillRect(px + 1, py + 1, size + 2, 1);
		ctx.fillRect(px + size, py + 2, 1, size);
		ctx.fillRect(px + 2, py + size + 1, size, 1);
	}
}
function drawRunnerTrail(ctx, snapshot, characterId, time, playerX = SKY_RUN_CONFIG.playerX) {
	if (snapshot.phase !== "playing") return;
	const progress = Math.min(1, Math.max(0, (snapshot.speedMultiplier - 1) / (SKY_RUN_CONFIG.maxSpeedMultiplier - 1)));
	const trailDistance = 30 + progress * 16;
	ctx.save();
	for (let i = 0; i < RUN_TRAIL_COUNT; i++) {
		const drift = wrap(time * (34 + progress * 72) + i * 19, 42);
		const x = playerX - trailDistance - drift;
		const y = SKY_RUN_CONFIG.groundY - 13 - i % 2 * 11 + Math.round(Math.sin(time * 8 + i * 1.3) * 2);
		ctx.globalAlpha = .35 + (i + Math.floor(time * 8)) % 3 * .13;
		drawCharacterParticle(ctx, characterId, x, y, i % 2 === 0 ? 2 : 1, i);
	}
	ctx.restore();
}
function drawJumpEffect(ctx, characterId, kind, progress, playerX = SKY_RUN_CONFIG.playerX) {
	if (progress < 0 || progress >= 1) return;
	const radius = 5 + progress * 21;
	ctx.save();
	ctx.globalAlpha = 1 - progress;
	for (const i of BURST_DIRECTIONS) {
		const angle = i * (Math.PI * 2 / BURST_PARTICLE_COUNT);
		const x = playerX + Math.cos(angle) * radius;
		const vertical = Math.sin(angle) * radius * .34;
		const lift = kind === "takeoff" ? progress * 13 : -progress * 3;
		drawCharacterParticle(ctx, characterId, x, SKY_RUN_CONFIG.groundY - 7 + vertical - lift, i % 2 === 0 ? 2 : 1, i);
	}
	ctx.restore();
}
function drawSkyRunCoin(ctx, coin, time) {
	const y = Math.round(coin.y + Math.sin(time * 4 + coin.id) * 2);
	ctx.save();
	ctx.shadowColor = "#ffe58a";
	ctx.shadowBlur = 11;
	ctx.fillStyle = "#98532d";
	ctx.fillRect(Math.round(coin.x) - 9, y - 10, 18, 20);
	ctx.fillStyle = "#e9a83d";
	ctx.fillRect(Math.round(coin.x) - 6, y - 11, 12, 22);
	ctx.fillStyle = "#ffdf73";
	ctx.fillRect(Math.round(coin.x) - 3, y - 8, 6, 16);
	ctx.fillStyle = "#fff7c9";
	ctx.fillRect(Math.round(coin.x) - 2, y - 7, 2, 5);
	ctx.restore();
}
function drawSkyRunWorld(ctx, snapshot, time, showFinalPortal = true) {
	ctx.imageSmoothingEnabled = false;
	if (snapshot.transitionFromWorldIndex !== null && snapshot.worldTransitionProgress < 1) {
		drawWorldLayer(ctx, snapshot, time, snapshot.transitionFromWorldIndex, 1);
		drawWorldLayer(ctx, snapshot, time, snapshot.worldIndex, snapshot.worldTransitionProgress);
	} else drawWorldLayer(ctx, snapshot, time, snapshot.worldIndex, 1);
	drawSpeedLines(ctx, snapshot, time);
	for (const obstacle of snapshot.obstacles) drawObstacle(ctx, obstacle);
	for (const coin of snapshot.coins) drawSkyRunCoin(ctx, coin, time);
	if (showFinalPortal) drawFinalPortal(ctx, snapshot, time);
}
function drawSkyRunPlayerEffects(ctx, snapshot, time, characterId, effects, playerX = SKY_RUN_CONFIG.playerX) {
	drawRunnerTrail(ctx, snapshot, characterId, time, playerX);
	if (effects.jumpKind) drawJumpEffect(ctx, characterId, effects.jumpKind, effects.jumpProgress, playerX);
}
function drawSkyRun(ctx, snapshot, time, characterId, effects, playerX = SKY_RUN_CONFIG.playerX) {
	drawSkyRunWorld(ctx, snapshot, time, effects.showFinalPortal ?? true);
	drawSkyRunPlayerEffects(ctx, snapshot, time, characterId, effects, playerX);
}
//#endregion
//#region src/features/spellbound/skyrun/SkyRunScreen.tsx
var BEST_SCORE_KEY = "spellbound-sky-run-best-v1";
var CHARACTER_BURST_COLORS = {
	"white-fox-ice-mage": {
		main: "#76dfff",
		light: "#e5fbff",
		glow: "rgba(104, 210, 255, 0.68)"
	},
	"purple-rabbit-ninja": {
		main: "#a888ed",
		light: "#e2d2ff",
		glow: "rgba(177, 136, 255, 0.62)"
	},
	"swamp-frog-mage": {
		main: "#58bd7b",
		light: "#c8f0a8",
		glow: "rgba(112, 229, 167, 0.58)"
	},
	"forge-raccoon-mage": {
		main: "#e66c43",
		light: "#ffc16d",
		glow: "rgba(255, 122, 57, 0.64)"
	},
	"time-owl-mage": {
		main: "#8275d2",
		light: "#e0d9ff",
		glow: "rgba(164, 143, 255, 0.62)"
	},
	"calm-capybara-mage": {
		main: "#83c9aa",
		light: "#d9f7e9",
		glow: "rgba(157, 232, 207, 0.62)"
	},
	"axolotl-mage": {
		main: "#e878b7",
		light: "#ffe1f3",
		glow: "rgba(255, 158, 219, 0.68)"
	}
};
function readBestScore$1() {
	try {
		const saved = Number(window.localStorage.getItem(BEST_SCORE_KEY));
		return Number.isFinite(saved) ? Math.max(0, Math.floor(saved)) : 0;
	} catch {
		return 0;
	}
}
function formatScore(score) {
	return String(score).padStart(6, "0");
}
function CharacterDeathBurst({ characterId, x, y, id, onComplete }) {
	const colors = CHARACTER_BURST_COLORS[characterId];
	return /* @__PURE__ */ jsx("div", {
		className: "pointer-events-none absolute z-0",
		style: {
			left: `${x / SKY_RUN_CONFIG.width * 100}%`,
			top: `${y / SKY_RUN_CONFIG.height * 100}%`,
			transform: "translate(-50%, -50%)"
		},
		children: /* @__PURE__ */ jsxs("svg", {
			className: "h-16 w-16 animate-ping",
			viewBox: "0 0 64 64",
			shapeRendering: "crispEdges",
			"aria-hidden": "true",
			"data-death-theme": characterId,
			onAnimationEnd: () => onComplete(id),
			style: {
				filter: `drop-shadow(0 0 7px ${colors.glow})`,
				animationDuration: `${SKY_RUN_CONFIG.collisionEffectDurationMs}ms`,
				animationIterationCount: 1
			},
			children: [
				/* @__PURE__ */ jsx("path", {
					d: "M29 2h6v5h-6zM57 29h5v6h-5zM29 57h6v5h-6zM2 29h5v6H2z",
					fill: colors.light
				}),
				characterId === "white-fox-ice-mage" && /* @__PURE__ */ jsxs("g", {
					fill: colors.main,
					children: [/* @__PURE__ */ jsx("path", { d: "m13 19 7-15 8 18h-6v9h-5v-9zM40 44l5-12 7 15h-5v8h-5v-8z" }), /* @__PURE__ */ jsx("path", {
						d: "m44 13 3-7 4 9h-3v6h-3v-6z",
						fill: colors.light
					})]
				}),
				characterId === "purple-rabbit-ninja" && /* @__PURE__ */ jsxs("g", {
					fill: colors.main,
					children: [/* @__PURE__ */ jsx("path", { d: "m15 17 8 3 8-5-4 9 5 8-10-2-6 8-1-10-9-4 10-1zM42 43l6 2 7-4-3 7 4 6-8-1-5 6-1-8-7-3 8-1z" }), /* @__PURE__ */ jsx("path", {
						d: "m43 9 2-5 2 5 5 2-5 2-2 5-2-5-5-2z",
						fill: colors.light
					})]
				}),
				characterId === "swamp-frog-mage" && /* @__PURE__ */ jsxs("g", {
					fill: colors.main,
					children: [
						/* @__PURE__ */ jsx("path", { d: "M11 20h5v5h6v4h-6v-2h-5zM42 39h5v5h6v4h-6v-2h-5z" }),
						/* @__PURE__ */ jsx("circle", {
							cx: "47",
							cy: "16",
							r: "5",
							fill: "none",
							stroke: colors.light,
							strokeWidth: "2"
						}),
						/* @__PURE__ */ jsx("circle", {
							cx: "17",
							cy: "47",
							r: "3",
							fill: "none",
							stroke: colors.light,
							strokeWidth: "2"
						})
					]
				}),
				characterId === "forge-raccoon-mage" && /* @__PURE__ */ jsxs("g", {
					fill: colors.main,
					children: [/* @__PURE__ */ jsx("path", { d: "M13 28v-9h4v-9h5v10h4v9h-4v6h-9zM40 51v-9h4v-9h5v10h4v9h-4v6h-9z" }), /* @__PURE__ */ jsx("path", {
						d: "M46 17h4v4h-4zM10 42h4v4h-4zM53 28h4v4h-4z",
						fill: colors.light
					})]
				}),
				characterId === "time-owl-mage" && /* @__PURE__ */ jsxs("g", {
					fill: colors.main,
					stroke: colors.light,
					strokeWidth: "1",
					children: [
						/* @__PURE__ */ jsx("circle", {
							cx: "47",
							cy: "17",
							r: "8",
							fill: "#7168b8"
						}),
						/* @__PURE__ */ jsx("path", {
							d: "M47 11v6l4 2M16 42h3v4h3v3h-3v-2h-3zM18 11h2v4h3v2h-3v4h-2v-4h-3v-2h3z",
							fill: "none"
						}),
						/* @__PURE__ */ jsx("path", {
							d: "M11 31h5v2h-5zM50 43h3v3h-3z",
							fill: "none"
						})
					]
				})
			]
		}, id)
	});
}
function SkyRunScreen({ characterId: selectedCharacterId, playerName, primaryWalletId, onBack }) {
	const engineRef = useRef(null);
	if (!engineRef.current) engineRef.current = new SkyRunEngine(void 0, SKY_RUN_CONFIG.playerX, { loopWorlds: true });
	const engine = engineRef.current;
	const { playSfx, setMusicIntensity } = useArcadeAudio();
	const characterId = selectedCharacterId ?? "white-fox-ice-mage";
	const character = getCharacterById(characterId);
	const canvasRef = useRef(null);
	const playerRef = useRef(null);
	const [hud, setHud] = useState(() => ({
		phase: engine.phase,
		score: engine.score,
		bestScore: engine.bestScore,
		worldIndex: engine.worldIndex,
		speedMultiplier: engine.snapshot().speedMultiplier,
		coinsCollected: engine.coinsCollected
	}));
	const [matchId, setMatchId] = useState(() => createMatchId("sky-run"));
	const [spriteAnimation, setSpriteAnimation] = useState("idle");
	const [deathBurst, setDeathBurst] = useState(null);
	const previousPhaseRef = useRef(engine.phase);
	const previousGroundedRef = useRef(true);
	const audioMatchIdRef = useRef(matchId);
	const audioStartPlayedRef = useRef(false);
	const audioSnapshotRef = useRef(null);
	const jumpEffectRef = useRef(null);
	const rewardReceipts = useMatchCurrencyRewards(matchId, hud.phase === "gameover" ? [{
		walletId: primaryWalletId,
		playerId: "player-1",
		playerName,
		amount: hud.coinsCollected
	}] : [], primaryWalletId);
	useEffect(() => {
		engine.setBestScore(readBestScore$1());
		const snapshot = engine.snapshot();
		setHud({
			phase: engine.phase,
			score: engine.score,
			bestScore: engine.bestScore,
			worldIndex: engine.worldIndex,
			speedMultiplier: snapshot.speedMultiplier,
			coinsCollected: snapshot.coinsCollected
		});
	}, [engine]);
	useEffect(() => {
		audioMatchIdRef.current = matchId;
		audioStartPlayedRef.current = false;
		audioSnapshotRef.current = {
			phase: engine.phase,
			score: engine.score,
			bestScore: engine.bestScore,
			worldIndex: engine.worldIndex,
			speedMultiplier: engine.snapshot().speedMultiplier,
			coinsCollected: engine.coinsCollected
		};
	}, [engine, matchId]);
	useEffect(() => {
		if (audioMatchIdRef.current !== matchId) {
			audioMatchIdRef.current = matchId;
			audioStartPlayedRef.current = false;
			audioSnapshotRef.current = hud;
			return;
		}
		const previous = audioSnapshotRef.current;
		if (!previous) {
			audioSnapshotRef.current = hud;
			return;
		}
		if (previous.phase !== "playing" && hud.phase === "playing") {
			if (!audioStartPlayedRef.current) playSfx("game-start");
			audioStartPlayedRef.current = true;
		}
		if (hud.phase === "playing" && hud.coinsCollected > previous.coinsCollected) {
			const collected = hud.coinsCollected - previous.coinsCollected;
			playSfx("coin", { volume: Math.min(1.2, .9 + collected * .08) });
		}
		if (hud.worldIndex > previous.worldIndex) playSfx("level-clear");
		if (previous.phase === "playing" && hud.phase === "gameover") playSfx("game-over");
		audioSnapshotRef.current = hud;
	}, [
		hud,
		matchId,
		playSfx
	]);
	useEffect(() => {
		const runProgress = Math.min(1, Math.max(0, (hud.speedMultiplier - 1) / (SKY_RUN_CONFIG.maxSpeedMultiplier - 1)));
		setMusicIntensity(.86 + runProgress * .32);
	}, [hud.speedMultiplier, setMusicIntensity]);
	useEffect(() => () => setMusicIntensity(.86), [setMusicIntensity]);
	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return;
		let frame = 0;
		let previous = performance.now();
		let lastHudKey = "";
		let lastAnimation = "idle";
		let savedBest = engine.bestScore;
		let submittedBest = savedBest;
		const loop = (now) => {
			const dt = Math.min(.05, Math.max(0, (now - previous) / 1e3));
			previous = now;
			engine.step(dt);
			const snapshot = engine.snapshot();
			if (snapshot.phase !== previousPhaseRef.current) {
				if (snapshot.phase === "gameover" && previousPhaseRef.current === "playing") {
					setDeathBurst({
						x: SKY_RUN_CONFIG.playerX,
						y: SKY_RUN_CONFIG.groundY - snapshot.jumpHeight - SKY_RUN_CONFIG.playerSpriteHeight / 3,
						id: now
					});
					jumpEffectRef.current = null;
				} else if (snapshot.phase === "ready") setDeathBurst(null);
				previousPhaseRef.current = snapshot.phase;
			}
			if (snapshot.phase === "playing" && previousGroundedRef.current && !snapshot.isGrounded) jumpEffectRef.current = {
				kind: "takeoff",
				startedAt: now
			};
			else if (snapshot.phase === "playing" && !previousGroundedRef.current && snapshot.isGrounded) jumpEffectRef.current = {
				kind: "landing",
				startedAt: now
			};
			previousGroundedRef.current = snapshot.isGrounded;
			const activeJumpEffect = jumpEffectRef.current;
			const jumpAge = activeJumpEffect ? (now - activeJumpEffect.startedAt) / SKY_RUN_CONFIG.jumpEffectDurationMs : 1;
			const jumpKind = activeJumpEffect && jumpAge < 1 ? activeJumpEffect.kind : null;
			drawSkyRun(ctx, snapshot, now / 1e3, characterId, {
				jumpKind,
				jumpProgress: Math.min(1, jumpAge),
				showFinalPortal: false
			});
			const player = playerRef.current;
			if (player) {
				const playerTop = SKY_RUN_CONFIG.groundY - snapshot.jumpHeight - SKY_RUN_CONFIG.playerSpriteHeight;
				player.style.left = `${SKY_RUN_CONFIG.playerX / SKY_RUN_CONFIG.width * 100}%`;
				player.style.top = `${playerTop / SKY_RUN_CONFIG.height * 100}%`;
			}
			const nextAnimation = snapshot.phase === "gameover" ? "hurt" : snapshot.phase === "ready" ? "idle" : snapshot.isGrounded ? "run" : "jump";
			if (nextAnimation !== lastAnimation) {
				lastAnimation = nextAnimation;
				setSpriteAnimation(nextAnimation);
			}
			const hudKey = `${snapshot.phase}|${snapshot.score}|${snapshot.bestScore}|${snapshot.worldIndex}|${snapshot.speedMultiplier.toFixed(2)}|${snapshot.coinsCollected}`;
			if (hudKey !== lastHudKey) {
				lastHudKey = hudKey;
				setHud({
					phase: snapshot.phase,
					score: snapshot.score,
					bestScore: snapshot.bestScore,
					worldIndex: snapshot.worldIndex,
					speedMultiplier: snapshot.speedMultiplier,
					coinsCollected: snapshot.coinsCollected
				});
			}
			if (snapshot.bestScore > savedBest) {
				savedBest = snapshot.bestScore;
				try {
					window.localStorage.setItem(BEST_SCORE_KEY, String(savedBest));
				} catch {}
			}
			if (snapshot.phase === "gameover" && snapshot.bestScore > submittedBest) {
				submittedBest = snapshot.bestScore;
				submitGlobalRecord("sky-run", snapshot.bestScore);
			}
			frame = requestAnimationFrame(loop);
		};
		frame = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(frame);
	}, [characterId, engine]);
	const handleJumpInput = useCallback(() => {
		const result = engine.pressJump();
		if (result === "started" && !audioStartPlayedRef.current) {
			audioStartPlayedRef.current = true;
			playSfx("game-start");
		}
		if (result === "jumped") {
			playSfx("jump");
			jumpEffectRef.current = {
				kind: "takeoff",
				startedAt: performance.now()
			};
		}
	}, [engine, playSfx]);
	useEffect(() => {
		const handleKeyDown = (event) => {
			if (event.code !== "Space" || event.repeat) return;
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("button, input, textarea, select, [contenteditable='true']")) return;
			event.preventDefault();
			handleJumpInput();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [handleJumpInput]);
	const handleCanvasPointerDown = (event) => {
		if (event.button !== 0) return;
		event.preventDefault();
		handleJumpInput();
	};
	const restart = () => {
		engine.reset();
		setMatchId(createMatchId("sky-run"));
		const snapshot = engine.snapshot();
		previousPhaseRef.current = snapshot.phase;
		previousGroundedRef.current = snapshot.isGrounded;
		jumpEffectRef.current = null;
		setDeathBurst(null);
		setSpriteAnimation("idle");
		setHud({
			phase: snapshot.phase,
			score: snapshot.score,
			bestScore: snapshot.bestScore,
			worldIndex: snapshot.worldIndex,
			speedMultiplier: snapshot.speedMultiplier,
			coinsCollected: snapshot.coinsCollected
		});
	};
	const completeDeathBurst = (id) => {
		setDeathBurst((current) => current?.id === id ? null : current);
	};
	const speedText = `${hud.speedMultiplier.toFixed(2)}×`;
	return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative min-h-screen overflow-hidden px-3 py-4 text-foreground sm:px-6 sm:py-7",
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, { density: "calm" }), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.55rem] text-arcade-violet",
						children: "MAGISTERIUM ARCADE"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl",
						children: "SKY RUN"
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mt-1 font-game text-base text-muted-foreground sm:text-lg",
						children: ["CORRIDA CELESTIAL COM ", character?.shortName ?? "RAPOSA"]
					})
				] }), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "arcade",
					onClick: onBack,
					children: "VOLTAR À MODALIDADE"
				})]
			}), /* @__PURE__ */ jsxs("section", {
				className: "pixel-panel rounded-sm p-3 sm:p-5",
				"aria-label": "Minigame Sky Run",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "mb-3 flex flex-wrap items-center justify-between gap-2",
						children: [/* @__PURE__ */ jsxs("p", {
							className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-xs",
							children: [
								"MUNDO ",
								hud.worldIndex + 1,
								" · ",
								SKY_RUN_WORLD_NAMES[hud.worldIndex] ?? "CÉU ENCANTADO"
							]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/45 px-3 py-2 font-arcade text-[0.48rem] text-arcade-ink sm:text-[0.6rem]",
							"aria-live": "polite",
							"aria-label": `Mundo ${hud.worldIndex + 1}, ${SKY_RUN_WORLD_NAMES[hud.worldIndex] ?? "Céu Encantado"}, pontos ${hud.score}, moedas ${hud.coinsCollected}, melhor ${hud.bestScore}, velocidade ${speedText}`,
							children: [
								/* @__PURE__ */ jsxs("span", { children: ["PONTOS: ", formatScore(hud.score)] }),
								/* @__PURE__ */ jsxs("span", {
									className: "text-arcade-gold",
									children: ["🪙 ", hud.coinsCollected]
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "text-arcade-violet",
									children: ["MELHOR: ", formatScore(hud.bestScore)]
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "hidden text-arcade-cyan sm:inline",
									children: ["RITMO: ", speedText]
								})
							]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "relative aspect-video w-full overflow-hidden border-[3px] border-arcade-panel-border bg-arcade-sky-deep shadow-[0_8px_0_var(--color-arcade-shadow)]",
						children: [
							/* @__PURE__ */ jsx("canvas", {
								ref: canvasRef,
								width: SKY_RUN_CONFIG.width,
								height: SKY_RUN_CONFIG.height,
								className: "absolute inset-0 h-full w-full cursor-pointer touch-none [image-rendering:pixelated]",
								onPointerDown: handleCanvasPointerDown,
								role: "button",
								tabIndex: 0,
								"aria-label": "Sky Run: pressione espaço para iniciar; depois, use espaço ou clique para pular"
							}),
							/* @__PURE__ */ jsxs("div", {
								ref: playerRef,
								className: "pointer-events-none absolute z-10 -translate-x-1/2",
								style: {
									left: `${SKY_RUN_CONFIG.playerX / SKY_RUN_CONFIG.width * 100}%`,
									top: `${(SKY_RUN_CONFIG.groundY - SKY_RUN_CONFIG.playerSpriteHeight) / SKY_RUN_CONFIG.height * 100}%`,
									width: `${SKY_RUN_CONFIG.playerSpriteWidth / SKY_RUN_CONFIG.width * 100}%`,
									height: `${SKY_RUN_CONFIG.playerSpriteHeight / SKY_RUN_CONFIG.height * 100}%`
								},
								"aria-hidden": "true",
								children: [/* @__PURE__ */ jsx("span", { className: "absolute bottom-0 left-1/2 h-[12%] w-[70%] -translate-x-1/2 bg-arcade-cyan/15 shadow-[0_0_18px_var(--color-arcade-cyan)]" }), /* @__PURE__ */ jsx(GameplaySprite, {
									characterId,
									animation: spriteAnimation,
									size: SKY_RUN_CONFIG.playerSpriteWidth,
									facing: "right",
									sourceFacing: "left",
									footAnchored: true,
									className: "absolute inset-0 h-full w-full drop-shadow-[0_0_5px_rgba(210,250,255,0.72)] [image-rendering:pixelated]"
								})]
							}),
							hud.phase === "ready" && /* @__PURE__ */ jsx("div", {
								className: "pointer-events-none absolute inset-0 flex items-center justify-center bg-arcade-ink/12 p-3",
								children: /* @__PURE__ */ jsxs("div", {
									className: "border-2 border-arcade-cloud bg-arcade-panel/95 px-4 py-3 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)] sm:px-7 sm:py-5",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-sm",
											children: "PRESSIONE ESPAÇO PARA CORRER"
										}),
										/* @__PURE__ */ jsx("p", {
											className: "mt-2 font-game text-base text-arcade-ink sm:text-xl",
											children: "depois, pule para desviar dos obstáculos"
										}),
										/* @__PURE__ */ jsx("p", {
											className: "mt-1 font-game text-sm text-muted-foreground sm:text-base",
											children: "ou clique para iniciar a corrida"
										})
									]
								})
							}),
							hud.phase === "gameover" && /* @__PURE__ */ jsxs("div", {
								className: "absolute inset-0 flex items-center justify-center bg-arcade-ink/65 p-3",
								children: [deathBurst && /* @__PURE__ */ jsx(CharacterDeathBurst, {
									...deathBurst,
									characterId,
									onComplete: completeDeathBurst
								}), /* @__PURE__ */ jsxs("div", {
									className: "pixel-panel relative z-10 w-full max-w-sm rounded-sm p-4 text-center sm:p-6",
									children: [
										/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-sm text-arcade-violet sm:text-lg",
											children: "GAME OVER"
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-4 font-arcade text-[0.6rem] text-arcade-ink sm:text-xs",
											children: ["PONTOS: ", formatScore(hud.score)]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-2 font-arcade text-[0.55rem] text-arcade-cyan sm:text-[0.65rem]",
											children: ["MELHOR: ", formatScore(hud.bestScore)]
										}),
										/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
										/* @__PURE__ */ jsx(Button, {
											type: "button",
											variant: "arcade",
											size: "arcade",
											className: "mt-5 w-full",
											onClick: restart,
											children: "JOGAR NOVAMENTE"
										})
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 text-center font-game text-base text-muted-foreground sm:text-lg",
						children: "ESPAÇO ou CLIQUE = pular · só é possível pular novamente depois de aterrissar"
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/features/spellbound/skyrun/bots.ts
var BOT_PROFILES = {
	casual: {
		clearancePixels: 1,
		targetFraction: .58,
		reactionBufferSeconds: .025
	},
	balanced: {
		clearancePixels: 2,
		targetFraction: .58,
		reactionBufferSeconds: .015
	},
	skilled: {
		clearancePixels: 4,
		targetFraction: .78,
		reactionBufferSeconds: .005
	}
};
/**
* Sky Run-specific controller. It solves when the grounded jump arc is high enough
* for the whole horizontal overlap, using the game's real gravity/impulse integration.
*/
var SkyRunBot = class {
	difficulty;
	profile;
	targetObstacleId = null;
	targetFraction = .5;
	constructor(difficulty) {
		this.difficulty = difficulty;
		this.profile = BOT_PROFILES[difficulty];
	}
	update(engine, deltaSeconds) {
		if (engine.phase !== "playing") return;
		const playerLeft = engine.playerX - SKY_RUN_CONFIG.playerHitWidth / 2;
		const playerRight = engine.playerX + SKY_RUN_CONFIG.playerHitWidth / 2;
		const obstacle = engine.obstacles.filter((candidate) => candidate.objectType === "GROUND_OBSTACLE" && candidate.surfaceY === SKY_RUN_CONFIG.groundY).filter((candidate) => candidate.x + candidate.width >= playerLeft).sort((left, right) => left.x - right.x)[0];
		if (!obstacle) {
			this.clearTarget();
			return;
		}
		if (obstacle.id !== this.targetObstacleId) {
			this.targetObstacleId = obstacle.id;
			this.targetFraction = this.profile.targetFraction;
		}
		const speedMultiplier = getSkyRunSpeedMultiplier(engine.distance / SKY_RUN_CONFIG.distancePerPoint);
		const speed = SKY_RUN_CONFIG.baseRunSpeed * speedMultiplier;
		const distanceToEntry = obstacle.x - playerRight;
		const distanceToExit = obstacle.x + obstacle.width - playerLeft;
		if (distanceToExit < 0) {
			this.clearTarget();
			return;
		}
		const physicsStep = Math.max(0, Math.min(.05, deltaSeconds));
		if (physicsStep === 0) return;
		const predictionStep = 1 / 120;
		const secondsToEntry = Math.max(0, distanceToEntry / speed);
		const secondsToExit = Math.max(0, distanceToExit / speed);
		const reactionLeadSeconds = speed * this.profile.reactionBufferSeconds / speed;
		const clearance = getSkyRunJumpClearanceWindow(obstacle.height + this.profile.clearancePixels, predictionStep);
		if (!clearance) return;
		const earliestTakeoff = secondsToExit - clearance.lastSafeSecond;
		const latestTakeoff = secondsToEntry - clearance.firstSafeSecond - reactionLeadSeconds;
		const firstAllowedTakeoff = Math.max(0, earliestTakeoff);
		if (latestTakeoff < firstAllowedTakeoff || latestTakeoff < 0) return;
		const targetTakeoffIn = firstAllowedTakeoff + (latestTakeoff - firstAllowedTakeoff) * this.targetFraction;
		if (engine.isGrounded && targetTakeoffIn <= physicsStep + predictionStep / 2) {
			if (engine.pressJump() === "jumped") this.clearTarget();
		}
	}
	clearTarget() {
		this.targetObstacleId = null;
		this.targetFraction = .5;
	}
};
var SKY_RUN_PLAYER_CONTROLS = [
	"SPACE / CLIQUE",
	"ENTER",
	"W",
	"↑"
];
function clamp$1(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
/** Shared deterministic course; participants finish at the final portal or remain eliminated. */
var SkyRunMultiplayerEngine = class {
	players;
	phase = "countdown";
	winnerId = null;
	voteDecision = null;
	countdownElapsed = 0;
	goLabelRemaining = 0;
	nextEliminationOrder = 1;
	nextFinishOrder = 1;
	seed;
	elapsedSeconds = 0;
	phaseElapsedSeconds = 0;
	votes = /* @__PURE__ */ new Map();
	constructor(participants, seed) {
		if (participants.length < 2 || participants.length > 4) throw new RangeError(`Sky Run Multiplayer aceita de 2 a 4 participantes.`);
		this.seed = (seed ?? (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0) || 1;
		const laneSpacing = 44;
		const firstLaneX = SKY_RUN_CONFIG.playerX - (participants.length - 1) * laneSpacing / 2;
		this.players = participants.map((participant, index) => ({
			id: participant.id,
			name: participant.name.trim() || `JOGADOR ${index + 1}`,
			characterId: participant.characterId,
			isBot: participant.isBot ?? false,
			engine: new SkyRunEngine(this.seed, firstLaneX + index * laneSpacing),
			bot: participant.isBot ? new SkyRunBot(participant.botDifficulty ?? "balanced") : null,
			status: "racing",
			eliminationOrder: null,
			finishOrder: null,
			finishTimeSeconds: null
		}));
	}
	get countdownLabel() {
		if (this.phase === "countdown") return String(Math.max(1, 3 - Math.floor(this.countdownElapsed)));
		return this.phase === "playing" && this.goLabelRemaining > 0 ? "VAI!" : null;
	}
	jump(playerId) {
		if (this.phase !== "playing") return "ignored";
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || player.status !== "racing") return "ignored";
		return player.engine.pressJump();
	}
	vote(playerId, choice) {
		if (this.phase !== "voting") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot) return false;
		this.votes.set(playerId, choice);
		if (this.votes.size >= this.humanVoterCount) this.resolveVote();
		return true;
	}
	step(deltaSeconds) {
		const dt = clamp$1(deltaSeconds, 0, .05);
		if (dt === 0) return;
		if (this.phase === "countdown") {
			this.countdownElapsed += dt;
			if (this.countdownElapsed >= 3) {
				this.phase = "playing";
				for (const player of this.players) player.engine.pressJump();
				this.goLabelRemaining = .55;
			}
			return;
		}
		if (this.phase === "playing") {
			this.stepRace(dt);
			return;
		}
		if (this.phase === "results") {
			this.phaseElapsedSeconds += dt;
			if (this.phaseElapsedSeconds >= 2.4) {
				this.phase = "voting";
				this.phaseElapsedSeconds = 0;
			}
			return;
		}
		if (this.phase === "voting") {
			this.phaseElapsedSeconds += dt;
			if (this.phaseElapsedSeconds >= 10) this.resolveVote();
			return;
		}
		if (this.phase === "decision") {
			this.phaseElapsedSeconds += dt;
			if (this.phaseElapsedSeconds >= 2.2) this.phase = this.voteDecision === "change-game" ? "change-game" : "rematch";
		}
	}
	snapshot() {
		const worldPlayer = this.players.find((player) => player.status === "racing") ?? this.players.find((player) => player.finishOrder === 1) ?? this.players.reduce((furthest, player) => player.engine.distance > furthest.engine.distance ? player : furthest);
		const players = this.players.map((player) => this.toSnapshotPlayer(player));
		return {
			phase: this.phase,
			countdownLabel: this.countdownLabel,
			winnerId: this.winnerId,
			world: worldPlayer.engine.snapshot(),
			players,
			ranking: this.rankedPlayers().map((player) => this.toSnapshotPlayer(player)),
			elapsedSeconds: this.elapsedSeconds,
			votingSecondsRemaining: this.phase === "voting" ? Math.max(0, Math.ceil(10 - this.phaseElapsedSeconds)) : 0,
			decisionSecondsRemaining: this.phase === "decision" ? Math.max(0, 2.2 - this.phaseElapsedSeconds) : 0,
			voteCounts: this.voteCounts(),
			humanVoterCount: this.humanVoterCount,
			voteDecision: this.voteDecision
		};
	}
	stepRace(dt) {
		this.elapsedSeconds += dt;
		this.goLabelRemaining = Math.max(0, this.goLabelRemaining - dt);
		for (const player of this.players) {
			if (player.status !== "racing") continue;
			player.bot?.update(player.engine, dt);
			const wasPlaying = player.engine.phase === "playing";
			player.engine.step(dt);
			if (wasPlaying && player.engine.phase === "gameover") {
				player.status = "eliminated";
				player.eliminationOrder = this.nextEliminationOrder++;
				continue;
			}
			if (player.engine.distance >= SKY_RUN_TOTAL_DISTANCE) {
				player.engine.distance = SKY_RUN_TOTAL_DISTANCE;
				player.engine.score = Math.floor(SKY_RUN_TOTAL_DISTANCE / SKY_RUN_CONFIG.distancePerPoint);
				player.engine.setBestScore(player.engine.score);
				player.status = "finished";
				player.finishOrder = this.nextFinishOrder++;
				player.finishTimeSeconds = this.elapsedSeconds;
			}
		}
		if (!this.players.some((player) => player.status === "racing")) {
			this.winnerId = this.rankedPlayers().find((player) => player.status === "finished")?.id ?? null;
			this.phase = "results";
			this.phaseElapsedSeconds = 0;
		}
	}
	resolveVote() {
		if (this.phase !== "voting") return;
		const counts = this.voteCounts();
		const requiredVotes = this.humanVoterCount / 2;
		this.voteDecision = counts["change-game"] > requiredVotes ? "change-game" : "rematch";
		this.phase = "decision";
		this.phaseElapsedSeconds = 0;
	}
	get humanVoterCount() {
		return this.players.filter((player) => !player.isBot).length;
	}
	voteCounts() {
		let rematch = 0;
		let changeGame = 0;
		for (const [playerId, choice] of this.votes) {
			if (this.players.find((player) => player.id === playerId)?.isBot) continue;
			if (choice === "rematch") rematch += 1;
			else changeGame += 1;
		}
		return {
			rematch,
			"change-game": changeGame
		};
	}
	toSnapshotPlayer(player) {
		const snapshot = player.engine.snapshot();
		return {
			id: player.id,
			name: player.name,
			characterId: player.characterId,
			isBot: player.isBot,
			phase: snapshot.phase,
			status: player.status,
			score: snapshot.score,
			distance: snapshot.distance,
			bestScore: snapshot.bestScore,
			playerX: player.engine.playerX,
			jumpHeight: snapshot.jumpHeight,
			playerVelocityY: snapshot.playerVelocityY,
			isGrounded: snapshot.isGrounded,
			coins: snapshot.coins,
			coinsCollected: snapshot.coinsCollected,
			eliminationOrder: player.eliminationOrder,
			finishOrder: player.finishOrder,
			finishTimeSeconds: player.finishTimeSeconds
		};
	}
	rankedPlayers() {
		return [...this.players].sort((a, b) => {
			if (a.status === "finished" && b.status !== "finished") return -1;
			if (b.status === "finished" && a.status !== "finished") return 1;
			if (a.status === "finished" && b.status === "finished") return (a.finishOrder ?? Number.MAX_SAFE_INTEGER) - (b.finishOrder ?? Number.MAX_SAFE_INTEGER);
			if (a.status === "eliminated" && b.status === "eliminated") {
				const eliminationDifference = (b.eliminationOrder ?? 0) - (a.eliminationOrder ?? 0);
				if (eliminationDifference !== 0) return eliminationDifference;
			}
			return b.engine.score - a.engine.score;
		});
	}
};
//#endregion
//#region src/features/spellbound/skyrun/SkyRunMultiplayerScreen.tsx
var PLAYER_KEYS = [
	"Space",
	"Enter",
	"KeyW",
	"ArrowUp"
];
function initialParticipants(playerName, selectedCharacterId, mode) {
	const playerOne = {
		id: "player-1",
		name: playerName.trim() || "JOGADOR",
		characterId: selectedCharacterId ?? playableCharacterSeeds[0].id,
		isBot: false
	};
	if (mode === "local") return [playerOne, {
		id: "player-2",
		name: "JOGADOR 2",
		characterId: playableCharacterSeeds[1].id,
		isBot: false
	}];
	return [
		playerOne,
		{
			id: "bot-1",
			name: "BOT FÁCIL",
			characterId: playableCharacterSeeds[1].id,
			isBot: true,
			botDifficulty: "casual"
		},
		{
			id: "bot-2",
			name: "BOT MÉDIO",
			characterId: playableCharacterSeeds[2].id,
			isBot: true,
			botDifficulty: "balanced"
		},
		{
			id: "bot-3",
			name: "BOT HÁBIL",
			characterId: playableCharacterSeeds[3].id,
			isBot: true,
			botDifficulty: "skilled"
		}
	];
}
function createWorldPlayerSnapshot(world, player) {
	return {
		...world,
		phase: player.phase,
		score: player.score,
		bestScore: player.bestScore,
		jumpHeight: player.jumpHeight,
		playerVelocityY: player.playerVelocityY,
		isGrounded: player.isGrounded
	};
}
function LivePlayerScoreRow({ player, place }) {
	playableCharacterSeeds.find((entry) => entry.id === player.characterId);
	const statusLabel = player.status === "finished" ? "FINALIZADO" : player.status === "eliminated" ? "ELIMINADO" : "CORRENDO";
	return /* @__PURE__ */ jsxs("li", {
		className: `grid min-w-0 grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1 border-b border-arcade-panel-border/50 px-1 py-0.5 text-[0.38rem] last:border-0 sm:text-[0.45rem] ${player.status === "racing" ? "" : "opacity-60"}`,
		"aria-label": `${place}º, ${player.name}, ${player.score} pontos, ${statusLabel.toLocaleLowerCase()}`,
		title: `${place}º · ${player.name} · ${player.score} pontos · ${statusLabel}`,
		children: [
			/* @__PURE__ */ jsxs("span", {
				className: "font-arcade text-arcade-violet",
				children: [place, "º"]
			}),
			/* @__PURE__ */ jsx("span", {
				className: `min-w-0 truncate font-arcade leading-tight ${player.id === "player-1" ? "text-arcade-cyan" : "text-arcade-ink"}`,
				children: player.name.toLocaleUpperCase()
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "font-arcade text-arcade-cyan",
				children: [
					Math.floor(player.score),
					" · 🪙 ",
					player.coinsCollected
				]
			})
		]
	});
}
function PlayerScoreRow({ player, place }) {
	const character = playableCharacterSeeds.find((entry) => entry.id === player.characterId);
	const statusLabel = player.status === "finished" ? "FINALIZADO" : player.status === "eliminated" ? "ELIMINADO" : "CORRENDO";
	return /* @__PURE__ */ jsxs("li", {
		className: `grid grid-cols-[1.5rem_2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-arcade-panel-border/50 px-2 py-1.5 last:border-0 ${player.phase === "gameover" ? "opacity-55" : ""}`,
		"aria-label": `${place}º, ${player.name}, ${character?.shortName ?? "personagem"}, ${player.score} pontos, ${statusLabel.toLocaleLowerCase()}`,
		children: [
			/* @__PURE__ */ jsxs("span", {
				className: "font-arcade text-[0.48rem] text-arcade-violet",
				children: [place, "º"]
			}),
			/* @__PURE__ */ jsx("img", {
				src: character?.sprite,
				alt: "",
				"aria-hidden": "true",
				width: 30,
				height: 30,
				className: "h-7 w-7 object-contain [image-rendering:pixelated]"
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "min-w-0 truncate font-arcade text-[0.45rem] text-arcade-ink sm:text-[0.55rem]",
				children: [
					player.name.toLocaleUpperCase(),
					" ",
					player.isBot ? "· BOT" : "· VOCÊ",
					/* @__PURE__ */ jsxs("span", {
						className: "block text-[0.38rem] text-muted-foreground sm:text-[0.45rem]",
						children: [
							character?.shortName,
							" · ",
							statusLabel,
							` · 🪙 ${player.coinsCollected}`,
							player.finishTimeSeconds !== null ? ` · ${player.finishTimeSeconds.toFixed(1)} s` : ` · DIST. ${Math.floor(player.distance)}`
						]
					})
				]
			}),
			/* @__PURE__ */ jsx("span", {
				className: "font-arcade text-[0.45rem] text-arcade-cyan sm:text-[0.55rem]",
				children: player.score
			})
		]
	});
}
function SkyRunMultiplayerScreen({ playerName, selectedCharacterId, primaryWalletId, mode = "bots", onBack, onChangeGame }) {
	const { playSfx, setMusicIntensity } = useArcadeAudio();
	const [stage, setStage] = useState("setup");
	const participants = useRef(initialParticipants(playerName, selectedCharacterId, mode));
	const engineRef = useRef(null);
	const canvasRef = useRef(null);
	const playerRefs = useRef(/* @__PURE__ */ new Map());
	const previousGroundedRef = useRef(/* @__PURE__ */ new Map());
	const jumpEffectsRef = useRef(/* @__PURE__ */ new Map());
	const [snapshot, setSnapshot] = useState(null);
	const previousAudioSnapshotRef = useRef(null);
	const audioEndPlayedRef = useRef(false);
	const [isSpectating, setIsSpectating] = useState(false);
	const [selectedVotes, setSelectedVotes] = useState({});
	const [matchId, setMatchId] = useState(() => createMatchId("sky-run"));
	const submittedGlobalRecordRef = useRef(null);
	const matchIsFinal = snapshot !== null && [
		"results",
		"voting",
		"decision",
		"rematch",
		"change-game"
	].includes(snapshot.phase);
	const rewardReceipts = useMatchCurrencyRewards(matchId, snapshot?.players.flatMap((player) => {
		if (player.isBot || player.status === "racing" && !matchIsFinal) return [];
		const humanSlot = snapshot.players.filter((candidate) => !candidate.isBot).findIndex((candidate) => candidate.id === player.id);
		return [{
			walletId: humanSlot === 0 ? primaryWalletId : walletIdForLocalSlot(humanSlot),
			playerId: player.id,
			playerName: player.name,
			amount: player.coinsCollected
		}];
	}) ?? [], primaryWalletId);
	useEffect(() => {
		if (!matchIsFinal || !snapshot) return;
		const primaryPlayer = snapshot.players.find((player) => player.id === "player-1" && !player.isBot);
		if (!primaryPlayer || primaryPlayer.score <= 0) return;
		const submissionKey = `${matchId}:${primaryPlayer.score}`;
		if (submittedGlobalRecordRef.current === submissionKey) return;
		submittedGlobalRecordRef.current = submissionKey;
		submitGlobalRecord("sky-run", primaryPlayer.score);
	}, [
		matchId,
		matchIsFinal,
		snapshot
	]);
	useEffect(() => {
		if (!snapshot) return;
		const previous = previousAudioSnapshotRef.current;
		if (!previous) {
			if (snapshot.phase === "countdown") playSfx("countdown");
			previousAudioSnapshotRef.current = snapshot;
			return;
		}
		if (snapshot.phase === "countdown" && previous.phase === "countdown" && snapshot.countdownLabel !== previous.countdownLabel) playSfx("countdown");
		if (previous.phase === "countdown" && snapshot.phase === "playing") playSfx("game-start");
		for (const player of snapshot.players) {
			if (player.isBot) continue;
			const oldPlayer = previous.players.find((entry) => entry.id === player.id);
			if (!oldPlayer) continue;
			if (player.coinsCollected > oldPlayer.coinsCollected) {
				const collected = player.coinsCollected - oldPlayer.coinsCollected;
				playSfx("coin", { volume: Math.min(1.2, .9 + collected * .08) });
			}
			if (player.status === "finished" && oldPlayer.status === "racing") playSfx("level-clear", { volume: .72 });
		}
		const primary = snapshot.players.find((player) => player.id === "player-1" && !player.isBot);
		const oldPrimary = previous.players.find((player) => player.id === "player-1" && !player.isBot);
		if (!audioEndPlayedRef.current && primary?.status === "eliminated" && oldPrimary?.status !== "eliminated") {
			audioEndPlayedRef.current = true;
			playSfx("game-over");
		} else if (!audioEndPlayedRef.current && previous.phase === "playing" && snapshot.phase === "results" && primary) {
			audioEndPlayedRef.current = true;
			playSfx(snapshot.winnerId === primary.id ? "win" : "game-over");
		}
		if (snapshot.world.worldIndex > previous.world.worldIndex) playSfx("level-clear");
		previousAudioSnapshotRef.current = snapshot;
	}, [playSfx, snapshot]);
	const runMusicIntensity = .86 + Math.min(1, Math.max(0, ((snapshot?.world.speedMultiplier ?? 1) - 1) / (SKY_RUN_CONFIG.maxSpeedMultiplier - 1))) * .32;
	useEffect(() => {
		setMusicIntensity(runMusicIntensity);
	}, [runMusicIntensity, setMusicIntensity]);
	useEffect(() => () => setMusicIntensity(.86), [setMusicIntensity]);
	const startMatch = () => {
		const configs = participants.current.map((participant) => ({
			id: participant.id,
			name: participant.name,
			characterId: participant.characterId,
			isBot: participant.isBot,
			...participant.botDifficulty ? { botDifficulty: participant.botDifficulty } : {}
		}));
		const engine = new SkyRunMultiplayerEngine(configs);
		engineRef.current = engine;
		previousGroundedRef.current = new Map(configs.map((participant) => [participant.id, true]));
		jumpEffectsRef.current.clear();
		setIsSpectating(false);
		setSelectedVotes({});
		previousAudioSnapshotRef.current = null;
		audioEndPlayedRef.current = false;
		setMatchId(createMatchId("sky-run"));
		setSnapshot(engine.snapshot());
		setStage("match");
	};
	useEffect(() => {
		if (stage !== "match") return;
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context || !engineRef.current) return;
		let frame = 0;
		let previousTime = performance.now();
		let previousHudKey = "";
		const loop = (now) => {
			const engine = engineRef.current;
			if (!engine) return;
			const deltaSeconds = Math.min(.05, Math.max(0, (now - previousTime) / 1e3));
			previousTime = now;
			engine.step(deltaSeconds);
			const current = engine.snapshot();
			const time = now / 1e3;
			const visibleCoins = new Map(current.players.filter((player) => player.status === "racing").flatMap((player) => player.coins).map((coin) => [coin.id, coin]));
			drawSkyRunWorld(context, {
				...current.world,
				coins: [...visibleCoins.values()]
			}, time);
			for (const player of current.players) {
				const playerElement = playerRefs.current.get(player.id);
				const playerTop = SKY_RUN_CONFIG.groundY - player.jumpHeight - SKY_RUN_CONFIG.multiplayerPlayerSpriteSize;
				if (playerElement) {
					playerElement.style.left = `${player.playerX / SKY_RUN_CONFIG.width * 100}%`;
					playerElement.style.top = `${playerTop / SKY_RUN_CONFIG.height * 100}%`;
					playerElement.style.opacity = player.status === "racing" ? "1" : "0";
				}
				if (player.status !== "racing") {
					previousGroundedRef.current.set(player.id, player.isGrounded);
					continue;
				}
				const wasGrounded = previousGroundedRef.current.get(player.id) ?? true;
				if (player.phase === "playing" && wasGrounded && !player.isGrounded) jumpEffectsRef.current.set(player.id, {
					kind: "takeoff",
					startedAt: now
				});
				else if (player.phase === "playing" && !wasGrounded && player.isGrounded) jumpEffectsRef.current.set(player.id, {
					kind: "landing",
					startedAt: now
				});
				previousGroundedRef.current.set(player.id, player.isGrounded);
				const effect = jumpEffectsRef.current.get(player.id);
				const jumpProgress = effect ? (now - effect.startedAt) / SKY_RUN_CONFIG.jumpEffectDurationMs : 1;
				const visualSnapshot = createWorldPlayerSnapshot(current.world, player);
				drawSkyRunPlayerEffects(context, visualSnapshot, time, player.characterId, {
					jumpKind: effect && jumpProgress < 1 ? effect.kind : null,
					jumpProgress: Math.min(1, jumpProgress)
				}, player.playerX);
			}
			const hudKey = [
				current.phase,
				current.countdownLabel,
				current.winnerId,
				current.world.worldIndex,
				current.votingSecondsRemaining,
				current.voteDecision,
				current.voteCounts.rematch,
				current.voteCounts["change-game"],
				...current.players.flatMap((player) => [
					player.id,
					player.phase,
					player.status,
					player.isGrounded,
					player.score,
					player.coinsCollected
				])
			].join("|");
			if (hudKey !== previousHudKey) {
				previousHudKey = hudKey;
				setSnapshot(current);
			}
			frame = window.requestAnimationFrame(loop);
		};
		frame = window.requestAnimationFrame(loop);
		return () => window.cancelAnimationFrame(frame);
	}, [stage]);
	useEffect(() => {
		if (stage !== "match") return;
		const handleKeyDown = (event) => {
			if (event.repeat) return;
			const index = PLAYER_KEYS.indexOf(event.code);
			if (index < 0) return;
			const target = event.target;
			if (target instanceof HTMLElement && target.closest("button, input, textarea, select, [contenteditable='true']")) return;
			event.preventDefault();
			const playerId = `player-${index + 1}`;
			if (!isSpectating || playerId !== "player-1") {
				const result = engineRef.current?.jump(playerId);
				if (result && result !== "ignored") playSfx("jump");
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		isSpectating,
		playSfx,
		stage
	]);
	const handlePointerDown = (event) => {
		if (event.button !== 0 || isSpectating) return;
		event.preventDefault();
		const result = engineRef.current?.jump("player-1");
		if (result && result !== "ignored") playSfx("jump");
	};
	const resetToSetup = () => {
		engineRef.current = null;
		setSnapshot(null);
		setIsSpectating(false);
		setSelectedVotes({});
		setStage("setup");
	};
	useEffect(() => {
		if (snapshot?.phase === "rematch") resetToSetup();
		else if (snapshot?.phase === "change-game") onChangeGame();
	}, [onChangeGame, snapshot?.phase]);
	const castVote = (playerId, choice) => {
		if (engineRef.current?.vote(playerId, choice)) setSelectedVotes((current) => ({
			...current,
			[playerId]: choice
		}));
	};
	const orderedPlayers = snapshot?.ranking ?? [];
	const humanControls = mode === "local" ? `P1 ${SKY_RUN_PLAYER_CONTROLS[0]} · P2 ${SKY_RUN_PLAYER_CONTROLS[1]}` : SKY_RUN_PLAYER_CONTROLS[0];
	const localPlayer = snapshot?.players.find((player) => player.id === "player-1");
	const worldIndex = snapshot?.world.worldIndex ?? 0;
	const worldName = SKY_RUN_WORLD_NAMES[worldIndex] ?? SKY_RUN_WORLD_NAMES[0];
	const speedMultiplier = snapshot?.world.speedMultiplier ?? 1;
	return /* @__PURE__ */ jsxs("main", {
		className: `celestial-sky relative overflow-hidden text-foreground ${stage === "match" ? "min-h-dvh px-2 py-2 sm:px-4 sm:py-3" : "min-h-screen px-3 py-4 sm:px-6 sm:py-7"}`,
		children: [/* @__PURE__ */ jsx(PixelSceneDecor, { density: "calm" }), /* @__PURE__ */ jsxs("div", {
			className: `relative z-10 mx-auto flex w-full max-w-6xl flex-col ${stage === "match" ? "gap-2" : "gap-4"}`,
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex flex-wrap items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "font-arcade text-[0.55rem] text-arcade-violet",
					children: "MAGISTERIUM ARCADE"
				}), /* @__PURE__ */ jsxs("h1", {
					className: "pixel-title text-2xl leading-relaxed text-arcade-ink sm:text-3xl",
					children: [
						"SKY RUN",
						" ",
						/* @__PURE__ */ jsx("span", {
							className: "text-arcade-cyan",
							children: mode === "local" ? "PARTIDA LOCAL" : "MULTIPLAYER"
						})
					]
				})] }), /* @__PURE__ */ jsx(Button, {
					type: "button",
					variant: "arcade",
					size: "arcade",
					onClick: onBack,
					children: "VOLTAR ÀS OPÇÕES"
				})]
			}), stage === "setup" ? /* @__PURE__ */ jsxs("section", {
				className: "pixel-panel rounded-sm p-4 sm:p-6",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs",
						children: mode === "local" ? "PARTIDA LOCAL · MESMO PERCURSO" : "PARTIDA CONTRA BOTS · MESMO PERCURSO"
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "pixel-title mt-2 text-xl text-arcade-ink sm:text-2xl",
						children: mode === "local" ? "DUAS PESSOAS · CONTROLES SEPARADOS" : "CORRA CONTRA A IA"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 font-game text-base text-muted-foreground sm:text-lg",
						children: mode === "local" ? "Cada jogador controla seu próprio corredor no mesmo percurso." : "Cada corredor mantém seu estado e toma decisões de salto próprias."
					}),
					/* @__PURE__ */ jsx("ul", {
						className: "mt-5 grid gap-3 sm:grid-cols-2",
						children: participants.current.map((participant, index) => {
							const character = playableCharacterSeeds.find((entry) => entry.id === participant.characterId);
							return /* @__PURE__ */ jsxs("li", {
								className: "flex items-center gap-3 border-2 border-arcade-panel-border bg-arcade-sky/45 p-3",
								children: [
									/* @__PURE__ */ jsx("img", {
										src: character?.sprite,
										alt: "",
										"aria-hidden": "true",
										width: 42,
										height: 42,
										className: "h-10 w-10 object-contain [image-rendering:pixelated]"
									}),
									/* @__PURE__ */ jsxs("span", {
										className: "min-w-0 flex-1",
										children: [/* @__PURE__ */ jsx("span", {
											className: "block truncate font-arcade text-[0.52rem] text-arcade-ink sm:text-[0.62rem]",
											children: participant.name.toLocaleUpperCase()
										}), /* @__PURE__ */ jsxs("span", {
											className: "mt-1 block font-game text-sm text-muted-foreground",
											children: [
												character?.shortName,
												" ·",
												" ",
												participant.isBot ? `IA ${participant.botDifficulty}` : "JOGADOR"
											]
										})]
									}),
									/* @__PURE__ */ jsx("span", {
										className: "font-arcade text-[0.48rem] text-arcade-violet",
										children: participant.isBot ? "BOT" : `P${index + 1}`
									})
								]
							}, participant.id);
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-5 flex flex-col items-center gap-3",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-center font-game text-base text-muted-foreground",
							children: mode === "local" ? `CONTROLES: ${humanControls}` : `CONTROLE: ${humanControls} · OS BOTS USAM IA DE CORRIDA`
						}), /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "arcade",
							size: "arcade",
							className: "w-full max-w-md",
							onClick: startMatch,
							children: "INICIAR PARTIDA"
						})]
					})
				]
			}) : /* @__PURE__ */ jsxs("section", {
				className: "pixel-panel rounded-sm p-2 sm:p-3",
				"aria-label": "Sky Run Multiplayer",
				children: [mode === "local" && snapshot?.phase === "playing" && localPlayer?.status === "eliminated" && !isSpectating && /* @__PURE__ */ jsxs("section", {
					role: "status",
					"aria-live": "polite",
					className: "mb-2 flex flex-wrap items-center justify-between gap-2 border-2 border-arcade-pink bg-arcade-sky/80 px-3 py-2",
					children: [/* @__PURE__ */ jsx("p", {
						className: "font-arcade text-[0.48rem] text-arcade-pink sm:text-[0.56rem]",
						children: "P1 FOI ELIMINADO · P2 CONTINUA NO PERCURSO"
					}), /* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap gap-2",
						children: [/* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "arcade",
							size: "arcade",
							onClick: onBack,
							children: "SAIR DA PARTIDA"
						}), /* @__PURE__ */ jsx(Button, {
							type: "button",
							variant: "arcade",
							size: "arcade",
							onClick: () => setIsSpectating(true),
							children: "CONTINUAR COMO ESPECTADOR"
						})]
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "relative mx-auto aspect-video w-full overflow-hidden border-[3px] border-arcade-panel-border bg-arcade-sky-deep shadow-[0_8px_0_var(--color-arcade-shadow)]",
					style: { maxWidth: "calc(177.78dvh - 245px)" },
					children: [
						/* @__PURE__ */ jsx("canvas", {
							ref: canvasRef,
							width: SKY_RUN_CONFIG.width,
							height: SKY_RUN_CONFIG.height,
							className: "absolute inset-0 h-full w-full cursor-pointer touch-none [image-rendering:pixelated]",
							onPointerDown: handlePointerDown,
							role: "button",
							tabIndex: 0,
							"aria-label": mode === "local" ? "Sky Run local: P1 usa Espaço ou clique; P2 usa Enter para pular" : "Sky Run Multiplayer: Space ou clique para pular"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "pointer-events-none absolute inset-x-2 top-2 z-20 flex items-start gap-2 sm:inset-x-3 sm:top-3",
							"aria-label": "HUD do Sky Run",
							children: [/* @__PURE__ */ jsxs("div", {
								className: `min-w-0 rounded-sm border border-arcade-panel-border bg-arcade-panel/90 px-2 py-1.5 shadow-sm backdrop-blur-sm ${isSpectating ? "flex-1" : "w-fit max-w-full"}`,
								children: [/* @__PURE__ */ jsxs("p", {
									className: "truncate font-arcade text-[0.38rem] leading-tight text-arcade-cyan sm:text-[0.48rem]",
									children: [
										"MUNDO ",
										worldIndex + 1,
										"/",
										SKY_RUN_WORLD_NAMES.length,
										" · ",
										worldName,
										worldIndex === SKY_RUN_WORLD_NAMES.length - 1 ? " · ÚLTIMO MAPA" : ""
									]
								}), /* @__PURE__ */ jsxs("p", {
									className: "mt-0.5 font-arcade text-[0.38rem] leading-tight text-arcade-violet sm:text-[0.48rem]",
									children: [
										"PERCURSO · ",
										speedMultiplier.toFixed(2),
										"×"
									]
								})]
							}), isSpectating && /* @__PURE__ */ jsx("span", {
								className: "shrink-0 rounded-sm border border-arcade-cyan bg-arcade-panel/90 px-2 py-1.5 font-arcade text-[0.38rem] leading-tight text-arcade-cyan shadow-sm backdrop-blur-sm sm:text-[0.48rem]",
								children: "ESPECTANDO"
							})]
						}),
						/* @__PURE__ */ jsxs("ol", {
							className: "pointer-events-none absolute right-2 top-9 z-20 grid w-40 max-w-[56%] grid-cols-1 overflow-hidden rounded-sm border border-arcade-panel-border bg-arcade-panel/90 p-1 shadow-sm backdrop-blur-sm sm:right-3 sm:top-14 sm:w-52 sm:max-w-[42%]",
							"aria-live": "off",
							"aria-label": "Classificação ao vivo",
							children: [/* @__PURE__ */ jsx("li", {
								className: "border-b border-arcade-panel-border/70 px-1 pb-1 font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.4rem]",
								children: "RANKING"
							}), orderedPlayers.map((player, index) => /* @__PURE__ */ jsx(LivePlayerScoreRow, {
								player,
								place: index + 1
							}, player.id))]
						}),
						snapshot?.players.filter((player) => player.status === "racing").map((player, index) => {
							const character = playableCharacterSeeds.find((entry) => entry.id === player.characterId);
							return /* @__PURE__ */ jsxs("div", {
								ref: (element) => {
									if (element) playerRefs.current.set(player.id, element);
									else playerRefs.current.delete(player.id);
								},
								className: "pointer-events-none absolute z-10 -translate-x-1/2",
								style: {
									left: `${player.playerX / SKY_RUN_CONFIG.width * 100}%`,
									top: `${(SKY_RUN_CONFIG.groundY - player.jumpHeight - SKY_RUN_CONFIG.multiplayerPlayerSpriteSize) / SKY_RUN_CONFIG.height * 100}%`,
									width: `${SKY_RUN_CONFIG.multiplayerPlayerSpriteSize / SKY_RUN_CONFIG.width * 100}%`,
									height: `${SKY_RUN_CONFIG.multiplayerPlayerSpriteSize / SKY_RUN_CONFIG.height * 100}%`
								},
								"aria-hidden": "true",
								"data-player-id": player.id,
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "absolute -top-4 left-1/2 max-w-[58px] -translate-x-1/2 truncate border border-arcade-panel-border bg-arcade-panel/90 px-1 py-0.5 font-arcade text-[0.32rem] text-arcade-ink",
										children: player.isBot ? `BOT ${index}` : player.name.toLocaleUpperCase()
									}),
									/* @__PURE__ */ jsx(GameplaySprite, {
										characterId: player.characterId,
										animation: player.phase === "gameover" ? "hurt" : player.isGrounded ? "run" : "jump",
										size: SKY_RUN_CONFIG.multiplayerPlayerSpriteSize,
										facing: "right",
										sourceFacing: "left",
										footAnchored: true,
										className: "absolute inset-0 h-full w-full [image-rendering:pixelated]"
									}),
									/* @__PURE__ */ jsxs("span", {
										className: "sr-only",
										children: [
											player.name,
											", ",
											character?.shortName,
											", ",
											player.phase
										]
									})
								]
							}, player.id);
						}),
						snapshot?.countdownLabel && /* @__PURE__ */ jsx("div", {
							className: "pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-arcade-ink/15",
							children: /* @__PURE__ */ jsx("div", {
								className: "pixel-panel min-w-36 px-7 py-5 text-center shadow-[5px_5px_0_var(--color-arcade-shadow)]",
								children: /* @__PURE__ */ jsx("p", {
									className: "font-arcade text-3xl text-arcade-violet sm:text-5xl",
									children: snapshot.countdownLabel
								})
							})
						}),
						snapshot && [
							"results",
							"voting",
							"decision"
						].includes(snapshot.phase) && /* @__PURE__ */ jsx("div", {
							className: "absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-arcade-ink/80 p-3 sm:p-5",
							children: /* @__PURE__ */ jsxs("div", {
								className: "pixel-panel my-auto w-full max-w-lg rounded-sm p-4 text-center sm:p-6",
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "font-arcade text-sm text-arcade-violet sm:text-lg",
										children: "CORRIDA FINALIZADA"
									}),
									snapshot.winnerId ? /* @__PURE__ */ jsxs("p", {
										className: "mt-2 font-game text-lg text-arcade-ink",
										children: [snapshot.players.find((player) => player.id === snapshot.winnerId)?.name, " chegou primeiro ao portal."]
									}) : /* @__PURE__ */ jsx("p", {
										className: "mt-2 font-game text-base text-muted-foreground",
										children: "Todos foram eliminados; a classificação considera a ordem de eliminação e a distância."
									}),
									/* @__PURE__ */ jsx("h2", {
										className: "mt-5 font-arcade text-[0.58rem] text-arcade-cyan sm:text-xs",
										children: "RESULTADO FINAL"
									}),
									/* @__PURE__ */ jsx("ol", {
										className: "mt-2 border-2 border-arcade-panel-border bg-arcade-sky/55 text-left",
										children: snapshot.ranking.map((player, index) => /* @__PURE__ */ jsx(PlayerScoreRow, {
											player,
											place: index + 1
										}, player.id))
									}),
									/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
									snapshot.phase === "results" && /* @__PURE__ */ jsx("p", {
										className: "mt-4 font-game text-sm text-muted-foreground",
										children: "RESULTADO REGISTRADO · VOTAÇÃO EM INSTANTES"
									}),
									snapshot.phase === "voting" && /* @__PURE__ */ jsxs("div", {
										className: "mt-4 border-2 border-arcade-panel-border bg-arcade-sky/70 p-3",
										children: [
											/* @__PURE__ */ jsxs("h3", {
												className: "font-arcade text-[0.55rem] text-arcade-violet sm:text-xs",
												children: [
													"VOTAÇÃO — ",
													snapshot.votingSecondsRemaining,
													" SEGUNDOS"
												]
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "mt-2 font-game text-sm text-arcade-ink",
												children: [
													"REVANCHE: ",
													snapshot.voteCounts.rematch,
													" voto(s) · MUDAR DE JOGO:",
													" ",
													snapshot.voteCounts["change-game"],
													" voto(s)"
												]
											}),
											/* @__PURE__ */ jsx("div", {
												className: "mt-3 grid gap-3 sm:grid-cols-2",
												children: snapshot.players.filter((voter) => !voter.isBot).map((voter, voterIndex) => {
													const voterChoice = selectedVotes[voter.id] ?? null;
													return /* @__PURE__ */ jsxs("div", {
														className: "border border-arcade-panel-border/70 p-2",
														children: [
															/* @__PURE__ */ jsx("p", {
																className: "font-arcade text-[0.42rem] text-arcade-violet",
																children: mode === "local" ? `P${voterIndex + 1} · ${voter.name}` : "SEU VOTO"
															}),
															/* @__PURE__ */ jsxs("div", {
																className: "mt-2 flex flex-col gap-2",
																children: [/* @__PURE__ */ jsx(Button, {
																	type: "button",
																	variant: "arcade",
																	size: "arcade",
																	className: "flex-1",
																	disabled: voterChoice !== null,
																	onClick: () => castVote(voter.id, "rematch"),
																	children: voterChoice === "rematch" ? "VOTO: REVANCHE" : "REVANCHE"
																}), /* @__PURE__ */ jsx(Button, {
																	type: "button",
																	variant: "arcade",
																	size: "arcade",
																	className: "flex-1",
																	disabled: voterChoice !== null,
																	onClick: () => castVote(voter.id, "change-game"),
																	children: voterChoice === "change-game" ? "VOTO: MUDAR DE JOGO" : "MUDAR DE JOGO"
																})]
															}),
															voterChoice && /* @__PURE__ */ jsx("p", {
																className: "mt-2 font-game text-xs text-muted-foreground",
																children: mode === "local" ? `Voto de P${voterIndex + 1} registrado.` : "Seu voto foi registrado. Os bots não votam."
															})
														]
													}, voter.id);
												})
											})
										]
									}),
									snapshot.phase === "decision" && /* @__PURE__ */ jsxs("div", {
										className: "mt-4 border-2 border-arcade-gold bg-arcade-sky/80 p-3",
										children: [
											/* @__PURE__ */ jsxs("p", {
												className: "font-arcade text-[0.6rem] text-arcade-ink sm:text-xs",
												children: [
													"VOTAÇÃO CONCLUÍDA ·",
													" ",
													snapshot.voteDecision === "change-game" ? "MUDAR DE JOGO" : "REVANCHE"
												]
											}),
											snapshot.voteDecision === "rematch" && snapshot.voteCounts.rematch <= snapshot.humanVoterCount / 2 && /* @__PURE__ */ jsx("p", {
												className: "mt-2 font-game text-xs text-muted-foreground",
												children: "Sem maioria definida: o empate favorece a revanche."
											}),
											/* @__PURE__ */ jsxs("p", {
												className: "mt-2 font-game text-sm text-muted-foreground",
												children: [
													"Próxima etapa em ",
													snapshot.decisionSecondsRemaining.toFixed(1),
													" s"
												]
											})
										]
									})
								]
							})
						}),
						mode === "bots" && localPlayer?.status === "eliminated" && !isSpectating && /* @__PURE__ */ jsx("div", {
							className: "absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-arcade-ink/85 p-3 sm:p-5",
							children: /* @__PURE__ */ jsxs("section", {
								role: "dialog",
								"aria-modal": "true",
								"aria-labelledby": "sky-run-eliminated-title",
								className: "pixel-panel my-auto w-full max-w-md rounded-sm p-5 text-center sm:p-7",
								children: [
									/* @__PURE__ */ jsx("h2", {
										id: "sky-run-eliminated-title",
										className: "font-arcade text-sm text-arcade-violet sm:text-lg",
										children: "VOCÊ FOI ELIMINADO"
									}),
									/* @__PURE__ */ jsx("p", {
										className: "mt-3 font-game text-base text-arcade-ink",
										children: "O que você deseja fazer?"
									}),
									/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts.filter((receipt) => receipt.playerId === localPlayer?.id) }),
									/* @__PURE__ */ jsxs("div", {
										className: "mt-5 flex flex-col gap-3",
										children: [/* @__PURE__ */ jsx(Button, {
											type: "button",
											variant: "arcade",
											size: "arcade",
											onClick: onBack,
											children: "SAIR DA SALA"
										}), /* @__PURE__ */ jsx(Button, {
											type: "button",
											variant: "arcade",
											size: "arcade",
											onClick: () => setIsSpectating(true),
											children: "CONTINUAR COMO ESPECTADOR"
										})]
									})
								]
							})
						})
					]
				})]
			})]
		})]
	});
}
//#endregion
//#region src/features/spellbound/maze/config.ts
var MAZE_PLAYER_KEYS = [
	"ShiftLeft",
	"KeyZ",
	"ShiftRight",
	"Slash"
];
var MAZE_SWITCH_COOLDOWN_SECONDS = .65;
var MAZE_POWER_RUNE_WARNING_SECONDS = 1.8;
var MAZE_CHARACTER_SWITCH_KEYS = [
	[
		"Digit1",
		"Digit2",
		"Digit3"
	],
	[
		"KeyQ",
		"KeyE",
		"KeyR"
	],
	[
		"KeyU",
		"KeyO",
		"KeyP"
	],
	[
		"KeyV",
		"KeyB",
		"KeyN"
	]
];
var DIRECTION_VECTOR = {
	up: {
		x: 0,
		y: -1
	},
	down: {
		x: 0,
		y: 1
	},
	left: {
		x: -1,
		y: 0
	},
	right: {
		x: 1,
		y: 0
	}
};
var OPPOSITE_DIRECTION = {
	up: "down",
	down: "up",
	left: "right",
	right: "left"
};
var MAZE_BIOMES = [
	{
		id: "frost",
		name: "OBSERVATÓRIO GLACIAL",
		subtitle: "Passagens de cristal e espelhos de gelo",
		wall: "#345d9a",
		wallLight: "#8edaf2",
		floor: "#142b52",
		floorAlt: "#1a3764",
		accent: "#b8f5ff",
		glow: "#70ddff",
		special: "#70dff1",
		specialName: "GELO BRILHANTE",
		specialRule: "As placas de gelo reduzem o passo dos espíritos."
	},
	{
		id: "shadow-garden",
		name: "JARDIM DAS SOMBRAS",
		subtitle: "Bambuzais lunares e atalhos ocultos",
		wall: "#543975",
		wallLight: "#c88cf3",
		floor: "#24153d",
		floorAlt: "#321c50",
		accent: "#e0afff",
		glow: "#bd75f2",
		special: "#ad70dc",
		specialName: "PASSAGEM SOMBRIA",
		specialRule: "Fendas de sombra escondem caminhos alternativos."
	},
	{
		id: "mosswood",
		name: "PÂNTANO DAS RAÍZES",
		subtitle: "Musgo vivo, poças e portões de cipó",
		wall: "#35644e",
		wallLight: "#a9df82",
		floor: "#142f2c",
		floorAlt: "#1c4035",
		accent: "#c1f08f",
		glow: "#8ee7a0",
		special: "#73c878",
		specialName: "MUSGO VIVO",
		specialRule: "O musgo prende por instantes os espíritos que o cruzam."
	},
	{
		id: "forge",
		name: "FORJA DAS ESTRELAS",
		subtitle: "Pedra quente, veios de magma e blocos rachados",
		wall: "#78434b",
		wallLight: "#ffad73",
		floor: "#3b202c",
		floorAlt: "#4c2931",
		accent: "#ffd293",
		glow: "#ff744a",
		special: "#f79456",
		specialName: "BRASA RÚNICA",
		specialRule: "As brasas rúnicas iluminam o caminho e destacam paredes rachadas."
	},
	{
		id: "chronolibrary",
		name: "BIBLIOTECA DO TEMPO",
		subtitle: "Relógios suspensos e estantes de runas",
		wall: "#394986",
		wallLight: "#b7baff",
		floor: "#1a2145",
		floorAlt: "#252b59",
		accent: "#d0ceff",
		glow: "#9e9aff",
		special: "#8f93ff",
		specialName: "ECO TEMPORAL",
		specialRule: "Ecos temporais atrasam a perseguição dos espíritos."
	}
];
var LOCAL_PLAYER_CONTROLS = [
	{
		movement: "SETAS",
		ability: "SHIFT ESQ.",
		switch: "1 / 2 / 3"
	},
	{
		movement: "W A S D",
		ability: "Z",
		switch: "Q / E / R"
	},
	{
		movement: "I J K L",
		ability: "SHIFT DIR.",
		switch: "U / O / P"
	},
	{
		movement: "T F G H",
		ability: "/",
		switch: "V / B / N"
	}
];
var DECISION_DISPLAY_SECONDS = 2.2;
//#endregion
//#region src/features/spellbound/maze/mapGenerator.ts
var CARVE_DIRECTIONS = [
	{
		x: 0,
		y: -2
	},
	{
		x: 2,
		y: 0
	},
	{
		x: 0,
		y: 2
	},
	{
		x: -2,
		y: 0
	}
];
var CARDINAL_DIRECTIONS = [
	{
		x: 0,
		y: -1
	},
	{
		x: 1,
		y: 0
	},
	{
		x: 0,
		y: 1
	},
	{
		x: -1,
		y: 0
	}
];
function makeRandom(seed) {
	let state = seed >>> 0 || 1;
	return () => {
		state += 1831565813;
		let value = state;
		value = Math.imul(value ^ value >>> 15, value | 1);
		value ^= value + Math.imul(value ^ value >>> 7, value | 61);
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	};
}
function shuffle(items, random) {
	const result = [...items];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const other = Math.floor(random() * (index + 1));
		[result[index], result[other]] = [result[other], result[index]];
	}
	return result;
}
function inBounds(x, y) {
	return x > 0 && y > 0 && x < 24 && y < 16;
}
function isWalkable(tile) {
	return tile !== void 0 && tile !== "wall" && tile !== "breakable";
}
function distancesFrom(grid, start) {
	const distances = /* @__PURE__ */ new Map();
	const queue = [start];
	distances.set(`${start.x},${start.y}`, 0);
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const cell = queue[cursor];
		const nextDistance = distances.get(`${cell.x},${cell.y}`) + 1;
		for (const direction of CARDINAL_DIRECTIONS) {
			const x = cell.x + direction.x;
			const y = cell.y + direction.y;
			const key = `${x},${y}`;
			if (!isWalkable(grid[y]?.[x]) || distances.has(key)) continue;
			distances.set(key, nextDistance);
			queue.push({
				x,
				y
			});
		}
	}
	return distances;
}
function createOpenMaze(random, difficultyRank) {
	const grid = Array.from({ length: 17 }, () => Array.from({ length: 25 }, () => "wall"));
	const stack = [{
		x: 1,
		y: 1
	}];
	grid[1][1] = "path";
	while (stack.length > 0) {
		const current = stack[stack.length - 1];
		const next = shuffle(CARVE_DIRECTIONS, random).filter((direction) => {
			const x = current.x + direction.x;
			const y = current.y + direction.y;
			return inBounds(x, y) && grid[y]?.[x] === "wall";
		})[0];
		if (!next) {
			stack.pop();
			continue;
		}
		grid[current.y + next.y / 2][current.x + next.x / 2] = "path";
		grid[current.y + next.y][current.x + next.x] = "path";
		stack.push({
			x: current.x + next.x,
			y: current.y + next.y
		});
	}
	for (let y = 1; y <= 3; y += 1) for (let x = 1; x <= 3; x += 1) grid[y][x] = "path";
	const roomCenters = [];
	for (let y = 3; y < 15; y += 2) for (let x = 3; x < 23; x += 2) roomCenters.push({
		x,
		y
	});
	const roomsToCarve = Math.min(5, 2 + Math.floor(Math.max(0, difficultyRank - 1) / 3));
	for (const center of shuffle(roomCenters, random).slice(0, roomsToCarve)) for (let y = center.y - 1; y <= center.y + 1; y += 1) for (let x = center.x - 1; x <= center.x + 1; x += 1) grid[y][x] = "path";
	const loopCandidates = [];
	for (let y = 1; y < 16; y += 1) for (let x = 1; x < 24; x += 1) {
		if (grid[y][x] !== "wall") continue;
		const horizontal = isWalkable(grid[y]?.[x - 1]) && isWalkable(grid[y]?.[x + 1]);
		const vertical = isWalkable(grid[y - 1]?.[x]) && isWalkable(grid[y + 1]?.[x]);
		if (horizontal || vertical) loopCandidates.push({
			x,
			y
		});
	}
	const loopsToOpen = Math.min(14, 6 + Math.floor(difficultyRank * .75));
	for (const cell of shuffle(loopCandidates, random).slice(0, loopsToOpen)) grid[cell.y][cell.x] = "path";
	return grid;
}
function gatherCells(grid) {
	const cells = [];
	for (let y = 1; y < 16; y += 1) for (let x = 1; x < 24; x += 1) if (isWalkable(grid[y]?.[x])) cells.push({
		x,
		y
	});
	return cells;
}
function chooseFarthest(cells, distances, excluded) {
	const excludedKeys = new Set(excluded.map((cell) => `${cell.x},${cell.y}`));
	return [...cells].filter((cell) => !excludedKeys.has(`${cell.x},${cell.y}`)).sort((left, right) => (distances.get(`${right.x},${right.y}`) ?? 0) - (distances.get(`${left.x},${left.y}`) ?? 0))[0] ?? {
		x: 23,
		y: 15
	};
}
function takeSpreadOut(pool, count, random, from, minDistance = 0) {
	const remaining = shuffle(pool, random);
	const selected = [];
	if (from) remaining.sort((left, right) => Math.abs(right.x - from.x) + Math.abs(right.y - from.y) - (Math.abs(left.x - from.x) + Math.abs(left.y - from.y)));
	while (selected.length < count && remaining.length > 0) {
		let bestIndex = 0;
		if (selected.length > 0 || from) {
			let bestScore = Number.NEGATIVE_INFINITY;
			for (let index = 0; index < remaining.length; index += 1) {
				const cell = remaining[index];
				const anchors = [...selected, ...from ? [from] : []];
				const score = (anchors.length ? Math.min(...anchors.map((anchor) => Math.abs(cell.x - anchor.x) + Math.abs(cell.y - anchor.y))) : 0) + random() * .4;
				if (score > bestScore) {
					bestScore = score;
					bestIndex = index;
				}
			}
		}
		const [cell] = remaining.splice(bestIndex, 1);
		if (!cell) break;
		if (minDistance > 0 && from && Math.abs(cell.x - from.x) + Math.abs(cell.y - from.y) < minDistance) continue;
		selected.push(cell);
	}
	return selected;
}
function placeOptionalBreakables(grid, random, count) {
	const candidates = [];
	for (let y = 2; y < 15; y += 1) for (let x = 2; x < 23; x += 1) {
		if (grid[y][x] !== "wall") continue;
		const horizontal = isWalkable(grid[y]?.[x - 1]) && isWalkable(grid[y]?.[x + 1]);
		const vertical = isWalkable(grid[y - 1]?.[x]) && isWalkable(grid[y + 1]?.[x]);
		if (horizontal || vertical) candidates.push({
			x,
			y
		});
	}
	for (const cell of shuffle(candidates, random).slice(0, count)) grid[cell.y][cell.x] = "breakable";
}
function generateMazeLayout(level, cycle, seed, playerCount) {
	const biome = MAZE_BIOMES[(level - 1) % MAZE_BIOMES.length + 1 - 1];
	const difficultyRank = Math.max(1, level + cycle - 1);
	const levelSeed = (seed ^ Math.imul(level, 2654435761) ^ Math.imul(cycle, 2246822507)) >>> 0;
	const random = makeRandom(levelSeed);
	const grid = createOpenMaze(random, difficultyRank);
	const start = {
		x: 1,
		y: 1
	};
	const distances = distancesFrom(grid, start);
	const exit = chooseFarthest(gatherCells(grid), distances, [start]);
	const playerSpawns = [
		{
			x: 1,
			y: 1
		},
		{
			x: 2,
			y: 1
		},
		{
			x: 1,
			y: 2
		},
		{
			x: 2,
			y: 2
		}
	].slice(0, Math.max(1, Math.min(4, playerCount)));
	placeOptionalBreakables(grid, random, Math.min(3, 1 + Math.floor(difficultyRank / 5)));
	const reachableAfterBreakables = distancesFrom(grid, start);
	const safeCells = gatherCells(grid).filter((cell) => reachableAfterBreakables.has(`${cell.x},${cell.y}`) && Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y) > 4 && Math.abs(cell.x - exit.x) + Math.abs(cell.y - exit.y) > 1 && !playerSpawns.some((spawn) => spawn.x === cell.x && spawn.y === cell.y));
	const isMultiplayer = playerCount > 1;
	const ghostSpawns = takeSpreadOut(safeCells, Math.min(isMultiplayer ? 8 : 6, 2 + Math.floor((difficultyRank - 1) / 3) + (isMultiplayer ? 2 : 0)), random, exit, 5);
	const used = /* @__PURE__ */ new Set([
		...playerSpawns.map((cell) => `${cell.x},${cell.y}`),
		`${exit.x},${exit.y}`,
		...ghostSpawns.map((cell) => `${cell.x},${cell.y}`)
	]);
	const itemCandidates = safeCells.filter((cell) => !used.has(`${cell.x},${cell.y}`));
	const targetCrystals = Math.min(12, 6 + Math.floor((difficultyRank - 1) / 3));
	const targetRunes = 2;
	const crystalCells = takeSpreadOut(itemCandidates, targetCrystals + 4, random, start, 4);
	for (const cell of crystalCells) used.add(`${cell.x},${cell.y}`);
	const runeCells = takeSpreadOut(itemCandidates.filter((cell) => !used.has(`${cell.x},${cell.y}`)), targetRunes, random, exit, 4);
	for (const cell of runeCells) used.add(`${cell.x},${cell.y}`);
	const coinPool = itemCandidates.filter((cell) => !used.has(`${cell.x},${cell.y}`));
	const coinCells = takeSpreadOut(coinPool, Math.min(16, coinPool.length), random, start, 3);
	for (const cell of coinCells) used.add(`${cell.x},${cell.y}`);
	const powerRuneCells = takeSpreadOut(itemCandidates.filter((cell) => !used.has(`${cell.x},${cell.y}`)), 3, random, start, 3);
	for (const cell of powerRuneCells) used.add(`${cell.x},${cell.y}`);
	const specialCells = takeSpreadOut(gatherCells(grid).filter((cell) => !used.has(`${cell.x},${cell.y}`) && Math.abs(cell.x - start.x) + Math.abs(cell.y - start.y) > 2), 4, random, start, 2);
	for (const cell of specialCells) {
		grid[cell.y][cell.x] = "special";
		used.add(`${cell.x},${cell.y}`);
	}
	return {
		width: 25,
		height: 17,
		biome,
		grid,
		start,
		exit,
		playerSpawns,
		ghostSpawns,
		items: [
			...crystalCells.map((cell, index) => ({
				id: `crystal-${level}-${index}`,
				kind: "crystal",
				x: cell.x,
				y: cell.y,
				collectedBy: null
			})),
			...runeCells.map((cell, index) => ({
				id: `rune-${level}-${index}`,
				kind: "rune",
				x: cell.x,
				y: cell.y,
				collectedBy: null
			})),
			...coinCells.map((cell, index) => ({
				id: `coin-${level}-${index}`,
				kind: "coin",
				x: cell.x,
				y: cell.y,
				collectedBy: null
			})),
			...powerRuneCells.map((cell, index) => ({
				id: `power-rune-${level}-${index}`,
				kind: "power-rune",
				x: cell.x,
				y: cell.y,
				collectedBy: null
			}))
		],
		targetCrystals,
		targetRunes,
		seed: levelSeed
	};
}
//#endregion
//#region src/features/spellbound/maze/navigation.ts
var DIRECTIONS = [
	"up",
	"right",
	"down",
	"left"
];
function canEnterTile(tile, allowBreakable = false) {
	return tile !== void 0 && tile !== "wall" && (allowBreakable || tile !== "breakable");
}
function cellFromPosition(x, y) {
	return {
		x: Math.floor(x),
		y: Math.floor(y)
	};
}
function cellKey(cell) {
	return `${cell.x},${cell.y}`;
}
function manhattanDistance(left, right) {
	return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
function getNeighbors(grid, cell, allowBreakable = false) {
	return DIRECTIONS.flatMap((direction) => {
		const vector = DIRECTION_VECTOR[direction];
		const next = {
			x: cell.x + vector.x,
			y: cell.y + vector.y
		};
		return canEnterTile(grid[next.y]?.[next.x], allowBreakable) ? [{
			cell: next,
			direction
		}] : [];
	});
}
function findPathDirection(grid, start, target, preferredDirection) {
	if (start.x === target.x && start.y === target.y) return null;
	const queue = [target];
	const nextStep = /* @__PURE__ */ new Map();
	const visited = /* @__PURE__ */ new Set([cellKey(target)]);
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const current = queue[cursor];
		for (const neighbor of getNeighbors(grid, current)) {
			const key = cellKey(neighbor.cell);
			if (visited.has(key)) continue;
			visited.add(key);
			const towardCurrent = OPPOSITE_DIRECTION[neighbor.direction];
			nextStep.set(key, {
				from: current,
				direction: towardCurrent
			});
			queue.push(neighbor.cell);
		}
	}
	const first = nextStep.get(cellKey(start));
	if (!first) return null;
	if (preferredDirection === first.direction) return preferredDirection;
	return first.direction;
}
function chooseFleeDirection(grid, from, threat, preferredDirection) {
	const options = getNeighbors(grid, from);
	options.sort((left, right) => {
		const leftDistance = manhattanDistance(left.cell, threat);
		const rightDistance = manhattanDistance(right.cell, threat);
		const leftPreference = left.direction === preferredDirection ? .2 : 0;
		return rightDistance + (right.direction === preferredDirection ? .2 : 0) - (leftDistance + leftPreference);
	});
	return options[0]?.direction ?? null;
}
function getReachableCells(grid, start) {
	const result = [];
	const queue = [start];
	const visited = /* @__PURE__ */ new Set([cellKey(start)]);
	for (let cursor = 0; cursor < queue.length; cursor += 1) {
		const current = queue[cursor];
		result.push(current);
		for (const neighbor of getNeighbors(grid, current)) {
			const key = cellKey(neighbor.cell);
			if (visited.has(key)) continue;
			visited.add(key);
			queue.push(neighbor.cell);
		}
	}
	return result;
}
//#endregion
//#region src/features/spellbound/maze/powers.ts
/**
* These are maze-specific translations of each character's established identity.
* They deliberately do not share or alter Tower's gameplay state or ability code.
*/
var MAZE_CHARACTER_POWERS = {
	"white-fox-ice-mage": {
		name: "NOVA DE GELO",
		shortName: "GELO",
		description: "Congela por 5 s todos os espíritos na área 6×6 ao redor da Raposa.",
		cooldownSeconds: 20,
		accent: "#9ceeff",
		glyph: "❄"
	},
	"purple-rabbit-ninja": {
		name: "TELEPORTE NINJA",
		shortName: "TELEPORTE",
		description: "Escolha uma casa alcançável a até 6 blocos; confirme para surgir nela.",
		cooldownSeconds: 20,
		accent: "#db9cff",
		glyph: "✦"
	},
	"swamp-frog-mage": {
		name: "PÂNTANO PEGAJOSO",
		shortName: "PÂNTANO",
		description: "Cria no chão uma área 5×5 por 6 s; espíritos nela ficam bem mais lentos.",
		cooldownSeconds: 20,
		accent: "#9de89b",
		glyph: "✿"
	},
	"forge-raccoon-mage": {
		name: "EXPLOSÃO FLAMEJANTE",
		shortName: "EXPLOSÃO",
		description: "Empurra os espíritos próximos e os atordoa por 3 s.",
		cooldownSeconds: 20,
		accent: "#ffad73",
		glyph: "✹"
	},
	"time-owl-mage": {
		name: "PARAR O TEMPO",
		shortName: "TEMPO",
		description: "Para todos os espíritos do labirinto por 5 s; a Coruja continua se movendo.",
		cooldownSeconds: 20,
		accent: "#b6b2ff",
		glyph: "◷"
	},
	"calm-capybara-mage": {
		name: "CALMARIA",
		shortName: "CALMARIA",
		description: "Reduz a velocidade de todos os fantasmas para 42% por 5 s.",
		cooldownSeconds: 20,
		accent: "#9de8cf",
		glyph: "≈"
	},
	"axolotl-mage": {
		name: "RESSURREIÇÃO",
		shortName: "REVIVER",
		description: "Com uma runa, traz de volta o aliado eliminado mais recentemente com 1 vida; recarga de 20 s.",
		cooldownSeconds: 20,
		accent: "#ff9edb",
		glyph: "♥+"
	}
};
var MAZE_CHARACTER_IDS = [
	"white-fox-ice-mage",
	"purple-rabbit-ninja",
	"time-owl-mage",
	"swamp-frog-mage",
	"forge-raccoon-mage",
	"calm-capybara-mage",
	"axolotl-mage"
];
function getMazePower(characterId) {
	return MAZE_CHARACTER_POWERS[characterId];
}
//#endregion
//#region src/features/spellbound/maze/engine.ts
var PLAYER_RADIUS = .22;
var MULTIPLAYER_PLAYER_RADIUS = .32;
var GHOST_RADIUS = .2;
var PLAYER_BASE_SPEED = 3.15;
var GHOST_BASE_SPEED = 1.55;
var MAX_FRAME_DELTA = .05;
var MAX_CATCH_UP_DELTA = 1;
var PLAYER_WALL_TURN_TOLERANCE = .28 + .02;
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}
function distance(leftX, leftY, rightX, rightY) {
	return Math.hypot(leftX - rightX, leftY - rightY);
}
function tileCenter(cell) {
	return {
		x: cell.x + .5,
		y: cell.y + .5
	};
}
function nearTileCenter(x, y, threshold = .18) {
	const center = tileCenter(cellFromPosition(x, y));
	return Math.abs(center.x - x) <= threshold && Math.abs(center.y - y) <= threshold;
}
function pickSeed() {
	return (Date.now() ^ Math.floor(Math.random() * 4294967295)) >>> 0 || 1;
}
function makeBotRoster(seedCharacter, offset) {
	const seedIndex = Math.max(0, MAZE_CHARACTER_IDS.indexOf(seedCharacter));
	return Array.from({ length: 3 }, (_, index) => MAZE_CHARACTER_IDS[(seedIndex + offset + index) % MAZE_CHARACTER_IDS.length]);
}
function initialCooldownsForPlayer(cooldownsByPlayer, playerId) {
	const cooldowns = cooldownsByPlayer?.get(playerId);
	return Object.fromEntries(MAZE_CHARACTER_IDS.map((characterId) => [characterId, Math.max(0, cooldowns?.[characterId] ?? 0)]));
}
var MazeEngine = class {
	mode;
	players;
	phase = "character-select";
	winnerId = null;
	matchEndReason = null;
	voteDecision = null;
	seed;
	votes = /* @__PURE__ */ new Map();
	globalTimeStopSeconds = 0;
	timeNormalDisplaySeconds = 0;
	layout;
	grid = [];
	items = [];
	ghosts = [];
	projectiles = [];
	effects = [];
	swampZones = [];
	level = 1;
	cycle = 1;
	levelInCycle = 1;
	countdownElapsed = 0;
	phaseElapsed = 0;
	elapsedSeconds = 0;
	levelElapsedSeconds = 0;
	matchElapsedSeconds = 0;
	crystalsCollected = 0;
	runesActivated = 0;
	totalGhostsDefeated = 0;
	nextEliminationOrder = 1;
	nextFinishOrder = 1;
	bestScore;
	randomState;
	gameOverReason = null;
	goLabelRemaining = 0;
	levelNeedsLoad = false;
	levelStartPlayerStates = /* @__PURE__ */ new Map();
	levelStartTotalGhostsDefeated = 0;
	levelStartRandomState = 1;
	constructor({ mode, participants, seed, bestScore = 0, startLevel = 1, initialAbilityCooldowns, initialPowerRunes }) {
		this.mode = mode;
		this.validateParticipants(participants);
		this.seed = seed ?? pickSeed();
		this.randomState = this.seed || 1;
		this.bestScore = Math.max(0, Math.floor(bestScore));
		this.level = Math.max(1, Math.floor(startLevel));
		this.players = participants.map((participant, index) => {
			const characterId = participant.roster?.[0] ?? participant.characterId;
			const roster = participant.isBot ? makeBotRoster(participant.characterId, index) : [...participant.roster ?? []];
			const axolotlHeartGranted = roster.includes("axolotl-mage");
			const abilityCooldownByCharacter = initialCooldownsForPlayer(initialAbilityCooldowns, participant.id);
			return {
				id: participant.id,
				name: participant.name.trim() || `JOGADOR ${index + 1}`,
				characterId,
				roster,
				axolotlHeartGranted,
				activeCharacterSlot: 0,
				rosterConfirmed: Boolean(participant.isBot) || participant.roster?.length === 3 && new Set(participant.roster).size === 3,
				switchCooldownSeconds: 0,
				teleportTarget: null,
				teleportTargetValid: false,
				isBot: participant.isBot ?? false,
				controlIndex: participant.controlIndex ?? index,
				...participant.botDifficulty ? { botDifficulty: participant.botDifficulty } : {},
				x: 1.5,
				y: 1.5,
				direction: "right",
				isMoving: false,
				inputActive: participant.isBot ?? false,
				movementX: 0,
				movementY: 0,
				stopAtCenter: false,
				desiredDirection: null,
				lives: (mode === "solo" ? 3 : 2) + Number(axolotlHeartGranted),
				score: 0,
				crystals: 0,
				runes: 0,
				coinsCollected: 0,
				powerRunes: Math.max(0, Math.floor(initialPowerRunes?.get(participant.id) ?? 0)),
				powerWarningSeconds: 0,
				ghostsDefeated: 0,
				combo: 0,
				abilityCooldownSeconds: abilityCooldownByCharacter[characterId] ?? 0,
				abilityCooldownByCharacter,
				abilityActiveSeconds: 0,
				status: "active",
				eliminationOrder: null,
				finishOrder: null,
				finishTimeSeconds: null,
				invulnerableSeconds: .8,
				botThinkSeconds: 0,
				botTarget: null
			};
		});
		this.loadLevel();
		this.maybeBeginSelectedLevel();
	}
	get countdownLabel() {
		if (this.phase === "countdown") return String(Math.max(1, 3 - Math.floor(this.countdownElapsed)));
		return this.phase === "playing" && this.goLabelRemaining > 0 ? "VAI!" : null;
	}
	get humanVoterCount() {
		return this.players.filter((player) => !player.isBot).length;
	}
	get exitOpen() {
		return this.items.every((item) => item.kind === "coin" || item.collectedBy !== null);
	}
	setDirection(playerId, direction) {
		if (this.phase !== "playing" && this.phase !== "countdown") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || player.status !== "active" || player.teleportTarget) return false;
		if (this.mode !== "solo") {
			const vector = this.directionVector(direction);
			return this.setMovementVector(playerId, vector.x, vector.y, direction);
		}
		player.desiredDirection = direction;
		player.inputActive = true;
		player.stopAtCenter = false;
		return true;
	}
	setMovementVector(playerId, x, y, facing) {
		if (this.phase !== "playing" && this.phase !== "countdown") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || player.status !== "active" || player.teleportTarget) return false;
		player.movementX = Math.sign(x);
		player.movementY = Math.sign(y);
		player.inputActive = player.movementX !== 0 || player.movementY !== 0;
		player.desiredDirection = null;
		player.stopAtCenter = false;
		if (facing) player.direction = facing;
		player.isMoving = false;
		return true;
	}
	clearDirection(playerId) {
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot) return false;
		if (this.mode !== "solo") return this.setMovementVector(playerId, 0, 0);
		player.desiredDirection = null;
		player.inputActive = false;
		if (nearTileCenter(player.x, player.y, .08)) {
			const center = tileCenter(cellFromPosition(player.x, player.y));
			player.x = center.x;
			player.y = center.y;
			player.stopAtCenter = false;
			player.isMoving = false;
		} else player.stopAtCenter = true;
		return true;
	}
	setRosterSelection(playerId, roster) {
		if (this.phase !== "character-select") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || player.rosterConfirmed || roster.length > 3) return false;
		if (new Set(roster).size !== roster.length || roster.some((characterId) => !MAZE_CHARACTER_IDS.includes(characterId))) return false;
		player.roster = [...roster];
		player.activeCharacterSlot = 0;
		if (roster[0]) {
			player.characterId = roster[0];
			player.abilityCooldownSeconds = player.abilityCooldownByCharacter[roster[0]] ?? 0;
		}
		return true;
	}
	confirmRoster(playerId) {
		if (this.phase !== "character-select") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || player.rosterConfirmed || player.roster.length !== 3 || new Set(player.roster).size !== 3) return false;
		if (player.roster.includes("axolotl-mage") && !player.axolotlHeartGranted) {
			player.lives += 1;
			player.axolotlHeartGranted = true;
		}
		player.rosterConfirmed = true;
		this.maybeBeginSelectedLevel();
		return true;
	}
	switchCharacter(playerId, slot) {
		if (this.phase !== "playing") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || player.status !== "active" || slot < 0 || slot >= player.roster.length || slot === player.activeCharacterSlot || player.switchCooldownSeconds > 0) return false;
		this.activateCharacterSlot(player, slot, true);
		return true;
	}
	moveTeleportTarget(playerId, direction) {
		if (this.phase !== "playing") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.status !== "active" || player.characterId !== "purple-rabbit-ninja" || !player.teleportTarget) return false;
		const vector = this.directionVector(direction);
		const next = {
			x: player.teleportTarget.x + vector.x,
			y: player.teleportTarget.y + vector.y
		};
		if (!getReachableCells(this.grid, cellFromPosition(player.x, player.y)).some((cell) => cell.x === next.x && cell.y === next.y) || distance(player.x, player.y, next.x + .5, next.y + .5) > 6) return false;
		player.teleportTarget = next;
		player.teleportTargetValid = this.isTeleportDestinationValid(player, next);
		return true;
	}
	cancelTeleportTarget(playerId) {
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player?.teleportTarget) return false;
		player.teleportTarget = null;
		player.teleportTargetValid = false;
		return true;
	}
	isTeleportAiming(playerId) {
		return Boolean(this.players.find((candidate) => candidate.id === playerId)?.teleportTarget);
	}
	setBestScore(score) {
		this.bestScore = Math.max(this.bestScore, Math.floor(score));
	}
	useAbility(playerId) {
		if (this.phase !== "playing") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.status !== "active") return false;
		if (player.powerRunes <= 0) {
			player.powerWarningSeconds = player.isBot ? 0 : MAZE_POWER_RUNE_WARNING_SECONDS;
			return false;
		}
		if (player.characterId === "purple-rabbit-ninja" && player.teleportTarget) return this.confirmTeleport(player);
		if ((player.abilityCooldownByCharacter[player.characterId] ?? 0) > 0) return false;
		if (player.characterId === "purple-rabbit-ninja") {
			const target = this.chooseInitialTeleportTarget(player);
			if (!target) return false;
			player.teleportTarget = target;
			player.teleportTargetValid = this.isTeleportDestinationValid(player, target);
			if (player.isBot) return this.confirmTeleport(player);
			return true;
		}
		const power = getMazePower(player.characterId);
		const origin = cellFromPosition(player.x, player.y);
		switch (player.characterId) {
			case "white-fox-ice-mage":
				for (const ghost of this.ghosts) if (Math.abs(ghost.x - player.x) <= 3 && Math.abs(ghost.y - player.y) <= 3) ghost.frozenSeconds = Math.max(ghost.frozenSeconds, 5);
				this.addEffect("ice-burst", player.x, player.y, player.direction, .8);
				player.abilityActiveSeconds = 5;
				break;
			case "swamp-frog-mage": {
				const cells = getReachableCells(this.grid, origin).filter((cell) => Math.abs(cell.x - origin.x) <= 2 && Math.abs(cell.y - origin.y) <= 2);
				if (cells.length === 0) return false;
				this.swampZones.push({
					id: `swamp-${player.id}-${this.elapsedSeconds.toFixed(3)}`,
					ownerId: player.id,
					x: player.x,
					y: player.y,
					cells,
					secondsRemaining: 6,
					maxSeconds: 6
				});
				this.addEffect("swamp-burst", player.x, player.y, player.direction, .7);
				player.abilityActiveSeconds = 6;
				break;
			}
			case "forge-raccoon-mage":
				for (const ghost of this.ghosts) {
					if (Math.abs(ghost.x - player.x) > 2 || Math.abs(ghost.y - player.y) > 2) continue;
					const ghostCell = cellFromPosition(ghost.x, ghost.y);
					ghost.knockbackDirection = chooseFleeDirection(this.grid, ghostCell, origin, ghost.direction) ?? ghost.direction;
					ghost.knockbackSeconds = Math.max(ghost.knockbackSeconds, .22);
					ghost.stunnedSeconds = Math.max(ghost.stunnedSeconds, 3);
				}
				this.addEffect("fire-burst", player.x, player.y, player.direction, .75);
				player.abilityActiveSeconds = .75;
				break;
			case "time-owl-mage":
				for (const ghost of this.ghosts) ghost.timeStoppedSeconds = 5;
				this.globalTimeStopSeconds = 5;
				this.timeNormalDisplaySeconds = 0;
				this.addEffect("time-stop", player.x, player.y, player.direction, .9);
				player.abilityActiveSeconds = 5;
				break;
			case "calm-capybara-mage":
				for (const ghost of this.ghosts) {
					ghost.calmariaSeconds = Math.max(ghost.calmariaSeconds, 5);
					ghost.slowedSeconds = Math.max(ghost.slowedSeconds, 5);
				}
				player.abilityActiveSeconds = 5;
				break;
			case "axolotl-mage": {
				const target = this.players.filter((candidate) => candidate.id !== player.id && candidate.status === "eliminated").sort((left, right) => (right.eliminationOrder ?? -1) - (left.eliminationOrder ?? -1))[0];
				if (!target) return false;
				const center = tileCenter(this.playerSpawnFor(target));
				target.x = center.x;
				target.y = center.y;
				target.direction = "right";
				target.isMoving = false;
				target.inputActive = true;
				target.movementX = 0;
				target.movementY = 0;
				target.stopAtCenter = false;
				target.desiredDirection = null;
				target.lives = 1;
				target.status = "active";
				target.eliminationOrder = null;
				target.finishOrder = null;
				target.finishTimeSeconds = null;
				target.invulnerableSeconds = 5;
				target.switchCooldownSeconds = 0;
				target.powerWarningSeconds = 0;
				target.teleportTarget = null;
				target.teleportTargetValid = false;
				target.botThinkSeconds = 0;
				target.botTarget = null;
				player.abilityActiveSeconds = 1;
				break;
			}
		}
		player.powerRunes -= 1;
		player.powerWarningSeconds = 0;
		player.abilityCooldownByCharacter[player.characterId] = power.cooldownSeconds;
		player.abilityCooldownSeconds = power.cooldownSeconds;
		return true;
	}
	maybeBeginSelectedLevel() {
		if (!this.players.every((player) => player.isBot || player.rosterConfirmed && player.roster.length === 3)) return;
		if (this.levelNeedsLoad) {
			this.loadLevel();
			this.levelNeedsLoad = false;
		}
		for (const player of this.players) {
			this.activateCharacterSlot(player, 0, false);
			player.rosterConfirmed = true;
			player.status = "active";
		}
		this.countdownElapsed = 0;
		this.phaseElapsed = 0;
		this.goLabelRemaining = 0;
		this.phase = "countdown";
		this.captureLevelStartState();
	}
	captureLevelStartState() {
		this.levelStartPlayerStates = new Map(this.players.map((player) => [player.id, {
			characterId: player.characterId,
			direction: player.direction,
			roster: [...player.roster],
			activeCharacterSlot: player.activeCharacterSlot,
			lives: player.lives,
			score: player.score,
			crystals: player.crystals,
			runes: player.runes,
			coinsCollected: player.coinsCollected,
			powerRunes: player.powerRunes,
			abilityCooldownSeconds: player.abilityCooldownSeconds,
			abilityCooldownByCharacter: { ...player.abilityCooldownByCharacter },
			ghostsDefeated: player.ghostsDefeated,
			combo: player.combo
		}]));
		this.levelStartTotalGhostsDefeated = this.totalGhostsDefeated;
		this.levelStartRandomState = this.randomState;
	}
	activateCharacterSlot(player, slot, animate) {
		const nextCharacter = player.roster[slot];
		if (!nextCharacter || nextCharacter === player.characterId) return false;
		const previousX = player.x;
		const previousY = player.y;
		player.characterId = nextCharacter;
		player.activeCharacterSlot = slot;
		player.abilityCooldownSeconds = player.abilityCooldownByCharacter[nextCharacter] ?? 0;
		player.abilityActiveSeconds = 0;
		player.teleportTarget = null;
		player.teleportTargetValid = false;
		if (animate) {
			player.switchCooldownSeconds = MAZE_SWITCH_COOLDOWN_SECONDS;
			this.addEffect("character-swap", previousX, previousY, player.direction, .48);
		}
		return true;
	}
	chooseInitialTeleportTarget(player) {
		const origin = cellFromPosition(player.x, player.y);
		const reachable = getReachableCells(this.grid, origin).filter((cell) => distance(player.x, player.y, cell.x + .5, cell.y + .5) <= 6 && this.isTeleportDestinationValid(player, cell));
		if (reachable.length === 0) return null;
		const vector = this.directionVector(player.direction);
		const preferred = {
			x: player.x + vector.x * 2.5,
			y: player.y + vector.y * 2.5
		};
		return reachable.sort((left, right) => distance(left.x + .5, left.y + .5, preferred.x, preferred.y) - distance(right.x + .5, right.y + .5, preferred.x, preferred.y))[0];
	}
	isTeleportDestinationValid(player, cell) {
		const center = tileCenter(cell);
		const tile = this.grid[cell.y]?.[cell.x];
		if (!canEnterTile(tile) || distance(player.x, player.y, center.x, center.y) > 6 || !this.canOccupy(center.x, center.y, PLAYER_RADIUS)) return false;
		return this.ghosts.every((ghost) => distance(ghost.x, ghost.y, center.x, center.y) >= .78);
	}
	confirmTeleport(player) {
		const target = player.teleportTarget;
		const power = getMazePower("purple-rabbit-ninja");
		if (player.powerRunes <= 0) {
			player.powerWarningSeconds = player.isBot ? 0 : MAZE_POWER_RUNE_WARNING_SECONDS;
			return false;
		}
		if (!target || player.characterId !== "purple-rabbit-ninja" || (player.abilityCooldownByCharacter[player.characterId] ?? 0) > 0 || !this.isTeleportDestinationValid(player, target)) {
			player.teleportTargetValid = target ? this.isTeleportDestinationValid(player, target) : false;
			return false;
		}
		const originX = player.x;
		const originY = player.y;
		const destination = tileCenter(target);
		this.addEffect("teleport-smoke", originX, originY, player.direction, .42);
		player.x = destination.x;
		player.y = destination.y;
		player.isMoving = false;
		player.inputActive = false;
		player.stopAtCenter = false;
		player.desiredDirection = null;
		player.teleportTarget = null;
		player.teleportTargetValid = false;
		player.abilityActiveSeconds = .42;
		player.powerRunes -= 1;
		player.powerWarningSeconds = 0;
		player.abilityCooldownByCharacter[player.characterId] = power.cooldownSeconds;
		player.abilityCooldownSeconds = power.cooldownSeconds;
		this.addEffect("teleport-smoke", destination.x, destination.y, player.direction, .42);
		return true;
	}
	vote(playerId, choice) {
		if (this.phase !== "voting") return false;
		const player = this.players.find((candidate) => candidate.id === playerId);
		if (!player || player.isBot || this.votes.has(playerId)) return false;
		this.votes.set(playerId, choice);
		if (this.votes.size >= this.humanVoterCount) this.resolveVote();
		return true;
	}
	advanceToNextLevel() {
		if (this.phase !== "level-clear") return false;
		const humanRosters = new Map(this.players.filter((player) => !player.isBot).map((player) => [player.id, [...player.roster]]));
		this.advanceLevel();
		for (const player of this.players) {
			player.coinsCollected = 0;
			if (player.isBot) continue;
			const roster = humanRosters.get(player.id);
			if (roster?.length === 3 && new Set(roster).size === 3) {
				player.roster = roster;
				player.rosterConfirmed = true;
			}
		}
		this.maybeBeginSelectedLevel();
		return true;
	}
	retryCurrentLevel() {
		if (this.phase !== "game-over") return false;
		this.votes.clear();
		this.winnerId = null;
		this.matchEndReason = null;
		this.voteDecision = null;
		this.gameOverReason = null;
		this.elapsedSeconds = 0;
		this.levelElapsedSeconds = 0;
		this.matchElapsedSeconds = 0;
		this.totalGhostsDefeated = this.levelStartTotalGhostsDefeated;
		this.randomState = this.levelStartRandomState;
		this.nextEliminationOrder = 1;
		this.nextFinishOrder = 1;
		this.countdownElapsed = 0;
		this.phaseElapsed = 0;
		this.goLabelRemaining = 0;
		this.levelNeedsLoad = false;
		for (const player of this.players) {
			const initial = this.levelStartPlayerStates.get(player.id);
			if (initial) {
				player.characterId = initial.characterId;
				player.direction = initial.direction;
				player.roster = [...initial.roster];
				player.activeCharacterSlot = initial.activeCharacterSlot;
				player.lives = initial.lives;
				player.score = initial.score;
				player.crystals = initial.crystals;
				player.runes = initial.runes;
				player.coinsCollected = initial.coinsCollected;
				player.powerRunes = initial.powerRunes;
				player.abilityCooldownSeconds = initial.abilityCooldownSeconds;
				player.abilityCooldownByCharacter = { ...initial.abilityCooldownByCharacter };
				player.ghostsDefeated = initial.ghostsDefeated;
				player.combo = initial.combo;
			}
			player.rosterConfirmed = true;
			player.inputActive = player.isBot;
			player.movementX = 0;
			player.movementY = 0;
			player.stopAtCenter = false;
			player.desiredDirection = null;
			player.isMoving = false;
			player.switchCooldownSeconds = 0;
			player.abilityActiveSeconds = 0;
			player.powerWarningSeconds = 0;
			player.teleportTarget = null;
			player.teleportTargetValid = false;
		}
		this.loadLevel();
		for (const player of this.players) {
			const initial = this.levelStartPlayerStates.get(player.id);
			if (initial) player.direction = initial.direction;
		}
		this.phase = "countdown";
		return true;
	}
	step(deltaSeconds) {
		const totalDelta = clamp(deltaSeconds, 0, MAX_CATCH_UP_DELTA);
		if (totalDelta <= 0) return;
		const substepCount = Math.ceil(totalDelta / MAX_FRAME_DELTA);
		const dt = totalDelta / substepCount;
		for (let index = 0; index < substepCount; index += 1) this.stepFrame(dt);
	}
	stepFrame(dt) {
		if (dt <= 0) return;
		if (this.phase === "countdown") {
			this.countdownElapsed += dt;
			if (this.countdownElapsed >= 3) {
				this.phase = "playing";
				this.goLabelRemaining = .55;
			}
			return;
		}
		if (this.phase === "level-clear") return;
		if (this.phase === "results") {
			this.phaseElapsed += dt;
			if (this.phaseElapsed >= 2.4) {
				this.phase = "voting";
				this.phaseElapsed = 0;
			}
			return;
		}
		if (this.phase === "voting") {
			this.phaseElapsed += dt;
			if (this.phaseElapsed >= 10) this.resolveVote();
			return;
		}
		if (this.phase === "decision") {
			this.phaseElapsed += dt;
			if (this.phaseElapsed >= 2.2) this.phase = this.voteDecision === "change-game" ? "change-game" : "next-level";
			return;
		}
		if (this.phase !== "playing") return;
		this.elapsedSeconds += dt;
		this.levelElapsedSeconds += dt;
		this.matchElapsedSeconds += dt;
		this.goLabelRemaining = Math.max(0, this.goLabelRemaining - dt);
		this.updateTimers(dt);
		this.stepBots(dt);
		this.stepPlayers(dt);
		this.stepGhosts(dt);
		this.stepProjectiles(dt);
		this.stepEffects(dt);
		this.checkItemPickups();
		this.checkPlayerCollisions();
		this.checkExits();
		if (this.mode !== "solo") {
			if (this.players.filter((player) => !player.isBot).every((player) => player.status !== "active")) this.finishMatch("all-inactive");
			else if (this.matchElapsedSeconds >= 180) this.finishMatch("time-limit");
		}
	}
	snapshot() {
		const players = this.players.map((player) => this.snapshotPlayer(player));
		return {
			phase: this.phase,
			countdownLabel: this.countdownLabel,
			level: this.level,
			cycle: this.cycle,
			levelInCycle: this.levelInCycle,
			biome: this.layout.biome,
			width: this.layout.width,
			height: this.layout.height,
			grid: this.grid.map((row) => [...row]),
			exit: { ...this.layout.exit },
			exitOpen: this.exitOpen,
			collectiblesCollected: this.items.filter((item) => item.kind !== "coin" && item.collectedBy !== null).length,
			collectiblesTotal: this.items.filter((item) => item.kind !== "coin").length,
			items: this.items.map((item) => ({ ...item })),
			players,
			ranking: this.rankedPlayers().map((player) => this.snapshotPlayer(player)),
			ghosts: this.ghosts.map((ghost) => ({
				id: ghost.id,
				kind: ghost.kind,
				x: ghost.x,
				y: ghost.y,
				direction: ghost.direction,
				stunnedSeconds: ghost.stunnedSeconds,
				frozenSeconds: ghost.frozenSeconds,
				timeStoppedSeconds: ghost.timeStoppedSeconds,
				fleeingSeconds: ghost.fleeingSeconds,
				slowedSeconds: ghost.slowedSeconds,
				calmariaSeconds: ghost.calmariaSeconds
			})),
			projectiles: this.projectiles.map(({ speed: _speed, ...projectile }) => ({ ...projectile })),
			effects: this.effects.map((effect) => ({ ...effect })),
			swampZones: this.swampZones.map((zone) => ({
				...zone,
				cells: zone.cells.map((cell) => ({ ...cell }))
			})),
			crystalsCollected: this.crystalsCollected,
			runesActivated: this.runesActivated,
			targetCrystals: this.layout.targetCrystals,
			targetRunes: this.layout.targetRunes,
			elapsedSeconds: this.elapsedSeconds,
			matchElapsedSeconds: this.matchElapsedSeconds,
			ghostsDefeated: this.totalGhostsDefeated,
			globalTimeStopSeconds: this.globalTimeStopSeconds,
			timeNormalDisplaySeconds: this.timeNormalDisplaySeconds,
			winnerId: this.winnerId,
			matchEndReason: this.matchEndReason,
			gameOverScore: this.phase === "game-over" ? players[0]?.score ?? 0 : 0,
			gameOverBestScore: this.bestScore,
			gameOverLevel: this.phase === "game-over" ? this.level : 0,
			gameOverGhostsDefeated: this.phase === "game-over" ? players[0]?.ghostsDefeated ?? 0 : 0,
			gameOverReason: this.phase === "game-over" ? this.gameOverReason : null,
			matchTotalSeconds: this.matchElapsedSeconds,
			votingSecondsRemaining: this.phase === "voting" ? Math.max(0, Math.ceil(10 - this.phaseElapsed)) : 0,
			decisionSecondsRemaining: this.phase === "decision" ? Math.max(0, DECISION_DISPLAY_SECONDS - this.phaseElapsed) : 0,
			voteCounts: this.voteCounts(),
			humanVoterCount: this.humanVoterCount,
			votedPlayerIds: [...this.votes.keys()],
			voteDecision: this.voteDecision
		};
	}
	validateParticipants(participants) {
		if (this.mode === "solo") {
			if (participants.length !== 1 || participants[0]?.isBot) throw new RangeError("O modo Solo do Labirinto Mágico aceita um jogador humano.");
			return;
		}
		if (participants.length < 2 || participants.length > 4) throw new RangeError(`O multiplayer do labirinto aceita de 2 a 4 participantes.`);
		if (!participants.some((participant) => !participant.isBot)) throw new RangeError("A partida precisa ter pelo menos um jogador humano.");
	}
	loadLevel() {
		this.cycle = Math.floor((this.level - 1) / MAZE_BIOMES.length) + 1;
		this.levelInCycle = (this.level - 1) % MAZE_BIOMES.length + 1;
		this.layout = generateMazeLayout(this.level, this.cycle, this.seed, this.players.length);
		this.grid = this.layout.grid.map((row) => [...row]);
		this.items = this.layout.items.map((item) => ({ ...item }));
		this.crystalsCollected = 0;
		this.runesActivated = 0;
		this.projectiles = [];
		this.effects = [];
		this.swampZones = [];
		this.globalTimeStopSeconds = 0;
		this.timeNormalDisplaySeconds = 0;
		this.levelElapsedSeconds = 0;
		this.ghosts = this.layout.ghostSpawns.map((cell, index) => {
			const center = tileCenter(cell);
			const kinds = [
				"pursuer",
				"interceptor",
				"patroller",
				"trickster"
			];
			return {
				id: `spirit-${this.level}-${index}`,
				kind: kinds[index % kinds.length],
				x: center.x,
				y: center.y,
				direction: index % 2 === 0 ? "left" : "up",
				stunnedSeconds: .7 + index * .08,
				frozenSeconds: 0,
				timeStoppedSeconds: 0,
				fleeingSeconds: 0,
				slowedSeconds: 0,
				calmariaSeconds: 0,
				knockbackSeconds: 0,
				knockbackDirection: null,
				home: { ...cell },
				patrolTarget: null,
				pathThinkSeconds: 0,
				tricksterSeconds: 2.2 + index * .7,
				tricksterFleeing: false,
				pullTarget: null
			};
		});
		this.players.forEach((player) => {
			const center = tileCenter(this.playerSpawnFor(player));
			player.x = center.x;
			player.y = center.y;
			player.direction = player.inputActive ? player.desiredDirection ?? player.direction : "right";
			if (!player.inputActive) player.desiredDirection = null;
			player.stopAtCenter = false;
			player.isMoving = false;
			player.status = "active";
			player.eliminationOrder = null;
			player.finishOrder = null;
			player.finishTimeSeconds = null;
			player.invulnerableSeconds = Math.max(player.invulnerableSeconds, .8);
			player.botTarget = null;
			player.botThinkSeconds = 0;
			player.abilityActiveSeconds = 0;
			player.powerWarningSeconds = 0;
			player.teleportTarget = null;
			player.teleportTargetValid = false;
		});
	}
	updateTimers(dt) {
		for (const player of this.players) {
			for (const characterId of MAZE_CHARACTER_IDS) player.abilityCooldownByCharacter[characterId] = Math.max(0, (player.abilityCooldownByCharacter[characterId] ?? 0) - dt);
			player.abilityCooldownSeconds = player.abilityCooldownByCharacter[player.characterId] ?? 0;
			player.switchCooldownSeconds = Math.max(0, player.switchCooldownSeconds - dt);
			player.abilityActiveSeconds = Math.max(0, player.abilityActiveSeconds - dt);
			player.powerWarningSeconds = Math.max(0, player.powerWarningSeconds - dt);
			player.invulnerableSeconds = Math.max(0, player.invulnerableSeconds - dt);
		}
		if (this.globalTimeStopSeconds > 0) {
			const remaining = Math.max(0, this.globalTimeStopSeconds - dt);
			this.globalTimeStopSeconds = remaining < 1e-8 ? 0 : remaining;
			if (this.globalTimeStopSeconds === 0) this.timeNormalDisplaySeconds = 1.2;
		} else this.timeNormalDisplaySeconds = Math.max(0, this.timeNormalDisplaySeconds - dt);
		for (const ghost of this.ghosts) {
			const timeWasStopped = ghost.timeStoppedSeconds > 0;
			const remainingTimeStopped = Math.max(0, ghost.timeStoppedSeconds - dt);
			ghost.timeStoppedSeconds = remainingTimeStopped < 1e-8 ? 0 : remainingTimeStopped;
			if (timeWasStopped) continue;
			ghost.stunnedSeconds = Math.max(0, ghost.stunnedSeconds - dt);
			ghost.frozenSeconds = Math.max(0, ghost.frozenSeconds - dt);
			ghost.fleeingSeconds = Math.max(0, ghost.fleeingSeconds - dt);
			ghost.slowedSeconds = Math.max(0, ghost.slowedSeconds - dt);
			ghost.calmariaSeconds = Math.max(0, ghost.calmariaSeconds - dt);
		}
	}
	stepBots(dt) {
		for (const player of this.players) {
			if (!player.isBot || player.status !== "active") continue;
			player.botThinkSeconds -= dt;
			if (player.botThinkSeconds > 0) continue;
			player.botThinkSeconds = player.botDifficulty === "skilled" ? .18 : player.botDifficulty === "casual" ? .42 : .28;
			const activeGhost = this.ghosts.filter((ghost) => ghost.stunnedSeconds <= 0 && ghost.frozenSeconds <= 0 && ghost.timeStoppedSeconds <= 0).sort((left, right) => distance(player.x, player.y, left.x, left.y) - distance(player.x, player.y, right.x, right.y))[0];
			const hasEliminatedAlly = player.characterId === "axolotl-mage" && this.players.some((candidate) => candidate.id !== player.id && candidate.status === "eliminated");
			if (player.abilityCooldownSeconds <= 0 && player.powerRunes > 0 && (hasEliminatedAlly || activeGhost && distance(player.x, player.y, activeGhost.x, activeGhost.y) < 2.8)) this.useAbility(player.id);
			const target = this.chooseBotTarget(player);
			player.botTarget = target;
			const currentCell = cellFromPosition(player.x, player.y);
			const direction = activeGhost && manhattanDistance(currentCell, cellFromPosition(activeGhost.x, activeGhost.y)) <= 2 ? chooseFleeDirection(this.grid, currentCell, cellFromPosition(activeGhost.x, activeGhost.y), player.direction) : target ? findPathDirection(this.grid, currentCell, target, player.direction) : null;
			if (direction) player.desiredDirection = direction;
		}
	}
	chooseBotTarget(player) {
		if (this.exitOpen) return { ...this.layout.exit };
		const uncollectedItems = this.items.filter((item) => item.collectedBy === null && item.kind !== "coin");
		const powerRuneItems = uncollectedItems.filter((item) => item.kind === "power-rune");
		const requiredKind = this.crystalsCollected < this.layout.targetCrystals ? "crystal" : "rune";
		const preferredItems = this.items.filter((item) => item.collectedBy === null && item.kind === requiredKind);
		const candidates = player.powerRunes <= 0 && powerRuneItems.length > 0 ? powerRuneItems : preferredItems.length > 0 ? preferredItems : uncollectedItems;
		const reservedTargets = new Set(this.players.filter((other) => other.id !== player.id && other.isBot && other.status === "active" && other.botTarget !== null).map((other) => cellKey(other.botTarget)));
		const unreservedItems = candidates.filter((item) => !reservedTargets.has(cellKey(item)));
		const fallbackUnreservedItems = uncollectedItems.filter((item) => !reservedTargets.has(cellKey(item)));
		const targetItem = [...unreservedItems.length > 0 ? unreservedItems : fallbackUnreservedItems.length > 0 ? fallbackUnreservedItems : uncollectedItems].sort((left, right) => manhattanDistance(cellFromPosition(player.x, player.y), left) - manhattanDistance(cellFromPosition(player.x, player.y), right))[0];
		return targetItem ? {
			x: targetItem.x,
			y: targetItem.y
		} : { ...this.layout.exit };
	}
	stepPlayers(dt) {
		const difficultyRank = this.level + this.cycle - 1;
		const playerSpeed = PLAYER_BASE_SPEED + Math.min(.35, difficultyRank * .015);
		const playerRadius = this.mode === "solo" ? PLAYER_RADIUS : MULTIPLAYER_PLAYER_RADIUS;
		for (const player of this.players) {
			if (player.status !== "active") {
				player.isMoving = false;
				continue;
			}
			if (!player.isBot && player.teleportTarget) {
				player.isMoving = false;
				continue;
			}
			if (this.mode !== "solo" && !player.isBot) {
				this.stepLocalPlayer(player, playerSpeed, dt, playerRadius);
				const localTile = this.grid[Math.floor(player.y)]?.[Math.floor(player.x)];
				if (player.inputActive && localTile === "special") player.abilityActiveSeconds = Math.max(player.abilityActiveSeconds, .04);
				continue;
			}
			if (!player.isBot && !player.inputActive && !player.stopAtCenter) {
				player.isMoving = false;
				continue;
			}
			const canTurnAtWall = !this.canMoveDirection(player.x, player.y, player.direction) && nearTileCenter(player.x, player.y, PLAYER_WALL_TURN_TOLERANCE);
			if (player.desiredDirection && (nearTileCenter(player.x, player.y) || canTurnAtWall) && this.canMoveDirection(player.x, player.y, player.desiredDirection)) {
				const center = tileCenter(cellFromPosition(player.x, player.y));
				player.x = center.x;
				player.y = center.y;
				player.direction = player.desiredDirection;
				player.desiredDirection = null;
			}
			const vector = this.directionVector(player.direction);
			const nextX = player.x + vector.x * playerSpeed * dt;
			const nextY = player.y + vector.y * playerSpeed * dt;
			if (this.canOccupy(nextX, nextY, PLAYER_RADIUS)) {
				player.x = nextX;
				player.y = nextY;
				player.isMoving = true;
			} else {
				player.isMoving = false;
				if (!player.isBot && !player.inputActive && player.stopAtCenter && nearTileCenter(player.x, player.y, PLAYER_WALL_TURN_TOLERANCE)) {
					const center = tileCenter(cellFromPosition(player.x, player.y));
					player.x = center.x;
					player.y = center.y;
					player.stopAtCenter = false;
				}
			}
			if (!player.isBot && !player.inputActive && player.stopAtCenter && nearTileCenter(player.x, player.y, .08)) {
				const center = tileCenter(cellFromPosition(player.x, player.y));
				player.x = center.x;
				player.y = center.y;
				player.stopAtCenter = false;
				player.isMoving = false;
			}
			if (this.grid[Math.floor(player.y)]?.[Math.floor(player.x)] === "special") player.abilityActiveSeconds = Math.max(player.abilityActiveSeconds, .04);
		}
	}
	stepLocalPlayer(player, speed, dt, radius) {
		if (!player.inputActive || player.movementX === 0 && player.movementY === 0) {
			player.isMoving = false;
			return;
		}
		const diagonal = player.movementX !== 0 && player.movementY !== 0;
		const step = speed * dt;
		const magnitude = Math.hypot(player.movementX, player.movementY);
		const deltaX = player.movementX / magnitude * step;
		const deltaY = player.movementY / magnitude * step;
		const canMoveX = deltaX === 0 || this.canOccupy(player.x + deltaX, player.y, radius);
		let moved = false;
		if (deltaX !== 0 && canMoveX) {
			player.x += deltaX;
			moved = true;
		}
		const slideY = diagonal && !canMoveX ? player.movementY * step : deltaY;
		if (slideY !== 0 && this.canOccupy(player.x, player.y + slideY, radius)) {
			player.y += slideY;
			moved = true;
		} else if (diagonal && canMoveX) {
			const slideX = player.x - deltaX + player.movementX * step;
			if (this.canOccupy(slideX, player.y, radius)) {
				player.x = slideX;
				moved = true;
			}
		}
		player.isMoving = moved;
	}
	stepGhosts(dt) {
		const difficultyRank = this.level + this.cycle - 1;
		const speed = GHOST_BASE_SPEED + Math.min(.48, difficultyRank * .035);
		for (const ghost of this.ghosts) {
			if (ghost.frozenSeconds > 0 || ghost.timeStoppedSeconds > 0) continue;
			if (ghost.knockbackSeconds > 0 && ghost.knockbackDirection) {
				this.moveAgent(ghost, ghost.knockbackDirection, 4.6, dt, GHOST_RADIUS);
				ghost.knockbackSeconds = Math.max(0, ghost.knockbackSeconds - dt);
				if (ghost.knockbackSeconds === 0) ghost.knockbackDirection = null;
			}
			if (ghost.stunnedSeconds > 0) continue;
			const targetPlayer = this.closestActivePlayer(ghost.x, ghost.y);
			if (!targetPlayer) continue;
			ghost.pathThinkSeconds -= dt;
			if (ghost.pullTarget) {
				const destination = tileCenter(ghost.pullTarget);
				const dx = destination.x - ghost.x;
				const dy = destination.y - ghost.y;
				const pullDirection = Math.abs(dx) > Math.abs(dy) ? dx >= 0 ? "right" : "left" : dy >= 0 ? "down" : "up";
				if (!this.moveAgent(ghost, pullDirection, 3.2, dt, GHOST_RADIUS) || distance(ghost.x, ghost.y, destination.x, destination.y) < .12) {
					ghost.x = destination.x;
					ghost.y = destination.y;
					ghost.pullTarget = null;
				}
				continue;
			}
			if (ghost.kind === "trickster") {
				ghost.tricksterSeconds -= dt;
				if (ghost.tricksterSeconds <= 0) {
					ghost.tricksterFleeing = !ghost.tricksterFleeing;
					ghost.tricksterSeconds = 3.2 + this.random() * 1.6;
				}
			}
			const currentCell = cellFromPosition(ghost.x, ghost.y);
			if (nearTileCenter(ghost.x, ghost.y, .16) && (ghost.pathThinkSeconds <= 0 || !this.canMoveDirection(ghost.x, ghost.y, ghost.direction))) {
				const target = this.ghostTarget(ghost, targetPlayer);
				if (ghost.fleeingSeconds > 0 || ghost.kind === "trickster" && ghost.tricksterFleeing) {
					const threat = cellFromPosition(targetPlayer.x, targetPlayer.y);
					ghost.direction = chooseFleeDirection(this.grid, currentCell, threat, ghost.direction) ?? ghost.direction;
				} else if (ghost.kind === "patroller") {
					if (!ghost.patrolTarget || manhattanDistance(currentCell, ghost.patrolTarget) <= 1) ghost.patrolTarget = this.choosePatrolTarget(currentCell);
					ghost.direction = findPathDirection(this.grid, currentCell, ghost.patrolTarget ?? target, ghost.direction) ?? ghost.direction;
				} else ghost.direction = findPathDirection(this.grid, currentCell, target, ghost.direction) ?? ghost.direction;
				ghost.pathThinkSeconds = Math.max(.18, .46 - difficultyRank * .012);
			}
			const specialSlow = this.grid[Math.floor(ghost.y)]?.[Math.floor(ghost.x)] === "special" && [
				"frost",
				"mosswood",
				"chronolibrary"
			].includes(this.layout.biome.id) ? .72 : 1;
			const ghostCell = cellFromPosition(ghost.x, ghost.y);
			const moveSpeed = speed * (this.swampZones.some((zone) => zone.cells.some((cell) => cell.x === ghostCell.x && cell.y === ghostCell.y)) || ghost.calmariaSeconds > 0 ? .42 : ghost.slowedSeconds > 0 ? .55 : specialSlow);
			this.moveAgent(ghost, ghost.direction, moveSpeed, dt, GHOST_RADIUS);
		}
	}
	ghostTarget(ghost, nearest) {
		const nearestCell = cellFromPosition(nearest.x, nearest.y);
		if (ghost.kind !== "interceptor") return nearestCell;
		const vector = this.directionVector(nearest.direction);
		let predicted = { ...nearestCell };
		for (let step = 0; step < 2; step += 1) {
			const next = {
				x: predicted.x + vector.x,
				y: predicted.y + vector.y
			};
			if (!canEnterTile(this.grid[next.y]?.[next.x])) break;
			predicted = next;
		}
		return predicted;
	}
	choosePatrolTarget(from) {
		const reachable = getReachableCells(this.grid, from).filter((cell) => manhattanDistance(cell, from) >= 4);
		if (reachable.length === 0) return { ...this.layout.start };
		const farCells = reachable.filter((cell) => manhattanDistance(cell, from) >= 6);
		const choices = farCells.length > 0 ? farCells : reachable;
		return { ...choices[Math.floor(this.random() * choices.length)] };
	}
	stepProjectiles(dt) {
		const remaining = [];
		for (const projectile of this.projectiles) {
			const vector = this.directionVector(projectile.direction);
			const distanceToMove = Math.min(projectile.speed * dt, projectile.remainingDistance);
			let blocked = false;
			let hit = false;
			const substeps = Math.max(1, Math.ceil(distanceToMove / .08));
			const subDistance = distanceToMove / substeps;
			for (let step = 0; step < substeps; step += 1) {
				const nextX = projectile.x + vector.x * subDistance;
				const nextY = projectile.y + vector.y * subDistance;
				if (!this.canOccupy(nextX, nextY, .08)) {
					blocked = true;
					break;
				}
				projectile.x = nextX;
				projectile.y = nextY;
				projectile.remainingDistance -= subDistance;
				const ghost = this.ghosts.find((candidate) => candidate.stunnedSeconds <= 0 && distance(candidate.x, candidate.y, projectile.x, projectile.y) < .38);
				if (ghost) {
					ghost.stunnedSeconds = 1.2;
					this.awardGhost(this.players.find((player) => player.id === projectile.ownerId));
					this.addEffect("hit", projectile.x, projectile.y, projectile.direction, .35);
					hit = true;
					break;
				}
			}
			if (!blocked && !hit && projectile.remainingDistance > .02) remaining.push(projectile);
		}
		this.projectiles = remaining;
	}
	stepEffects(dt) {
		this.effects = this.effects.map((effect) => ({
			...effect,
			secondsRemaining: effect.secondsRemaining - dt
		})).filter((effect) => effect.secondsRemaining > 0);
		this.swampZones = this.swampZones.map((zone) => ({
			...zone,
			secondsRemaining: zone.secondsRemaining - dt
		})).filter((zone) => zone.secondsRemaining > 0);
	}
	checkItemPickups() {
		for (const player of this.players) {
			if (player.status !== "active") continue;
			for (const item of this.items) {
				if (item.collectedBy !== null || item.kind === "coin" && player.isBot || distance(player.x, player.y, item.x + .5, item.y + .5) > .36) continue;
				item.collectedBy = player.id;
				if (item.kind === "coin") player.coinsCollected += 1;
				else if (item.kind === "crystal") {
					this.crystalsCollected += 1;
					player.crystals += 1;
					player.combo += 1;
					player.score += 45 + Math.min(45, player.combo * 3);
				} else if (item.kind === "rune") {
					this.runesActivated += 1;
					player.runes += 1;
					player.combo += 2;
					player.score += 130 + Math.min(45, player.combo * 4);
				} else {
					player.powerRunes += 1;
					player.powerWarningSeconds = 0;
				}
			}
		}
	}
	playerSpawnFor(player) {
		return this.layout.playerSpawns[player.controlIndex % this.layout.playerSpawns.length] ?? this.layout.start;
	}
	checkPlayerCollisions() {
		for (const player of this.players) {
			if (player.status !== "active" || player.invulnerableSeconds > 0) continue;
			if (this.ghosts.find((candidate) => candidate.stunnedSeconds <= 0 && candidate.frozenSeconds <= 0 && candidate.timeStoppedSeconds <= 0 && distance(player.x, player.y, candidate.x, candidate.y) < .42)) this.damagePlayer(player, "Um espírito alcançou você.");
		}
	}
	checkExits() {
		if (!this.exitOpen) return;
		for (const player of this.players) {
			if (player.status !== "active" || distance(player.x, player.y, this.layout.exit.x + .5, this.layout.exit.y + .5) > .42) continue;
			player.status = "finished";
			player.finishOrder = this.nextFinishOrder++;
			player.finishTimeSeconds = this.mode === "solo" ? this.levelElapsedSeconds : this.matchElapsedSeconds;
			player.score += 250 + Math.max(0, Math.floor(120 - player.finishTimeSeconds * 2));
			if (!player.isBot) {
				this.phase = "level-clear";
				this.phaseElapsed = 0;
				this.bestScore = Math.max(this.bestScore, player.score);
				return;
			}
		}
	}
	damagePlayer(player, reason) {
		if (player.status !== "active" || player.invulnerableSeconds > 0) return;
		player.lives = Math.max(0, player.lives - 1);
		player.combo = 0;
		player.invulnerableSeconds = 0;
		player.abilityActiveSeconds = 0;
		player.powerWarningSeconds = 0;
		player.teleportTarget = null;
		player.teleportTargetValid = false;
		player.isMoving = false;
		this.addEffect("hit", player.x, player.y, player.direction, .45);
		if (player.lives <= 0) {
			player.status = "eliminated";
			player.inputActive = false;
			player.stopAtCenter = false;
			player.desiredDirection = null;
			player.eliminationOrder = this.nextEliminationOrder++;
			if (this.mode === "solo") {
				this.phase = "game-over";
				this.gameOverReason = reason;
				this.bestScore = Math.max(this.bestScore, player.score);
			}
			return;
		}
		const center = tileCenter(this.playerSpawnFor(player));
		player.x = center.x;
		player.y = center.y;
		player.invulnerableSeconds = 5;
		player.direction = player.inputActive ? player.desiredDirection ?? player.direction : "right";
		if (!player.inputActive) player.desiredDirection = null;
		player.stopAtCenter = false;
	}
	finishMatch(reason) {
		if (this.phase !== "playing" || this.mode === "solo") return;
		const humanFinisher = this.players.find((player) => !player.isBot && player.status === "finished");
		if (humanFinisher) {
			this.phase = "level-clear";
			this.phaseElapsed = 0;
			this.bestScore = Math.max(this.bestScore, humanFinisher.score);
			return;
		}
		this.winnerId = null;
		this.matchEndReason = reason;
		this.gameOverReason = reason === "time-limit" ? "O tempo acabou antes de a fase ser concluída." : "Todos os jogadores perderam as vidas antes de concluir a fase.";
		this.phase = "game-over";
		this.phaseElapsed = 0;
	}
	advanceLevel() {
		this.level += 1;
		if (this.levelInCycle === MAZE_BIOMES.length) for (const player of this.players) player.lives = Math.min(5, player.lives + 1);
		this.levelNeedsLoad = true;
		this.phase = "character-select";
		this.phaseElapsed = 0;
		for (const player of this.players) {
			player.roster = player.isBot ? makeBotRoster(MAZE_CHARACTER_IDS[(this.level + player.controlIndex) % MAZE_CHARACTER_IDS.length], player.controlIndex) : [];
			player.rosterConfirmed = player.isBot;
			player.activeCharacterSlot = 0;
			player.switchCooldownSeconds = 0;
			player.teleportTarget = null;
			player.teleportTargetValid = false;
			player.abilityActiveSeconds = 0;
			if (player.roster[0]) {
				player.characterId = player.roster[0];
				player.abilityCooldownSeconds = player.abilityCooldownByCharacter[player.characterId] ?? 0;
			}
		}
	}
	openGate(cell, player, effectKind) {
		if (this.grid[cell.y]?.[cell.x] !== "breakable") return false;
		this.grid[cell.y][cell.x] = "path";
		player.score += 60;
		this.addEffect(effectKind, cell.x + .5, cell.y + .5, player.direction, .45);
		return true;
	}
	awardGhost(player) {
		if (!player) return;
		player.ghostsDefeated += 1;
		player.score += 180;
		player.combo += 1;
		this.totalGhostsDefeated += 1;
	}
	addEffect(kind, x, y, direction, seconds, target) {
		const id = `fx-${Math.floor(this.elapsedSeconds * 1e3)}-${this.effects.length}`;
		this.effects.push({
			id,
			kind,
			x,
			y,
			direction,
			secondsRemaining: seconds,
			maxSeconds: seconds,
			...target ? {
				targetX: target.x,
				targetY: target.y
			} : {}
		});
	}
	closestActivePlayer(x, y) {
		return this.players.filter((player) => player.status === "active").sort((left, right) => distance(x, y, left.x, left.y) - distance(x, y, right.x, right.y))[0];
	}
	canMoveDirection(x, y, direction) {
		const vector = this.directionVector(direction);
		const radius = this.mode === "solo" ? PLAYER_RADIUS : MULTIPLAYER_PLAYER_RADIUS;
		return this.canOccupy(x + vector.x * .12, y + vector.y * .12, radius);
	}
	canOccupy(x, y, radius) {
		return [
			[x - radius, y - radius],
			[x + radius, y - radius],
			[x - radius, y + radius],
			[x + radius, y + radius]
		].every(([sampleX, sampleY]) => {
			const tile = this.grid[Math.floor(sampleY)]?.[Math.floor(sampleX)];
			return canEnterTile(tile);
		});
	}
	moveAgent(agent, direction, speed, dt, radius) {
		const vector = this.directionVector(direction);
		const nextX = agent.x + vector.x * speed * dt;
		const nextY = agent.y + vector.y * speed * dt;
		if (this.canOccupy(nextX, nextY, radius)) {
			agent.x = nextX;
			agent.y = nextY;
			agent.direction = direction;
			return true;
		}
		if (nearTileCenter(agent.x, agent.y, .32)) {
			const center = tileCenter(cellFromPosition(agent.x, agent.y));
			agent.x = center.x;
			agent.y = center.y;
		}
		return false;
	}
	directionVector(direction) {
		return {
			up: {
				x: 0,
				y: -1
			},
			right: {
				x: 1,
				y: 0
			},
			down: {
				x: 0,
				y: 1
			},
			left: {
				x: -1,
				y: 0
			}
		}[direction];
	}
	random() {
		this.randomState += 1831565813;
		let value = this.randomState;
		value = Math.imul(value ^ value >>> 15, value | 1);
		value ^= value + Math.imul(value ^ value >>> 7, value | 61);
		return ((value ^ value >>> 14) >>> 0) / 4294967296;
	}
	rankedPlayers() {
		return [...this.players].sort((left, right) => {
			if (left.status === "finished" && right.status !== "finished") return -1;
			if (right.status === "finished" && left.status !== "finished") return 1;
			if (left.status === "finished" && right.status === "finished") return (left.finishOrder ?? Number.MAX_SAFE_INTEGER) - (right.finishOrder ?? Number.MAX_SAFE_INTEGER);
			if (left.status === "eliminated" && right.status === "eliminated") {
				const eliminationDifference = (right.eliminationOrder ?? 0) - (left.eliminationOrder ?? 0);
				if (eliminationDifference !== 0) return eliminationDifference;
			}
			if (left.score !== right.score) return right.score - left.score;
			const objectiveDifference = right.crystals + right.runes - (left.crystals + left.runes);
			if (objectiveDifference !== 0) return objectiveDifference;
			if (left.ghostsDefeated !== right.ghostsDefeated) return right.ghostsDefeated - left.ghostsDefeated;
			if (left.lives !== right.lives) return right.lives - left.lives;
			return left.controlIndex - right.controlIndex;
		});
	}
	resolveVote() {
		if (this.phase !== "voting") return;
		const counts = this.voteCounts();
		this.voteDecision = counts["change-game"] > this.humanVoterCount / 2 ? "change-game" : "next-level";
		this.phase = "decision";
		this.phaseElapsed = 0;
	}
	voteCounts() {
		let nextLevel = 0;
		let changeGame = 0;
		for (const [playerId, choice] of this.votes) {
			const player = this.players.find((candidate) => candidate.id === playerId);
			if (!player || player.isBot) continue;
			if (choice === "next-level") nextLevel += 1;
			else changeGame += 1;
		}
		return {
			"next-level": nextLevel,
			"change-game": changeGame
		};
	}
	snapshotPlayer(player) {
		const { desiredDirection: _desired, inputActive: _inputActive, axolotlHeartGranted: _axolotlHeartGranted, stopAtCenter: _stopAtCenter, abilityCooldownByCharacter: _cooldowns, botThinkSeconds: _botThink, botTarget: _target, botDifficulty: _difficulty, ...snapshot } = player;
		return {
			...snapshot,
			abilityCooldowns: { ...player.abilityCooldownByCharacter },
			roster: [...player.roster],
			teleportTarget: player.teleportTarget ? { ...player.teleportTarget } : null,
			teleportTargetValid: player.teleportTarget ? this.isTeleportDestinationValid(player, player.teleportTarget) : false
		};
	}
};
//#endregion
//#region src/features/spellbound/maze/MazeTutorialOverlay.tsx
var MAZE_TUTORIAL_FOCUS_BY_STEP = [
	"mission",
	"controls",
	"gems",
	"exit"
];
var TUTORIAL_STEPS = [
	{
		eyebrow: "ETAPA 1 DE 4 · OBJETIVO",
		title: "EXPLORE O LABIRINTO MÁGICO",
		description: "Reúna todas as gemas azuis e os demais itens obrigatórios para liberar o portal. As moedas são bônus."
	},
	{
		eyebrow: "ETAPA 2 DE 4 · MOVIMENTO",
		title: "ESCOLHA SEU CAMINHO",
		description: "Use os comandos indicados para o seu modo. O painel CONTROLES também mostra as teclas de poder e troca de personagem."
	},
	{
		eyebrow: "ETAPA 3 DE 4 · GEMAS AZUIS",
		title: "ACOMPANHE SUA MISSÃO",
		description: "Cada cristal azul conta como uma gema. O contador destacado mostra quantas você coletou e quantas existem neste nível; runas e moedas têm contagens separadas."
	},
	{
		eyebrow: "ETAPA 4 DE 4 · SAÍDA",
		title: "LIBERE O PORTAL E CONCLUA",
		description: "A saída só libera quando todos os itens que não são moedas forem coletados: cristais azuis, runas e runas de poder. Quando o painel indicar SAÍDA LIBERADA, caminhe até o portal."
	}
];
function LocalMovementControls({ playerCount }) {
	const count = Math.max(1, Math.min(4, Math.floor(playerCount)));
	return /* @__PURE__ */ jsx("div", {
		className: "mt-3 grid gap-1.5 sm:grid-cols-2",
		children: Array.from({ length: count }, (_, index) => /* @__PURE__ */ jsxs("p", {
			className: "flex items-center justify-between gap-2 border border-arcade-panel-border bg-arcade-sky/50 px-2 py-1.5 font-game text-sm text-arcade-ink",
			children: [/* @__PURE__ */ jsxs("span", {
				className: "font-arcade text-[0.42rem] text-arcade-violet",
				children: ["P", index + 1]
			}), /* @__PURE__ */ jsx("span", { children: LOCAL_PLAYER_CONTROLS[index]?.movement ?? "—" })]
		}, index))
	});
}
function MazeTutorialOverlay({ step, mode, playerCount, blueGemsTotal, onPrevious, onNext, onSkip, onComplete }) {
	const currentStep = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, Math.floor(step)));
	const content = TUTORIAL_STEPS[currentStep];
	const isLocalMultiplayer = mode === "local";
	return /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("div", {
		className: "pointer-events-auto absolute inset-0 z-30 bg-[#080d28]/65 backdrop-blur-[1px]",
		"aria-hidden": "true"
	}), /* @__PURE__ */ jsx("div", {
		className: "pointer-events-none absolute inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4",
		children: /* @__PURE__ */ jsxs("section", {
			role: "dialog",
			"aria-modal": "true",
			"aria-labelledby": "maze-tutorial-title",
			"aria-describedby": "maze-tutorial-description",
			className: "pointer-events-auto my-auto max-h-[calc(100%_-_1rem)] w-full max-w-2xl overflow-y-auto rounded-sm border-[3px] border-arcade-cyan bg-[#e9f4ff]/[0.98] p-4 text-center text-arcade-ink shadow-[6px_6px_0_var(--color-arcade-shadow)] transition duration-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 sm:p-5",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-2",
				"aria-live": "polite",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ jsx("p", {
							className: "font-arcade text-[0.46rem] text-arcade-violet sm:text-[0.52rem]",
							children: content.eyebrow
						}), /* @__PURE__ */ jsxs("span", {
							className: "shrink-0 font-arcade text-[0.42rem] text-arcade-violet",
							children: [
								currentStep + 1,
								"/",
								TUTORIAL_STEPS.length
							]
						})]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-2 h-1.5 overflow-hidden border border-arcade-panel-border bg-[#101537]/15",
						role: "progressbar",
						"aria-label": "Progresso do tutorial",
						"aria-valuemin": 1,
						"aria-valuemax": TUTORIAL_STEPS.length,
						"aria-valuenow": currentStep + 1,
						children: /* @__PURE__ */ jsx("div", {
							className: "h-full bg-arcade-cyan transition-[width] duration-200",
							style: { width: `${(currentStep + 1) / TUTORIAL_STEPS.length * 100}%` }
						})
					}),
					/* @__PURE__ */ jsx("h2", {
						id: "maze-tutorial-title",
						className: "pixel-title mt-4 text-xl leading-relaxed text-arcade-ink sm:text-2xl",
						children: content.title
					}),
					/* @__PURE__ */ jsx("p", {
						id: "maze-tutorial-description",
						className: "mx-auto mt-2 max-w-xl font-game text-base leading-relaxed text-muted-foreground sm:text-lg",
						children: currentStep === 2 && blueGemsTotal > 0 ? `${content.description} Neste nível, há ${blueGemsTotal} gemas azuis.` : content.description
					}),
					currentStep === 1 && /* @__PURE__ */ jsx("div", {
						className: "mx-auto mt-2 max-w-xl rounded-sm border border-arcade-panel-border bg-arcade-sky/35 p-2 text-left",
						children: isLocalMultiplayer ? /* @__PURE__ */ jsxs(Fragment$1, { children: [/* @__PURE__ */ jsx("p", {
							className: "font-arcade text-[0.42rem] text-arcade-violet",
							children: "MOVIMENTO · MULTIPLAYER LOCAL"
						}), /* @__PURE__ */ jsx(LocalMovementControls, { playerCount })] }) : /* @__PURE__ */ jsxs("p", {
							className: "font-game text-sm text-arcade-ink sm:text-base",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "font-arcade text-[0.42rem] text-arcade-violet",
									children: "SOLO E BOTS:"
								}),
								" ",
								"use as setas ou W A S D para mover."
							]
						})
					})
				]
			}, currentStep), /* @__PURE__ */ jsxs("div", {
				className: "mt-4 flex flex-col-reverse gap-2 border-t border-arcade-panel-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onSkip,
					className: "border border-arcade-panel-border bg-arcade-sky/50 px-3 py-2 font-arcade text-[0.44rem] text-arcade-violet transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan",
					children: "PULAR TUTORIAL"
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex justify-center gap-2 sm:justify-end",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: currentStep === 0,
						onClick: onPrevious,
						className: "border-2 border-arcade-panel-border bg-arcade-sky/60 px-3 py-2 font-arcade text-[0.46rem] text-arcade-ink transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-45",
						children: "VOLTAR"
					}), currentStep < TUTORIAL_STEPS.length - 1 ? /* @__PURE__ */ jsx("button", {
						type: "button",
						autoFocus: currentStep === 0,
						onClick: onNext,
						className: "border-2 border-arcade-violet bg-arcade-violet/75 px-4 py-2 font-arcade text-[0.46rem] text-arcade-ink transition-colors hover:bg-arcade-cyan focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan",
						children: "AVANÇAR"
					}) : /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onComplete,
						className: "border-2 border-arcade-violet bg-arcade-violet/75 px-4 py-2 font-arcade text-[0.46rem] text-arcade-ink transition-colors hover:bg-arcade-cyan focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan",
						children: "CONCLUIR"
					})]
				})]
			})]
		})
	})] });
}
//#endregion
//#region src/features/spellbound/maze/render.ts
var SIZE = 32;
var characterImageCache = /* @__PURE__ */ new Map();
var SPIRIT_PALETTES = {
	pursuer: {
		body: "#ff7fba",
		light: "#ffd3ea",
		eye: "#4f245f"
	},
	interceptor: {
		body: "#63d9f2",
		light: "#c8fbff",
		eye: "#17365b"
	},
	patroller: {
		body: "#b08aff",
		light: "#e6d6ff",
		eye: "#30215a"
	},
	trickster: {
		body: "#f3c66c",
		light: "#fff1b4",
		eye: "#5b3744"
	}
};
function fillRect(ctx, color, x, y, width, height) {
	ctx.fillStyle = color;
	ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}
function fillScaledSpriteRect(ctx, color, x, y, width, height) {
	const left = Math.round(x);
	const top = Math.round(y);
	const right = Math.round(x + width);
	const bottom = Math.round(y + height);
	if (right <= left || bottom <= top) return;
	ctx.fillStyle = color;
	ctx.fillRect(left, top, right - left, bottom - top);
}
function drawFloor(ctx, biome, x, y, time) {
	const left = x * SIZE;
	const top = y * SIZE;
	fillRect(ctx, (x * 7 + y * 11) % 5 === 0 ? biome.floorAlt : biome.floor, left, top, SIZE, SIZE);
	if ((x * 3 + y * 5) % 13 === 0) fillRect(ctx, Math.sin(time * 1.8 + x * 2.1 + y) > .82 ? biome.accent : biome.glow, left + 7 + (x + y) % 13, top + 8 + x * y % 11, 2, 2);
	if ((x + 2 * y) % 17 === 0) fillRect(ctx, biome.accent, left + 22, top + 24, 2, 2);
}
function drawBlockWall(ctx, biome, x, y, cracked = false) {
	const left = x * SIZE;
	const top = y * SIZE;
	fillRect(ctx, biome.wall, left, top, SIZE, SIZE);
	fillRect(ctx, biome.wallLight, left + 2, top + 2, SIZE - 4, 3);
	fillRect(ctx, "rgba(4, 9, 31, 0.34)", left + 2, top + SIZE - 5, SIZE - 4, 3);
	fillRect(ctx, "rgba(8, 13, 39, 0.25)", left + 3, top + 6, 2, SIZE - 12);
	fillRect(ctx, "rgba(255, 255, 255, 0.08)", left + 7, top + 8, SIZE - 14, 2);
	if (cracked) {
		ctx.strokeStyle = biome.accent;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(left + 9, top + 7);
		ctx.lineTo(left + 18, top + 14);
		ctx.lineTo(left + 13, top + 19);
		ctx.lineTo(left + 23, top + 25);
		ctx.stroke();
		fillRect(ctx, biome.glow, left + 7, top + 6, 3, 3);
	}
}
function drawSpecial(ctx, biome, x, y, time) {
	const left = x * SIZE;
	const top = y * SIZE;
	fillRect(ctx, biome.floorAlt, left, top, SIZE, SIZE);
	const pulse = Math.sin(time * 3.2 + x * .7 + y) > 0 ? 1 : 0;
	fillRect(ctx, biome.special, left + 13, top + 5 - pulse, 6, 3);
	fillRect(ctx, biome.special, left + 8, top + 11, 16, 5);
	fillRect(ctx, biome.glow, left + 12, top + 16, 8, 6);
	fillRect(ctx, biome.special, left + 10, top + 22 + pulse, 12, 3);
}
function drawGrid(ctx, snapshot, time) {
	for (let y = 0; y < snapshot.height; y += 1) for (let x = 0; x < snapshot.width; x += 1) {
		const tile = snapshot.grid[y]?.[x] ?? "wall";
		if (tile === "wall") drawBlockWall(ctx, snapshot.biome, x, y);
		else if (tile === "breakable") drawBlockWall(ctx, snapshot.biome, x, y, true);
		else {
			drawFloor(ctx, snapshot.biome, x, y, time);
			if (tile === "special") drawSpecial(ctx, snapshot.biome, x, y, time);
		}
	}
}
function drawSwampZones(ctx, snapshot, time) {
	for (const zone of snapshot.swampZones) {
		const fade = Math.max(.12, zone.secondsRemaining / zone.maxSeconds);
		for (const cell of zone.cells) {
			const left = cell.x * SIZE;
			const top = cell.y * SIZE;
			ctx.save();
			ctx.globalAlpha = fade * .72;
			fillRect(ctx, "#285e4a", left + 2, top + 2, SIZE - 4, SIZE - 4);
			fillRect(ctx, "rgba(137, 224, 144, 0.58)", left + 5, top + 5, SIZE - 10, 3);
			fillRect(ctx, "rgba(13, 36, 38, 0.58)", left + 4, top + SIZE - 8, SIZE - 8, 4);
			if (Math.sin(time * 4 + cell.x * 1.3 + cell.y * .7) > .25) {
				fillRect(ctx, "#b4f0a5", left + 8 + (cell.x + cell.y) % 12, top + 13, 3, 3);
				fillRect(ctx, "#72cf95", left + 18, top + 20 - cell.x * 3 % 5, 2, 2);
			}
			fillRect(ctx, "#c9f39b", left + 22, top + 8 + cell.y * 3 % 6, 3, 2);
			ctx.restore();
		}
	}
}
function drawTeleportTargets(ctx, snapshot, time) {
	for (const player of snapshot.players) {
		if (!player.teleportTarget) continue;
		const center = renderCellCenter(player.teleportTarget);
		const valid = player.teleportTargetValid;
		const pulse = 1 + Math.sin(time * 12) * .1;
		ctx.save();
		ctx.globalAlpha = .9;
		ctx.fillStyle = valid ? "rgba(108, 244, 213, 0.22)" : "rgba(255, 111, 141, 0.22)";
		ctx.fillRect(center.x - SIZE / 2 + 2, center.y - SIZE / 2 + 2, SIZE - 4, SIZE - 4);
		ctx.strokeStyle = valid ? "#77ffd6" : "#ff87a0";
		ctx.lineWidth = 2;
		ctx.shadowColor = ctx.strokeStyle;
		ctx.shadowBlur = 12;
		ctx.strokeRect(center.x - SIZE * pulse / 2 + 3, center.y - SIZE * pulse / 2 + 3, SIZE * pulse - 6, SIZE * pulse - 6);
		ctx.beginPath();
		ctx.moveTo(center.x - 9, center.y);
		ctx.lineTo(center.x + 9, center.y);
		ctx.moveTo(center.x, center.y - 9);
		ctx.lineTo(center.x, center.y + 9);
		ctx.stroke();
		ctx.font = "6px \"Press Start 2P\", monospace";
		ctx.textAlign = "center";
		ctx.fillStyle = valid ? "#caffee" : "#ffd4df";
		ctx.fillText(valid ? "ALVO OK" : "BLOQUEADO", center.x, center.y - 21);
		ctx.restore();
	}
}
function drawDiamond(ctx, x, y, radius, color) {
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(Math.round(x), Math.round(y - radius));
	ctx.lineTo(Math.round(x + radius * .65), Math.round(y - radius * .25));
	ctx.lineTo(Math.round(x + radius * .65), Math.round(y + radius * .25));
	ctx.lineTo(Math.round(x), Math.round(y + radius));
	ctx.lineTo(Math.round(x - radius * .65), Math.round(y + radius * .25));
	ctx.lineTo(Math.round(x - radius * .65), Math.round(y - radius * .25));
	ctx.closePath();
	ctx.fill();
}
function drawItems(ctx, snapshot, time) {
	for (const item of snapshot.items) {
		if (item.collectedBy) continue;
		const x = (item.x + .5) * SIZE;
		const y = (item.y + .5) * SIZE;
		const bob = Math.sin(time * 3.2 + item.x * 1.3 + item.y) * 2;
		ctx.save();
		ctx.shadowColor = item.kind === "crystal" ? "#7beaff" : item.kind === "power-rune" ? "#c77bff" : "#ffd98a";
		ctx.shadowBlur = item.kind === "power-rune" ? 16 : 12;
		if (item.kind === "crystal") {
			drawDiamond(ctx, x, y + bob, 10, "#8cefff");
			fillRect(ctx, "#f2ffff", x - 2, y - 5 + bob, 4, 8);
			fillRect(ctx, "#5298e7", x - 3, y + 6 + bob, 6, 3);
		} else if (item.kind === "coin") {
			fillRect(ctx, "#9d5c2f", x - 7, y - 8 + bob, 14, 16);
			fillRect(ctx, "#e9a83d", x - 5, y - 9 + bob, 10, 18);
			fillRect(ctx, "#ffdc75", x - 3, y - 6 + bob, 6, 12);
			fillRect(ctx, "#fff4bc", x - 2, y - 5 + bob, 2, 4);
		} else if (item.kind === "power-rune") {
			drawDiamond(ctx, x, y + bob, 12, "#a24be8");
			fillRect(ctx, "#f5e6ff", x - 2, y - 8 + bob, 4, 16);
			fillRect(ctx, "#8feeff", x - 7, y - 2 + bob, 14, 4);
			fillRect(ctx, "#ffffff", x - 1, y - 1 + bob, 2, 2);
		} else {
			fillRect(ctx, "#ffd887", x - 8, y - 8 + bob, 16, 16);
			fillRect(ctx, "#fff2bf", x - 5, y - 5 + bob, 10, 10);
			fillRect(ctx, "#9064d9", x - 2, y - 2 + bob, 4, 4);
			fillRect(ctx, "#fff7d4", x - 1, y - 7 + bob, 2, 14);
		}
		ctx.restore();
	}
}
function drawPortal(ctx, biome, exit, open, time) {
	const x = (exit.x + .5) * SIZE;
	const y = (exit.y + .5) * SIZE;
	const pulse = 1 + Math.sin(time * 4) * .08;
	ctx.save();
	ctx.translate(x, y);
	ctx.scale(pulse, pulse);
	ctx.shadowColor = open ? "#fff4aa" : biome.glow;
	ctx.shadowBlur = open ? 22 : 10;
	ctx.fillStyle = open ? "#f2d37e" : biome.wall;
	ctx.beginPath();
	ctx.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = open ? "#fff3bb" : biome.accent;
	ctx.lineWidth = 3;
	ctx.stroke();
	fillRect(ctx, open ? "#fffbe5" : biome.floor, -4, -9, 8, 18);
	if (!open) {
		fillRect(ctx, biome.wallLight, -3, -2, 6, 7);
		fillRect(ctx, biome.accent, -6, -7, 12, 3);
	} else fillRect(ctx, "#9a7be8", -1, -10, 2, 20);
	ctx.restore();
}
function drawGlobalTimeStop(ctx, snapshot, time) {
	if (snapshot.globalTimeStopSeconds <= 0) return;
	const width = snapshot.width * SIZE;
	const height = snapshot.height * SIZE;
	ctx.save();
	ctx.globalAlpha = .1 + Math.sin(time * 2.4) * .025;
	ctx.fillStyle = "#7976cf";
	ctx.fillRect(0, 0, width, height);
	ctx.globalAlpha = .78;
	for (let index = 0; index < 18; index += 1) {
		const x = ((index * 79 + Math.sin(time * .45 + index) * 18) % width + width) % width;
		const y = ((index * 53 + Math.cos(time * .38 + index * 1.7) * 15) % height + height) % height;
		fillRect(ctx, index % 3 === 0 ? "#fff8ff" : "#9eeeff", x, y, 2, 2);
		if (index % 6 === 0) {
			ctx.strokeStyle = "rgba(225, 218, 255, 0.88)";
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(x + 5, y + 5, 3, 0, Math.PI * 2);
			ctx.stroke();
			fillRect(ctx, "#fffaff", x + 4, y + 3, 1, 3);
			fillRect(ctx, "#d8caff", x + 5, y + 5, 2, 1);
		}
	}
	ctx.restore();
}
function spiritColor(kind) {
	return SPIRIT_PALETTES[kind];
}
function drawGhost(ctx, ghost, time) {
	const palette = spiritColor(ghost.kind);
	const x = ghost.x * SIZE;
	const y = ghost.y * SIZE;
	const flicker = Math.sin(time * 12 + x) * .5;
	const frozen = ghost.frozenSeconds > 0;
	const timeStopped = ghost.timeStoppedSeconds > 0;
	const disabled = frozen || timeStopped || ghost.stunnedSeconds > 0;
	ctx.save();
	ctx.globalAlpha = disabled ? .78 + flicker * .12 : 1;
	ctx.shadowColor = frozen ? "#8cefff" : timeStopped ? "#c5adff" : disabled ? "#fff1a8" : palette.body;
	ctx.shadowBlur = disabled ? 13 : 7;
	fillRect(ctx, "rgba(4, 9, 31, 0.35)", x - 10, y + 9, 20, 4);
	fillRect(ctx, palette.body, x - 8, y - 7, 16, 17);
	fillRect(ctx, palette.body, x - 6, y - 10, 12, 4);
	fillRect(ctx, palette.light, x - 4, y - 6, 8, 4);
	fillRect(ctx, palette.body, x - 11, y - 3, 3, 10);
	fillRect(ctx, palette.body, x + 8, y - 3, 3, 10);
	fillRect(ctx, palette.body, x - 8, y + 10, 5, 4);
	fillRect(ctx, palette.body, x - 1, y + 10 + (ghost.kind === "trickster" ? Math.round(flicker) : 0), 5, 4);
	fillRect(ctx, palette.body, x + 6, y + 10, 4, 4);
	fillRect(ctx, palette.light, x - 5, y - 1, 3, 4);
	fillRect(ctx, palette.light, x + 3, y - 1, 3, 4);
	fillRect(ctx, palette.eye, x - 4, y, 2, 3);
	fillRect(ctx, palette.eye, x + 4, y, 2, 3);
	if (ghost.kind === "pursuer") {
		fillRect(ctx, "#fff1fa", x - 2, y - 13, 4, 3);
		fillRect(ctx, palette.body, x - 1, y - 16, 2, 3);
	} else if (ghost.kind === "interceptor") drawDiamond(ctx, x, y - 12, 5, palette.light);
	else if (ghost.kind === "patroller") {
		fillRect(ctx, "#d6ffb8", x - 2, y - 13, 4, 3);
		fillRect(ctx, "#76ce9d", x - 1, y - 16, 2, 3);
	} else {
		fillRect(ctx, "#fff2ad", x - 6, y - 13, 3, 3);
		fillRect(ctx, "#fff2ad", x + 3, y - 13, 3, 3);
	}
	if (ghost.slowedSeconds > 0) {
		fillRect(ctx, "#bdf6ff", x - 12, y - 11, 2, 2);
		fillRect(ctx, "#bdf6ff", x + 10, y - 7, 2, 2);
	}
	if (frozen) {
		fillRect(ctx, "rgba(120, 226, 255, 0.72)", x - 12, y - 12, 5, 5);
		fillRect(ctx, "rgba(206, 250, 255, 0.78)", x + 7, y - 12, 5, 5);
		fillRect(ctx, "rgba(112, 203, 255, 0.72)", x - 12, y + 8, 5, 5);
		fillRect(ctx, "rgba(206, 250, 255, 0.78)", x + 7, y + 8, 5, 5);
		ctx.strokeStyle = "#bff8ff";
		ctx.lineWidth = 1.5;
		ctx.strokeRect(x - 13, y - 13, 26, 28);
	}
	if (timeStopped) {
		ctx.strokeStyle = "#cabdff";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(x, y, 15 + Math.sin(time * 4) * 1.5, 0, Math.PI * 2);
		ctx.stroke();
		fillRect(ctx, "#d8caff", x - 1, y - 13, 2, 5);
		fillRect(ctx, "#d8caff", x + 1, y - 10, 4, 2);
	}
	if (ghost.stunnedSeconds > 0) drawDiamond(ctx, x, y - 18 + Math.sin(time * 5) * 2, 3, "#fff2af");
	if (disabled) {
		ctx.font = "6px \"Press Start 2P\", monospace";
		ctx.textAlign = "center";
		ctx.fillStyle = frozen ? "#cbf8ff" : timeStopped ? "#e1d7ff" : "#fff5bd";
		ctx.shadowColor = "#141436";
		ctx.shadowBlur = 3;
		const seconds = frozen ? Math.ceil(ghost.frozenSeconds) : timeStopped ? Math.ceil(ghost.timeStoppedSeconds) : Math.ceil(ghost.stunnedSeconds);
		ctx.fillText(String(seconds), x, y - 22);
	}
	ctx.restore();
}
function drawCharacter(ctx, player, time) {
	if (player.status !== "active") return;
	const sprite = getGameplaySprite(player.characterId);
	const centerX = player.x * SIZE;
	const centerY = player.y * SIZE;
	const bob = player.isMoving ? Math.sin(time * 9 + player.controlIndex) * .7 : 0;
	const blinkAlpha = player.invulnerableSeconds > 0 && Math.floor(time * 14) % 2 === 0 ? .55 : 1;
	if (sprite) {
		const pixel = 1.45;
		const spriteColumns = sprite.grid.reduce((max, line) => Math.max(max, line.length), 0);
		const bodyWidth = spriteColumns * pixel;
		const bodyHeight = sprite.grid.length * pixel;
		const visualHeight = bodyHeight + pixel * 1.6 - 1;
		const spriteLeft = centerX - bodyWidth / 2;
		const anchorY = centerY - visualHeight / 2 + bob;
		const angle = player.direction === "up" ? -Math.PI / 2 : player.direction === "down" ? Math.PI / 2 : player.direction === "left" ? Math.PI : 0;
		ctx.save();
		ctx.translate(centerX, centerY);
		ctx.rotate(angle);
		ctx.globalAlpha = blinkAlpha;
		ctx.shadowColor = sprite.palette.m;
		ctx.shadowBlur = player.abilityActiveSeconds > 0 ? 16 : 7;
		fillRect(ctx, "rgba(5, 11, 40, 0.45)", -10, 9, 20, 4);
		ctx.restore();
		ctx.save();
		ctx.globalAlpha = blinkAlpha;
		for (let row = 0; row < sprite.grid.length; row += 1) {
			const line = sprite.grid[row] ?? "";
			for (let column = 0; column < line.length; column += 1) {
				const pixelKey = line[column];
				if (!pixelKey || pixelKey === ".") continue;
				const key = pixelKey;
				const visualColumn = player.direction === "left" ? spriteColumns - column - 1 : column;
				fillScaledSpriteRect(ctx, sprite.palette[key], spriteLeft + visualColumn * pixel, anchorY + row * pixel, pixel, pixel);
			}
		}
		const legY = bodyHeight;
		const legShift = player.isMoving && Math.sin(time * 12 + player.controlIndex) > 0 ? 1 : 0;
		for (const legColumn of sprite.legColumns) {
			const visualLegColumn = player.direction === "left" ? spriteColumns - legColumn - 2 : legColumn;
			fillScaledSpriteRect(ctx, sprite.palette.o, spriteLeft + visualLegColumn * pixel, anchorY + legY - 1, pixel * 2, pixel * (1.2 + legShift * .4));
		}
		ctx.restore();
	} else {
		const imageUrl = player.characterId === "calm-capybara-mage" ? capybara_default : axolotl_default;
		let image = characterImageCache.get(imageUrl);
		if (!image) {
			image = new Image();
			image.src = imageUrl;
			characterImageCache.set(imageUrl, image);
		}
		ctx.save();
		ctx.globalAlpha = blinkAlpha;
		ctx.fillStyle = "rgba(5, 11, 40, 0.45)";
		ctx.fillRect(centerX - 10, centerY + 9, 20, 4);
		ctx.shadowColor = player.characterId === "axolotl-mage" ? "#ff9edb" : "#9de8cf";
		ctx.shadowBlur = player.abilityActiveSeconds > 0 ? 16 : 7;
		if (image.complete && image.naturalWidth > 0) {
			ctx.imageSmoothingEnabled = false;
			if (player.direction === "left") {
				ctx.translate(centerX, 0);
				ctx.scale(-1, 1);
				ctx.drawImage(image, -SIZE * .58, centerY - SIZE * .58 + bob, SIZE * 1.16, SIZE * 1.16);
			} else ctx.drawImage(image, centerX - SIZE * .58, centerY - SIZE * .58 + bob, SIZE * 1.16, SIZE * 1.16);
		} else {
			ctx.fillStyle = player.characterId === "axolotl-mage" ? "#ff9edb" : "#9de8cf";
			ctx.fillRect(centerX - 6, centerY - 7 + bob, 12, 14);
		}
		ctx.restore();
	}
	if (!player.isBot) {
		ctx.save();
		ctx.strokeStyle = "#aef4ff";
		ctx.lineWidth = 2;
		ctx.shadowColor = "#8aeaff";
		ctx.shadowBlur = player.abilityActiveSeconds > 0 ? 15 : 8;
		ctx.strokeRect(centerX - 13, centerY - 16, 26, 30);
		ctx.restore();
	}
	if (player.characterId === "time-owl-mage" && player.abilityActiveSeconds > 0) {
		const clockY = centerY - 22;
		ctx.save();
		ctx.globalAlpha = Math.min(1, player.abilityActiveSeconds * 2);
		ctx.strokeStyle = "#e9e2ff";
		ctx.lineWidth = 1.5;
		ctx.shadowColor = "#b6b2ff";
		ctx.shadowBlur = 8;
		ctx.beginPath();
		ctx.arc(centerX, clockY, 5 + Math.sin(time * 7) * .6, 0, Math.PI * 2);
		ctx.stroke();
		ctx.shadowBlur = 0;
		fillRect(ctx, "#fffaff", centerX - 1, clockY - 3, 2, 4);
		fillRect(ctx, "#d8caff", centerX, clockY, 3, 1);
		for (let index = 0; index < 3; index += 1) {
			const angle = time * 3 + index * Math.PI * 2 / 3;
			fillRect(ctx, index % 2 === 0 ? "#fffaff" : "#b6b2ff", centerX + Math.cos(angle) * 9 - 1, clockY + Math.sin(angle) * 7 - 1, 2, 2);
		}
		ctx.restore();
	}
	if (player.invulnerableSeconds > 0) {
		ctx.save();
		ctx.globalAlpha = .45 + Math.sin(time * 9) * .12;
		ctx.strokeStyle = "#a9f6ff";
		ctx.lineWidth = 2;
		ctx.shadowColor = "#71eaff";
		ctx.shadowBlur = 12;
		ctx.beginPath();
		ctx.arc(centerX, centerY, 19 + Math.sin(time * 6) * 1.5, 0, Math.PI * 2);
		ctx.stroke();
		ctx.restore();
		ctx.save();
		ctx.font = "5px \"Press Start 2P\", monospace";
		ctx.textAlign = "center";
		ctx.fillStyle = "#d8fbff";
		ctx.shadowColor = "#18234c";
		ctx.shadowBlur = 4;
		ctx.fillText(`ESCUDO ${Math.ceil(player.invulnerableSeconds)}`, centerX, centerY - 34);
		ctx.restore();
	}
	const badge = player.isBot ? `CPU${player.controlIndex}` : `P${player.controlIndex + 1}`;
	ctx.save();
	ctx.font = "7px \"Press Start 2P\", monospace";
	ctx.textAlign = "center";
	ctx.fillStyle = player.isBot ? "#e9d7ff" : "#fff8c6";
	ctx.shadowColor = "#111432";
	ctx.shadowBlur = 4;
	ctx.fillText(badge, centerX, centerY - 18);
	if (player.controlIndex === 0 && !player.isBot) {
		ctx.fillStyle = "#ffffff";
		ctx.font = "6px \"Press Start 2P\", monospace";
		ctx.fillText("VOCÊ", centerX, centerY - 27);
	}
	ctx.restore();
}
function drawProjectiles(ctx, snapshot, time) {
	for (const projectile of snapshot.projectiles) {
		const x = projectile.x * SIZE;
		const y = projectile.y * SIZE;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(time * 10);
		ctx.shadowColor = "#e6baff";
		ctx.shadowBlur = 12;
		drawDiamond(ctx, 0, 0, 8, "#da9cff");
		drawDiamond(ctx, 0, 0, 4, "#fff5ff");
		ctx.restore();
	}
}
function drawEffects(ctx, snapshot, time) {
	for (const effect of snapshot.effects) {
		const fade = Math.max(.1, effect.secondsRemaining / effect.maxSeconds);
		const startX = effect.x * SIZE;
		const startY = effect.y * SIZE;
		ctx.save();
		ctx.globalAlpha = fade;
		if (effect.kind === "ice-ray" && effect.targetX !== void 0 && effect.targetY !== void 0) {
			ctx.strokeStyle = "#aaf4ff";
			ctx.lineWidth = 5;
			ctx.setLineDash([5, 4]);
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(effect.targetX * SIZE, effect.targetY * SIZE);
			ctx.stroke();
			ctx.setLineDash([]);
		} else if (effect.kind === "root-tether" && effect.targetX !== void 0 && effect.targetY !== void 0) {
			ctx.strokeStyle = "#9de89b";
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.moveTo(startX, startY);
			ctx.lineTo(effect.targetX * SIZE, effect.targetY * SIZE);
			ctx.stroke();
			fillRect(ctx, "#d4ffac", effect.targetX * SIZE - 3, effect.targetY * SIZE - 3, 6, 6);
		} else if (effect.kind === "forge-impact" || effect.kind === "gate-open" || effect.kind === "hit") {
			ctx.strokeStyle = effect.kind === "hit" ? "#fff1a8" : "#ffb45f";
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(startX, startY, 8 + (1 - fade) * 15, 0, Math.PI * 2);
			ctx.stroke();
			for (let index = 0; index < 4; index += 1) {
				const angle = time * 4 + index * Math.PI / 2;
				fillRect(ctx, "#fff3bd", startX + Math.cos(angle) * 12, startY + Math.sin(angle) * 12, 3, 3);
			}
		} else if (effect.kind === "time-vision") {
			ctx.strokeStyle = "rgba(194, 187, 255, 0.8)";
			ctx.lineWidth = 2;
			ctx.setLineDash([4, 5]);
			for (const ghost of snapshot.ghosts) {
				const vector = {
					up: {
						x: 0,
						y: -1
					},
					right: {
						x: 1,
						y: 0
					},
					down: {
						x: 0,
						y: 1
					},
					left: {
						x: -1,
						y: 0
					}
				}[ghost.direction];
				ctx.beginPath();
				ctx.moveTo(ghost.x * SIZE, ghost.y * SIZE);
				ctx.lineTo((ghost.x + vector.x * 1.7) * SIZE, (ghost.y + vector.y * 1.7) * SIZE);
				ctx.stroke();
			}
			ctx.setLineDash([]);
		} else if (effect.kind === "ice-burst" || effect.kind === "time-stop" || effect.kind === "swamp-burst" || effect.kind === "fire-burst" || effect.kind === "teleport-smoke" || effect.kind === "character-swap") {
			const color = effect.kind === "ice-burst" ? "#a9f5ff" : effect.kind === "time-stop" ? "#cbb9ff" : effect.kind === "swamp-burst" ? "#a1ee9a" : effect.kind === "fire-burst" ? "#ffad73" : effect.kind === "teleport-smoke" ? "#dda9ff" : "#91f2ff";
			const radius = effect.kind === "time-stop" ? 5 : 9 + (1 - fade) * (effect.kind === "fire-burst" ? 39 : 31);
			ctx.strokeStyle = color;
			ctx.lineWidth = effect.kind === "character-swap" ? 2 : 3;
			ctx.shadowColor = color;
			ctx.shadowBlur = 10;
			ctx.beginPath();
			ctx.arc(startX, startY, radius, 0, Math.PI * 2);
			ctx.stroke();
			for (let index = 0; index < 6; index += 1) {
				const angle = time * (effect.kind === "swamp-burst" ? 2 : 4) + index * Math.PI / 3;
				const distanceFromCenter = radius + index % 2 * 4;
				const size = effect.kind === "teleport-smoke" ? 4 : 3;
				fillRect(ctx, color, startX + Math.cos(angle) * distanceFromCenter, startY + Math.sin(angle) * distanceFromCenter, size, size);
			}
			if (effect.kind === "time-stop") {
				ctx.strokeStyle = "#f0eaff";
				ctx.beginPath();
				ctx.arc(startX, startY, Math.max(5, radius * .48), -Math.PI / 2, Math.PI * .9);
				ctx.stroke();
				fillRect(ctx, "#f0eaff", startX - 1, startY - 9, 2, 8);
				fillRect(ctx, "#f0eaff", startX, startY - 2, 6, 2);
			}
		}
		ctx.restore();
	}
}
function drawMatchFrame(ctx, width, height) {
	ctx.strokeStyle = "#c7adff";
	ctx.lineWidth = 4;
	ctx.strokeRect(1, 1, width - 2, height - 2);
	ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
	ctx.lineWidth = 1;
	ctx.strokeRect(6, 6, width - 12, height - 12);
}
var PIXEL_HEART_ROWS = [
	".##.##.",
	"#######",
	"#######",
	".#####.",
	"..###..",
	"...#..."
];
var PIXEL_HEART_CELL_SIZE = 2;
var PIXEL_HEART_GAP = 4;
function drawPixelHeart(ctx, x, y) {
	ctx.save();
	for (let row = 0; row < PIXEL_HEART_ROWS.length; row += 1) {
		const line = PIXEL_HEART_ROWS[row];
		for (let column = 0; column < line.length; column += 1) {
			if (line[column] !== "#") continue;
			fillRect(ctx, "#64122f", x + column * PIXEL_HEART_CELL_SIZE + 1, y + row * PIXEL_HEART_CELL_SIZE + 1, PIXEL_HEART_CELL_SIZE, PIXEL_HEART_CELL_SIZE);
		}
	}
	for (let row = 0; row < PIXEL_HEART_ROWS.length; row += 1) {
		const line = PIXEL_HEART_ROWS[row];
		for (let column = 0; column < line.length; column += 1) {
			if (line[column] !== "#") continue;
			fillRect(ctx, row < 3 ? "#ff3b57" : "#e5224e", x + column * PIXEL_HEART_CELL_SIZE, y + row * PIXEL_HEART_CELL_SIZE, PIXEL_HEART_CELL_SIZE, PIXEL_HEART_CELL_SIZE);
		}
	}
	fillRect(ctx, "#ffd8de", x + 2, y + 2, PIXEL_HEART_CELL_SIZE, PIXEL_HEART_CELL_SIZE);
	fillRect(ctx, "#ffd8de", x + 10, y + 2, PIXEL_HEART_CELL_SIZE, PIXEL_HEART_CELL_SIZE);
	ctx.restore();
}
function drawLocalLivesHud(ctx, snapshot, width) {
	const localPlayer = snapshot.players.find((player) => player.controlIndex === 0 && !player.isBot);
	const lives = Math.max(0, Math.floor(localPlayer?.lives ?? 0));
	if (lives === 0) return;
	const left = 8;
	const top = 2;
	const maxHeartsPerRow = Math.max(1, Math.floor((width - 16 + PIXEL_HEART_GAP) / 18));
	for (let index = 0; index < lives; index += 1) {
		const column = index % maxHeartsPerRow;
		const row = Math.floor(index / maxHeartsPerRow);
		drawPixelHeart(ctx, left + column * 18, top + row * 16);
	}
}
function renderMaze(ctx, snapshot, time, showLocalLivesHud = false) {
	const width = snapshot.width * SIZE;
	const height = snapshot.height * SIZE;
	ctx.save();
	ctx.imageSmoothingEnabled = false;
	const background = ctx.createLinearGradient(0, 0, width, height);
	background.addColorStop(0, "#101c46");
	background.addColorStop(1, "#241641");
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);
	drawGrid(ctx, snapshot, time);
	drawSwampZones(ctx, snapshot, time);
	drawItems(ctx, snapshot, time);
	drawPortal(ctx, snapshot.biome, snapshot.exit, snapshot.exitOpen, time);
	drawTeleportTargets(ctx, snapshot, time);
	for (const ghost of snapshot.ghosts) drawGhost(ctx, ghost, time);
	drawEffects(ctx, snapshot, time);
	drawProjectiles(ctx, snapshot, time);
	drawGlobalTimeStop(ctx, snapshot, time);
	for (const player of snapshot.players) drawCharacter(ctx, player, time);
	drawMatchFrame(ctx, width, height);
	if (showLocalLivesHud) drawLocalLivesHud(ctx, snapshot, width);
	ctx.restore();
}
function renderCellCenter(cell) {
	return {
		x: (cell.x + .5) * SIZE,
		y: (cell.y + .5) * SIZE
	};
}
//#endregion
//#region src/features/spellbound/maze/MazeScreen.tsx
var DIRECTION_BINDINGS = [
	{
		ArrowUp: "up",
		ArrowDown: "down",
		ArrowLeft: "left",
		ArrowRight: "right"
	},
	{
		KeyW: "up",
		KeyS: "down",
		KeyA: "left",
		KeyD: "right"
	},
	{
		KeyI: "up",
		KeyK: "down",
		KeyJ: "left",
		KeyL: "right"
	},
	{
		KeyT: "up",
		KeyG: "down",
		KeyF: "left",
		KeyH: "right"
	}
];
var SOLO_WASD_BINDINGS = {
	KeyW: "up",
	KeyS: "down",
	KeyA: "left",
	KeyD: "right"
};
function directionForKey(mode, index, code) {
	return DIRECTION_BINDINGS[index]?.[code] ?? ((mode === "solo" || mode === "bots") && index === 0 ? SOLO_WASD_BINDINGS[code] : void 0);
}
function movementVectorForKeys(mode, index, codes) {
	const directions = codes.map((code) => directionForKey(mode, index, code)).filter((direction) => direction !== void 0);
	const x = Number(directions.includes("right")) - Number(directions.includes("left"));
	const y = Number(directions.includes("down")) - Number(directions.includes("up"));
	return {
		x,
		y,
		facing: [...directions].reverse().find((direction) => direction === "left" || direction === "right" ? x !== 0 : y !== 0)
	};
}
function characterSlotForKey(index, code) {
	return MAZE_CHARACTER_SWITCH_KEYS[index]?.findIndex((key) => key === code) ?? -1;
}
function abilityKeyForControl(index) {
	return LOCAL_PLAYER_CONTROLS[index]?.ability ?? "—";
}
var DEFAULT_CHARACTER = playableCharacterSeeds[0].id;
var PANEL_STYLE = "pixel-panel border-2 border-arcade-panel-border bg-arcade-panel/90 shadow-[4px_4px_0_var(--color-arcade-shadow)]";
function characterAt(index, availableCharacters) {
	return availableCharacters[index % Math.max(1, availableCharacters.length)]?.id ?? DEFAULT_CHARACTER;
}
function mazePowerSound(characterId) {
	switch (characterId) {
		case "white-fox-ice-mage": return "power-ice";
		case "purple-rabbit-ninja": return "power-teleport";
		case "swamp-frog-mage": return "power-swamp";
		case "forge-raccoon-mage": return "power-forge";
		case "time-owl-mage": return "power-time";
		case "calm-capybara-mage": return "power-time";
		case "axolotl-mage": return "power-time";
	}
}
var MAZE_CHOOSER_CHARACTERS = MAZE_CHARACTER_IDS.map((characterId) => playableCharacterSeeds.find((character) => character.id === characterId));
function makeParticipants(mode, playerName, selectedCharacterId, count, unlockedCharacterIds) {
	const availableCharacters = playableCharacterSeeds.filter((character) => unlockedCharacterIds.includes(character.id));
	const humanCharacter = selectedCharacterId && unlockedCharacterIds.includes(selectedCharacterId) ? selectedCharacterId : availableCharacters[0]?.id ?? DEFAULT_CHARACTER;
	if (mode === "solo") return [{
		id: "maze-human-1",
		name: playerName || "JOGADOR 1",
		characterId: humanCharacter,
		controlIndex: 0
	}];
	if (mode === "bots") {
		const bots = availableCharacters.filter((character) => character.id !== humanCharacter).slice(0, 3).map((character, index) => ({
			id: `maze-bot-${index + 1}`,
			name: [
				"GUARDIÃO LUNAR",
				"ESPÍRITO ERRANTE",
				"SENTINELA ESTELAR"
			][index],
			characterId: character.id,
			isBot: true,
			botDifficulty: [
				"casual",
				"balanced",
				"skilled"
			][index],
			controlIndex: index + 1
		}));
		return [{
			id: "maze-human-1",
			name: playerName || "JOGADOR 1",
			characterId: humanCharacter,
			controlIndex: 0
		}, ...bots];
	}
	return Array.from({ length: count }, (_, index) => ({
		id: `maze-local-${index + 1}`,
		name: index === 0 ? playerName || "JOGADOR 1" : `JOGADOR ${index + 1}`,
		characterId: index === 0 ? humanCharacter : characterAt(index, availableCharacters),
		controlIndex: index
	}));
}
function readBestScore(key) {
	if (typeof window === "undefined") return 0;
	try {
		return Number(window.localStorage.getItem(key)) || 0;
	} catch {
		return 0;
	}
}
function formatTime(seconds) {
	const total = Math.max(0, Math.floor(seconds));
	const minutes = Math.floor(total / 60);
	const remaining = total % 60;
	return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}
function formatCooldown(seconds) {
	const remaining = Math.max(0, Math.ceil(seconds));
	return remaining > 0 ? `⚡ ${remaining}s` : "PRONTO";
}
function formatCooldownAccessible(seconds) {
	const remaining = Math.max(0, Math.ceil(seconds));
	return remaining > 0 ? `recarga ${remaining} segundos` : "PRONTO";
}
function actionButtonClass(accent = "border-arcade-violet text-arcade-ink") {
	return `border-2 ${accent} bg-arcade-sky/70 px-4 py-2 font-arcade text-[0.58rem] transition hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-45`;
}
function OverlayCard({ children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "absolute inset-0 z-20 flex items-center justify-center bg-[#090e2b]/75 p-3 backdrop-blur-[2px]",
		children: /* @__PURE__ */ jsx("div", {
			className: `${PANEL_STYLE} max-h-full w-full max-w-3xl overflow-y-auto rounded-sm p-4 text-center sm:p-6`,
			children
		})
	});
}
function MazeScreen({ mode, playerName, primaryWalletId, selectedCharacterId, unlockedCharacterIds, onBack, onChangeGame }) {
	const { playSfx, setMusicIntensity } = useArcadeAudio();
	const canvasRef = useRef(null);
	const engineRef = useRef(null);
	const resumeEngineLoopRef = useRef(null);
	const pressedDirectionKeysRef = useRef(/* @__PURE__ */ new Map());
	const [playerCount, setPlayerCount] = useState(2);
	const [participants, setParticipants] = useState(() => mode === "local" ? null : makeParticipants(mode, playerName, selectedCharacterId, 1, unlockedCharacterIds));
	const [runId, setRunId] = useState(0);
	const [snapshot, setSnapshot] = useState(null);
	const audioRunIdRef = useRef(runId);
	const audioSnapshotRef = useRef(null);
	const seenPowerRuneItemsRef = useRef(/* @__PURE__ */ new Set());
	const completedLevelSoundRef = useRef(null);
	const lastGhostWarningAtRef = useRef(0);
	const [spectatingIds, setSpectatingIds] = useState([]);
	const [dismissedEliminationIds, setDismissedEliminationIds] = useState([]);
	const changeGameHandled = useRef(false);
	const matchSessionId = useRef(createMatchId("maze"));
	const startLevelRef = useRef(1);
	const nextLevelRostersRef = useRef(null);
	const nextLevelCooldownsRef = useRef(null);
	const nextLevelPowerRunesRef = useRef(null);
	const matchId = `${matchSessionId.current}:${runId}:${snapshot?.level ?? startLevelRef.current}`;
	const bestScoreKey = `spellbound-maze-best:${selectedCharacterId ?? DEFAULT_CHARACTER}`;
	const selectedCharacter = useMemo(() => playableCharacterSeeds.find((character) => character.id === (selectedCharacterId ?? DEFAULT_CHARACTER)), [selectedCharacterId]);
	const matchIsFinal = snapshot !== null && [
		"level-clear",
		"results",
		"voting",
		"decision",
		"next-level",
		"change-game"
	].includes(snapshot.phase);
	const finalizedRewardEntries = snapshot?.players.flatMap((entry) => {
		const isFinal = mode === "solo" ? snapshot.phase === "level-clear" : matchIsFinal;
		if (entry.isBot || !isFinal) return [];
		return [{
			walletId: entry.controlIndex === 0 ? primaryWalletId : walletIdForLocalSlot(entry.controlIndex),
			playerId: entry.id,
			playerName: entry.name,
			amount: entry.coinsCollected
		}];
	}) ?? [];
	const rewardReceipts = useMatchCurrencyRewards(matchId, finalizedRewardEntries, primaryWalletId);
	const tutorialStorageKey = useMemo(() => {
		const normalizedName = normalizePlayerName(playerName)?.normalizedName ?? "jogador";
		return `magisterium-arcade-maze-tutorial-v1:${encodeURIComponent(normalizedName)}`;
	}, [playerName]);
	const [tutorialOpen, setTutorialOpen] = useState(false);
	const [tutorialStep, setTutorialStep] = useState(0);
	const tutorialOpenRef = useRef(false);
	const tutorialAutoOpenedRef = useRef(false);
	const clearHeldDirections = useCallback(() => {
		pressedDirectionKeysRef.current.clear();
		for (const participant of participants ?? []) if (!participant.isBot) engineRef.current?.clearDirection(participant.id);
	}, [participants]);
	const closeMazeTutorial = useCallback(() => {
		tutorialOpenRef.current = false;
		try {
			window.localStorage.setItem(tutorialStorageKey, "done");
		} catch {}
		setTutorialOpen(false);
	}, [tutorialStorageKey]);
	const openMazeTutorial = useCallback(() => {
		clearHeldDirections();
		tutorialOpenRef.current = true;
		setTutorialStep(0);
		setTutorialOpen(true);
	}, [clearHeldDirections]);
	useEffect(() => {
		if (!participants || tutorialAutoOpenedRef.current) return;
		tutorialAutoOpenedRef.current = true;
		let tutorialWasSeen = false;
		try {
			tutorialWasSeen = window.localStorage.getItem(tutorialStorageKey) === "done";
		} catch {}
		if (!tutorialWasSeen) {
			tutorialOpenRef.current = true;
			setTutorialStep(0);
			setTutorialOpen(true);
		}
	}, [participants, tutorialStorageKey]);
	useEffect(() => {
		if (!participants) return;
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		const carriedRosters = nextLevelRostersRef.current;
		const carriedCooldowns = nextLevelCooldownsRef.current;
		const carriedPowerRunes = nextLevelPowerRunesRef.current;
		const engineParticipants = participants.map((participant) => {
			const roster = carriedRosters?.get(participant.id);
			return roster ? {
				...participant,
				roster
			} : participant;
		});
		nextLevelRostersRef.current = null;
		nextLevelCooldownsRef.current = null;
		nextLevelPowerRunesRef.current = null;
		const engine = new MazeEngine({
			mode,
			participants: engineParticipants,
			bestScore: readBestScore(bestScoreKey),
			startLevel: startLevelRef.current,
			...carriedCooldowns ? { initialAbilityCooldowns: carriedCooldowns } : {},
			...carriedPowerRunes ? { initialPowerRunes: carriedPowerRunes } : {}
		});
		engineRef.current = engine;
		let animationFrame = 0;
		let lastFrame = performance.now();
		let lastHudUpdate = 0;
		let lastSnapshotPhase = engine.phase;
		let nextLevelTimer = 0;
		let nextLevelQueued = false;
		const frame = (time) => {
			const delta = Math.max(0, (time - lastFrame) / 1e3);
			lastFrame = time;
			if (tutorialOpenRef.current) {
				animationFrame = window.requestAnimationFrame(frame);
				return;
			}
			engine.step(delta);
			let nextSnapshot = engine.snapshot();
			if (nextSnapshot.phase === "game-over") {
				const previousBest = readBestScore(bestScoreKey);
				const best = Math.max(previousBest, nextSnapshot.gameOverScore);
				try {
					window.localStorage.setItem(bestScoreKey, String(best));
				} catch {}
				if (best > previousBest) {
					submitGlobalRecord("maze", best);
					playSfx("record");
				}
				engine.setBestScore(best);
				nextSnapshot = engine.snapshot();
			}
			renderMaze(context, nextSnapshot, time / 1e3, mode !== "solo");
			if (time - lastHudUpdate >= 80 || nextSnapshot.phase !== lastSnapshotPhase) {
				setSnapshot(nextSnapshot);
				lastHudUpdate = time;
				lastSnapshotPhase = nextSnapshot.phase;
			}
			if (nextSnapshot.phase === "change-game") return;
			if (nextSnapshot.phase === "game-over") {
				animationFrame = 0;
				return;
			}
			if (nextSnapshot.phase === "next-level" && !nextLevelQueued) {
				nextLevelQueued = true;
				startLevelRef.current = nextSnapshot.level + 1;
				nextLevelRostersRef.current = new Map(nextSnapshot.players.map((player) => [player.id, [...player.roster]]));
				nextLevelCooldownsRef.current = new Map(nextSnapshot.players.map((player) => [player.id, { ...player.abilityCooldowns }]));
				nextLevelPowerRunesRef.current = new Map(nextSnapshot.players.map((player) => [player.id, player.powerRunes]));
				nextLevelTimer = window.setTimeout(() => {
					setSnapshot(null);
					setSpectatingIds([]);
					setDismissedEliminationIds([]);
					changeGameHandled.current = false;
					setRunId((current) => current + 1);
				}, 700);
				return;
			}
			animationFrame = window.requestAnimationFrame(frame);
		};
		resumeEngineLoopRef.current = () => {
			if (animationFrame !== 0) return;
			lastFrame = performance.now();
			animationFrame = window.requestAnimationFrame(frame);
		};
		const initialSnapshot = engine.snapshot();
		setSnapshot(initialSnapshot);
		renderMaze(context, initialSnapshot, 0);
		animationFrame = window.requestAnimationFrame(frame);
		return () => {
			window.cancelAnimationFrame(animationFrame);
			if (nextLevelTimer) window.clearTimeout(nextLevelTimer);
			if (engineRef.current === engine) {
				engineRef.current = null;
				resumeEngineLoopRef.current = null;
			}
		};
	}, [
		bestScoreKey,
		mode,
		participants,
		playSfx,
		runId
	]);
	useEffect(() => {
		if (audioRunIdRef.current !== runId) {
			audioRunIdRef.current = runId;
			audioSnapshotRef.current = null;
			seenPowerRuneItemsRef.current.clear();
			completedLevelSoundRef.current = null;
			lastGhostWarningAtRef.current = 0;
			return;
		}
		if (!snapshot) return;
		const previous = audioSnapshotRef.current;
		if (previous) {
			if (previous.phase === "countdown" && snapshot.phase === "countdown" && previous.countdownLabel !== snapshot.countdownLabel) playSfx("countdown");
			if (previous.phase === "countdown" && snapshot.phase === "playing") playSfx("game-start");
			const oldCollectedItems = new Set(previous.items.filter((item) => item.collectedBy !== null).map((item) => item.id));
			let coinsCollected = 0;
			let ordinaryItemsCollected = 0;
			let powerRunesCollected = 0;
			for (const item of snapshot.items) {
				if (item.collectedBy === null || oldCollectedItems.has(item.id)) continue;
				const collector = snapshot.players.find((player) => player.id === item.collectedBy);
				if (!collector || collector.isBot) continue;
				if (item.kind === "coin") coinsCollected += 1;
				else if (item.kind === "power-rune") powerRunesCollected += 1;
				else ordinaryItemsCollected += 1;
			}
			for (let index = 0; index < Math.min(coinsCollected, 3); index += 1) playSfx("coin", { volume: .8 + index * .08 });
			if (ordinaryItemsCollected > 0) playSfx("collect", { volume: .82 });
			if (powerRunesCollected > 0) playSfx("rune", { volume: 1.05 });
			for (const item of snapshot.items) {
				if (item.kind !== "power-rune" || seenPowerRuneItemsRef.current.has(item.id)) continue;
				seenPowerRuneItemsRef.current.add(item.id);
				if (previous.items.some((oldItem) => oldItem.id !== item.id)) playSfx("rune-spawn", { volume: .58 });
			}
			const localPlayers = snapshot.players.filter((player) => !player.isBot);
			let lostLife = false;
			const activatedPowers = [];
			const revivedPlayerIds = [];
			let cooldownReady = false;
			for (const player of localPlayers) {
				const oldPlayer = previous.players.find((entry) => entry.id === player.id);
				if (!oldPlayer) continue;
				if (player.lives < oldPlayer.lives) lostLife = true;
				if (oldPlayer.status === "eliminated" && player.status === "active") revivedPlayerIds.push(player.id);
				if (player.powerRunes < oldPlayer.powerRunes) activatedPowers.push(player.characterId);
				if (player.score > oldPlayer.score) playSfx("score");
				for (const characterId of MAZE_CHARACTER_IDS) if ((oldPlayer.abilityCooldowns[characterId] ?? 0) > 0 && (player.abilityCooldowns[characterId] ?? 0) <= 0) cooldownReady = true;
			}
			if (revivedPlayerIds.length > 0) {
				const revivedIds = new Set(revivedPlayerIds);
				setDismissedEliminationIds((current) => current.filter((id) => !revivedIds.has(id)));
				setSpectatingIds((current) => current.filter((id) => !revivedIds.has(id)));
			}
			if (lostLife) {
				playSfx("hit", { volume: .55 });
				playSfx("life-lost");
			}
			if (activatedPowers.length > 0) playSfx(mazePowerSound(activatedPowers[0]));
			if (cooldownReady) playSfx("cooldown-ready");
			if (!previous.exitOpen && snapshot.exitOpen) playSfx("exit-unlocked");
			if (snapshot.phase === "level-clear" && completedLevelSoundRef.current !== snapshot.level) {
				completedLevelSoundRef.current = snapshot.level;
				playSfx("level-clear");
			}
			if (snapshot.phase === "game-over" && previous.phase !== "game-over") playSfx("game-over");
			const primary = snapshot.players.find((player) => !player.isBot && (player.controlIndex ?? 0) === 0);
			if (primary && snapshot.phase === "playing") {
				const isThreatened = snapshot.ghosts.some((ghost) => ghost.frozenSeconds <= 0 && ghost.timeStoppedSeconds <= 0 && ghost.fleeingSeconds <= 0 && ghost.stunnedSeconds <= 0 && Math.hypot(ghost.x - primary.x, ghost.y - primary.y) <= 2.1);
				const wasThreatened = previous.ghosts.some((ghost) => ghost.frozenSeconds <= 0 && ghost.timeStoppedSeconds <= 0 && ghost.fleeingSeconds <= 0 && ghost.stunnedSeconds <= 0 && Math.hypot(ghost.x - primary.x, ghost.y - primary.y) <= 2.1);
				if (isThreatened && !wasThreatened && performance.now() - lastGhostWarningAtRef.current > 4500) {
					lastGhostWarningAtRef.current = performance.now();
					playSfx("ghost-near", { volume: .55 });
				}
			}
		} else {
			if (snapshot.phase === "countdown") playSfx("countdown");
			if (snapshot.items.some((item) => item.kind === "power-rune" && item.collectedBy === null)) playSfx("rune-spawn", { volume: .48 });
			for (const item of snapshot.items) if (item.kind === "power-rune") seenPowerRuneItemsRef.current.add(item.id);
		}
		audioSnapshotRef.current = snapshot;
	}, [
		playSfx,
		runId,
		snapshot
	]);
	const mazeDangerNear = snapshot?.phase === "playing" && snapshot.ghosts.some((ghost) => ghost.frozenSeconds <= 0 && ghost.timeStoppedSeconds <= 0 && ghost.fleeingSeconds <= 0 && ghost.stunnedSeconds <= 0 && snapshot.players.some((player) => !player.isBot && (player.controlIndex ?? 0) === 0 && Math.hypot(ghost.x - player.x, ghost.y - player.y) <= 2.1));
	useEffect(() => {
		setMusicIntensity(mazeDangerNear ? 1.14 : .96);
	}, [mazeDangerNear, setMusicIntensity]);
	useEffect(() => () => setMusicIntensity(1), [setMusicIntensity]);
	useEffect(() => {
		if (snapshot?.phase !== "change-game" || changeGameHandled.current) return;
		changeGameHandled.current = true;
		onChangeGame();
	}, [onChangeGame, snapshot?.phase]);
	useEffect(() => {
		if (!participants) return;
		const onKeyDown = (event) => {
			if (tutorialOpenRef.current) return;
			if (event.code === "Escape") {
				event.preventDefault();
				for (const participant of participants) if (!participant.isBot && engineRef.current?.cancelTeleportTarget(participant.id)) {
					clearHeldDirections();
					if (engineRef.current) setSnapshot(engineRef.current.snapshot());
					return;
				}
				clearHeldDirections();
				onBack();
				return;
			}
			for (const player of participants) {
				if (player.isBot) continue;
				const index = player.controlIndex ?? 0;
				const slot = characterSlotForKey(index, event.code);
				if (slot >= 0) {
					if (event.repeat) return;
					event.preventDefault();
					engineRef.current?.switchCharacter(player.id, slot);
					if (engineRef.current) setSnapshot(engineRef.current.snapshot());
					return;
				}
				const direction = directionForKey(mode, index, event.code);
				if (direction) {
					event.preventDefault();
					if (engineRef.current?.isTeleportAiming(player.id)) {
						engineRef.current.moveTeleportTarget(player.id, direction);
						if (engineRef.current) setSnapshot(engineRef.current.snapshot());
						return;
					}
					const heldKeys = pressedDirectionKeysRef.current.get(player.id) ?? [];
					if (event.repeat && heldKeys.includes(event.code)) return;
					const nextHeldKeys = [...heldKeys.filter((code) => code !== event.code), event.code];
					pressedDirectionKeysRef.current.set(player.id, nextHeldKeys);
					if (mode === "solo") engineRef.current?.setDirection(player.id, direction);
					else {
						const movement = movementVectorForKeys(mode, index, nextHeldKeys);
						engineRef.current?.setMovementVector(player.id, movement.x, movement.y, movement.facing ?? direction);
					}
					return;
				}
				if (event.repeat) return;
				if (event.code === MAZE_PLAYER_KEYS[index]) {
					event.preventDefault();
					if (!engineRef.current?.useAbility(player.id)) playSfx("blocked");
					if (engineRef.current) setSnapshot(engineRef.current.snapshot());
					return;
				}
			}
		};
		const onKeyUp = (event) => {
			for (const player of participants) {
				if (player.isBot) continue;
				const heldKeys = pressedDirectionKeysRef.current.get(player.id);
				if (!heldKeys?.includes(event.code)) continue;
				event.preventDefault();
				const remainingKeys = heldKeys.filter((code) => code !== event.code);
				if (remainingKeys.length === 0) {
					pressedDirectionKeysRef.current.delete(player.id);
					engineRef.current?.clearDirection(player.id);
				} else {
					pressedDirectionKeysRef.current.set(player.id, remainingKeys);
					const lastKey = remainingKeys[remainingKeys.length - 1];
					const index = player.controlIndex ?? 0;
					const direction = directionForKey(mode, index, lastKey);
					if (direction && mode === "solo") engineRef.current?.setDirection(player.id, direction);
					else if (mode !== "solo") {
						const movement = movementVectorForKeys(mode, index, remainingKeys);
						engineRef.current?.setMovementVector(player.id, movement.x, movement.y, movement.facing ?? direction);
					}
				}
				return;
			}
		};
		const onWindowBlur = () => clearHeldDirections();
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") clearHeldDirections();
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);
		window.addEventListener("blur", onWindowBlur);
		document.addEventListener("visibilitychange", onVisibilityChange);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			window.removeEventListener("blur", onWindowBlur);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			clearHeldDirections();
		};
	}, [
		clearHeldDirections,
		mode,
		onBack,
		participants,
		playSfx,
		runId
	]);
	const startLocalMatch = () => {
		startLevelRef.current = 1;
		nextLevelRostersRef.current = null;
		nextLevelCooldownsRef.current = null;
		nextLevelPowerRunesRef.current = null;
		setParticipants(makeParticipants("local", playerName, selectedCharacterId, playerCount, unlockedCharacterIds));
		setRunId((current) => current + 1);
		changeGameHandled.current = false;
	};
	const retryCurrentPhase = () => {
		const engine = engineRef.current;
		if (!engine || !engine.retryCurrentLevel()) return;
		pressedDirectionKeysRef.current.clear();
		nextLevelRostersRef.current = null;
		nextLevelCooldownsRef.current = null;
		nextLevelPowerRunesRef.current = null;
		setSpectatingIds([]);
		setDismissedEliminationIds([]);
		changeGameHandled.current = false;
		setSnapshot(engine.snapshot());
		resumeEngineLoopRef.current?.();
	};
	const advanceMazeLevel = () => {
		const engine = engineRef.current;
		if (!engine || snapshot?.phase !== "level-clear") return;
		settleMatchRewards(matchId, finalizedRewardEntries);
		if (engine.advanceToNextLevel()) {
			setSpectatingIds([]);
			setDismissedEliminationIds([]);
			changeGameHandled.current = false;
			setSnapshot(engine.snapshot());
		}
	};
	const castVote = (playerId, vote) => {
		engineRef.current?.vote(playerId, vote);
	};
	const activatePower = (playerId) => {
		if (!engineRef.current?.useAbility(playerId)) playSfx("blocked");
		if (engineRef.current) setSnapshot(engineRef.current.snapshot());
	};
	const switchPlayerCharacter = (playerId, slot) => {
		engineRef.current?.switchCharacter(playerId, slot);
		if (engineRef.current) setSnapshot(engineRef.current.snapshot());
	};
	const activateFirstPower = () => {
		const human = participants?.find((participant) => !participant.isBot);
		if (human) activatePower(human.id);
	};
	const toggleRosterCharacter = (playerId, characterId) => {
		const selecting = snapshot?.players.find((candidate) => candidate.id === playerId);
		if (!selecting || selecting.rosterConfirmed) return;
		const nextRoster = selecting.roster.includes(characterId) ? selecting.roster.filter((id) => id !== characterId) : selecting.roster.length < 3 ? [...selecting.roster, characterId] : selecting.roster;
		engineRef.current?.setRosterSelection(playerId, nextRoster);
		if (engineRef.current) setSnapshot(engineRef.current.snapshot());
	};
	const confirmPlayerRoster = (playerId) => {
		engineRef.current?.confirmRoster(playerId);
		if (engineRef.current) setSnapshot(engineRef.current.snapshot());
	};
	const unresolvedElimination = snapshot?.players.find((player) => !player.isBot && player.status === "eliminated" && !spectatingIds.includes(player.id) && !dismissedEliminationIds.includes(player.id)) ?? null;
	if (!participants && mode === "local") return /* @__PURE__ */ jsxs("main", {
		className: "celestial-sky relative h-dvh min-h-0 overflow-hidden px-3 py-3 text-foreground sm:px-6 sm:py-5",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "pointer-events-none absolute inset-0 opacity-50",
			children: [
				/* @__PURE__ */ jsx("div", { className: "absolute left-[10%] top-[14%] h-2 w-2 bg-arcade-star shadow-[0_0_18px_var(--color-arcade-star)]" }),
				/* @__PURE__ */ jsx("div", { className: "absolute right-[12%] top-[28%] h-3 w-3 bg-arcade-cyan shadow-[0_0_22px_var(--color-arcade-cyan)]" }),
				/* @__PURE__ */ jsx("div", { className: "absolute bottom-[18%] left-[22%] h-2 w-2 bg-arcade-violet shadow-[0_0_18px_var(--color-arcade-violet)]" })
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex h-full max-w-5xl flex-col",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex shrink-0 items-center justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "font-arcade text-[0.52rem] text-arcade-violet",
					children: "MAGISTERIUM ARCADE"
				}), /* @__PURE__ */ jsx("h1", {
					className: "mt-2 font-arcade text-xs leading-relaxed text-arcade-ink sm:text-sm",
					children: "LABIRINTO MÁGICO"
				})] }), /* @__PURE__ */ jsx("button", {
					type: "button",
					className: actionButtonClass(),
					onClick: onBack,
					children: "VOLTAR"
				})]
			}), /* @__PURE__ */ jsx("section", {
				className: "my-2 min-h-0 flex-1 overflow-y-auto py-3",
				children: /* @__PURE__ */ jsxs("div", {
					className: `${PANEL_STYLE} rounded-sm p-4 sm:p-6`,
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "text-center",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.52rem] text-arcade-violet",
									children: "MULTIPLAYER LOCAL"
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "pixel-title mt-3 text-2xl leading-relaxed text-arcade-ink sm:text-4xl",
									children: "ESCOLHA SUA EQUIPE"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mx-auto mt-2 max-w-xl font-game text-base text-muted-foreground sm:text-lg",
									children: "De 2 a 4 participantes no mesmo dispositivo. Cada vaga tem movimento, magia e troca de equipe próprios. Antes de cada nível, cada jogador escolhe três personagens."
								})
							]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-5 flex flex-wrap items-center justify-center gap-2",
							"aria-label": "Quantidade de jogadores",
							children: Array.from({ length: 3 }, (_, offset) => offset + 2).map((count) => /* @__PURE__ */ jsxs("button", {
								type: "button",
								"aria-pressed": playerCount === count,
								onClick: () => setPlayerCount(count),
								className: actionButtonClass(playerCount === count ? "border-arcade-cyan text-arcade-ink" : "border-arcade-panel-border text-muted-foreground"),
								children: [count, " JOGADORES"]
							}, count))
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-5 grid gap-3 sm:grid-cols-2",
							children: Array.from({ length: playerCount }, (_, index) => /* @__PURE__ */ jsxs("label", {
								className: "border-2 border-arcade-panel-border bg-arcade-sky/30 p-3",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "flex items-center justify-between gap-2",
									children: [/* @__PURE__ */ jsx("span", {
										className: "font-arcade text-[0.52rem] text-arcade-ink",
										children: index === 0 ? playerName.toUpperCase() : `JOGADOR ${index + 1}`
									}), /* @__PURE__ */ jsxs("span", {
										className: "font-arcade text-right text-[0.4rem] leading-relaxed text-arcade-violet",
										children: [
											LOCAL_PLAYER_CONTROLS[index]?.movement,
											" · PODER",
											" ",
											LOCAL_PLAYER_CONTROLS[index]?.ability,
											/* @__PURE__ */ jsx("br", {}),
											"TROCA ",
											LOCAL_PLAYER_CONTROLS[index]?.switch
										]
									})]
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-3 font-game text-sm text-muted-foreground",
									children: "Escolha seu trio antes de entrar em cada labirinto."
								})]
							}, index))
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-5 flex flex-wrap justify-center gap-2",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: onBack,
								className: actionButtonClass("border-arcade-panel-border text-arcade-ink"),
								children: "VOLTAR"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: startLocalMatch,
								className: actionButtonClass("border-arcade-violet text-arcade-ink"),
								children: "COMEÇAR PARTIDA"
							})]
						})
					]
				})
			})]
		})]
	});
	const player = snapshot?.players.find((candidate) => !candidate.isBot) ?? null;
	const selectingPlayer = snapshot?.phase === "character-select" ? snapshot.players.find((candidate) => !candidate.isBot && !candidate.rosterConfirmed) ?? null : null;
	const selectedRoster = selectingPlayer?.roster ?? [];
	const power = player ? getMazePower(player.characterId) : getMazePower(selectedCharacter.id);
	const currentVoteIds = new Set(snapshot?.votedPlayerIds ?? []);
	const ghosts = snapshot?.ghosts ?? [];
	const globalTimeStopSeconds = snapshot?.globalTimeStopSeconds ?? 0;
	const timeNormalDisplaySeconds = snapshot?.timeNormalDisplaySeconds ?? 0;
	const timeStopReadout = globalTimeStopSeconds > 0 ? `TEMPO PARADO · ${Math.ceil(globalTimeStopSeconds)}s` : timeNormalDisplaySeconds > 0 ? "TEMPO NORMAL" : null;
	const controlReadouts = [{
		label: "GELO",
		count: ghosts.filter((ghost) => ghost.frozenSeconds > 0).length,
		seconds: Math.ceil(Math.max(0, ...ghosts.map((ghost) => ghost.frozenSeconds)))
	}, {
		label: "ATORDOADOS",
		count: ghosts.filter((ghost) => ghost.stunnedSeconds > 0).length,
		seconds: Math.ceil(Math.max(0, ...ghosts.map((ghost) => ghost.stunnedSeconds)))
	}].filter((effect) => effect.count > 0);
	const powerRuneWarnings = snapshot?.players.filter((entry) => !entry.isBot && entry.powerWarningSeconds > 0) ?? [];
	const blueGems = snapshot?.items.filter((item) => item.kind === "crystal") ?? [];
	const blueGemsCollected = blueGems.filter((item) => item.collectedBy !== null).length;
	const blueGemsTotal = blueGems.length;
	const allBlueGemsCollected = blueGemsTotal > 0 && blueGemsCollected === blueGemsTotal;
	const remainingObjectiveItems = Math.max(0, (snapshot?.collectiblesTotal ?? 0) - (snapshot?.collectiblesCollected ?? 0));
	const tutorialFocus = MAZE_TUTORIAL_FOCUS_BY_STEP[tutorialStep] ?? "mission";
	const tutorialTargetClass = (target) => tutorialOpen && tutorialFocus === target ? "relative z-[40] rounded-sm ring-4 ring-arcade-cyan ring-offset-2 ring-offset-[#090e2b] shadow-[0_0_18px_rgba(96,226,255,0.8)] transition-all duration-200" : "";
	const tutorialPlayerCount = participants?.filter((participant) => !participant.isBot).length ?? playerCount;
	const blueGemProgress = blueGemsTotal > 0 ? Math.min(100, blueGemsCollected / blueGemsTotal * 100) : 0;
	return /* @__PURE__ */ jsx("main", {
		className: "celestial-sky relative h-dvh min-h-0 overflow-hidden p-2 text-foreground sm:p-3",
		children: /* @__PURE__ */ jsxs("div", {
			className: "relative z-10 mx-auto flex h-full max-w-[1500px] flex-col gap-2",
			children: [
				/* @__PURE__ */ jsxs("header", {
					className: "flex shrink-0 items-center justify-between gap-2",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ jsxs("p", {
							className: "font-arcade text-[0.45rem] text-arcade-violet sm:text-[0.55rem]",
							children: ["MAGISTERIUM ARCADE · ", mode === "solo" ? "SOLO INFINITO" : mode === "bots" ? "MULTIPLAYER · BOTS" : "MULTIPLAYER LOCAL"]
						}), /* @__PURE__ */ jsx("h1", {
							className: "mt-1 truncate font-arcade text-[0.62rem] text-arcade-ink sm:text-sm",
							children: "LABIRINTO MÁGICO"
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "flex shrink-0 items-center gap-2",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							"aria-label": "Abrir novamente o tutorial do Labirinto Mágico",
							className: actionButtonClass("border-arcade-cyan text-arcade-ink"),
							onClick: openMazeTutorial,
							children: "? AJUDA"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							className: actionButtonClass("border-arcade-panel-border text-arcade-ink"),
							onClick: onBack,
							children: "SAIR"
						})]
					})]
				}),
				/* @__PURE__ */ jsxs("section", {
					"aria-label": "Resumo da partida",
					className: "pixel-panel shrink-0 rounded-sm border-[3px] border-arcade-violet bg-[#e9f4ff]/95 px-3 py-2 shadow-[4px_5px_0_var(--color-arcade-shadow)] sm:px-5 sm:py-3",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-arcade-panel-border/70 pb-1.5",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "flex items-center gap-2 font-arcade text-[0.42rem] sm:text-[0.5rem]",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-arcade-violet",
									children: "NÍVEL · CICLO"
								}), /* @__PURE__ */ jsx("span", {
									className: "text-arcade-ink",
									children: snapshot ? `${snapshot.level} · ${snapshot.cycle}` : "—"
								})]
							}), /* @__PURE__ */ jsxs("p", {
								className: "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 font-arcade text-[0.42rem] sm:text-[0.5rem]",
								children: [/* @__PURE__ */ jsx("span", {
									className: "shrink-0 text-arcade-violet",
									children: "BIOMA"
								}), /* @__PURE__ */ jsx("span", {
									className: "break-words text-arcade-ink",
									children: snapshot?.biome.name ?? "PREPARANDO"
								})]
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-2 grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.42fr)] sm:gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								"data-maze-tutorial-target": "mission",
								className: `min-w-0 rounded-sm border-2 border-arcade-cyan bg-arcade-cyan/10 p-2 sm:p-2.5 ${tutorialTargetClass("mission")}`,
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "font-arcade text-[0.42rem] text-arcade-violet sm:text-[0.5rem]",
										children: "MISSÃO PRINCIPAL"
									}),
									/* @__PURE__ */ jsx("p", {
										className: "mt-1 font-arcade text-[0.46rem] text-arcade-ink sm:text-[0.54rem]",
										children: "💎 COLETE TODAS AS GEMAS AZUIS"
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "mt-1 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2",
										children: [
											/* @__PURE__ */ jsxs("span", {
												"data-maze-tutorial-target": "gems",
												className: `whitespace-nowrap font-arcade text-[0.67rem] text-arcade-ink sm:text-base ${tutorialTargetClass("gems")}`,
												"aria-label": `Gemas azuis coletadas: ${blueGemsCollected} de ${blueGemsTotal}`,
												children: [
													"💎 GEMAS AZUIS: ",
													snapshot ? `${blueGemsCollected}/${blueGemsTotal}` : "—",
													allBlueGemsCollected ? " ✓" : ""
												]
											}),
											/* @__PURE__ */ jsxs("span", {
												className: "font-arcade text-[0.43rem] text-arcade-violet sm:text-[0.48rem]",
												children: [
													"◈ RUNAS COLETADAS:",
													" ",
													snapshot ? `${snapshot.runesActivated}/${snapshot.targetRunes}` : "—"
												]
											}),
											/* @__PURE__ */ jsxs("span", {
												className: "whitespace-nowrap font-arcade text-[0.43rem] text-arcade-gold sm:text-[0.48rem]",
												title: `Moedas bônus coletadas nesta partida: ${player?.coinsCollected ?? 0}`,
												"aria-label": `Moedas bônus coletadas nesta partida: ${player?.coinsCollected ?? 0}`,
												children: ["🪙 BÔNUS: ", player?.coinsCollected ?? 0]
											})
										]
									}),
									/* @__PURE__ */ jsx("div", {
										className: "mt-2 h-2 overflow-hidden border border-arcade-panel-border bg-[#101537]/15",
										role: "progressbar",
										"aria-label": `Progresso das gemas azuis: ${blueGemsCollected} de ${blueGemsTotal}`,
										"aria-valuemin": 0,
										"aria-valuemax": Math.max(1, blueGemsTotal),
										"aria-valuenow": blueGemsCollected,
										children: /* @__PURE__ */ jsx("div", {
											className: "h-full bg-arcade-cyan transition-[width] duration-300",
											style: { width: `${blueGemProgress}%` }
										})
									})
								]
							}), /* @__PURE__ */ jsxs("div", {
								className: "grid grid-cols-3 gap-1 sm:gap-2",
								children: [
									/* @__PURE__ */ jsxs("div", {
										className: "rounded-sm border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.45rem]",
											children: "PONTOS"
										}), /* @__PURE__ */ jsx("p", {
											className: "mt-1 truncate font-arcade text-[0.65rem] text-arcade-ink sm:text-base",
											"aria-label": player ? `Pontos: ${player.score}` : "Pontos: aguardando",
											"aria-live": "polite",
											children: snapshot && player ? player.score.toLocaleString("pt-BR") : "—"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "rounded-sm border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.45rem]",
											children: "TEMPO"
										}), /* @__PURE__ */ jsx("p", {
											className: "mt-1 whitespace-nowrap font-arcade text-[0.65rem] text-arcade-ink sm:text-base",
											"aria-label": `Tempo de partida: ${formatTime(snapshot?.matchElapsedSeconds ?? 0)}`,
											"aria-live": "polite",
											children: snapshot ? formatTime(snapshot.matchElapsedSeconds) : "—"
										})]
									}),
									/* @__PURE__ */ jsxs("div", {
										className: "rounded-sm border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5",
										children: [/* @__PURE__ */ jsx("p", {
											className: "font-arcade text-[0.34rem] text-arcade-violet sm:text-[0.45rem]",
											children: mode === "solo" ? "VIDAS" : "ESPÍRITOS VENCIDOS"
										}), /* @__PURE__ */ jsx("p", {
											className: "mt-1 truncate font-arcade text-[0.65rem] text-arcade-ink sm:text-base",
											"aria-label": player ? mode === "solo" ? `Vidas: ${player.lives}` : `Espíritos vencidos: ${player.ghostsDefeated}` : "Estado do jogador: aguardando",
											children: snapshot && player ? mode === "solo" ? "♥".repeat(player.lives) || "0" : String(player.ghostsDefeated) : "—"
										})]
									})
								]
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-2 grid min-w-0 gap-2 border-t border-arcade-panel-border/60 pt-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsxs("p", {
									className: "font-arcade text-[0.4rem] text-arcade-violet sm:text-[0.46rem]",
									children: [
										"ITENS PARA LIBERAR A SAÍDA:",
										" ",
										/* @__PURE__ */ jsx("strong", {
											className: "text-arcade-ink",
											children: snapshot ? `${snapshot.collectiblesCollected}/${snapshot.collectiblesTotal}` : "—"
										})
									]
								}), /* @__PURE__ */ jsx("p", {
									"data-maze-tutorial-target": "exit",
									className: `mt-1 inline-flex flex-wrap items-center gap-1 border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1 font-arcade text-[0.4rem] sm:text-[0.45rem] ${snapshot?.exitOpen ? "text-emerald-700" : "text-arcade-violet"} ${tutorialTargetClass("exit")}`,
									role: "status",
									"aria-live": "polite",
									children: snapshot?.exitOpen ? "✓ SAÍDA LIBERADA · CAMINHE ATÉ O PORTAL" : snapshot ? `🔒 SAÍDA BLOQUEADA · FALTAM ${remainingObjectiveItems} ${remainingObjectiveItems === 1 ? "ITEM" : "ITENS"}` : "PREPARANDO A SAÍDA"
								})]
							}), /* @__PURE__ */ jsx("div", {
								className: "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1",
								children: snapshot?.players.filter((entry) => !entry.isBot).map((entry) => /* @__PURE__ */ jsxs("span", {
									className: "whitespace-nowrap font-arcade text-[0.4rem] text-arcade-violet sm:text-[0.46rem]",
									"aria-label": `Runas de poder de ${entry.name}: ${entry.powerRunes}`,
									children: [
										"🔮 ",
										mode === "solo" ? "PODER" : `P${entry.controlIndex + 1} PODER`,
										":",
										/* @__PURE__ */ jsx("strong", {
											className: "ml-1 text-arcade-ink",
											children: entry.powerRunes
										})
									]
								}, entry.id))
							})]
						}),
						powerRuneWarnings.length > 0 && /* @__PURE__ */ jsx("p", {
							className: "mt-1 border-l-2 border-arcade-gold pl-2 font-arcade text-[0.4rem] leading-snug text-arcade-violet sm:text-[0.45rem]",
							role: "status",
							"aria-live": "polite",
							children: powerRuneWarnings.map((entry) => `${mode === "solo" ? "" : `P${entry.controlIndex + 1}: `}ENCONTRE UMA RUNA PARA USAR SEU PODER!`).join(" · ")
						}),
						(timeStopReadout || controlReadouts.length > 0) && /* @__PURE__ */ jsx("p", {
							className: "mt-1.5 break-words font-game text-[0.6rem] leading-snug text-arcade-violet sm:text-xs",
							children: [...timeStopReadout ? [timeStopReadout] : [], ...controlReadouts.map((effect) => `${effect.label} ×${effect.count} · ${effect.seconds}s`)].join(" · ")
						})
					]
				}),
				/* @__PURE__ */ jsxs("section", {
					className: "grid min-h-0 flex-1 gap-2 md:grid-cols-[minmax(0,1fr)_17rem]",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-sm border-4 border-arcade-panel-border bg-[#101537]/80 shadow-[6px_6px_0_var(--color-arcade-shadow)]",
						children: [
							/* @__PURE__ */ jsx("canvas", {
								ref: canvasRef,
								width: 800,
								height: 544,
								className: "block max-h-full max-w-full aspect-[25/17] h-auto w-auto pixelated",
								"aria-label": "Labirinto mágico em pixel-art"
							}),
							unresolvedElimination && snapshot?.phase === "playing" && /* @__PURE__ */ jsx("div", {
								className: "pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3",
								children: /* @__PURE__ */ jsx("section", {
									role: "status",
									"aria-live": "polite",
									className: "pointer-events-auto w-full max-w-2xl border-2 border-arcade-pink bg-[#e9f4ff]/90 px-3 py-2 shadow-[3px_3px_0_var(--color-arcade-shadow)]",
									children: /* @__PURE__ */ jsxs("div", {
										className: "flex flex-wrap items-center justify-between gap-2",
										children: [/* @__PURE__ */ jsxs("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ jsxs("p", {
												className: "font-arcade text-[0.48rem] text-arcade-pink sm:text-[0.56rem]",
												children: [unresolvedElimination.name, " FOI ELIMINADO · A PARTIDA CONTINUA"]
											}), /* @__PURE__ */ jsx("p", {
												className: "mt-1 font-game text-xs text-muted-foreground",
												children: "Acompanhe o labirinto enquanto os outros jogadores continuam. Continuar fecha este aviso e mantém você como espectador."
											})]
										}), /* @__PURE__ */ jsxs("div", {
											className: "flex flex-wrap justify-end gap-2",
											children: [/* @__PURE__ */ jsx("button", {
												type: "button",
												className: actionButtonClass("border-arcade-cyan text-arcade-ink"),
												onClick: () => setSpectatingIds((current) => [...current, unresolvedElimination.id]),
												children: "CONTINUAR COMO ESPECTADOR"
											}), /* @__PURE__ */ jsx("button", {
												type: "button",
												className: actionButtonClass("border-arcade-panel-border text-arcade-ink"),
												onClick: onBack,
												children: "SAIR DA SALA"
											})]
										})]
									})
								})
							}),
							player?.teleportTarget && snapshot?.phase === "playing" && /* @__PURE__ */ jsx("div", {
								className: "pointer-events-none absolute left-2 right-2 top-2 z-10 border border-arcade-violet bg-[#101537]/90 px-2 py-1 text-center font-arcade text-[0.38rem] text-arcade-ink sm:text-[0.45rem]",
								children: "MIRA NINJA · SETAS/WASD AJUSTAM · PODER CONFIRMA · ESC CANCELA"
							}),
							snapshot?.phase === "character-select" && selectingPlayer && /* @__PURE__ */ jsxs(OverlayCard, { children: [
								/* @__PURE__ */ jsxs("p", {
									className: "font-arcade text-[0.5rem] text-arcade-violet",
									children: [
										"NÍVEL ",
										snapshot.level,
										" · JOGADOR ",
										selectingPlayer.controlIndex + 1
									]
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "pixel-title mt-2 text-xl text-arcade-ink sm:text-3xl",
									children: "ESCOLHA SEUS 3 PERSONAGENS"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-2 font-game text-sm text-muted-foreground",
									children: "Selecione exatamente três. Só esse trio poderá ser usado neste labirinto."
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mx-auto mt-4 grid max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7",
									children: MAZE_CHOOSER_CHARACTERS.filter((character) => unlockedCharacterIds.includes(character.id)).map((character) => {
										const selectedIndex = selectedRoster.indexOf(character.id);
										const characterPower = getMazePower(character.id);
										const selectionFull = selectedRoster.length >= 3;
										return /* @__PURE__ */ jsxs("button", {
											type: "button",
											"aria-pressed": selectedIndex >= 0,
											disabled: selectedIndex < 0 && selectionFull,
											onClick: () => toggleRosterCharacter(selectingPlayer.id, character.id),
											className: `relative flex min-h-28 flex-col items-center justify-center border-2 p-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-40 ${selectedIndex >= 0 ? "border-arcade-cyan bg-arcade-cyan/20 shadow-[0_0_14px_rgba(96,226,255,0.55)]" : "border-arcade-panel-border bg-arcade-sky/40 hover:bg-white/80"}`,
											children: [
												selectedIndex >= 0 && /* @__PURE__ */ jsxs("span", {
													className: "absolute right-1 top-1 font-arcade text-[0.4rem] text-arcade-violet",
													children: ["SLOT ", selectedIndex + 1]
												}),
												/* @__PURE__ */ jsx("img", {
													src: character.sprite,
													alt: "",
													className: "h-12 w-12 object-contain [image-rendering:pixelated]"
												}),
												/* @__PURE__ */ jsx("span", {
													className: "mt-1 font-arcade text-[0.42rem] text-arcade-ink",
													children: character.shortName
												}),
												/* @__PURE__ */ jsx("span", {
													className: "mt-1 text-center font-game text-[0.65rem] text-muted-foreground",
													children: characterPower.shortName
												})
											]
										}, character.id);
									})
								}),
								selectedRoster.includes("axolotl-mage") && /* @__PURE__ */ jsx("p", {
									className: "mt-2 font-game text-xs text-arcade-violet",
									children: "♥ O Axolote concede +1 vida nesta partida."
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mx-auto mt-3 flex max-w-3xl items-center justify-between gap-2 border border-arcade-panel-border bg-arcade-sky/35 px-3 py-2",
									children: [/* @__PURE__ */ jsx("div", {
										className: "flex min-w-0 flex-wrap gap-2 font-game text-xs text-arcade-ink",
										children: Array.from({ length: 3 }, (_, index) => {
											const characterId = selectedRoster[index];
											const character = playableCharacterSeeds.find((item) => item.id === characterId);
											return /* @__PURE__ */ jsxs("span", {
												className: "border border-arcade-panel-border px-2 py-1",
												children: [
													index + 1,
													" · ",
													character?.shortName ?? "VAGO"
												]
											}, index);
										})
									}), /* @__PURE__ */ jsxs("span", {
										className: "shrink-0 font-arcade text-[0.48rem] text-arcade-violet",
										children: [
											selectedRoster.length,
											"/",
											3
										]
									})]
								}),
								/* @__PURE__ */ jsx("button", {
									type: "button",
									disabled: selectedRoster.length !== 3,
									onClick: () => confirmPlayerRoster(selectingPlayer.id),
									className: `${actionButtonClass("border-arcade-violet text-arcade-ink")} mt-4 disabled:opacity-40`,
									children: "CONFIRMAR E CONTINUAR"
								})
							] }),
							snapshot?.phase === "countdown" && /* @__PURE__ */ jsxs(OverlayCard, { children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.55rem] text-arcade-violet",
									children: snapshot.biome.name
								}),
								/* @__PURE__ */ jsx("p", {
									className: "pixel-title mt-4 text-6xl text-arcade-cyan sm:text-8xl",
									children: snapshot.countdownLabel
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-3 font-game text-lg text-muted-foreground",
									children: "Reúna todos os itens de objetivo; moedas são bônus. Runas de Poder carregam seu próximo feitiço."
								})
							] }),
							snapshot?.phase === "level-clear" && /* @__PURE__ */ jsxs(OverlayCard, { children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-xs text-arcade-cyan",
									children: "✓ FASE CONCLUÍDA!"
								}),
								/* @__PURE__ */ jsxs("h2", {
									className: "pixel-title mt-3 text-2xl text-arcade-ink sm:text-4xl",
									children: ["FASE ", snapshot.level]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mx-auto mt-4 grid max-w-xl grid-cols-2 gap-2 text-left",
									children: [
										/* @__PURE__ */ jsx(Stat, {
											label: "PONTOS",
											value: (snapshot.players[0]?.score ?? 0).toLocaleString("pt-BR")
										}),
										/* @__PURE__ */ jsx(Stat, {
											label: "VIDAS",
											value: String(snapshot.players[0]?.lives ?? 0)
										}),
										/* @__PURE__ */ jsx(Stat, {
											label: "GEMAS AZUIS",
											value: `${blueGemsCollected}/${blueGemsTotal}`
										}),
										/* @__PURE__ */ jsx(Stat, {
											label: "RUNAS COLETADAS",
											value: `${snapshot.runesActivated}/${snapshot.targetRunes}`
										})
									]
								}),
								/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
								/* @__PURE__ */ jsx("p", {
									className: "mt-3 font-game text-base text-muted-foreground",
									children: "Seu trio continua para o próximo mapa."
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mt-5 flex justify-center",
									children: /* @__PURE__ */ jsx("button", {
										type: "button",
										className: actionButtonClass("border-arcade-cyan text-arcade-ink"),
										onClick: advanceMazeLevel,
										children: "➡️ PRÓXIMO NÍVEL"
									})
								})
							] }),
							snapshot?.phase === "game-over" && /* @__PURE__ */ jsxs(OverlayCard, { children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-xs text-arcade-pink",
									children: "💀 VOCÊ PERDEU"
								}),
								/* @__PURE__ */ jsxs("h2", {
									className: "pixel-title mt-3 text-3xl text-arcade-ink sm:text-5xl",
									children: ["FASE ", snapshot.gameOverLevel || snapshot.level]
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-3 font-game text-base text-muted-foreground",
									children: "Tente novamente para completar esta fase!"
								}),
								snapshot.gameOverReason && /* @__PURE__ */ jsx("p", {
									className: "mt-2 font-game text-sm text-muted-foreground",
									children: snapshot.gameOverReason
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mt-5 flex flex-wrap justify-center gap-2",
									children: [/* @__PURE__ */ jsx("button", {
										type: "button",
										className: actionButtonClass("border-arcade-cyan text-arcade-ink"),
										onClick: retryCurrentPhase,
										children: "🔄 REPETIR FASE"
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										className: actionButtonClass("border-arcade-panel-border text-arcade-ink"),
										onClick: onBack,
										children: "SAIR"
									})]
								})
							] }),
							snapshot?.phase === "results" && /* @__PURE__ */ jsxs(OverlayCard, { children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.55rem] text-arcade-violet",
									children: "PARTIDA ENCERRADA"
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "pixel-title mt-2 text-2xl text-arcade-ink sm:text-4xl",
									children: "RESULTADO DA PARTIDA"
								}),
								snapshot.matchEndReason === "time-limit" && /* @__PURE__ */ jsx("p", {
									className: "mt-2 font-arcade text-[0.48rem] text-arcade-pink",
									children: "TEMPO LIMITE · PLACAR FINAL DECIDE"
								}),
								snapshot.winnerId && /* @__PURE__ */ jsxs("p", {
									className: "mt-2 font-arcade text-[0.6rem] text-arcade-gold",
									children: [
										"VENCEDOR:",
										" ",
										snapshot.players.find((candidate) => candidate.id === snapshot.winnerId)?.name
									]
								}),
								/* @__PURE__ */ jsxs("div", {
									className: "mx-auto mt-4 max-w-2xl overflow-hidden border-2 border-arcade-panel-border",
									children: [/* @__PURE__ */ jsxs("div", {
										className: "grid grid-cols-[2.3rem_minmax(0,1fr)_4.4rem_4rem_4rem] gap-1 bg-arcade-sky/80 px-2 py-2 text-left font-arcade text-[0.42rem] text-arcade-ink",
										children: [
											/* @__PURE__ */ jsx("span", { children: "#" }),
											/* @__PURE__ */ jsx("span", { children: "JOGADOR" }),
											/* @__PURE__ */ jsx("span", { children: "PONTOS" }),
											/* @__PURE__ */ jsx("span", { children: "TEMPO" }),
											/* @__PURE__ */ jsx("span", { children: "ESPÍRITOS" })
										]
									}), snapshot.ranking.map((entry, index) => /* @__PURE__ */ jsxs("div", {
										className: "grid grid-cols-[2.3rem_minmax(0,1fr)_4.4rem_4rem_4rem] gap-1 border-t border-arcade-panel-border/50 px-2 py-2 text-left font-game text-sm text-arcade-ink",
										children: [
											/* @__PURE__ */ jsxs("span", { children: [index + 1, "º"] }),
											/* @__PURE__ */ jsxs("span", {
												className: "truncate",
												children: [entry.name, entry.isBot ? " · CPU" : ""]
											}),
											/* @__PURE__ */ jsx("span", { children: entry.score }),
											/* @__PURE__ */ jsx("span", { children: formatTime(entry.finishTimeSeconds ?? snapshot.matchElapsedSeconds) }),
											/* @__PURE__ */ jsx("span", { children: entry.ghostsDefeated })
										]
									}, entry.id))]
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-2 font-game text-sm text-muted-foreground",
									children: [
										"Objetivos concluídos: ",
										snapshot.crystalsCollected,
										" cristais ·",
										" ",
										snapshot.runesActivated,
										" runas · ",
										snapshot.ghostsDefeated,
										" espíritos neutralizados."
									]
								}),
								/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts })
							] }),
							snapshot?.phase === "voting" && /* @__PURE__ */ jsxs(OverlayCard, { children: [
								/* @__PURE__ */ jsxs("p", {
									className: "font-arcade text-[0.55rem] text-arcade-violet",
									children: [
										"VOTAÇÃO · ",
										snapshot.votingSecondsRemaining,
										"s"
									]
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "pixel-title mt-2 text-2xl text-arcade-ink sm:text-4xl",
									children: "E AGORA?"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-2 font-game text-sm text-muted-foreground",
									children: "Cada pessoa vota uma vez. A maioria humana decide; empate avança para o próximo nível."
								}),
								/* @__PURE__ */ jsx("ol", {
									className: "mx-auto mt-3 grid max-w-2xl gap-1 text-left sm:grid-cols-2",
									children: snapshot.ranking.map((entry, index) => /* @__PURE__ */ jsxs("li", {
										className: "flex min-w-0 items-center gap-2 border border-arcade-panel-border bg-arcade-sky/45 px-2 py-1.5 font-game text-sm text-arcade-ink",
										children: [
											/* @__PURE__ */ jsxs("span", {
												className: "font-arcade text-[0.5rem] text-arcade-violet",
												children: [index + 1, "º"]
											}),
											/* @__PURE__ */ jsxs("span", {
												className: "min-w-0 flex-1 truncate",
												children: [entry.name, entry.isBot ? " · CPU" : ""]
											}),
											/* @__PURE__ */ jsxs("span", {
												className: "shrink-0 font-arcade text-[0.48rem]",
												children: [entry.score.toLocaleString("pt-BR"), " PTS"]
											})
										]
									}, entry.id))
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-2 font-game text-xs text-muted-foreground",
									children: [
										"Cristais ",
										snapshot.crystalsCollected,
										" · runas ",
										snapshot.runesActivated,
										" · espíritos ",
										snapshot.ghostsDefeated
									]
								}),
								/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts }),
								/* @__PURE__ */ jsx("div", {
									className: "mx-auto mt-4 grid max-w-2xl gap-3 sm:grid-cols-2",
									children: snapshot.players.filter((candidate) => !candidate.isBot).map((voter) => {
										const voted = currentVoteIds.has(voter.id);
										return /* @__PURE__ */ jsxs("div", {
											className: "border-2 border-arcade-panel-border bg-arcade-sky/35 p-3",
											children: [/* @__PURE__ */ jsxs("p", {
												className: "mb-2 font-arcade text-[0.48rem] text-arcade-ink",
												children: [voter.name, voted ? " · VOTO REGISTRADO" : " · ESCOLHA"]
											}), /* @__PURE__ */ jsxs("div", {
												className: "flex flex-wrap justify-center gap-2",
												children: [/* @__PURE__ */ jsx("button", {
													type: "button",
													disabled: voted,
													className: actionButtonClass("border-arcade-cyan text-arcade-ink"),
													onClick: () => castVote(voter.id, "next-level"),
													children: "PRÓXIMO NÍVEL"
												}), /* @__PURE__ */ jsx("button", {
													type: "button",
													disabled: voted,
													className: actionButtonClass("border-arcade-violet text-arcade-ink"),
													onClick: () => castVote(voter.id, "change-game"),
													children: "MUDAR DE JOGO"
												})]
											})]
										}, voter.id);
									})
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-3 font-arcade text-[0.48rem] text-muted-foreground",
									children: [
										"PRÓXIMO NÍVEL ",
										snapshot.voteCounts["next-level"],
										" · MUDAR",
										" ",
										snapshot.voteCounts["change-game"]
									]
								})
							] }),
							snapshot?.phase === "decision" && /* @__PURE__ */ jsxs(OverlayCard, { children: [
								/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.55rem] text-arcade-violet",
									children: "VOTO HUMANO CONCLUÍDO"
								}),
								/* @__PURE__ */ jsx("h2", {
									className: "pixel-title mt-3 text-3xl text-arcade-ink sm:text-5xl",
									children: snapshot.voteDecision === "change-game" ? "MUDAR DE JOGO" : "PRÓXIMO NÍVEL"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-3 font-game text-base text-muted-foreground",
									children: snapshot.voteDecision === "change-game" ? "Voltando ao lobby celeste." : `O nível ${snapshot.level + 1} começa em instantes para todos os jogadores.`
								}),
								/* @__PURE__ */ jsx(CurrencyRewardCard, { receipts: rewardReceipts })
							] })
						]
					}), /* @__PURE__ */ jsxs("aside", {
						className: "hidden min-h-0 flex-col gap-2 overflow-hidden md:flex",
						children: [
							/* @__PURE__ */ jsxs("section", {
								className: `${PANEL_STYLE} min-h-0 flex-1 overflow-auto rounded-sm p-3`,
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.52rem] text-arcade-violet",
									children: "JOGADORES · CLASSIFICAÇÃO"
								}), /* @__PURE__ */ jsx("div", {
									className: "mt-3 space-y-2",
									children: snapshot?.ranking.map((entry, index) => /* @__PURE__ */ jsxs("div", {
										className: `border px-2 py-2 ${entry.status === "eliminated" ? "border-arcade-panel-border opacity-60" : "border-arcade-panel-border/70"}`,
										children: [/* @__PURE__ */ jsxs("div", {
											className: "flex items-center justify-between gap-2",
											children: [/* @__PURE__ */ jsxs("span", {
												className: "truncate font-game text-sm text-arcade-ink",
												children: [
													index + 1,
													". ",
													entry.name
												]
											}), /* @__PURE__ */ jsx("span", {
												className: "font-arcade text-[0.42rem] text-arcade-violet",
												children: entry.status === "eliminated" ? "ELIMINADO" : entry.status === "finished" ? "CHEGOU" : entry.isBot ? "CPU" : mode === "local" && entry.controlIndex > 0 ? `P${entry.controlIndex + 1}` : "VOCÊ"
											})]
										}), /* @__PURE__ */ jsxs("p", {
											className: "mt-1 font-game text-xs text-muted-foreground",
											children: [
												entry.score,
												" pts · 🪙 ",
												entry.coinsCollected,
												" · ♥ ",
												entry.lives,
												" ·",
												" ",
												entry.ghostsDefeated,
												" espíritos"
											]
										})]
									}, entry.id))
								})]
							}),
							/* @__PURE__ */ jsxs("section", {
								className: `${PANEL_STYLE} max-h-[42%] min-h-0 shrink-0 overflow-y-auto rounded-sm p-2`,
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-arcade text-[0.47rem] text-arcade-violet",
									children: "TRIOS · MAGIA"
								}), /* @__PURE__ */ jsx("div", {
									className: "mt-2 space-y-1.5",
									children: snapshot?.players.map((entry) => {
										const currentPower = getMazePower(entry.characterId);
										const abilityKey = abilityKeyForControl(entry.controlIndex);
										const isAiming = entry.teleportTarget !== null;
										const reviveTarget = entry.characterId === "axolotl-mage" ? snapshot.players.filter((candidate) => candidate.id !== entry.id && candidate.status === "eliminated").sort((left, right) => (right.eliminationOrder ?? -1) - (left.eliminationOrder ?? -1))[0] : void 0;
										const powerBlocked = snapshot.phase !== "playing" || entry.status !== "active" || entry.abilityCooldownSeconds > 0 && entry.powerRunes > 0 && !isAiming || isAiming && !entry.teleportTargetValid || entry.characterId === "axolotl-mage" && !reviveTarget;
										const cooldownProgress = Math.max(0, Math.min(100, 100 * (1 - entry.abilityCooldownSeconds / currentPower.cooldownSeconds)));
										return /* @__PURE__ */ jsxs("div", {
											className: `border p-1.5 ${entry.status === "eliminated" ? "border-arcade-panel-border opacity-50" : entry.isBot ? "border-arcade-panel-border/60" : "border-arcade-panel-border/80"}`,
											children: [
												/* @__PURE__ */ jsxs("div", {
													className: "mb-1 flex items-center justify-between gap-1",
													children: [
														/* @__PURE__ */ jsxs("span", {
															className: "max-w-[10rem] truncate font-game text-[0.68rem] text-arcade-ink",
															children: [
																entry.controlIndex === 0 && !entry.isBot ? "VOCÊ" : `P${entry.controlIndex + 1}`,
																" ",
																"· ",
																entry.name
															]
														}),
														/* @__PURE__ */ jsxs("span", {
															className: "shrink-0 font-arcade text-[0.34rem] text-arcade-cyan",
															title: `Cargas de poder de ${entry.name}: ${entry.powerRunes}`,
															"aria-label": `Cargas de poder: ${entry.powerRunes}`,
															children: ["🔮 ", entry.powerRunes]
														}),
														/* @__PURE__ */ jsx("span", {
															className: "font-arcade text-[0.36rem] text-arcade-violet",
															children: entry.isBot ? "CPU" : entry.switchCooldownSeconds > 0 ? `TROCA ${entry.switchCooldownSeconds.toFixed(1)}s` : "TROCAR"
														})
													]
												}),
												entry.characterId === "axolotl-mage" && /* @__PURE__ */ jsx("p", {
													className: "mb-1 font-game text-[0.62rem] text-arcade-violet",
													children: reviveTarget ? `RESGATE DISPONÍVEL · ${reviveTarget.name}` : "AGUARDANDO ALIADO ELIMINADO"
												}),
												/* @__PURE__ */ jsx("div", {
													className: "space-y-1",
													children: Array.from({ length: 3 }, (_, slot) => {
														const characterId = entry.roster[slot];
														const character = playableCharacterSeeds.find((item) => item.id === characterId);
														const characterPower = character ? getMazePower(character.id) : null;
														const characterCooldown = character ? entry.abilityCooldowns[character.id] ?? 0 : 0;
														const isActive = slot === entry.activeCharacterSlot;
														return /* @__PURE__ */ jsxs("button", {
															type: "button",
															title: character ? `${slot + 1}. ${character.shortName} · ${characterPower?.name} · ${formatCooldown(characterCooldown)} · ${entry.isBot ? "CPU" : abilityKey}` : `Slot ${slot + 1} vazio`,
															"aria-label": `${entry.name}: trocar para slot ${slot + 1}${character ? `, ${character.shortName}, poder ${characterPower?.name}, ${formatCooldownAccessible(characterCooldown)}` : " vazio"}`,
															"aria-pressed": isActive,
															disabled: entry.isBot || !character || snapshot.phase !== "playing" || entry.status !== "active" || isActive || entry.switchCooldownSeconds > 0,
															onClick: () => switchPlayerCharacter(entry.id, slot),
															className: `relative flex w-full min-w-0 items-center gap-1.5 border px-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? "h-9 border-arcade-cyan bg-arcade-cyan/20 shadow-[0_0_10px_rgba(96,226,255,0.8)]" : "h-8 border-arcade-panel-border bg-arcade-sky/30 hover:bg-white/60"}`,
															children: [
																/* @__PURE__ */ jsx("span", {
																	className: "w-3 shrink-0 font-arcade text-[0.34rem] text-arcade-violet",
																	children: slot + 1
																}),
																character && /* @__PURE__ */ jsx("img", {
																	src: character.sprite,
																	alt: "",
																	className: "h-6 w-6 shrink-0 object-contain [image-rendering:pixelated]"
																}),
																/* @__PURE__ */ jsxs("span", {
																	className: "min-w-0 flex-1",
																	children: [/* @__PURE__ */ jsx("span", {
																		className: "block truncate font-arcade text-[0.36rem] text-arcade-ink",
																		children: character?.shortName ?? "VAGO"
																	}), character && characterPower && /* @__PURE__ */ jsxs("span", {
																		className: "mt-0.5 flex items-center gap-1 font-arcade text-[0.3rem] text-arcade-violet",
																		children: [
																			/* @__PURE__ */ jsx("span", {
																				style: { color: characterPower.accent },
																				children: characterPower.glyph
																			}),
																			/* @__PURE__ */ jsx("span", { children: entry.isBot ? "CPU" : abilityKey }),
																			/* @__PURE__ */ jsx("span", { children: formatCooldown(characterCooldown) })
																		]
																	})]
																}),
																isActive && /* @__PURE__ */ jsx("span", {
																	className: "shrink-0 font-arcade text-[0.3rem] text-arcade-cyan",
																	children: entry.isBot ? "ATIVO" : "VOCÊ"
																})
															]
														}, slot);
													})
												}),
												!entry.isBot && /* @__PURE__ */ jsxs("button", {
													type: "button",
													title: `${currentPower.name}: ${currentPower.description} · runas ${entry.powerRunes} · tecla ${abilityKey}`,
													"aria-label": `Usar ${currentPower.name} de ${entry.name} com ${abilityKey}; runas de poder ${entry.powerRunes}`,
													disabled: powerBlocked,
													onClick: () => activatePower(entry.id),
													className: "mt-1 flex h-8 w-full items-center justify-between gap-2 border-2 border-arcade-violet bg-arcade-sky/60 px-2 font-arcade text-[0.38rem] text-arcade-ink disabled:cursor-not-allowed disabled:opacity-40",
													children: [/* @__PURE__ */ jsxs("span", {
														className: "flex min-w-0 items-center gap-1.5 truncate",
														children: [
															/* @__PURE__ */ jsx("span", {
																className: "text-sm",
																style: { color: currentPower.accent },
																children: currentPower.glyph
															}),
															/* @__PURE__ */ jsx("span", {
																className: "truncate",
																children: currentPower.shortName
															}),
															/* @__PURE__ */ jsx("kbd", {
																className: "shrink-0 border border-arcade-panel-border px-1 text-arcade-violet",
																children: abilityKey
															})
														]
													}), /* @__PURE__ */ jsx("span", {
														className: "shrink-0",
														children: isAiming ? "CONFIRMAR" : entry.powerRunes <= 0 ? "SEM RUNA" : entry.abilityCooldownSeconds > 0 ? formatCooldown(entry.abilityCooldownSeconds) : entry.characterId === "axolotl-mage" ? reviveTarget ? "RESSUSCITAR" : "SEM ALVO" : formatCooldown(entry.abilityCooldownSeconds)
													})]
												}),
												/* @__PURE__ */ jsx("div", {
													className: "mt-1 h-1 overflow-hidden bg-arcade-panel-border/50",
													children: /* @__PURE__ */ jsx("div", {
														className: "h-full transition-[width]",
														style: {
															width: `${cooldownProgress}%`,
															backgroundColor: currentPower.accent
														}
													})
												}),
												entry.invulnerableSeconds > 0 && /* @__PURE__ */ jsxs("p", {
													className: "mt-1 font-arcade text-[0.34rem] text-arcade-cyan",
													children: [
														"ESCUDO ",
														Math.ceil(entry.invulnerableSeconds),
														"s"
													]
												})
											]
										}, entry.id);
									})
								})]
							}),
							/* @__PURE__ */ jsxs("section", {
								"data-maze-tutorial-target": "controls",
								className: `${PANEL_STYLE} shrink-0 rounded-sm p-3 ${tutorialTargetClass("controls")}`,
								children: [
									/* @__PURE__ */ jsx("p", {
										className: "font-arcade text-[0.48rem] text-arcade-violet",
										children: "CONTROLES"
									}),
									/* @__PURE__ */ jsx("div", {
										className: "mt-2 space-y-1",
										children: participants?.filter((participant) => !participant.isBot).map((participant) => {
											const controlIndex = participant.controlIndex ?? 0;
											const controls = LOCAL_PLAYER_CONTROLS[controlIndex];
											const movement = (mode === "solo" || mode === "bots") && controlIndex === 0 ? "SETAS / W A S D" : controls?.movement;
											return /* @__PURE__ */ jsxs("p", {
												className: "font-game text-xs text-muted-foreground",
												children: [
													"P",
													controlIndex + 1,
													": ",
													movement,
													" · poder ",
													controls?.ability,
													" · troca",
													" ",
													controls?.switch
												]
											}, participant.id);
										})
									}),
									/* @__PURE__ */ jsxs("p", {
										className: "mt-2 font-game text-xs text-muted-foreground",
										children: [
											snapshot?.biome.specialName,
											": ",
											snapshot?.biome.specialRule
										]
									})
								]
							})
						]
					})]
				}),
				/* @__PURE__ */ jsxs("footer", {
					className: "flex shrink-0 items-center justify-between gap-2 md:hidden",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "truncate font-game text-xs text-muted-foreground",
							children: player ? player.teleportTarget ? `Mira ${player.teleportTargetValid ? "válida" : "bloqueada"} · setas · confirme com ${abilityKeyForControl(player.controlIndex)}` : player.characterId === "axolotl-mage" ? `RESSURREIÇÃO · ${snapshot?.players.find((candidate) => candidate.id !== player.id && candidate.status === "eliminated")?.name ?? "AGUARDANDO ALIADO"} · 🔮 ${player.powerRunes}` : `${power.shortName} · 🔮 ${player.powerRunes} · ${player.powerRunes <= 0 ? "SEM RUNA" : formatCooldown(player.abilityCooldownSeconds)} · tecla ${abilityKeyForControl(player.controlIndex)}` : "Preparando partida"
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							disabled: !player || snapshot?.phase !== "playing" || player.abilityCooldownSeconds > 0 && player.powerRunes > 0 && !player.teleportTarget || Boolean(player.teleportTarget && !player.teleportTargetValid) || Boolean(player.characterId === "axolotl-mage" && !snapshot?.players.some((candidate) => candidate.id !== player.id && candidate.status === "eliminated")),
							className: `${actionButtonClass("border-arcade-violet text-arcade-ink")} px-2 py-2`,
							onClick: activateFirstPower,
							children: player?.teleportTarget ? `CONFIRMAR · ${abilityKeyForControl(player.controlIndex)}` : player?.characterId === "axolotl-mage" ? player.powerRunes <= 0 ? `SEM RUNA · ${abilityKeyForControl(player.controlIndex)}` : player.abilityCooldownSeconds > 0 ? `RECARGA ${formatCooldown(player.abilityCooldownSeconds)}` : snapshot?.players.some((candidate) => candidate.id !== player.id && candidate.status === "eliminated") ? `RESSUSCITAR · ${abilityKeyForControl(player.controlIndex)}` : "AGUARDANDO ALIADO" : player && player.powerRunes <= 0 ? `SEM RUNA · ${abilityKeyForControl(player.controlIndex)}` : `USAR PODER · ${abilityKeyForControl(player?.controlIndex ?? 0)}`
						}),
						spectatingIds.length > 0 && /* @__PURE__ */ jsx("span", {
							className: "font-arcade text-[0.42rem] text-arcade-cyan",
							children: "ESPECTADOR"
						})
					]
				}),
				tutorialOpen && /* @__PURE__ */ jsx(MazeTutorialOverlay, {
					step: tutorialStep,
					mode,
					playerCount: tutorialPlayerCount,
					blueGemsTotal,
					onPrevious: () => setTutorialStep((current) => Math.max(0, current - 1)),
					onNext: () => setTutorialStep((current) => Math.min(MAZE_TUTORIAL_FOCUS_BY_STEP.length - 1, current + 1)),
					onSkip: closeMazeTutorial,
					onComplete: closeMazeTutorial
				})
			]
		})
	});
}
function Stat({ label, value }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "border border-arcade-panel-border bg-arcade-sky/35 px-3 py-2",
		children: [/* @__PURE__ */ jsx("p", {
			className: "font-arcade text-[0.42rem] text-arcade-violet",
			children: label
		}), /* @__PURE__ */ jsx("p", {
			className: "mt-1 font-arcade text-[0.62rem] text-arcade-ink",
			children: value
		})]
	});
}
//#endregion
//#region src/features/spellbound/hooks/useCharacterSelection.ts
var CHARACTER_SESSION_KEY = "spellbound-arcade-character";
function isCharacterId(value) {
	return playableCharacterSeeds.some((character) => character.id === value);
}
function useCharacterSelection(walletId) {
	const [selectedId, setSelectedId] = useState(null);
	const [unlockRevision, setUnlockRevision] = useState(0);
	const purchasedCharacterIds = useMemo(() => getPurchasedCharacterIds(walletId), [walletId, unlockRevision]);
	const unlockedCharacterIds = useMemo(() => playableCharacterSeeds.filter((character) => !character.coinCost || purchasedCharacterIds.includes(character.id)).map((character) => character.id), [purchasedCharacterIds]);
	useEffect(() => {
		const refreshUnlocks = () => setUnlockRevision((revision) => revision + 1);
		window.addEventListener(CURRENCY_CHANGE_EVENT, refreshUnlocks);
		window.addEventListener("storage", refreshUnlocks);
		return () => {
			window.removeEventListener(CURRENCY_CHANGE_EVENT, refreshUnlocks);
			window.removeEventListener("storage", refreshUnlocks);
		};
	}, []);
	useEffect(() => {
		const stored = window.sessionStorage.getItem(CHARACTER_SESSION_KEY);
		const character = playableCharacterSeeds.find((candidate) => candidate.id === stored);
		if (isCharacterId(stored) && (!character?.coinCost || purchasedCharacterIds.includes(stored))) setSelectedId(stored);
		else setSelectedId(null);
	}, [walletId, purchasedCharacterIds]);
	return {
		selectedId,
		selectCharacter: useCallback((id) => {
			if (playableCharacterSeeds.find((candidate) => candidate.id === id)?.coinCost && !getPurchasedCharacterIds(walletId).includes(id)) return false;
			window.sessionStorage.setItem(CHARACTER_SESSION_KEY, id);
			setSelectedId(id);
			return true;
		}, [walletId]),
		unlockedCharacterIds,
		purchaseCharacter: useCallback((id) => {
			const character = playableCharacterSeeds.find((candidate) => candidate.id === id);
			if (!character?.coinCost) return "already-unlocked";
			return purchaseCharacter(walletId, id, character.coinCost);
		}, [walletId])
	};
}
//#endregion
//#region src/features/spellbound/hooks/usePlayerSession.ts
function usePlayerSession() {
	const [playerName, setPlayerName] = useState("");
	const enterByName = useCallback(async (rawName) => {
		const requestedName = normalizePlayerName(rawName);
		if (!requestedName) return {
			ok: false,
			message: `Digite um nome de até 18 caracteres.`
		};
		setActivePlayerName(requestedName.displayName);
		setPlayerName(requestedName.displayName);
		return {
			ok: true,
			message: "BOM JOGO!"
		};
	}, []);
	const changePlayer = useCallback(() => {
		setActivePlayerName(null);
		setPlayerName("");
	}, []);
	return {
		isReady: true,
		playerName,
		hasPlayerName: playerName.length > 0,
		enterByName,
		changePlayer
	};
}
//#endregion
//#region src/features/spellbound/audio/AudioSettingsButton.tsx
function AudioSettingsButton() {
	const { settings, updateSettings } = useArcadeAudio();
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef(null);
	useEffect(() => {
		if (!isOpen) return;
		const closeOnOutsidePointer = (event) => {
			if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setIsOpen(false);
		};
		const closeOnEscape = (event) => {
			if (event.key === "Escape") setIsOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutsidePointer);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnOutsidePointer);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [isOpen]);
	const musicMuted = !settings.musicEnabled || settings.musicVolume === 0;
	const sfxMuted = !settings.sfxEnabled || settings.sfxVolume === 0;
	return /* @__PURE__ */ jsxs("div", {
		ref: containerRef,
		className: "fixed bottom-3 right-3 z-50 font-game",
		children: [isOpen ? /* @__PURE__ */ jsxs("section", {
			role: "dialog",
			"aria-label": "Configurações de áudio",
			className: "mb-2 w-[min(19rem,calc(100vw-1.5rem))] border-4 border-arcade-violet bg-arcade-panel/98 p-4 text-arcade-ink shadow-[5px_5px_0_var(--color-arcade-shadow)]",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "mb-3 flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "font-arcade text-[0.58rem] text-arcade-violet sm:text-xs",
						children: "ÁUDIO DO ARCADE"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						"data-audio-sfx": "menu-close",
						"aria-label": "Fechar configurações de áudio",
						onClick: () => setIsOpen(false),
						className: "border-2 border-arcade-panel-border bg-white px-2 py-1 font-arcade text-[0.55rem] hover:bg-arcade-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan",
						children: "FECHAR"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "mb-3 block",
					children: [/* @__PURE__ */ jsxs("span", {
						className: "flex items-center justify-between gap-3 font-arcade text-[0.52rem] sm:text-[0.6rem]",
						children: [/* @__PURE__ */ jsx("span", { children: "🎵 MÚSICA" }), /* @__PURE__ */ jsx("span", {
							"aria-live": "polite",
							children: musicMuted ? "MUTADA" : `${Math.round(settings.musicVolume * 100)}%`
						})]
					}), /* @__PURE__ */ jsx("input", {
						type: "range",
						min: "0",
						max: "1",
						step: "0.05",
						value: settings.musicVolume,
						"aria-label": "Volume da música",
						onChange: (event) => updateSettings({ musicVolume: Number(event.currentTarget.value) }),
						className: "mt-2 h-2 w-full cursor-pointer accent-arcade-violet"
					})]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "mb-3 block",
					children: [/* @__PURE__ */ jsxs("span", {
						className: "flex items-center justify-between gap-3 font-arcade text-[0.52rem] sm:text-[0.6rem]",
						children: [/* @__PURE__ */ jsx("span", { children: "🔊 EFEITOS SONOROS" }), /* @__PURE__ */ jsx("span", {
							"aria-live": "polite",
							children: sfxMuted ? "MUTOS" : `${Math.round(settings.sfxVolume * 100)}%`
						})]
					}), /* @__PURE__ */ jsx("input", {
						type: "range",
						min: "0",
						max: "1",
						step: "0.05",
						value: settings.sfxVolume,
						"aria-label": "Volume dos efeitos sonoros",
						onChange: (event) => updateSettings({ sfxVolume: Number(event.currentTarget.value) }),
						className: "mt-2 h-2 w-full cursor-pointer accent-arcade-cyan"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "grid grid-cols-2 gap-2",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => updateSettings({ musicEnabled: !settings.musicEnabled }),
						className: "border-2 border-arcade-panel-border bg-white px-2 py-2 font-arcade text-[0.48rem] hover:bg-arcade-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan sm:text-[0.55rem]",
						children: settings.musicEnabled ? "MUTAR MÚSICA" : "ATIVAR MÚSICA"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => updateSettings({ sfxEnabled: !settings.sfxEnabled }),
						className: "border-2 border-arcade-panel-border bg-white px-2 py-2 font-arcade text-[0.48rem] hover:bg-arcade-sky focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan sm:text-[0.55rem]",
						children: settings.sfxEnabled ? "MUTAR EFEITOS" : "ATIVAR EFEITOS"
					})]
				}),
				/* @__PURE__ */ jsx("button", {
					type: "button",
					"aria-pressed": settings.silentMode,
					onClick: () => updateSettings({ silentMode: !settings.silentMode }),
					className: `mt-2 w-full border-2 px-2 py-2 font-arcade text-[0.5rem] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arcade-cyan sm:text-[0.58rem] ${settings.silentMode ? "border-arcade-pink bg-arcade-pink/20 text-arcade-ink" : "border-arcade-panel-border bg-white hover:bg-arcade-sky"}`,
					children: settings.silentMode ? "🔇 MODO SILENCIOSO ATIVO" : "🔇 MODO SILENCIOSO"
				})
			]
		}) : null, /* @__PURE__ */ jsxs("button", {
			type: "button",
			"data-audio-sfx": isOpen ? "menu-close" : "menu-open",
			"aria-label": isOpen ? "Fechar controles de áudio" : "Abrir controles de áudio",
			"aria-expanded": isOpen,
			onClick: () => setIsOpen((current) => !current),
			className: "ml-auto flex min-h-11 items-center gap-2 border-2 border-arcade-violet bg-arcade-panel/95 px-3 py-2 font-arcade text-[0.5rem] text-arcade-ink shadow-[3px_3px_0_var(--color-arcade-shadow)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-arcade-cyan",
			children: [/* @__PURE__ */ jsx("span", {
				"aria-hidden": "true",
				children: settings.silentMode ? "🔇" : musicMuted && sfxMuted ? "🔕" : "🔊"
			}), /* @__PURE__ */ jsx("span", { children: "ÁUDIO" })]
		})]
	});
}
//#endregion
//#region src/features/spellbound/SpellboundArcade.tsx
function trackForGame(gameId) {
	if (gameId === "spellbound-maze") return "maze";
	return gameId;
}
function SpellboundArcadeApp({ onTrackChange }) {
	const { isReady, playerName, hasPlayerName, enterByName, changePlayer } = usePlayerSession();
	const walletId = walletIdForPlayerName(playerName);
	const { selectedId, selectCharacter, unlockedCharacterIds, purchaseCharacter } = useCharacterSelection(walletId);
	const [view, setView] = useState("lobby");
	const [multiplayerGameId, setMultiplayerGameId] = useState("tower");
	const audioTrack = !isReady || !hasPlayerName ? null : view === "multiplayer-menu" ? trackForGame(multiplayerGameId) : view === "tower" || view === "tower-local" ? "tower" : view.includes("sky-flap") ? "sky-flap" : view.includes("sky-run") ? "sky-run" : view.startsWith("maze") ? "maze" : "lobby";
	useEffect(() => onTrackChange(audioTrack), [audioTrack, onTrackChange]);
	const openMultiplayerMenu = (gameId) => {
		setMultiplayerGameId(gameId);
		setView("multiplayer-menu");
	};
	const startBotMatch = () => {
		if (multiplayerGameId === "tower") setView("tower");
		else if (multiplayerGameId === "sky-flap") setView("sky-flap-bots");
		else if (multiplayerGameId === "spellbound-maze") setView("maze-bots");
		else setView("sky-run-multiplayer");
	};
	const backFromMultiplayerMenu = () => {
		if (multiplayerGameId === "tower") setView("lobby");
		else if (multiplayerGameId === "sky-flap") setView("sky-flap");
		else if (multiplayerGameId === "spellbound-maze") setView("maze-modes");
		else setView("sky-run-modes");
	};
	if (!isReady) return /* @__PURE__ */ jsx("main", {
		className: "celestial-sky flex min-h-screen items-center justify-center px-4 text-center",
		children: /* @__PURE__ */ jsx("p", {
			className: "pixel-title font-arcade text-sm text-arcade-ink",
			children: "CARREGANDO GRIMORIO..."
		})
	});
	if (!hasPlayerName) return /* @__PURE__ */ jsx(NameEntryScreen, { onEnter: enterByName });
	if (view === "characters") return /* @__PURE__ */ jsx(CharacterSelectScreen, {
		selectedId,
		onSelect: selectCharacter,
		onPurchase: purchaseCharacter,
		walletId,
		unlockedCharacterIds,
		onBack: () => setView("lobby")
	});
	if (view === "multiplayer-menu") return /* @__PURE__ */ jsx(MultiplayerActionMenuScreen, {
		gameId: multiplayerGameId,
		onBots: startBotMatch,
		...multiplayerGameId === "tower" ? { onLocal: () => setView("tower-local") } : {},
		...multiplayerGameId === "sky-flap" ? { onLocal: () => setView("sky-flap-multiplayer") } : {},
		...multiplayerGameId === "spellbound-maze" ? { onLocal: () => setView("maze-local") } : {},
		...multiplayerGameId === "sky-run" ? { onLocal: () => setView("sky-run-local") } : {},
		onBack: backFromMultiplayerMenu
	});
	if (view === "tower") return /* @__PURE__ */ jsx(TowerScreen, {
		characterId: selectedId,
		unlockedCharacterIds,
		playerName,
		primaryWalletId: walletId,
		onBack: () => setView("multiplayer-menu"),
		onChangeGame: () => setView("lobby")
	});
	if (view === "tower-local") return /* @__PURE__ */ jsx(TowerLocalScreen, {
		playerName,
		primaryWalletId: walletId,
		onBack: () => setView("multiplayer-menu"),
		onChangeGame: () => setView("lobby")
	});
	if (view === "sky-flap") return /* @__PURE__ */ jsx(SkyFlapModeSelectScreen, {
		onSolo: () => setView("sky-flap-solo"),
		onMultiplayer: () => openMultiplayerMenu("sky-flap"),
		onBack: () => setView("lobby")
	});
	if (view === "sky-flap-solo") return /* @__PURE__ */ jsx(SkyFlapScreen, {
		characterId: selectedId,
		playerName,
		primaryWalletId: walletId,
		onBack: () => setView("sky-flap")
	});
	if (view === "sky-flap-multiplayer") return /* @__PURE__ */ jsx(SkyFlapMultiplayerScreen, {
		selectedCharacterId: selectedId,
		playerName,
		primaryWalletId: walletId,
		onBack: () => setView("multiplayer-menu"),
		onChangeGame: () => setView("lobby")
	});
	if (view === "sky-flap-bots") return /* @__PURE__ */ jsx(SkyFlapMultiplayerScreen, {
		selectedCharacterId: selectedId,
		playerName,
		mode: "bots",
		primaryWalletId: walletId,
		onBack: () => setView("multiplayer-menu"),
		onChangeGame: () => setView("lobby")
	});
	if (view === "sky-run-modes") return /* @__PURE__ */ jsx(GameModeSelectorScreen, {
		gameId: "sky-run",
		onSingleplayer: () => setView("sky-run"),
		onMultiplayer: () => openMultiplayerMenu("sky-run"),
		onBack: () => setView("lobby")
	});
	if (view === "sky-run") return /* @__PURE__ */ jsx(SkyRunScreen, {
		characterId: selectedId,
		playerName,
		primaryWalletId: walletId,
		onBack: () => setView("sky-run-modes")
	});
	if (view === "sky-run-multiplayer" || view === "sky-run-local") return /* @__PURE__ */ jsx(SkyRunMultiplayerScreen, {
		playerName,
		selectedCharacterId: selectedId,
		primaryWalletId: walletId,
		mode: view === "sky-run-local" ? "local" : "bots",
		onBack: () => setView("multiplayer-menu"),
		onChangeGame: () => setView("lobby")
	});
	if (view === "maze-modes") return /* @__PURE__ */ jsx(GameModeSelectorScreen, {
		gameId: "spellbound-maze",
		onSingleplayer: () => setView("maze-solo"),
		onMultiplayer: () => openMultiplayerMenu("spellbound-maze"),
		onBack: () => setView("lobby")
	});
	if (view === "maze-solo" || view === "maze-bots" || view === "maze-local") {
		const mode = view === "maze-solo" ? "solo" : view === "maze-bots" ? "bots" : "local";
		return /* @__PURE__ */ jsx(MazeScreen, {
			mode,
			playerName,
			selectedCharacterId: selectedId,
			unlockedCharacterIds,
			primaryWalletId: walletId,
			onBack: () => setView(mode === "solo" ? "maze-modes" : "multiplayer-menu"),
			onChangeGame: () => setView("lobby")
		});
	}
	return /* @__PURE__ */ jsx(LobbyScreen, {
		playerName,
		walletId,
		onChangePlayer: () => {
			changePlayer();
			setView("lobby");
		},
		selectedCharacterId: selectedId,
		unlockedCharacterIds,
		onOpenCharacters: () => setView("characters"),
		onOpenTower: () => openMultiplayerMenu("tower"),
		onOpenSkyFlap: () => setView("sky-flap"),
		onOpenSkyRun: () => setView("sky-run-modes"),
		onOpenMaze: () => setView("maze-modes")
	});
}
function SpellboundArcade() {
	const [track, setTrack] = useState(null);
	return /* @__PURE__ */ jsxs(ArcadeAudioProvider, {
		track,
		children: [/* @__PURE__ */ jsx(SpellboundArcadeApp, { onTrackChange: setTrack }), track ? /* @__PURE__ */ jsx(AudioSettingsButton, {}) : null]
	});
}
//#endregion
//#region src/routes/index.tsx?tsr-split=component
function Index() {
	return /* @__PURE__ */ jsx(SpellboundArcade, {});
}
//#endregion
export { Index as component };
