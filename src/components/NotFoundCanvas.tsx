'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef } from 'react';

class Particle {
  x: number;
  y: number;
  x0: number;
  y0: number;
  xDelta: number = 0;
  yDelta: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.x0 = x;
    this.y0 = y;
  }

  animate() {
    if (this.x === this.x0 && this.y === this.y0) {
      return;
    }

    if (Math.sqrt((this.x - this.x0) ** 2 + (this.y - this.y0) ** 2) > 1) {
      this.x += this.xDelta / 200;
      this.y += this.yDelta / 200;
    } else {
      this.x = this.x0;
      this.y = this.y0;
    }
  }

  distanceTo(x: number, y: number): number {
    const xDistance = this.x - x;
    const yDistance = this.y - y;
    return Math.sqrt(xDistance * xDistance + yDistance * yDistance);
  }

  moveAwayFrom(x: number, y: number) {
    const xDistance = this.x - x;
    const yDistance = this.y - y;
    const distance = Math.sqrt(xDistance * xDistance + yDistance * yDistance);
    const angle = Math.atan2(yDistance, xDistance);

    this.x += Math.cos(angle) * distance;
    this.y += Math.sin(angle) * distance;

    this.yDelta = this.y0 - this.y;
    this.xDelta = this.x0 - this.x;
  }
}

export default function NotFoundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(undefined);
  const particlesRef = useRef<Particle[]>([]);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return;
    }

    const padding = 36;

    const measureTextBinaryMethod = (text: string, fontface: string, min: number, max: number, desiredWidth: number): number => {
      if (max - min < 1) {
        return min;
      }
      const test = min + ((max - min) / 2);
      ctx.font = `${test}px ${fontface}`;
      const measureTest = ctx.measureText(text).width;
      let found;
      if (measureTest > desiredWidth) {
        found = measureTextBinaryMethod(text, fontface, min, test, desiredWidth);
      } else {
        found = measureTextBinaryMethod(text, fontface, test, max, desiredWidth);
      }
      return found;
    };

    const fitTextOnCanvas = (text: string, fontface: string) => {
      return measureTextBinaryMethod(text, fontface, 0, 72, canvas.width - 2 * padding);
    };

    const disperseParticlesXY = (x: number, y: number) => {
      particlesRef.current.forEach((particle) => {
        if (particle.distanceTo(x, y) < 20) {
          particle.moveAwayFrom(x, y);
        }
      });
    };

    const disperseParticlesMouse = (e: MouseEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      disperseParticlesXY(mouseX, mouseY);
    };

    const disperseParticlesTouch = (e: TouchEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.targetTouches.length; i++) {
        const touch = e.targetTouches[i];
        if (!touch) {
          continue;
        }
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;
        disperseParticlesXY(touchX, touchY);
      }
    };

    const drawScene = () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }

      // Reset dimensions to parent width
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
      } else {
        canvas.width = window.innerWidth;
      }

      // Initial drawing to get text data
      ctx.fillStyle = 'white'; // Used for extracting text pixels
      ctx.textAlign = 'center';
      const texts = ['404', 'Not Found'];
      let yPos = 0;

      texts.forEach((txt) => {
        const fontSize = fitTextOnCanvas(txt, 'verdana');
        yPos += fontSize;
        ctx.fillText(txt, canvas.width / 2 - padding, yPos);
      });

      const data = ctx.getImageData(0, 0, canvas.width - padding * 2, yPos);

      // Resize canvas to fit text height
      const newHeight = yPos + padding * 2;
      canvas.height = newHeight;
      canvas.style.height = `${newHeight}px`;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current = [];
      for (let y = 0, y2 = data.height; y < y2; y = y + 4) {
        for (let x = 0, x2 = data.width; x < x2; x = x + 4) {
          const index = (y * 4 * data.width) + (x * 4) + 3;
          if (data.data[index] !== undefined && data.data[index]! > 128) {
            particlesRef.current.push(new Particle(x + padding, y + padding));
          }
        }
      }

      ctx.fillStyle = resolvedTheme === 'dark' ? 'white' : 'black'; // Color of particles

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0, j = particlesRef.current.length; i < j; i++) {
          const particle = particlesRef.current[i];
          if (!particle) {
            continue;
          }
          particle.animate();
          ctx.fillRect(particle.x, particle.y, 2, 2);
        }
        requestRef.current = requestAnimationFrame(animate);
      };

      animate();
    };

    drawScene();

    window.addEventListener('resize', drawScene);
    canvas.addEventListener('mousemove', disperseParticlesMouse);
    canvas.addEventListener('touchmove', disperseParticlesTouch);
    canvas.addEventListener('click', disperseParticlesMouse);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      window.removeEventListener('resize', drawScene);
      canvas.removeEventListener('mousemove', disperseParticlesMouse);
      canvas.removeEventListener('touchmove', disperseParticlesTouch);
      canvas.removeEventListener('click', disperseParticlesMouse);
    };
  }, [resolvedTheme]);

  return <canvas ref={canvasRef} style={{ width: '100%', display: 'block' }} />;
}
