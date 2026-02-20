import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthModal } from './AuthModal';

export function ProfileButton() {
  const { user, profile, signOut, loading, isOnline } = useAuth();
  const [showModal, setShowModal] = useState(false);

  if (!isOnline) return null;
  if (loading) return null;

  if (user && profile) {
    return (
      <div className="profile-button">
        <span className="profile-info">
          <span className="profile-username">{profile.username}</span>
          <span className="profile-elo">{profile.elo_rating} ELO</span>
        </span>
        <button className="profile-signout" onClick={signOut}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <>
      <button className="profile-signin-btn" onClick={() => setShowModal(true)}>
        Sign In
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  );
}
