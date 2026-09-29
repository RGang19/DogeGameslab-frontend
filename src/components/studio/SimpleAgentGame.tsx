import { useEffect, useRef } from "react";

export function SimpleAgentGame({ onScoreSubmit }: { onScoreSubmit?: (score: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onScoreSubmitRef = useRef(onScoreSubmit);

  useEffect(() => {
    onScoreSubmitRef.current = onScoreSubmit;
  }, [onScoreSubmit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 800;
    const height = 600;
    const radius = 30;
    const colors = ["#ff3366", "#33ccff", "#ffcc00", "#66ff66"];
    let score = 0;
    let time = 20;
    let color = 0;
    let target = { x: width / 2, y: height / 2 };
    let gameOver = false;
    let submitted = false;
    let lastTime = performance.now();
    let frameId = 0;

    canvas.width = width;
    canvas.height = height;

    const moveTarget = () => {
      target = {
        x: radius + Math.random() * (width - radius * 2),
        y: 90 + radius + Math.random() * (height - 90 - radius * 2),
      };
      color = (color + 1) % colors.length;
    };

    const reset = () => {
      score = 0;
      time = 20;
      gameOver = false;
      submitted = false;
      lastTime = performance.now();
      moveTarget();
    };

    const pointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * (width / rect.width);
      const y = (event.clientY - rect.top) * (height / rect.height);

      if (gameOver) {
        reset();
      } else if (Math.hypot(x - target.x, y - target.y) <= radius) {
        score += 1;
        moveTarget();
      }
    };

    const keyboard = (event: KeyboardEvent) => {
      if (event.code === "KeyR") reset();
    };

    const draw = (now: number) => {
      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      if (!gameOver) {
        time = Math.max(0, time - delta);
        gameOver = time === 0;
        if (gameOver && !submitted) {
          submitted = true;
          onScoreSubmitRef.current?.(score);
        }
      }

      const background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, "#16162d");
      background.addColorStop(1, "#08152b");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "#fff";
      ctx.font = "700 28px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`Score: ${score}`, 28, 48);
      ctx.textAlign = "right";
      ctx.fillText(`${time.toFixed(1)}s`, width - 28, 48);

      if (!gameOver) {
        ctx.shadowBlur = 28;
        ctx.shadowColor = colors[color];
        ctx.fillStyle = colors[color];
        ctx.beginPath();
        ctx.arc(target.x, target.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffcc00";
        ctx.font = "800 54px system-ui";
        ctx.fillText("Game Over", width / 2, height / 2 - 30);
        ctx.fillStyle = "#fff";
        ctx.font = "700 28px system-ui";
        ctx.fillText(`Final Score: ${score}`, width / 2, height / 2 + 25);
        ctx.font = "500 20px system-ui";
        ctx.fillText("Click or press R to restart", width / 2, height / 2 + 70);
      }

      frameId = requestAnimationFrame(draw);
    };

    canvas.addEventListener("pointerdown", pointer);
    window.addEventListener("keydown", keyboard);
    reset();
    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      canvas.removeEventListener("pointerdown", pointer);
      window.removeEventListener("keydown", keyboard);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none object-contain"
      aria-label="Simple Agent Game"
    />
  );
}
