import { apiFetch } from "./core";

export type GameKind = "quiz" | "bingo";
export type GameStatus = "lobby" | "question" | "reveal" | "playing" | "finished";

export type JoinResponse = { token: string; pin: string; kind: GameKind; nickname: string };

export type PlayerState = {
  pin: string;
  kind: GameKind;
  title: string;
  status: GameStatus;
  nickname: string;
  score: number;
  rank: number;
  player_count: number;
  question: {
    number: number;
    count: number;
    prompt: string;
    choices: string[];
    multi: boolean;
    time_limit: number;
  } | null;
  seconds_left: number | null;
  my_answer: { choices: number[]; correct: boolean | null; points: number | null } | null;
  correct: number[] | null;
  leaderboard: { nickname: string; score: number }[];
  card: string[] | null;
  called: string[];
  winners: string[];
  has_bingo: boolean;
};

// Guests have no session cookie — each game's token (handed out by /join)
// lives in localStorage and rides along as a header on every call.
const tokenKey = (pin: string) => `game-token:${pin}`;

export const gameToken = {
  get(pin: string): string | null {
    try {
      return localStorage.getItem(tokenKey(pin));
    } catch {
      return null;
    }
  },
  set(pin: string, token: string) {
    try {
      localStorage.setItem(tokenKey(pin), token);
    } catch {
      // private mode etc. — the game still works until the tab closes
    }
  },
  clear(pin: string) {
    try {
      localStorage.removeItem(tokenKey(pin));
    } catch {
      // ignore
    }
  },
};

const withToken = (pin: string, init?: RequestInit): RequestInit => ({
  ...init,
  headers: { "X-Game-Token": gameToken.get(pin) ?? "" },
});

export const gameApi = {
  join: (pin: string, nickname: string | null) =>
    apiFetch<JoinResponse>("/games/join", { method: "POST", body: JSON.stringify({ pin, nickname }) }),
  state: (pin: string) => apiFetch<PlayerState>(`/games/${pin}/state`, withToken(pin)),
  answer: (pin: string, choices: number[]) =>
    apiFetch<PlayerState>(`/games/${pin}/answer`, withToken(pin, { method: "POST", body: JSON.stringify({ choices }) })),
  claimBingo: (pin: string) => apiFetch<{ line: number[] }>(`/games/${pin}/bingo`, withToken(pin, { method: "POST" })),
};
