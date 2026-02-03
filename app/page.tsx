'use client';

import { Fullscreen } from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

type GameState = 'menu' | 'game' | 'end';
type Difficulty = 'easy' | 'intermediate' | 'hard';

interface Target {
  id: number;
  x: number;
  y: number;
  radius: number;
  size: 'small' | 'large';
  velocity?: number;
  direction?: number;
  createdAt?: number; // Timestamp when target was created
}

interface Feedback {
  x: number;
  y: number;
  text: string;
  points: number;
  opacity: number;
  isMiss?: boolean; // Flag for sparkle effect
}

interface Sparkle {
  x: number;
  y: number;
  life: number;
  angle: number;
  speed: number;
  rotation?: number;
}

interface GameStats {
  finalScore: number;
  perfectHits: number;
  totalHits: number;
  reactionTimes: number[]; // Array of reaction times in milliseconds
  averageReactionTime: number; // Average reaction time in milliseconds
  mode: Difficulty;
}

const PaddleGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  // Game State
  const [gameState, setGameState] = useState<GameState>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [gameStats, setGameStats] = useState<GameStats | null>(null);

  // Game Variables
  const gameRef = useRef({
    score: 0,
    timeLeft: 60,
    targets: [] as Target[],
    feedback: [] as Feedback[],
    sparkles: [] as Sparkle[],
    nextTargetId: 0,
    perfectHits: 0,
    totalHits: 0,
    mousePos: { x: 0, y: 0 },
    reactionTimes: [] as number[],
  });

  const CANVAS_WIDTH = canvasSize.width;
  const CANVAS_HEIGHT = canvasSize.height;
  const TARGET_AREA_TOP = 40;
  const TARGET_AREA_BOTTOM = CANVAS_HEIGHT * 0.4;
  const TARGET_SPAWN_Y = CANVAS_HEIGHT * 0.4;
  const NET_Y = CANVAS_HEIGHT * 0.65;
  const NET_HEIGHT = CANVAS_HEIGHT - NET_Y;

  // Set canvas size on mount and when fullscreen changes
  useEffect(() => {
    const updateCanvasSize = () => {
      console.log('Canvas updated:', window.innerWidth, window.innerHeight);
      setCanvasSize({
        width: window.screen.width,
        height: window.screen.height,
      });
    };

    updateCanvasSize();

    window.addEventListener('resize', updateCanvasSize);
    document.addEventListener('fullscreenchange', updateCanvasSize);
    
    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      document.removeEventListener('fullscreenchange', updateCanvasSize);
    };
  }, []);

  // Initialize game
  const initializeGame = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    gameRef.current = {
      score: 0,
      timeLeft: 60,
      targets: [],
      feedback: [],
      sparkles: [],
      nextTargetId: 0,
      perfectHits: 0,
      totalHits: 0,
      mousePos: { x: 0, y: 0 },
      reactionTimes: [],
    };
    if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen request failed, continue without Fullscreen
      });
    }

    // Create initial targets (pass difficulty directly to avoid async state issues)
    addNewTarget(selectedDifficulty);
    addNewTarget(selectedDifficulty);

    setGameState('game');
  };

  // Add new target
  const addNewTarget = (diff?: Difficulty) => {
    const currentDifficulty = diff || difficulty;
    let x, radius, size;
    let validPosition = false;

    while (!validPosition) {
      size = currentDifficulty === 'easy' ? 'large' : Math.random() > 0.5 ? 'large' : 'small';
      radius = size === 'large' ? 190 : 130; // 2x bigger from previous

      // Spawn targets horizontally across the top area, all at same Y level
      x = Math.random() * (CANVAS_WIDTH - radius * 2) + radius;

      // Check if not overlapping with existing targets
      validPosition = true;
      for (const target of gameRef.current.targets) {
        const distance = Math.sqrt((x - target.x) ** 2);
        if (distance < radius + target.radius + 80) {
          validPosition = false;
          break;
        }
      }
    }

    const velocity = currentDifficulty === 'hard' ? Math.random() * 1.5 + 0.5 : 0;
    const direction = Math.random() > 0.5 ? 1 : -1;

    gameRef.current.targets.push({
      id: gameRef.current.nextTargetId++,
      x,
      y: TARGET_SPAWN_Y,
      radius,
      size,
      velocity,
      direction,
      createdAt: Date.now(),
    });
  };

  // Calculate points based on distance from center
  const calculatePoints = (distance: number, radius: number) => {
    const accuracy = 1 - distance / radius;

    if (accuracy > 0.95) {
      return { points: 100, feedback: 'PERFECT' };
    }

    const points = Math.floor(accuracy * 100);

    return {
      points,
      feedback: `+${points}`,
    };
  };

  // Handle canvas click
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gameState !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked in net area (penalty zone)
    if (clickY > NET_Y) {
      gameRef.current.feedback.push({
        x: clickX,
        y: clickY,
        text: 'MISS',
        points: 0,
        opacity: 1,
      });
      gameRef.current.score = Math.max(0, gameRef.current.score - 10);
      return;
    }

    // Check targets
    let hitTarget: Target | null = null;
    for (let i = gameRef.current.targets.length - 1; i >= 0; i--) {
      const target = gameRef.current.targets[i];
      const distance = Math.sqrt((clickX - target.x) ** 2 + (clickY - target.y) ** 2);

      if (distance <= target.radius) {
        hitTarget = target;
        const { points, feedback } = calculatePoints(distance, target.radius);

        // Calculate reaction time
        const reactionTime = target.createdAt ? Date.now() - target.createdAt : 0;
        gameRef.current.reactionTimes.push(reactionTime);

        gameRef.current.score += points;
        gameRef.current.totalHits++;
        if (feedback === 'PERFECT') {
          gameRef.current.perfectHits++;
        }

        gameRef.current.feedback.push({
          x: target.x,
          y: target.y,
          text: feedback,
          points,
          opacity: 1,
        });

        gameRef.current.targets.splice(i, 1);
        addNewTarget();
        break;
      }
    }

    // If no target was hit, show miss feedback with sparkles
    if (!hitTarget) {
      gameRef.current.feedback.push({
        x: clickX,
        y: clickY,
        text: 'MISS',
        points: 0,
        opacity: 1,
        isMiss: true,
      });

      // Create sparkles around the miss location
      for (let i = 0; i < 8; i++) {
        gameRef.current.sparkles.push({
          x: clickX,
          y: clickY,
          life: 1,
          angle: (i / 8) * Math.PI * 2,
          speed: 2 + Math.random() * 2,
          rotation: Math.random() * Math.PI * 2,
        });
      }
    }
  };

  // Handle mouse move for cursor feedback
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    gameRef.current.mousePos = { x, y };
    canvas.style.cursor = 'crosshair';
  };

  // Draw function
  const draw = (ctx: CanvasRenderingContext2D) => {
    // Draw dark background
    ctx.fillStyle = '#0a0f1f';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw target area background (subtle gradient)
    const targetAreaGradient = ctx.createLinearGradient(0, TARGET_AREA_TOP, 0, NET_Y);
    targetAreaGradient.addColorStop(0, '#0f1a2e');
    targetAreaGradient.addColorStop(1, '#0a0f1f');
    ctx.fillStyle = targetAreaGradient;
    ctx.fillRect(0, TARGET_AREA_TOP, CANVAS_WIDTH, NET_Y - TARGET_AREA_TOP);

    // Draw massive net area with dense grid
    const netGradient = ctx.createLinearGradient(0, NET_Y, 0, CANVAS_HEIGHT);
    netGradient.addColorStop(0, '#1a1a3e');
    netGradient.addColorStop(0.3, '#2a2a5e');
    netGradient.addColorStop(0.7, '#1a1a3e');
    netGradient.addColorStop(1, '#0a0a1f');
    ctx.fillStyle = netGradient;
    ctx.fillRect(0, NET_Y, CANVAS_WIDTH, NET_HEIGHT);

    // Dense net grid pattern (very fine grid)
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, NET_Y);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }

    for (let y = NET_Y; y < CANVAS_HEIGHT; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_WIDTH, y);
      ctx.stroke();
    }

    // Net top edge highlight with glow
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, NET_Y);
    ctx.lineTo(CANVAS_WIDTH, NET_Y);
    ctx.stroke();

    // Net glow effect
    const netGlowGradient = ctx.createLinearGradient(0, NET_Y, 0, NET_Y + 100);
    netGlowGradient.addColorStop(0, 'rgba(100, 150, 255, 0.2)');
    netGlowGradient.addColorStop(1, 'rgba(100, 150, 255, 0)');
    ctx.fillStyle = netGlowGradient;
    ctx.fillRect(0, NET_Y, CANVAS_WIDTH, 100);

    // Draw targets
    const time = Date.now() / 1000;
    for (const target of gameRef.current.targets) {
      // Update target position if moving (hard mode)
      if (target.velocity && target.velocity > 0) {
        target.x += target.direction! * target.velocity;
        if (target.x - target.radius < 0) {
          target.direction = 1;
        } else if (target.x + target.radius > CANVAS_WIDTH) {
          target.direction = -1;
        }
      }

      // Very large outer glow
      const glowGradient = ctx.createRadialGradient(
        target.x,
        target.y,
        0,
        target.x,
        target.y,
        target.radius * 2.2
      );
      glowGradient.addColorStop(0, 'rgba(100, 220, 255, 0.4)');
      glowGradient.addColorStop(0.5, 'rgba(100, 220, 255, 0.15)');
      glowGradient.addColorStop(1, 'rgba(100, 220, 255, 0)');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Outer ring 1 - thick bright cyan
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.95)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Outer ring 2
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius * 0.65, 0, Math.PI * 2);
      ctx.stroke();

      // Inner ring 3
      ctx.strokeStyle = 'rgba(100, 220, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius * 0.35, 0, Math.PI * 2);
      ctx.stroke();

      // Bright center zone
      const centerGradient = ctx.createRadialGradient(
        target.x,
        target.y,
        0,
        target.x,
        target.y,
        target.radius * 0.28
      );
      centerGradient.addColorStop(0, '#ffffff');
      centerGradient.addColorStop(1, 'rgba(150, 230, 255, 1)');
      ctx.fillStyle = centerGradient;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius * 0.28, 0, Math.PI * 2);
      ctx.fill();

      // Pulsing outermost ring animation
      const pulse = 0.4 + Math.sin(time * 3) * 0.4;
      ctx.strokeStyle = `rgba(100, 220, 255, ${pulse * 0.9})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(target.x, target.y, target.radius + 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw sparkles for misses
    for (let i = gameRef.current.sparkles.length - 1; i >= 0; i--) {
      const sparkle = gameRef.current.sparkles[i];
      sparkle.life -= 0.02;

      if (sparkle.life <= 0) {
        gameRef.current.sparkles.splice(i, 1);
        continue;
      }

      // Move sparkle outward
      const distance = sparkle.speed * (1 - sparkle.life);
      const x = sparkle.x + Math.cos(sparkle.angle) * distance;
      const y = sparkle.y + Math.sin(sparkle.angle) * distance;

      // Animate rotation
      sparkle.rotation! += 0.15;

      // Draw sparkle with yellow glow and scaling animation
      const sparkleSize = 8 + sparkle.life * 8;
      const scale = 1 + Math.sin(Date.now() / 1000 * 8 - sparkle.angle) * 0.4;
      ctx.globalAlpha = sparkle.life * 0.8;
      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 10;

      // Save context for rotation
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(sparkle.rotation!);

      // Draw center circle
      ctx.beginPath();
      ctx.arc(0, 0, sparkleSize * scale, 0, Math.PI * 2);
      ctx.fill();

      // Draw rotating star shape
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        const angle = (j / 4) * Math.PI * 2 + sparkle.rotation!;
        const size = sparkleSize * 1.8 * scale;
        const px = Math.cos(angle) * size;
        const py = Math.sin(angle) * size;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Restore context
      ctx.restore();
    }

    ctx.shadowColor = 'transparent';
    ctx.globalAlpha = 1;

    // Draw feedback text with glow
    for (let i = gameRef.current.feedback.length - 1; i >= 0; i--) {
      const fb = gameRef.current.feedback[i];
      fb.opacity -= 0.02;

      if (fb.opacity <= 0) {
        gameRef.current.feedback.splice(i, 1);
        continue;
      }

      // Skip rendering MISS text (only show sparkles)
      if (fb.text === 'MISS' && fb.isMiss) {
        continue;
      }

      ctx.globalAlpha = fb.opacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (fb.text === 'PERFECT') {
        ctx.fillStyle = '#00ffff';
        ctx.font = 'bold 48px "Courier New", monospace';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
      } else if (fb.text.startsWith('+')) {
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 32px "Courier New", monospace';
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 15;
      } else if (fb.text === 'MISS' && fb.isMiss) {
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 36px "Courier New", monospace';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 18;
      } else {
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 32px "Courier New", monospace';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 10;
      }

      ctx.fillText(fb.text, fb.x, fb.y - fb.opacity * 40);
      ctx.shadowColor = 'transparent';
    }

    ctx.globalAlpha = 1;
  };

  // Game loop
  const [, setRender] = useState(0);

  useEffect(() => {
    if (gameState !== 'game') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startTime = Date.now();

    const gameLoop = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      gameRef.current.timeLeft = Math.max(0, 60 - elapsed);

      // Move targets for hard difficulty
      if (difficulty === 'hard') {
        const time = Date.now() / 1000;
        for (const target of gameRef.current.targets) {
          const baseX = target.x;
          target.x += Math.sin(time * 2) * 2;
          target.x = Math.max(target.radius, Math.min(CANVAS_WIDTH - target.radius, target.x));
        }
      }

      draw(ctx);
      // Force React to re-render HUD
      setRender(prev => prev + 1);

      if (gameRef.current.timeLeft > 0) {
        animationRef.current = requestAnimationFrame(gameLoop);
      } else {
        const avgReactionTime =
          gameRef.current.reactionTimes.length > 0
            ? gameRef.current.reactionTimes.reduce((a, b) => a + b, 0) /
              gameRef.current.reactionTimes.length
            : 0;

        const stats: GameStats = {
          finalScore: gameRef.current.score,
          perfectHits: gameRef.current.perfectHits,
          totalHits: gameRef.current.totalHits,
          reactionTimes: gameRef.current.reactionTimes,
          averageReactionTime: avgReactionTime,
          mode: difficulty,
        };
        setGameStats(stats);
        setGameState('end');
      }
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, difficulty]);

  // Render menu screen
  const renderMenu = () => (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(100,200,255,0.1),rgba(100,200,255,0))]">
      <div className="text-center max-w-2xl w-full mx-4">
        <h1 className="text-8xl font-bold text-cyan-400 mb-2 font-mono tracking-widest">
          PADEL
        </h1>
        <p className="text-cyan-300/60 text-xl mb-12 font-mono tracking-wider">TRAINING SIMULATOR</p>

        <div className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg p-12 border border-cyan-500/50 backdrop-blur mb-8">
          <p className="text-cyan-300/80 text-lg mb-8 font-mono tracking-wider">SELECT DIFFICULTY</p>

          <div className="space-y-4">
            <button
              onClick={() => initializeGame('easy')}
              className="w-full bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-bold py-5 px-8 rounded transition-all text-2xl uppercase tracking-wider font-mono shadow-lg shadow-cyan-500/20"
            >
              Easy
            </button>
            <button
              onClick={() => initializeGame('intermediate')}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-slate-950 font-bold py-5 px-8 rounded transition-all text-2xl uppercase tracking-wider font-mono shadow-lg shadow-blue-500/20"
            >
              Intermediate
            </button>
            <button
              onClick={() => initializeGame('hard')}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-500 hover:from-purple-500 hover:to-blue-400 text-slate-950 font-bold py-5 px-8 rounded transition-all text-2xl uppercase tracking-wider font-mono shadow-lg shadow-purple-500/20"
            >
              Hard
            </button>
          </div>
        </div>

        <p className="text-cyan-300/40 text-lg font-mono tracking-wider">60 SECOND SESSION</p>
      </div>
    </div>
  );

  // Render game screen
  const renderGame = () => (
    <div className="fixed inset-0 bg-slate-950 overflow-hidden">
      {/* Canvas fills entire screen */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        style={{
          display: 'block',
          width: '100vw',
          height: '100vh',
          margin: 0,
          padding: 0,
        }}
      />
      {/* HUD overlay on canvas */}
      <div className="absolute top-6 left-8 text-cyan-400 font-mono pointer-events-none">
        <div className="text-xs opacity-60">MODE</div>
        <div className="text-xl font-bold">
          {difficulty === 'easy' ? 'EASY' : difficulty === 'intermediate' ? 'INTER' : 'HARD'}
        </div>
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-cyan-400 font-mono text-center pointer-events-none">
        <div className="text-xs opacity-60 mb-1">TIME</div>
        <div className="text-4xl font-bold tabular-nums">
          {Math.floor(gameRef.current.timeLeft / 60)
            .toString()
            .padStart(2, '0')}
          :
          {Math.floor(gameRef.current.timeLeft % 60)
            .toString()
            .padStart(2, '0')}
        </div>
      </div>

      <div className="absolute top-6 right-8 text-cyan-400 font-mono text-right pointer-events-none">
        <div className="text-xs opacity-60">SCORE</div>
        <div className="text-4xl font-bold tabular-nums">{gameRef.current.score.toString().padStart(5, '0')}</div>
      </div>
    </div>
  );

  // Render end screen
  const renderEnd = () => {
    if (!gameStats) return null;

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(100,200,255,0.1),rgba(100,200,255,0))]">
        <div className="text-center max-w-xl w-full mx-4">
          <h1 className="text-6xl font-bold text-cyan-400 mb-2 font-mono tracking-widest">
            SESSION END
          </h1>
          <p className="text-cyan-300/60 text-lg mb-6 font-mono">MATCH RESULTS</p>

          <div className="bg-slate-800/50 rounded-lg p-8 border border-cyan-500/30 backdrop-blur mb-6 space-y-4">
            <div>
              <div className="text-xs text-cyan-300/60 opacity-60 font-mono mb-1">MODE</div>
              <div className="text-3xl font-bold text-cyan-400 uppercase">
                {gameStats.mode === 'easy' ? 'Easy' : gameStats.mode === 'intermediate' ? 'Intermediate' : 'Hard'}
              </div>
            </div>

            <div className="border-t border-cyan-500/20 pt-4">
              <div className="text-xs text-cyan-300/60 opacity-60 font-mono mb-1">SCORE</div>
              <div className="text-5xl font-bold text-cyan-400 font-mono tabular-nums">
                {gameStats.finalScore.toString().padStart(5, '0')}
              </div>
            </div>

            <div className="border-t border-cyan-500/20 pt-4">
              <div className="text-xs text-cyan-300/60 opacity-60 font-mono mb-2">ACCURACY</div>
              <div className="text-4xl font-bold text-cyan-400 font-mono">
                {gameStats.totalHits > 0
                  ? Math.round((gameStats.perfectHits / gameStats.totalHits) * 100)
                  : 0}
                %
              </div>
              <div className="text-sm text-cyan-300/60 mt-1">
                {gameStats.perfectHits} / {gameStats.totalHits} Perfect Hits
              </div>
            </div>

            <div className="border-t border-cyan-500/20 pt-4">
              <div className="text-xs text-cyan-300/60 opacity-60 font-mono mb-2">AVG REACTION TIME</div>
              <div className="text-4xl font-bold text-cyan-400 font-mono">
                {(gameStats.averageReactionTime / 1000).toFixed(2)}
                <span className="text-2xl">s</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => initializeGame(gameStats.mode)}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950 font-bold py-4 px-6 rounded transition-all text-xl uppercase tracking-wider font-mono shadow-lg shadow-cyan-500/20"
            >
              Play Again
            </button>
            <button
              onClick={() => setGameState('menu')}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-cyan-400 font-bold py-4 px-6 rounded transition-all text-xl uppercase tracking-wider font-mono border border-cyan-500/30"
            >
              Menu
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-screen bg-slate-900">
      {gameState === 'menu' && renderMenu()}
      {gameState === 'game' && renderGame()}
      {gameState === 'end' && renderEnd()}
    </div>
  );
};

export default PaddleGame;
