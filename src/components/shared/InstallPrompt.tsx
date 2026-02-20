import { useState, useEffect } from 'react';
import './InstallPrompt.css';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user previously dismissed
    if (localStorage.getItem('pwa-install-dismissed')) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-install-dismissed', '1');
    setDeferredPrompt(null);
  };

  if (isInstalled || dismissed || !deferredPrompt) return null;

  return (
    <div className="install-banner">
      <div className="install-content">
        <img src="/icon-192.png" alt="Dugout Draft" className="install-icon" />
        <div className="install-text">
          <strong>Install Dugout Draft</strong>
          <span>Add to home screen for the full experience</span>
        </div>
      </div>
      <div className="install-actions">
        <button className="install-btn" onClick={handleInstall}>Install</button>
        <button className="install-dismiss" onClick={handleDismiss}>Not now</button>
      </div>
    </div>
  );
}
