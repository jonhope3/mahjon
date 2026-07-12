import { createRoot } from 'react-dom/client';
import App from './App';
import { initPwaUpdates } from './pwa-update';

// Drop cache-bust query from a hard refresh / multiplayer reconnect
{
  const url = new URL(window.location.href);
  if (url.searchParams.has('_fresh')) {
    url.searchParams.delete('_fresh');
    const clean =
      url.pathname +
      (url.searchParams.toString() ? `?${url.searchParams}` : '') +
      url.hash;
    window.history.replaceState(null, '', clean);
  }
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<App />);
}

initPwaUpdates();
