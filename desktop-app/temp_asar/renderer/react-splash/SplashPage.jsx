import React, { useRef, useEffect, useState } from 'react';
import './SplashPage.css';
import Antigravity from './Antigravity';
import BackgroundCanvas from './BackgroundCanvas';

const SplashPage = ({ onAnimationComplete }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.transition = 'transform 600ms cubic-bezier(0.85, 0, 0.15, 1)';
        containerRef.current.style.transform = 'translateY(-100vh)';
      }
      
      // Cleanup after the 600ms transition finishes
      if (onAnimationComplete) {
        setTimeout(() => {
          onAnimationComplete();
        }, 600);
      }
    }, 6000);

    return () => clearTimeout(exitTimer);
  }, [onAnimationComplete]);

  const titleChars = "Smart-Lab-Monitor".split('');

  return (
    <div className="new-splash-container" ref={containerRef}>
      {/* LAYER 1 - Background Canvas */}
      <div className="layer-bottom">
        <BackgroundCanvas />
      </div>
      
      {/* LAYER 2 - Antigravity overlay */}
      <div className="layer-middle">
        <Antigravity
          count={180}
          magnetRadius={9}
          ringRadius={10}
          waveSpeed={0.5}
          waveAmplitude={1.2}
          particleSize={1.4}
          lerpSpeed={0.05}
          color="#1565C0"
          autoAnimate={true}
          particleVariance={1}
          rotationSpeed={0.05}
          depthFactor={1}
          pulseSpeed={2.5}
          particleShape="capsule"
          fieldStrength={10}
        />
      </div>

      {/* LAYER 3 - Top UI */}
      <div className="layer-top">
        {/* Scanline sweep */}
        <div className="scanline" />

        {/* Top-right version tag */}
        <div className="version-tag-new">v2.4.1</div>

        {/* 4 Corner Brackets */}
        <div className="corner top-left" />
        <div className="corner top-right" />
        <div className="corner bottom-left" />
        <div className="corner bottom-right" />

        {/* Badge */}
        <div className="secure-badge">
          SECURE PROCTORING SYSTEM
        </div>

        {/* Title */}
        <div className="title-3d-wrapper">
          <div className="title-row">
            {titleChars.map((char, i) => {
              // Determine colour based on spec
              let charClass = "text-navy"; // S,m,a,r,t
              if (i === 5) charClass = "text-royal"; // First -
              if (i >= 6 && i <= 8) charClass = "text-royal"; // L,a,b
              if (i === 9) charClass = "text-burnt"; // Second -
              if (i > 9) charClass = "text-burnt"; // M,o,n,i,t, o, r

              return (
                <span 
                  key={i} 
                  className={`title-char ${charClass}`} 
                  style={{ animationDelay: `${0.55 + (i * 0.055)}s` }}
                >
                  {char}
                </span>
              );
            })}
          </div>
          <div className="orange-underline" />
        </div>

        {/* Tagline */}
        <div className="tagline-new">
          REAL-TIME LAB MONITORING INFRASTRUCTURE
        </div>

      </div>

      {/* PROGRESS BAR */}
      <div className="progress-bar-new" />
    </div>
  );
};

export default SplashPage;
