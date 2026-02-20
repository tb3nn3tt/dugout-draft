import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameProvider } from './context/GameContext';
import { AuthProvider } from './contexts/AuthContext';
import { CollectionProvider } from './contexts/CollectionContext';
import { SoundProvider } from './contexts/SoundContext';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SoundProvider>
      <AuthProvider>
        <CollectionProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </CollectionProvider>
      </AuthProvider>
    </SoundProvider>
  </React.StrictMode>
);
