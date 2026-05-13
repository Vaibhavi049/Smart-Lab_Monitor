import React from 'react';
import { createRoot } from 'react-dom/client';
import SplashPage from './SplashPage.jsx';

const container = document.getElementById('react-splash-root');
if (container) {
  const root = createRoot(container);
  
  const handleSplashComplete = () => {
    // Notify the Vanilla JS application that the animation is done
    if (window.onSplashComplete) {
      window.onSplashComplete();
    }
    // Fully unmount React tree from DOM to stop any background WebGL looping
    root.unmount();
  };

  root.render(<SplashPage onAnimationComplete={handleSplashComplete} />);
}
