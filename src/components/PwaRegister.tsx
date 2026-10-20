'use client';

import {useEffect} from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('KASA PWA ServiceWorker registered with scope:', registration.scope);
          })
          .catch((err) => {
            console.warn('KASA ServiceWorker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}
