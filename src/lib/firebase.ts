import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

const app = isConfigured ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const isFirebaseConfigured = isConfigured;

// Database types
export interface Profile {
  id: string;
  username: string;
  team_name?: string;
  elo_rating: number;
  games_played: number;
  wins: number;
  losses: number;
  peak_elo: number;
  created_at: string;
}

export interface MatchmakingQueueEntry {
  id: string;
  username: string;
  elo_rating: number;
  joined_at: string;
}

export interface Match {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_username: string;
  player2_username: string;
  status: 'draft' | 'team_setup' | 'simulating' | 'completed' | 'abandoned';
  phase_data: Record<string, unknown> | null;
  winner_id: string | null;
  created_at: string;
  completed_at: string | null;
  player1_elo_at_start: number;
  player2_elo_at_start: number;
}

export interface MatchHistory {
  id: string;
  match_id: string;
  player1_id: string;
  player2_id: string;
  player1_username: string;
  player2_username: string;
  winner_id: string;
  player1_elo_before: number;
  player2_elo_before: number;
  elo_change: number;
  series_score: string;
  completed_at: string;
}
