import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { auth, db, isFirebaseConfigured, Profile } from '../lib/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, username: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateTeamName: (name: string) => Promise<void>;
  isOnline: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!db) return null;
    const snap = await getDoc(doc(db, 'profiles', userId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Profile;
  }, []);

  // Initialize auth state
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const p = await fetchProfile(firebaseUser.uid);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [fetchProfile]);

  const signUp = useCallback(async (email: string, username: string, password: string) => {
    if (!auth || !db) return { error: 'Online features not configured' };

    const trimmed = username.trim();
    if (trimmed.length < 3) return { error: 'Username must be at least 3 characters' };
    if (trimmed.length > 20) return { error: 'Username must be 20 characters or less' };
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return { error: 'Username can only contain letters, numbers, and underscores' };
    if (password.length < 6) return { error: 'Password must be at least 6 characters' };

    // Check if username is taken
    const usernameQuery = query(
      collection(db, 'profiles'),
      where('username', '==', trimmed),
      limit(1)
    );
    const existing = await getDocs(usernameQuery);
    if (!existing.empty) return { error: 'Username is already taken' };

    try {
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);

      // Create profile document
      await setDoc(doc(db, 'profiles', newUser.uid), {
        username: trimmed,
        elo_rating: 1200,
        games_played: 0,
        wins: 0,
        losses: 0,
        peak_elo: 1200,
        created_at: serverTimestamp(),
      });

      const p = await fetchProfile(newUser.uid);
      setProfile(p);
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign up failed';
      if (message.includes('email-already-in-use')) {
        return { error: 'An account with this email already exists' };
      }
      if (message.includes('invalid-email')) {
        return { error: 'Please enter a valid email address' };
      }
      if (message.includes('weak-password')) {
        return { error: 'Password must be at least 6 characters' };
      }
      return { error: message };
    }
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) return { error: 'Online features not configured' };

    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign in failed';
      if (message.includes('invalid-credential') || message.includes('wrong-password') || message.includes('user-not-found')) {
        return { error: 'Invalid email or password' };
      }
      if (message.includes('invalid-email')) {
        return { error: 'Please enter a valid email address' };
      }
      if (message.includes('too-many-requests')) {
        return { error: 'Too many attempts. Please try again later.' };
      }
      return { error: message };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  }, []);

  const updateTeamName = useCallback(async (name: string) => {
    if (!db || !user) return;
    const firestore = db;
    await updateDoc(doc(firestore, 'profiles', user.uid), { team_name: name });
    setProfile(prev => prev ? { ...prev, team_name: name } : prev);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      signUp,
      signIn,
      signOut,
      updateTeamName,
      isOnline: isFirebaseConfigured,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
