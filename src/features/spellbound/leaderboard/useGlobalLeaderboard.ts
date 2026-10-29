import { useCallback, useEffect, useState } from "react";

import {
  fetchGlobalLeaderboard,
  subscribeToLeaderboardUpdates,
  type GlobalLeaderboardEntry,
} from "./api";

interface GlobalLeaderboardState {
  entries: GlobalLeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: GlobalLeaderboardState = {
  entries: [],
  isLoading: true,
  error: null,
};

export function useGlobalLeaderboard(playerName: string) {
  const [state, setState] = useState(INITIAL_STATE);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true, error: null }));
    try {
      const result = await fetchGlobalLeaderboard(playerName);
      setState({ entries: result.entries, isLoading: false, error: null });
    } catch (error) {
      setState({
        entries: [],
        isLoading: false,
        error:
          error instanceof Error
            ? error.message
            : "Ranking indisponível. Verifique o Netlify Database e tente novamente.",
      });
    }
  }, [playerName]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setState((current) => ({ ...current, isLoading: true, error: null }));
      try {
        const result = await fetchGlobalLeaderboard(playerName);
        if (active) setState({ entries: result.entries, isLoading: false, error: null });
      } catch (error) {
        if (!active) return;
        setState({
          entries: [],
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Ranking indisponível. Verifique o Netlify Database e tente novamente.",
        });
      }
    };

    void load();
    const unsubscribe = subscribeToLeaderboardUpdates(() => void refresh());
    window.addEventListener("focus", refresh);
    const refreshInterval = window.setInterval(refresh, 30_000);
    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("focus", refresh);
      window.clearInterval(refreshInterval);
    };
  }, [playerName, refresh]);

  return { ...state, refresh };
}
