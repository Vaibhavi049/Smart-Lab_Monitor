import React, { useRef, useEffect } from 'react';

const BackgroundCanvas = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let W = window.innerWidth;
    let H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const handleResize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
    };
    window.addEventListener('resize', handleResize);

    // Initialise flags
    const flags = [];
    const colors = [
      'rgba(21,101,192,', // blue
      'rgba(230,81,0,',   // orange
      'rgba(27,94,32,',   // green
      'rgba(0,105,92,'    // teal
    ];
    for (let i = 0; i < 32; i++) {
      flags.push({
        x: Math.random() * W,
        y: Math.random() * H,
        w: 16 + Math.random() * 30,
        h: 9 + Math.random() * 14,
        angle: Math.random() * Math.PI * 2,
        speed: 0.002 + Math.random() * 0.005,
        drift: (Math.random() * 0.7) - 0.35,
        rotDir: Math.random() > 0.5 ? 1 : -1,
        colorBase: colors[Math.floor(Math.random() * colors.length)],
        wave: Math.random() * Math.PI * 2
      });
    }

    const draw = (t) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, W, H);

      // Draw grid of dots
      for (let x = 0; x < W; x += 40) {
        for (let y = 0; y < H; y += 40) {
          const phase = (x + y) * 0.01;
          const alpha = 0.05 + 0.03 * Math.sin(t * 0.0007 + phase);
          ctx.beginPath();
          ctx.arc(x, y, 1.3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(21, 101, 192, ${alpha})`;
          ctx.fill();
        }
      }

      // Draw flags
      flags.forEach(f => {
        f.wave += f.speed * 20;
        f.angle += f.rotDir * f.speed;
        f.x += Math.cos(f.angle) * f.drift;
        f.y += Math.sin(f.angle * 0.7) * f.drift * 0.5;

        if (f.x < -50) f.x = W + 50;
        if (f.x > W + 50) f.x = -50;
        if (f.y < -50) f.y = H + 50;
        if (f.y > H + 50) f.y = -50;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        ctx.beginPath();
        
        const waveOffset = Math.sin(f.wave) * 5;
        ctx.moveTo(0, 0);
        ctx.lineTo(f.w, waveOffset);
        ctx.lineTo(f.w, f.h + waveOffset * 0.5);
        ctx.lineTo(0, f.h);
        ctx.closePath();

        // Alpha 0.07-0.18
        const a = 0.07 + (f.speed * 10); 
        ctx.fillStyle = `${f.colorBase}${a})`;
        ctx.fill();
        ctx.lineWidth = 0.5;
        ctx.strokeStyle = `${f.colorBase}${a * 1.6})`;
        ctx.stroke();
        ctx.restore();
      });

      // Subtle colour wash
      const gradient = ctx.createLinearGradient(0, 0, W, 0);
      gradient.addColorStop(0, 'rgba(21,101,192,0.015)');
      gradient.addColorStop(0.5, 'rgba(230,81,0,0.015)');
      gradient.addColorStop(1, 'rgba(21,101,192,0.015)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
};

export default BackgroundCanvas;
