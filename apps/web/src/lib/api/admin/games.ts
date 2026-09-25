import { apiFetch } from "../core";
import type { GameKind, GameStatus } from "../games";

export type QuizQuestion = { prompt: string; choices: string[]; correct: number[]; time_limit: number };

export type GameQuizRow = { id: string; title: string; description: string | null; question_count: number; updated_at: string };
export type GameQuizDetail = { id: string; title: string; description: string | null; questions: QuizQuestion[] };
export type BingoDeckRow = { id: string; title: string; term_count: number; updated_at: string };
export type BingoDeckDetail = { id: string; title: string; terms: string[] };

export type LiveGameRow = {
  id: string;
  pin: string;
  kind: GameKind;
  title: string;
  status: GameStatus;
  player_count: number;
  created_at: string;
};

export type HostState = {
  id: string;
  pin: string;
  kind: GameKind;
  title: string;
  status: GameStatus;
  question_number: number;
  question_count: number;
  question: QuizQuestion | null;
  seconds_left: number | null;
  answered_count: number;
  choice_counts: number[] | null;
  called: string[];
  terms_left: number;
  winners: string[];
  players: { id: string; nickname: string; score: number; answered: boolean; bingo_at: string | null }[];
};

type QuizPayload = { title: string; description: string | null; questions: QuizQuestion[] };
type DeckPayload = { title: string; terms: string[] };

export const adminGamesApi = {
  listGameQuizzes: () => apiFetch<GameQuizRow[]>("/admin/games/quizzes"),
  getGameQuiz: (id: string) => apiFetch<GameQuizDetail>(`/admin/games/quizzes/${id}`),
  createGameQuiz: (payload: QuizPayload) =>
    apiFetch<GameQuizDetail>("/admin/games/quizzes", { method: "POST", body: JSON.stringify(payload) }),
  updateGameQuiz: (id: string, payload: QuizPayload) =>
    apiFetch<GameQuizDetail>(`/admin/games/quizzes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteGameQuiz: (id: string) => apiFetch<void>(`/admin/games/quizzes/${id}`, { method: "DELETE" }),

  listBingoDecks: () => apiFetch<BingoDeckRow[]>("/admin/games/decks"),
  getBingoDeck: (id: string) => apiFetch<BingoDeckDetail>(`/admin/games/decks/${id}`),
  createBingoDeck: (payload: DeckPayload) =>
    apiFetch<BingoDeckDetail>("/admin/games/decks", { method: "POST", body: JSON.stringify(payload) }),
  updateBingoDeck: (id: string, payload: DeckPayload) =>
    apiFetch<BingoDeckDetail>(`/admin/games/decks/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBingoDeck: (id: string) => apiFetch<void>(`/admin/games/decks/${id}`, { method: "DELETE" }),

  listLiveGames: () => apiFetch<LiveGameRow[]>("/admin/games/sessions"),
  hostGame: (payload: { quiz_id?: string; deck_id?: string }) =>
    apiFetch<HostState>("/admin/games/sessions", { method: "POST", body: JSON.stringify(payload) }),
  hostState: (id: string) => apiFetch<HostState>(`/admin/games/sessions/${id}`),
  advanceGame: (id: string) => apiFetch<HostState>(`/admin/games/sessions/${id}/advance`, { method: "POST" }),
  endGame: (id: string) => apiFetch<HostState>(`/admin/games/sessions/${id}/end`, { method: "POST" }),
  kickPlayer: (id: string, playerId: string) =>
    apiFetch<HostState>(`/admin/games/sessions/${id}/players/${playerId}/kick`, { method: "POST" }),
};
