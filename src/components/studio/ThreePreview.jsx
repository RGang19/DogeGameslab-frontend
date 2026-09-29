import { Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const WIDTH = 960;
const HEIGHT = 540;
const CONTROL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Digit1",
  "Digit2",
  "Digit3",
  "Digit4",
  "Enter",
  "KeyA",
  "KeyD",
  "KeyR",
  "KeyS",
  "KeyW",
  "Space",
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function isTypingTarget(target) {
  return target?.closest?.("input, textarea, select, button, [contenteditable='true']");
}

function makeInput() {
  return {
    x: 0,
    y: 0,
    action: false,
    actionPressed: false,
    restartPressed: false,
    numberPressed: null,
    pointer: { active: false, pressed: false, released: false, x: 0, y: 0 },
    keys: new Set(),
  };
}

function updateKeyboardInput(input) {
  const left = input.keys.has("ArrowLeft") || input.keys.has("KeyA");
  const right = input.keys.has("ArrowRight") || input.keys.has("KeyD");
  const up = input.keys.has("ArrowUp") || input.keys.has("KeyW");
  const down = input.keys.has("ArrowDown") || input.keys.has("KeyS");

  input.x = Number(right) - Number(left);
  input.y = Number(down) - Number(up);
  input.action = input.keys.has("Space") || input.keys.has("Enter") || input.pointer.active;
}

function applyGamepad(input) {
  const [pad] = navigator.getGamepads ? navigator.getGamepads().filter(Boolean) : [];
  if (!pad) return;

  const axisX = Math.abs(pad.axes[0] ?? 0) > 0.18 ? pad.axes[0] : 0;
  const axisY = Math.abs(pad.axes[1] ?? 0) > 0.18 ? pad.axes[1] : 0;
  const dpadX = Number(pad.buttons[15]?.pressed) - Number(pad.buttons[14]?.pressed);
  const dpadY = Number(pad.buttons[13]?.pressed) - Number(pad.buttons[12]?.pressed);

  input.x = dpadX || axisX || input.x;
  input.y = dpadY || axisY || input.y;
  input.action = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed || input.action);
  input.actionPressed = Boolean(pad.buttons[0]?.pressed || input.actionPressed);
  input.restartPressed = Boolean(pad.buttons[9]?.pressed || input.restartPressed);
}

let latestGameState = null;

function makeGamePackage(gamePackage) {
  const colors = gamePackage.visuals?.colors ?? ["#35e8ff", "#ff3df2", "#ffd166"];
  const tuning = gamePackage.gameplay?.tuning ?? {};
  const game = { colors, tuning, score: 0, message: "", over: false, level: 1, levelUpTimer: 0 };
  latestGameState = game;
  return game;
}

function drawBackground(ctx, colors) {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = `${colors[0]}55`;
  ctx.lineWidth = 1;
  for (let x = 0; x <= WIDTH; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 112);
    ctx.lineTo(x - 180, HEIGHT);
    ctx.stroke();
  }
  for (let y = 112; y <= HEIGHT; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
}

function drawText(ctx, text, x, y, size = 22, color = "#eef6ff", align = "left") {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px Inter, system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}

function drawButton(ctx, rect, label, active, colors) {
  ctx.fillStyle = active ? `${colors[0]}33` : "rgba(255,255,255,0.06)";
  ctx.strokeStyle = active ? colors[0] : "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 8);
  ctx.fill();
  ctx.stroke();
  drawText(ctx, label, rect.x + rect.w / 2, rect.y + rect.h / 2, 16, "#eef6ff", "center");
}

function contains(rect, point) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}

function drawGameHud(ctx, game, label) {
  drawText(ctx, label, 28, 72, 18, "#91a4b8");
  drawText(ctx, `Score ${Math.floor(game.score)}`, 28, 102, 28);

  // Draw Level Indicator next to Score
  drawText(ctx, `Lvl ${game.level ?? 1}`, 220, 102, 24, "#67ffb4");

  if (game.levelUpTimer > 0 && !game.over) {
    // Show a bold Level Up text flashing in the center of the game screen
    drawText(
      ctx,
      `LEVEL UP! LEVEL ${game.level}`,
      WIDTH / 2,
      HEIGHT / 2 - 40,
      36,
      "#67ffb4",
      "center",
    );
  } else if (game.message && !game.over) {
    drawText(ctx, game.message, WIDTH / 2, 102, 20, "#ffd166", "center");
  }

  if (game.over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const isWin =
      game.message === "LEVEL COMPLETE!" ||
      game.message === "RACE COMPLETE!" ||
      game.message === "VICTORY!";
    const title = isWin ? "Victory!" : "Game Over";
    const subtitle = isWin ? "Press R or Space to play again" : "Press R or Space to restart";
    const titleColor = isWin ? "#67ffb4" : "#eef6ff";

    drawText(ctx, title, WIDTH / 2, HEIGHT / 2 - 24, 42, titleColor, "center");
    drawText(ctx, subtitle, WIDTH / 2, HEIGHT / 2 + 24, 20, "#91a4b8", "center");
    if (game.message) {
      drawText(ctx, game.message, WIDTH / 2, HEIGHT / 2 - 80, 24, "#ffd166", "center");
    }
  }
}

function makeFlappy(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const speed = game.tuning.speed ?? 200;
  const gravity = game.tuning.gravity ?? 600;
  const jump = game.tuning.jump ?? -320;
  const gap = game.tuning.gap ?? 150;
  const bird = { x: 170, y: 230, vy: 0, r: 21 };
  const pipes = Array.from({ length: 4 }, (_, index) => ({
    x: WIDTH + index * 250,
    gapY: randomBetween(155, 380),
    passed: false,
  }));

  function reset() {
    game.score = 0;
    game.over = false;
    game.message = "";
    game.level = 1;
    game.levelUpTimer = 0;
    bird.y = 230;
    bird.vy = 0;
    pipes.forEach((pipe, index) => {
      pipe.x = WIDTH + index * 250;
      pipe.gapY = randomBetween(155, 380);
      pipe.passed = false;
    });
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      if (game.levelUpTimer > 0) game.levelUpTimer -= dt;

      // Level progression
      const prevLevel = game.level;
      if (game.score >= 15) {
        game.level = 3;
      } else if (game.score >= 5) {
        game.level = 2;
      } else {
        game.level = 1;
      }
      if (game.level > prevLevel) {
        game.levelUpTimer = 2.0;
      }

      if (input.actionPressed || input.pointer.pressed) bird.vy = jump;
      bird.vy += gravity * dt;
      bird.y += bird.vy * dt;

      // Adjust difficulty based on level
      const currentSpeed = speed * (1 + (game.level - 1) * 0.25);
      const currentGap = gap * (1 - (game.level - 1) * 0.12);

      pipes.forEach((pipe, pipeIndex) => {
        pipe.x -= currentSpeed * dt;

        // Level 3: Vertical oscillation for pipes
        if (game.level === 3) {
          pipe.gapY += Math.sin(performance.now() / 300 + pipeIndex) * 60 * dt;
          pipe.gapY = clamp(pipe.gapY, 155, 380);
        }

        if (pipe.x < -80) {
          pipe.x = WIDTH + 170;
          pipe.gapY = randomBetween(145, 390);
          pipe.passed = false;
        }
        if (!pipe.passed && pipe.x + 58 < bird.x) {
          game.score += 1;
          pipe.passed = true;
        }
        const hitX = bird.x + bird.r > pipe.x && bird.x - bird.r < pipe.x + 58;
        const hitY =
          bird.y - bird.r < pipe.gapY - currentGap / 2 ||
          bird.y + bird.r > pipe.gapY + currentGap / 2;
        if (hitX && hitY) game.over = true;
      });

      if (bird.y < 112 || bird.y > HEIGHT - 24) game.over = true;
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      const currentGap = gap * (1 - (game.level - 1) * 0.12);
      pipes.forEach((pipe) => {
        ctx.fillStyle = game.colors[1];
        ctx.fillRect(pipe.x, 112, 58, pipe.gapY - currentGap / 2 - 112);
        ctx.fillRect(pipe.x, pipe.gapY + currentGap / 2, 58, HEIGHT - pipe.gapY);
      });
      ctx.fillStyle = game.colors[0];
      ctx.beginPath();
      ctx.arc(bird.x, bird.y, bird.r, 0, Math.PI * 2);
      ctx.fill();
      drawGameHud(ctx, game, "Flappy: tap Space to jump through gates");
    },
  };
}

function makeRunner(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const lanes = game.tuning.lanes ?? 3;
  const laneYs = Array.from({ length: lanes }, (_, index) => 210 + index * 70);
  const runner = { x: 150, lane: Math.floor(lanes / 2), y: 0, jump: 0, vy: 0, lives: 3 };
  const obstacles = Array.from({ length: 4 }, (_, index) => ({
    x: WIDTH + index * 230,
    lane: index % lanes,
    hit: false,
  }));
  const coins = Array.from({ length: 5 }, (_, index) => ({
    x: WIDTH + index * 180 + 100,
    lane: (index + 1) % lanes,
    taken: false,
  }));
  let laneCooldown = 0;

  function reset() {
    game.score = 0;
    game.over = false;
    game.level = 1;
    game.levelUpTimer = 0;
    runner.lives = 3;
    runner.lane = Math.floor(lanes / 2);
    obstacles.forEach((obstacle, index) => {
      obstacle.x = WIDTH + index * 230;
      obstacle.lane = Math.floor(Math.random() * lanes);
      obstacle.hit = false;
    });
  }

  function recycle(item, offset = 0) {
    item.x = WIDTH + randomBetween(120, 360) + offset;
    item.lane = Math.floor(Math.random() * lanes);
    item.hit = false;
    item.taken = false;
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      if (game.levelUpTimer > 0) game.levelUpTimer -= dt;

      // Level progression
      const prevLevel = game.level;
      if (game.score >= 400) {
        game.level = 3;
      } else if (game.score >= 150) {
        game.level = 2;
      } else {
        game.level = 1;
      }
      if (game.level > prevLevel) {
        game.levelUpTimer = 2.0;
      }

      laneCooldown -= dt;
      if (laneCooldown <= 0 && Math.abs(input.y) > 0.4) {
        runner.lane = clamp(runner.lane + Math.sign(input.y), 0, lanes - 1);
        laneCooldown = 0.18;
      }
      if ((input.actionPressed || input.pointer.pressed) && runner.jump === 0) runner.vy = -520;
      runner.vy += 1120 * dt;
      runner.jump = clamp(runner.jump + runner.vy * dt, -96, 0);
      if (runner.jump === 0) runner.vy = 0;

      // Level 2 & 3 increase speed
      const baseSpeed = game.tuning.speed ?? 330;
      const currentSpeed = baseSpeed * (1 + (game.level - 1) * 0.2);

      runner.y = laneYs[runner.lane] + runner.jump;
      obstacles.forEach((obstacle, index) => {
        obstacle.x -= currentSpeed * dt;
        if (obstacle.x < -60) recycle(obstacle);

        // Level 3: Dynamic shifting obstacles
        if (game.level === 3 && index === 0) {
          obstacle.lane = (Math.floor(performance.now() / 1500) + index) % lanes;
        }

        const hit =
          Math.abs(obstacle.x - runner.x) < 42 &&
          obstacle.lane === runner.lane &&
          runner.jump > -42 &&
          !obstacle.hit;
        if (hit) {
          obstacle.hit = true;
          runner.lives -= 1;
          game.message = `${runner.lives} lives left`;
          if (runner.lives <= 0) game.over = true;
        }
      });
      coins.forEach((coin) => {
        coin.x -= currentSpeed * dt;
        if (coin.x < -40) recycle(coin, 280);
        if (!coin.taken && Math.abs(coin.x - runner.x) < 42 && coin.lane === runner.lane) {
          coin.taken = true;
          game.score += 25 * game.level;
        }
      });
      game.score += dt * 3 * game.level;
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      laneYs.forEach((y) => {
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(70, y + 24);
        ctx.lineTo(WIDTH - 70, y + 24);
        ctx.stroke();
      });
      coins.forEach((coin) => {
        if (coin.taken) return;
        ctx.fillStyle = game.colors[2];
        ctx.beginPath();
        ctx.arc(coin.x, laneYs[coin.lane], 12, 0, Math.PI * 2);
        ctx.fill();
      });
      obstacles.forEach((obstacle) => {
        ctx.fillStyle = obstacle.hit ? "#ff4d6d66" : game.colors[1];
        ctx.fillRect(obstacle.x - 18, laneYs[obstacle.lane] - 32, 36, 58);
      });
      ctx.fillStyle = game.colors[0];
      ctx.fillRect(runner.x - 18, runner.y - 42, 36, 54);
      drawText(ctx, `Lives ${runner.lives}`, WIDTH - 130, 62, 22);
      drawGameHud(ctx, game, "Runner: Up/Down change lane, Space jumps");
    },
  };
}

function makeClicker(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const clickValue = game.tuning.baseClick ?? 1;
  const buttons = [
    { label: "Click +", cost: 25, level: 0, rect: { x: 610, y: 170, w: 220, h: 54 } },
    { label: "Auto", cost: 75, level: 0, rect: { x: 610, y: 245, w: 220, h: 54 } },
    { label: "Factory", cost: 180, level: 0, rect: { x: 610, y: 320, w: 220, h: 54 } },
  ];
  let pulse = 0;

  function buy(button) {
    if (game.score < button.cost) return;
    game.score -= button.cost;
    button.level += 1;
    button.cost = Math.ceil(button.cost * (game.tuning.multiplier ?? 1.24));
  }

  return {
    update(dt, input) {
      const passive = buttons[1].level * 2 + buttons[2].level * 8;
      game.score += passive * dt;
      pulse = Math.max(0, pulse - dt * 4);
      if (input.actionPressed || input.pointer.pressed) {
        const point = input.pointer;
        const button = buttons.find((item) => contains(item.rect, point));
        if (button) buy(button);
        else {
          game.score += clickValue + buttons[0].level;
          pulse = 1;
        }
      }
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      ctx.fillStyle = game.colors[2];
      ctx.beginPath();
      ctx.arc(310, 275, 90 + pulse * 14, 0, Math.PI * 2);
      ctx.fill();
      drawText(ctx, "TAP", 310, 275, 28, "#061018", "center");
      buttons.forEach((button) =>
        drawButton(
          ctx,
          button.rect,
          `${button.label} L${button.level} - ${button.cost}`,
          game.score >= button.cost,
          game.colors,
        ),
      );
      drawGameHud(ctx, game, "Clicker: click token, buy upgrades, earn passively");
    },
  };
}

function makeMatch3(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const size = Math.min(game.tuning.grid ?? 7, 8);
  const colorCount = Math.min(game.tuning.colors ?? 5, 6);
  const palette = [...game.colors, "#ffffff", "#67ffb4", "#ff4d6d"].slice(0, colorCount);
  const board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.floor(Math.random() * colorCount)),
  );
  const cell = 46;
  const origin = { x: WIDTH / 2 - (size * cell) / 2, y: 130 };
  let cursor = { row: 0, col: 0 };
  let selected = null;
  let moves = game.tuning.moves ?? 32;
  let moveCooldown = 0;

  function cellAt(point) {
    const col = Math.floor((point.x - origin.x) / cell);
    const row = Math.floor((point.y - origin.y) / cell);
    return row >= 0 && row < size && col >= 0 && col < size ? { row, col } : null;
  }

  function findMatches() {
    const matches = new Set();
    for (let row = 0; row < size; row += 1) {
      let run = 1;
      for (let col = 1; col <= size; col += 1) {
        if (col < size && board[row][col] === board[row][col - 1]) run += 1;
        else {
          if (run >= 3)
            for (let index = col - run; index < col; index += 1) matches.add(`${row},${index}`);
          run = 1;
        }
      }
    }
    for (let col = 0; col < size; col += 1) {
      let run = 1;
      for (let row = 1; row <= size; row += 1) {
        if (row < size && board[row][col] === board[row - 1][col]) run += 1;
        else {
          if (run >= 3)
            for (let index = row - run; index < row; index += 1) matches.add(`${index},${col}`);
          run = 1;
        }
      }
    }
    return matches;
  }

  function resolveMatches() {
    let matches = findMatches();
    while (matches.size) {
      game.score += matches.size * 10;
      matches.forEach((key) => {
        const [row, col] = key.split(",").map(Number);
        board[row][col] = null;
      });
      for (let col = 0; col < size; col += 1) {
        const column = board.map((row) => row[col]).filter((value) => value !== null);
        while (column.length < size) column.unshift(Math.floor(Math.random() * colorCount));
        for (let row = 0; row < size; row += 1) board[row][col] = column[row];
      }
      matches = findMatches();
    }
  }

  function choose(tile) {
    if (!tile || moves <= 0) return;
    if (!selected) {
      selected = tile;
      return;
    }
    const distance = Math.abs(tile.row - selected.row) + Math.abs(tile.col - selected.col);
    if (distance === 1) {
      const temp = board[tile.row][tile.col];
      board[tile.row][tile.col] = board[selected.row][selected.col];
      board[selected.row][selected.col] = temp;
      moves -= 1;
      resolveMatches();
    }
    selected = null;
  }

  resolveMatches();

  return {
    update(dt, input) {
      moveCooldown -= dt;
      if (moveCooldown <= 0 && (input.x || input.y)) {
        cursor.col = clamp(cursor.col + Math.sign(input.x), 0, size - 1);
        cursor.row = clamp(cursor.row + Math.sign(input.y), 0, size - 1);
        moveCooldown = 0.14;
      }
      if (input.pointer.pressed) choose(cellAt(input.pointer));
      if (input.actionPressed) choose(cursor);
      game.message = `${moves} moves`;
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          const x = origin.x + col * cell;
          const y = origin.y + row * cell;
          ctx.fillStyle = palette[board[row][col]];
          ctx.beginPath();
          ctx.roundRect(x + 5, y + 5, cell - 10, cell - 10, 9);
          ctx.fill();
        }
      }
      [selected, cursor].filter(Boolean).forEach((tile, index) => {
        ctx.strokeStyle = index === 0 ? "#ffd166" : "#ffffff";
        ctx.lineWidth = 4;
        ctx.strokeRect(
          origin.x + tile.col * cell + 3,
          origin.y + tile.row * cell + 3,
          cell - 6,
          cell - 6,
        );
      });
      drawGameHud(ctx, game, "Match-3: select adjacent tiles to swap");
    },
  };
}

function makeMemory(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const pairs = Math.min(game.tuning.pairs ?? 8, 10);
  const values = Array.from({ length: pairs }, (_, index) => index)
    .flatMap((value) => [value, value])
    .sort(() => Math.random() - 0.5);
  const cols = 5;
  const cards = values.map((value, index) => ({
    value,
    x: 250 + (index % cols) * 92,
    y: 135 + Math.floor(index / cols) * 92,
    revealed: false,
    matched: false,
  }));
  let cursor = 0;
  let open = [];
  let wait = 0;

  function flip(index) {
    const card = cards[index];
    if (!card || card.matched || card.revealed || wait > 0) return;
    card.revealed = true;
    open.push(card);
    if (open.length === 2) {
      if (open[0].value === open[1].value) {
        open.forEach((item) => {
          item.matched = true;
        });
        game.score += 50;
        open = [];
      } else {
        wait = 0.7;
      }
    }
  }

  return {
    update(dt, input) {
      if (wait > 0) {
        wait -= dt;
        if (wait <= 0) {
          open.forEach((card) => {
            card.revealed = false;
          });
          open = [];
        }
      }
      if (input.x || input.y) {
        const next = cursor + Math.sign(input.x) + Math.sign(input.y) * cols;
        cursor = clamp(next, 0, cards.length - 1);
      }
      if (input.pointer.pressed) {
        const clicked = cards.findIndex((card) =>
          contains({ x: card.x, y: card.y, w: 70, h: 70 }, input.pointer),
        );
        flip(clicked);
      }
      if (input.actionPressed) flip(cursor);
      if (cards.every((card) => card.matched)) game.message = "Board clear";
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      cards.forEach((card, index) => {
        ctx.fillStyle = card.matched
          ? `${game.colors[1]}66`
          : card.revealed
            ? game.colors[2]
            : game.colors[0];
        ctx.beginPath();
        ctx.roundRect(card.x, card.y, 70, 70, 8);
        ctx.fill();
        if (card.revealed || card.matched)
          drawText(ctx, String(card.value + 1), card.x + 35, card.y + 35, 24, "#061018", "center");
        if (index === cursor) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.strokeRect(card.x - 4, card.y - 4, 78, 78);
        }
      });
      drawGameHud(ctx, game, "Memory: flip cards and find pairs");
    },
  };
}

function makeQuiz(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const buttons = [0, 1, 2, 3].map((index) => ({
    x: 180 + (index % 2) * 310,
    y: 270 + Math.floor(index / 2) * 80,
    w: 270,
    h: 56,
  }));
  let question;
  let timer = game.tuning.seconds ?? 16;
  let streak = 0;

  function nextQuestion() {
    const a = Math.floor(randomBetween(2, 13));
    const b = Math.floor(randomBetween(2, 13));
    const answer = a + b;
    const options = [answer, answer + 1, answer - 1, answer + Math.floor(randomBetween(3, 8))].sort(
      () => Math.random() - 0.5,
    );
    question = { text: `${a} + ${b} = ?`, options, answer };
    timer = game.tuning.seconds ?? 16;
  }

  function answer(index) {
    if (index == null) return;
    if (question.options[index] === question.answer) {
      streak += 1;
      game.score += 100 + streak * 20;
      game.message = `Streak ${streak}`;
    } else {
      streak = 0;
      game.score = Math.max(0, game.score - (game.tuning.penalty ?? 20));
      game.message = "Miss";
    }
    nextQuestion();
  }

  nextQuestion();

  return {
    update(dt, input) {
      timer -= dt;
      if (timer <= 0) {
        streak = 0;
        game.message = "Time";
        nextQuestion();
      }
      if (input.numberPressed) answer(input.numberPressed - 1);
      if (input.pointer.pressed)
        answer(buttons.findIndex((button) => contains(button, input.pointer)));
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      drawText(ctx, question.text, WIDTH / 2, 180, 48, "#eef6ff", "center");
      buttons.forEach((button, index) =>
        drawButton(ctx, button, `${index + 1}. ${question.options[index]}`, false, game.colors),
      );
      drawText(ctx, `Time ${Math.ceil(timer)}`, WIDTH - 120, 62, 22, "#ffd166");
      drawGameHud(ctx, game, "Quiz: click answers or press 1-4");
    },
  };
}

function makeDrawing(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const strokes = [];
  const prompt = gamePackage.customization?.prompt ?? "quick sketch";
  const area = { x: 180, y: 138, w: 600, h: 300 };
  const clearButton = { x: 675, y: 466, w: 104, h: 48 };
  const brush = { x: area.x + area.w / 2, y: area.y + area.h / 2 };
  let color = game.colors[0];
  let current = null;
  const palette = game.colors.map((item, index) => ({
    x: 205 + index * 58,
    y: 470,
    w: 42,
    h: 42,
    color: item,
  }));

  function addBrushPoint() {
    if (!current) {
      current = { color, points: [] };
      strokes.push(current);
    }
    current.points.push({ x: brush.x, y: brush.y });
    game.score = strokes.reduce((total, stroke) => total + stroke.points.length, 0);
  }

  return {
    update(dt, input) {
      if (input.restartPressed) {
        strokes.length = 0;
        game.score = 0;
      }
      if (input.pointer.pressed) {
        const swatch = palette.find((item) => contains(item, input.pointer));
        if (swatch) {
          color = swatch.color;
          return;
        }
        if (contains(clearButton, input.pointer)) {
          strokes.length = 0;
          game.score = 0;
          return;
        }
      }
      brush.x = clamp(brush.x + input.x * 320 * dt, area.x + 8, area.x + area.w - 8);
      brush.y = clamp(brush.y + input.y * 320 * dt, area.y + 8, area.y + area.h - 8);
      if (input.pointer.active && contains(area, input.pointer)) {
        brush.x = input.pointer.x;
        brush.y = input.pointer.y;
        addBrushPoint();
      } else if (input.action) {
        addBrushPoint();
      } else {
        current = null;
      }
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      ctx.fillStyle = "#f7fbff";
      ctx.fillRect(area.x, area.y, area.w, area.h);
      ctx.strokeStyle = game.colors[0];
      ctx.lineWidth = 4;
      ctx.strokeRect(area.x, area.y, area.w, area.h);
      ctx.strokeStyle = "rgba(7, 10, 18, 0.1)";
      ctx.lineWidth = 1;
      for (let x = area.x + 40; x < area.x + area.w; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, area.y);
        ctx.lineTo(x, area.y + area.h);
        ctx.stroke();
      }
      for (let y = area.y + 40; y < area.y + area.h; y += 40) {
        ctx.beginPath();
        ctx.moveTo(area.x, y);
        ctx.lineTo(area.x + area.w, y);
        ctx.stroke();
      }
      strokes.forEach((stroke) => {
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";
        ctx.beginPath();
        stroke.points.forEach((point, index) => {
          if (index === 0) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
        });
        ctx.stroke();
      });
      if (strokes.length === 0) {
        drawText(
          ctx,
          "Draw here",
          area.x + area.w / 2,
          area.y + area.h / 2 - 12,
          32,
          "#0b111b",
          "center",
        );
        drawText(
          ctx,
          `Prompt: ${prompt.slice(0, 44)}`,
          area.x + area.w / 2,
          area.y + area.h / 2 + 28,
          18,
          "#4c5b6c",
          "center",
        );
      }
      palette.forEach((item) => {
        ctx.fillStyle = item.color;
        ctx.fillRect(item.x, item.y, item.w, item.h);
        if (item.color === color) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 3;
          ctx.strokeRect(item.x - 4, item.y - 4, item.w + 8, item.h + 8);
        }
      });
      drawButton(ctx, clearButton, "Clear", false, game.colors);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(brush.x, brush.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      drawGameHud(ctx, game, "Drawing: drag or hold Space and steer brush");
    },
  };
}

function makeRacing(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const car = { x: WIDTH / 2, y: HEIGHT - 110, speed: 0 };
  const traffic = Array.from({ length: game.tuning.traffic ?? 5 }, (_, index) => ({
    x: randomBetween(260, 700),
    y: -index * 160,
    w: 44,
    h: 72,
    swayDir: Math.random() > 0.5 ? 1 : -1,
  }));

  function reset() {
    game.score = 0;
    game.over = false;
    game.level = 1;
    game.levelUpTimer = 0;
    car.x = WIDTH / 2;
    car.y = HEIGHT - 110;
    car.speed = 0;
    traffic.forEach((item, index) => {
      item.x = randomBetween(260, 700);
      item.y = -index * 160;
    });
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      if (game.levelUpTimer > 0) game.levelUpTimer -= dt;

      // Level progression
      const prevLevel = game.level;
      if (game.score >= 800) {
        game.level = 3;
      } else if (game.score >= 300) {
        game.level = 2;
      } else {
        game.level = 1;
      }
      if (game.level > prevLevel) {
        game.levelUpTimer = 2.0;
      }

      car.speed = clamp(
        car.speed + (input.action ? 420 : -180) * dt,
        120,
        460 + (game.level - 1) * 60,
      );
      car.x = clamp(car.x + input.x * 360 * dt, 225, 735);
      traffic.forEach((item) => {
        const trafficBaseSpeed = car.speed - 100 * game.level;
        item.y += trafficBaseSpeed * dt;

        // Level 3: Traffic cars sway left and right
        if (game.level === 3) {
          item.x += item.swayDir * 60 * dt;
          if (item.x < 240 || item.x > 720) {
            item.swayDir *= -1;
          }
        }

        if (item.y > HEIGHT + 80) {
          item.y = randomBetween(-260, -80);
          item.x = randomBetween(260, 700);
          item.swayDir = Math.random() > 0.5 ? 1 : -1;
          game.score += 20 * game.level;
        }
        if (Math.abs(item.x - car.x) < 44 && Math.abs(item.y - car.y) < 72) {
          game.score = Math.max(0, game.score - 40);
          item.y = -120;
        }
      });
      game.score += dt * car.speed * 0.02 * game.level;
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      ctx.fillStyle = "#121a27";
      ctx.fillRect(220, 100, 540, 430);
      ctx.strokeStyle = "#ffffff55";
      ctx.setLineDash([28, 26]);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(490, 100);
      ctx.lineTo(490, 530);
      ctx.stroke();
      ctx.setLineDash([]);
      traffic.forEach((item) => {
        ctx.fillStyle = game.colors[1];
        ctx.fillRect(item.x - item.w / 2, item.y - item.h / 2, item.w, item.h);
      });
      ctx.fillStyle = game.colors[2];
      ctx.fillRect(car.x - 24, car.y - 42, 48, 84);
      drawGameHud(ctx, game, "Racing: steer, hold Space/Button A for throttle");
    },
  };
}

function makeIdle(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const generatorCount = game.tuning.generators ?? 5;
  const nodes = Array.from({ length: generatorCount }, (_, index) => ({
    label: ["Ore", "Forge", "Bot", "Lab", "Portal", "Core", "Vault"][index] ?? `Node ${index + 1}`,
    level: index === 0 ? 1 : 0,
    unlocked: index === 0,
    progress: 0,
    rate: 0.18 + index * 0.08,
    value: 2 + index * 5,
    cost: Math.round(35 * (index + 1) ** 1.7),
    x: 150 + (index % 4) * 175,
    y: 185 + Math.floor(index / 4) * 130,
  }));
  const upgradeButtons = nodes.map((node, index) => ({
    node,
    rect: { x: 70 + index * 126, y: 462, w: 112, h: 46 },
  }));
  let selected = 0;
  let selectCooldown = 0;

  function incomePerSecond() {
    return nodes.reduce(
      (total, node) => (node.unlocked ? total + node.level * node.value * node.rate : total),
      0,
    );
  }

  function buy(node) {
    if (!node.unlocked) {
      const previous = nodes[nodes.indexOf(node) - 1];
      if (!previous || previous.level < 2 || game.score < node.cost) return;
      game.score -= node.cost;
      node.unlocked = true;
      node.level = 1;
      node.cost = Math.ceil(node.cost * 1.42);
      game.message = `${node.label} online`;
      return;
    }
    if (game.score < node.cost) return;
    game.score -= node.cost;
    node.level += 1;
    node.cost = Math.ceil(node.cost * (1.32 + node.level * 0.03));
    game.message = `${node.label} L${node.level}`;
  }

  return {
    update(dt, input) {
      selectCooldown -= dt;
      if (selectCooldown <= 0 && input.x) {
        selected = clamp(selected + Math.sign(input.x), 0, nodes.length - 1);
        selectCooldown = 0.14;
      }
      if (input.actionPressed) buy(nodes[selected]);
      if (input.pointer.pressed) {
        const button = upgradeButtons.find((item) => contains(item.rect, input.pointer));
        if (button) buy(button.node);
      }
      nodes.forEach((node, index) => {
        if (!node.unlocked) {
          const previous = nodes[index - 1];
          if (previous?.level >= 2) game.message = `${node.label} unlock ready`;
          return;
        }
        node.progress += dt * node.rate * Math.max(1, node.level);
        while (node.progress >= 1) {
          node.progress -= 1;
          game.score += node.value * node.level;
        }
      });
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      drawText(ctx, `Rate ${incomePerSecond().toFixed(1)}/s`, WIDTH - 142, 102, 22, "#ffd166");
      nodes.forEach((node, index) => {
        const active = index === selected;
        ctx.strokeStyle = active
          ? "#ffffff"
          : node.unlocked
            ? game.colors[index % game.colors.length]
            : "rgba(255,255,255,0.2)";
        ctx.lineWidth = active ? 4 : 2;
        ctx.fillStyle = node.unlocked ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.025)";
        ctx.beginPath();
        ctx.roundRect(node.x - 54, node.y - 44, 108, 88, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = node.unlocked ? game.colors[index % game.colors.length] : "#4c5b6c";
        ctx.beginPath();
        ctx.arc(node.x, node.y - 12, 21, 0, Math.PI * 2);
        ctx.fill();
        if (node.unlocked) {
          ctx.strokeStyle = "#061018";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(
            node.x,
            node.y - 12,
            27,
            -Math.PI / 2,
            -Math.PI / 2 + Math.PI * 2 * node.progress,
          );
          ctx.stroke();
        }
        drawText(ctx, node.label, node.x, node.y + 24, 15, "#eef6ff", "center");
        drawText(
          ctx,
          node.unlocked ? `L${node.level}` : "LOCK",
          node.x,
          node.y + 43,
          13,
          "#91a4b8",
          "center",
        );
        if (index > 0) {
          ctx.strokeStyle = `${game.colors[1]}66`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(nodes[index - 1].x + 58, nodes[index - 1].y);
          ctx.lineTo(node.x - 58, node.y);
          ctx.stroke();
        }
      });
      upgradeButtons.forEach((button, index) => {
        const label = button.node.unlocked
          ? `${button.node.label} ${button.node.cost}`
          : `Unlock ${button.node.cost}`;
        drawButton(
          ctx,
          button.rect,
          label,
          game.score >= button.node.cost || index === 0,
          game.colors,
        );
      });
      drawGameHud(ctx, game, "Idle Factory: automate nodes, upgrade lines, unlock chains");
    },
  };
}

function makeMinigames(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const player = { x: WIDTH / 2 };
  const targets = Array.from({ length: 5 }, (_, index) => ({
    x: randomBetween(120, 840),
    y: -index * 90,
    good: index % 3 !== 0,
  }));
  let lives = game.tuning.lives ?? 4;

  return {
    update(dt, input) {
      player.x = clamp(player.x + input.x * 420 * dt, 70, WIDTH - 70);
      targets.forEach((target) => {
        target.y += 250 * dt;
        if (target.y > HEIGHT + 30) {
          target.y = randomBetween(-180, -40);
          target.x = randomBetween(100, 860);
          target.good = Math.random() > 0.25;
        }
        if (Math.abs(target.x - player.x) < 48 && Math.abs(target.y - 445) < 30) {
          if (target.good) game.score += 30;
          else lives -= 1;
          target.y = -80;
          target.x = randomBetween(100, 860);
          target.good = Math.random() > 0.25;
        }
      });
      if (lives <= 0) game.over = true;
      if (game.over && (input.restartPressed || input.actionPressed)) {
        lives = game.tuning.lives ?? 4;
        game.score = 0;
        game.over = false;
      }
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      targets.forEach((target) => {
        ctx.fillStyle = target.good ? game.colors[0] : "#ff4d6d";
        ctx.beginPath();
        ctx.arc(target.x, target.y, 20, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = game.colors[2];
      ctx.fillRect(player.x - 52, 445, 104, 18);
      drawText(ctx, `Lives ${lives}`, WIDTH - 130, 62, 22);
      drawGameHud(ctx, game, "Mini-game: catch blue targets, avoid red");
    },
  };
}

function makeArenaBattle(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const player = {
    x: WIDTH / 2,
    y: HEIGHT / 2 + 50,
    health: game.tuning.health ?? 4,
    cooldown: 0,
    invuln: 0,
  };
  const bullets = [];
  const enemyBullets = []; // Added enemy bullets for level 3
  const explosions = [];
  const enemyCount = game.tuning.enemies ?? 6;
  const enemies = Array.from({ length: enemyCount }, (_, index) => ({
    x: 120 + (index % 4) * 210,
    y: 150 + Math.floor(index / 4) * 70,
    health: 2,
    shootCooldown: randomBetween(1, 3),
  }));

  function spawn(enemy) {
    enemy.x = randomBetween(90, WIDTH - 90);
    enemy.y = randomBetween(125, 210);
    enemy.health = (2 + Math.floor(game.score / 500)) * game.level;
    enemy.shootCooldown = randomBetween(1, 3);
  }

  function shoot() {
    if (player.cooldown > 0) return;
    const target = enemies.reduce((closest, enemy) => {
      const distance = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      return !closest || distance < closest.distance ? { enemy, distance } : closest;
    }, null)?.enemy;
    const angle = target ? Math.atan2(target.y - player.y, target.x - player.x) : -Math.PI / 2;
    bullets.push({
      x: player.x,
      y: player.y,
      vx: Math.cos(angle) * 560,
      vy: Math.sin(angle) * 560,
    });
    player.cooldown = game.tuning.fireRate ?? 0.34;
  }

  function reset() {
    game.score = 0;
    game.over = false;
    game.level = 1;
    game.levelUpTimer = 0;
    player.x = WIDTH / 2;
    player.y = HEIGHT / 2 + 50;
    player.health = game.tuning.health ?? 4;
    enemies.forEach(spawn);
    bullets.length = 0;
    enemyBullets.length = 0;
    explosions.length = 0;
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      if (game.levelUpTimer > 0) game.levelUpTimer -= dt;

      // Level progression
      const prevLevel = game.level;
      if (game.score >= 3000) {
        game.level = 3;
      } else if (game.score >= 1000) {
        game.level = 2;
      } else {
        game.level = 1;
      }
      if (game.level > prevLevel) {
        game.levelUpTimer = 2.0;
      }

      player.x = clamp(player.x + input.x * 310 * dt, 45, WIDTH - 45);
      player.y = clamp(player.y + input.y * 310 * dt, 125, HEIGHT - 55);
      player.cooldown -= dt;
      player.invuln -= dt;
      if (input.action || input.pointer.pressed) shoot();

      bullets.forEach((bullet) => {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
      });
      for (let index = bullets.length - 1; index >= 0; index -= 1) {
        const bullet = bullets[index];
        if (bullet.x < -20 || bullet.x > WIDTH + 20 || bullet.y < 90 || bullet.y > HEIGHT + 20)
          bullets.splice(index, 1);
      }

      // Update enemy bullets for Level 3
      enemyBullets.forEach((bullet) => {
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        if (Math.hypot(player.x - bullet.x, player.y - bullet.y) < 20 && player.invuln <= 0) {
          player.health -= 1;
          player.invuln = 0.85;
          game.message = `${player.health} HP`;
          if (player.health <= 0) game.over = true;
        }
      });
      for (let index = enemyBullets.length - 1; index >= 0; index -= 1) {
        const bullet = enemyBullets[index];
        if (bullet.x < -20 || bullet.x > WIDTH + 20 || bullet.y < 90 || bullet.y > HEIGHT + 20)
          enemyBullets.splice(index, 1);
      }

      enemies.forEach((enemy) => {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        const currentSpeed = (game.tuning.speed ?? 120) * (1 + (game.level - 1) * 0.3);
        enemy.x += Math.cos(angle) * currentSpeed * dt;
        enemy.y += Math.sin(angle) * currentSpeed * dt;

        // Level 3 enemies shoot back!
        if (game.level === 3) {
          enemy.shootCooldown -= dt;
          if (enemy.shootCooldown <= 0) {
            enemyBullets.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(angle) * 320,
              vy: Math.sin(angle) * 320,
            });
            enemy.shootCooldown = randomBetween(2, 4);
          }
        }

        if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < 34 && player.invuln <= 0) {
          player.health -= 1;
          player.invuln = 0.85;
          game.message = `${player.health} HP`;
          if (player.health <= 0) game.over = true;
        }
        bullets.forEach((bullet, bulletIndex) => {
          if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < 28) {
            bullets.splice(bulletIndex, 1);
            enemy.health -= 1;
            explosions.push({ x: enemy.x, y: enemy.y, t: 0.25 });
            if (enemy.health <= 0) {
              game.score += 100 * game.level;
              spawn(enemy);
            }
          }
        });
      });
      explosions.forEach((explosion) => {
        explosion.t -= dt;
      });
      for (let index = explosions.length - 1; index >= 0; index -= 1) {
        if (explosions[index].t <= 0) explosions.splice(index, 1);
      }
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      ctx.strokeStyle = `${game.colors[2]}44`;
      ctx.strokeRect(90, 118, WIDTH - 180, HEIGHT - 170);
      enemies.forEach((enemy) => {
        ctx.fillStyle = game.colors[1];
        ctx.fillRect(enemy.x - 20, enemy.y - 20, 40, 40);
        ctx.fillStyle = "#070a12";
        ctx.fillRect(enemy.x - 8, enemy.y - 8, 6, 6);
        ctx.fillRect(enemy.x + 4, enemy.y - 8, 6, 6);
      });
      bullets.forEach((bullet) => {
        ctx.fillStyle = game.colors[2];
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      // Draw enemy bullets for Level 3
      ctx.fillStyle = "#ff4d6d";
      enemyBullets.forEach((bullet) => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 5, 0, Math.PI * 2);
        ctx.fill();
      });
      explosions.forEach((explosion) => {
        ctx.strokeStyle = game.colors[2];
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(explosion.x, explosion.y, 28 * (1 - explosion.t), 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.fillStyle = player.invuln > 0 ? "#ffffff" : game.colors[0];
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 26);
      ctx.lineTo(player.x - 24, player.y + 20);
      ctx.lineTo(player.x + 24, player.y + 20);
      ctx.closePath();
      ctx.fill();
      drawText(ctx, `HP ${player.health}`, WIDTH - 110, 102, 22, "#ffd166");
      drawGameHud(ctx, game, "AI Arena: move, hold Space/click to fire at robots");
    },
  };
}

function makeCyberRunner(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const lanes = game.tuning.lanes ?? 3;
  const laneXs = Array.from(
    { length: lanes },
    (_, index) => 270 + index * (420 / Math.max(1, lanes - 1)),
  );
  const vehicle = { lane: Math.floor(lanes / 2), x: laneXs[Math.floor(lanes / 2)], lives: 3 };
  const traffic = Array.from({ length: game.tuning.traffic ?? 6 }, (_, index) => ({
    lane: index % lanes,
    y: -index * 105,
    hit: false,
  }));
  const shards = Array.from({ length: 6 }, (_, index) => ({
    lane: (index + 1) % lanes,
    y: -index * 120 - 60,
    taken: false,
  }));
  let laneCooldown = 0;

  function recycle(item) {
    item.lane = Math.floor(Math.random() * lanes);
    item.y = randomBetween(-220, -70);
    item.hit = false;
    item.taken = false;
  }

  function reset() {
    game.score = 0;
    game.over = false;
    vehicle.lives = 3;
    traffic.forEach(recycle);
    shards.forEach(recycle);
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      laneCooldown -= dt;
      if (laneCooldown <= 0 && Math.abs(input.x) > 0.4) {
        vehicle.lane = clamp(vehicle.lane + Math.sign(input.x), 0, lanes - 1);
        laneCooldown = 0.15;
      }
      vehicle.x += (laneXs[vehicle.lane] - vehicle.x) * 12 * dt;
      const speed = (game.tuning.speed ?? 330) * (input.action ? (game.tuning.boost ?? 1.55) : 1);
      traffic.forEach((car) => {
        car.y += speed * dt;
        if (car.y > HEIGHT + 70) recycle(car);
        if (!car.hit && car.lane === vehicle.lane && Math.abs(car.y - 428) < 54) {
          car.hit = true;
          vehicle.lives -= 1;
          game.message = `${vehicle.lives} lives`;
          if (vehicle.lives <= 0) game.over = true;
        }
      });
      shards.forEach((shard) => {
        shard.y += speed * dt;
        if (shard.y > HEIGHT + 40) recycle(shard);
        if (!shard.taken && shard.lane === vehicle.lane && Math.abs(shard.y - 428) < 52) {
          shard.taken = true;
          game.score += input.action ? 60 : 35;
        }
      });
      game.score += dt * speed * 0.025;
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      ctx.fillStyle = "#101725";
      ctx.fillRect(220, 110, 520, 410);
      laneXs.forEach((x) => {
        ctx.strokeStyle = `${game.colors[0]}66`;
        ctx.setLineDash([20, 22]);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, 110);
        ctx.lineTo(x, 520);
        ctx.stroke();
      });
      ctx.setLineDash([]);
      traffic.forEach((car) => {
        ctx.fillStyle = car.hit ? "#ff4d6d66" : game.colors[1];
        ctx.fillRect(laneXs[car.lane] - 24, car.y - 34, 48, 68);
      });
      shards.forEach((shard) => {
        if (shard.taken) return;
        ctx.fillStyle = game.colors[2];
        ctx.beginPath();
        ctx.moveTo(laneXs[shard.lane], shard.y - 16);
        ctx.lineTo(laneXs[shard.lane] + 16, shard.y);
        ctx.lineTo(laneXs[shard.lane], shard.y + 16);
        ctx.lineTo(laneXs[shard.lane] - 16, shard.y);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = game.colors[0];
      ctx.beginPath();
      ctx.roundRect(vehicle.x - 34, 398, 68, 60, 12);
      ctx.fill();
      drawText(ctx, `Lives ${vehicle.lives}`, WIDTH - 130, 102, 22);
      drawGameHud(ctx, game, "Cyber Runner: switch lanes, hold Space to boost");
    },
  };
}

function makeSpaceShooter(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const player = { x: WIDTH / 2, y: HEIGHT - 64, lives: game.tuning.lives ?? 4, cooldown: 0 };
  const bullets = [];
  const enemyBullets = [];
  const enemies = Array.from({ length: game.tuning.enemies ?? 6 }, (_, index) => ({
    x: 170 + (index % 6) * 120,
    y: 150 + Math.floor(index / 6) * 56,
    alive: true,
  }));
  const boss = {
    x: WIDTH / 2,
    y: 100,
    health: game.tuning.bossHealth ?? 52,
    max: game.tuning.bossHealth ?? 52,
    cooldown: 0,
  };

  function reset() {
    game.score = 0;
    game.over = false;
    game.level = 1;
    game.levelUpTimer = 0;
    player.x = WIDTH / 2;
    player.y = HEIGHT - 64;
    player.lives = game.tuning.lives ?? 4;
    boss.health = boss.max;
    bullets.length = 0;
    enemyBullets.length = 0;
    enemies.forEach((enemy, index) => {
      enemy.x = 170 + (index % 6) * 120;
      enemy.y = 150 + Math.floor(index / 6) * 56;
      enemy.alive = true;
    });
  }

  function shoot() {
    if (player.cooldown > 0) return;
    bullets.push({ x: player.x, y: player.y - 26, vy: -(game.tuning.bulletSpeed ?? 480) });
    player.cooldown = 0.16;
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      if (game.levelUpTimer > 0) game.levelUpTimer -= dt;

      // Level progression
      const prevLevel = game.level;
      if (game.score >= 3000) {
        game.level = 3;
      } else if (game.score >= 1000) {
        game.level = 2;
      } else {
        game.level = 1;
      }
      if (game.level > prevLevel) {
        game.levelUpTimer = 2.0;
      }

      player.x = clamp(player.x + input.x * 380 * dt, 40, WIDTH - 40);
      player.y = clamp(player.y + input.y * 280 * dt, 260, HEIGHT - 40);
      player.cooldown -= dt;
      boss.cooldown -= dt;
      if (input.action || input.pointer.pressed) shoot();

      bullets.forEach((bullet) => {
        bullet.y += bullet.vy * dt;
      });
      enemyBullets.forEach((bullet) => {
        bullet.y += 270 * (1 + (game.level - 1) * 0.25) * dt;
      });

      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        enemy.x +=
          Math.sin(performance.now() / 500 + enemy.y) * 18 * (1 + (game.level - 1) * 0.3) * dt;
        const shootChance = 0.008 * game.level;
        if (Math.random() < shootChance) enemyBullets.push({ x: enemy.x, y: enemy.y + 18 });
        bullets.forEach((bullet, bulletIndex) => {
          if (Math.abs(bullet.x - enemy.x) < 25 && Math.abs(bullet.y - enemy.y) < 24) {
            bullets.splice(bulletIndex, 1);
            enemy.alive = false;
            game.score += 80 * game.level;
          }
        });
      });

      if (boss.health > 0) {
        boss.x = WIDTH / 2 + Math.sin(performance.now() / 700) * 210;

        // Level 3 Boss: Regenerate shield over time
        if (game.level === 3) {
          boss.health = Math.min(boss.max, boss.health + dt * 0.5);
        }

        if (boss.cooldown <= 0) {
          if (game.level >= 2) {
            // Boss shoots double bullets
            enemyBullets.push(
              { x: boss.x - 40, y: boss.y + 34 },
              { x: boss.x + 40, y: boss.y + 34 },
              { x: boss.x - 10, y: boss.y + 34 },
              { x: boss.x + 10, y: boss.y + 34 },
            );
          } else {
            enemyBullets.push(
              { x: boss.x - 40, y: boss.y + 34 },
              { x: boss.x + 40, y: boss.y + 34 },
            );
          }
          boss.cooldown = 0.65;
        }
        bullets.forEach((bullet, bulletIndex) => {
          if (Math.abs(bullet.x - boss.x) < 88 && Math.abs(bullet.y - boss.y) < 36) {
            bullets.splice(bulletIndex, 1);
            boss.health -= 1;
            game.score += 15 * game.level;
            if (boss.health <= 0) game.message = "Boss defeated";
          }
        });
      }

      enemyBullets.forEach((bullet, index) => {
        if (Math.abs(bullet.x - player.x) < 22 && Math.abs(bullet.y - player.y) < 28) {
          enemyBullets.splice(index, 1);
          player.lives -= 1;
          game.message = `${player.lives} lives`;
          if (player.lives <= 0) game.over = true;
        }
      });
      for (let index = bullets.length - 1; index >= 0; index -= 1)
        if (bullets[index].y < 70) bullets.splice(index, 1);
      for (let index = enemyBullets.length - 1; index >= 0; index -= 1)
        if (enemyBullets[index].y > HEIGHT + 20) enemyBullets.splice(index, 1);
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);
      for (let index = 0; index < 70; index += 1) {
        ctx.fillStyle = index % 3 === 0 ? game.colors[0] : "#ffffff";
        ctx.fillRect((index * 137) % WIDTH, 100 + ((index * 73) % 420), 2, 2);
      }
      if (boss.health > 0) {
        ctx.fillStyle = game.colors[0];
        ctx.fillRect(boss.x - 95, boss.y - 24, 190, 48);
        ctx.fillStyle = "#ff4d6d";
        ctx.fillRect(boss.x - 95, boss.y - 46, 190 * (boss.health / boss.max), 8);
      }
      enemies.forEach((enemy) => {
        if (!enemy.alive) return;
        ctx.fillStyle = game.colors[1];
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y + 22);
        ctx.lineTo(enemy.x - 24, enemy.y - 16);
        ctx.lineTo(enemy.x + 24, enemy.y - 16);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = game.colors[2];
      bullets.forEach((bullet) => ctx.fillRect(bullet.x - 3, bullet.y - 12, 6, 20));
      ctx.fillStyle = "#ff4d6d";
      enemyBullets.forEach((bullet) => {
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = game.colors[0];
      ctx.beginPath();
      ctx.moveTo(player.x, player.y - 30);
      ctx.lineTo(player.x - 28, player.y + 26);
      ctx.lineTo(player.x + 28, player.y + 26);
      ctx.closePath();
      ctx.fill();
      drawText(ctx, `Lives ${player.lives}`, WIDTH - 130, 102, 22);
      drawGameHud(ctx, game, "Space Shooter: move and hold Space/click to fire");
    },
  };
}

function makeFpsSurvival(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const zombieSpeed = game.tuning.zombieSpeed ?? 4;
  let ammo = game.tuning.ammo ?? 90;
  let health = game.tuning.health ?? 100;
  const maxAmmo = 30;
  let currentAmmo = 30;
  let isReloading = false;
  let reloadTimer = 0;

  const zombies = [];
  const crosshair = { x: WIDTH / 2, y: HEIGHT / 2 };
  const muzzleFlashes = [];
  const splatters = [];

  function spawnZombie() {
    zombies.push({
      x: randomBetween(200, WIDTH - 200),
      y: HEIGHT / 2,
      scale: 0.1,
      speed: zombieSpeed * randomBetween(0.8, 1.2),
      health: 2 * game.level,
    });
  }

  for (let i = 0; i < 3; i++) {
    spawnZombie();
  }

  function reset() {
    game.score = 0;
    game.over = false;
    game.message = "";
    game.level = 1;
    game.levelUpTimer = 0;
    health = game.tuning.health ?? 100;
    currentAmmo = maxAmmo;
    ammo = game.tuning.ammo ?? 90;
    isReloading = false;
    zombies.length = 0;
    for (let i = 0; i < 3; i++) {
      spawnZombie();
    }
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      if (game.levelUpTimer > 0) game.levelUpTimer -= dt;

      // Level progression
      const prevLevel = game.level;
      if (game.score >= 2000) {
        game.level = 3;
      } else if (game.score >= 800) {
        game.level = 2;
      } else {
        game.level = 1;
      }
      if (game.level > prevLevel) {
        game.levelUpTimer = 2.0;
      }

      if (isReloading) {
        reloadTimer -= dt;
        if (reloadTimer <= 0) {
          isReloading = false;
          const needed = maxAmmo - currentAmmo;
          const transfer = Math.min(needed, ammo);
          currentAmmo += transfer;
          ammo -= transfer;
        }
      }

      if (input.pointer.active) {
        crosshair.x = input.pointer.x;
        crosshair.y = input.pointer.y;
      } else {
        crosshair.x = clamp(crosshair.x + input.x * 400 * dt, 0, WIDTH);
        crosshair.y = clamp(crosshair.y + input.y * 400 * dt, 112, HEIGHT);
      }

      if (input.actionPressed || (input.pointer.pressed && !isReloading)) {
        if (currentAmmo > 0 && !isReloading) {
          currentAmmo--;
          muzzleFlashes.push({ x: crosshair.x, y: crosshair.y, duration: 0.05 });

          const sortedZombies = [...zombies].sort((a, b) => b.scale - a.scale);
          for (let z of sortedZombies) {
            const zWidth = 80 * z.scale;
            const zHeight = 150 * z.scale;
            const zX = z.x;
            const zY = z.y - zHeight / 2;

            if (
              Math.abs(crosshair.x - zX) < zWidth / 2 &&
              Math.abs(crosshair.y - zY) < zHeight / 2
            ) {
              z.health--;
              splatters.push({
                x: crosshair.x,
                y: crosshair.y,
                vx: randomBetween(-100, 100),
                vy: randomBetween(-100, 100),
                life: 0.3,
              });
              if (z.health <= 0) {
                game.score += 100 * game.level;
                zombies.splice(zombies.indexOf(z), 1);
                spawnZombie();
              }
              break;
            }
          }
        } else if (currentAmmo === 0 && !isReloading && ammo > 0) {
          isReloading = true;
          reloadTimer = 1.2;
        }
      }

      if (input.keys.has("KeyR") && !isReloading && currentAmmo < maxAmmo && ammo > 0) {
        isReloading = true;
        reloadTimer = 1.2;
      }

      for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        const currentSpeed = z.speed * (1 + (game.level - 1) * 0.25);
        z.scale += 0.12 * currentSpeed * dt;
        z.x += Math.sin(performance.now() / 200 + i) * 20 * dt * z.scale;

        if (z.scale >= 1.2) {
          health -= 15 * game.level;
          game.message = `HIT! -${15 * game.level} HP`;
          if (health <= 0) {
            health = 0;
            game.over = true;
          }
          zombies.splice(i, 1);
          spawnZombie();
        }
      }

      for (let i = muzzleFlashes.length - 1; i >= 0; i--) {
        muzzleFlashes[i].duration -= dt;
        if (muzzleFlashes[i].duration <= 0) muzzleFlashes.splice(i, 1);
      }

      for (let i = splatters.length - 1; i >= 0; i--) {
        const s = splatters[i];
        s.life -= dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.life <= 0) splatters.splice(i, 1);
      }

      if (zombies.length < 5 && Math.random() < 0.02) {
        spawnZombie();
      }
    },
    draw(ctx) {
      ctx.fillStyle = "#0c0d14";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.strokeStyle = "#1a1f35";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 112);
      ctx.lineTo(WIDTH / 2, HEIGHT / 2);
      ctx.lineTo(WIDTH, 112);
      ctx.moveTo(0, HEIGHT);
      ctx.lineTo(WIDTH / 2, HEIGHT / 2);
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.stroke();

      ctx.strokeStyle = "#141724";
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT / 2);
      ctx.lineTo(WIDTH, HEIGHT / 2);
      ctx.stroke();

      const sortedZombies = [...zombies].sort((a, b) => a.scale - b.scale);
      sortedZombies.forEach((z) => {
        const zWidth = 80 * z.scale;
        const zHeight = 150 * z.scale;
        const zX = z.x;
        const zY = HEIGHT / 2 + z.scale * 100;

        ctx.fillStyle = "#2c4c38";
        ctx.fillRect(zX - zWidth / 2, zY - zHeight, zWidth, zHeight);

        ctx.fillStyle = "#1e2a38";
        ctx.fillRect(zX - zWidth / 2, zY - zHeight * 0.7, zWidth, zHeight * 0.4);

        ctx.fillStyle = "#4a7c59";
        ctx.beginPath();
        ctx.arc(zX, zY - zHeight * 0.85, zWidth * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath();
        ctx.arc(zX - zWidth * 0.1, zY - zHeight * 0.85, 3 * z.scale, 0, Math.PI * 2);
        ctx.arc(zX + zWidth * 0.1, zY - zHeight * 0.85, 3 * z.scale, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(zX - zWidth / 2, zY - zHeight - 12, zWidth, 6);
        ctx.fillStyle = "#ff4d6d";
        ctx.fillRect(zX - zWidth / 2, zY - zHeight - 12, zWidth * (z.health / (2 * game.level)), 6);
      });

      splatters.forEach((s) => {
        ctx.fillStyle = "rgba(139, 0, 0, 0.8)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#2a2d32";
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2 - 30, HEIGHT);
      ctx.lineTo(crosshair.x - 5, crosshair.y + 100);
      ctx.lineTo(crosshair.x + 5, crosshair.y + 100);
      ctx.lineTo(WIDTH / 2 + 30, HEIGHT);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#1a1c1e";
      ctx.fillRect(WIDTH / 2 - 15, HEIGHT - 50, 30, 50);

      muzzleFlashes.forEach((f) => {
        const grad = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 40);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.2, "#ffd166");
        grad.addColorStop(1, "rgba(255, 77, 109, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 40, 0, Math.PI * 2);
        ctx.fill();
      });

      // Level 3: Fog effect overlay (lower visibility)
      if (game.level === 3) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(0, 112, WIDTH, HEIGHT - 112);
      }

      ctx.strokeStyle = isReloading ? "#ff4d6d" : "#67ffb4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(crosshair.x, crosshair.y, 15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = isReloading ? "#ff4d6d" : "#67ffb4";
      ctx.beginPath();
      ctx.arc(crosshair.x, crosshair.y, 2, 0, Math.PI * 2);
      ctx.fill();

      drawText(ctx, `AMMO: ${currentAmmo}/${maxAmmo}`, 28, 102, 28, "#ffd166");
      drawText(ctx, `RESERVE: ${ammo}`, 28, 132, 18, "#91a4b8");
      drawText(ctx, `HP: ${health}`, WIDTH - 140, 102, 28, "#ff4d6d");

      if (isReloading) {
        drawText(ctx, "RELOADING...", WIDTH / 2, HEIGHT - 80, 24, "#ffd166", "center");
      }

      drawGameHud(ctx, game, "FPS Survival: Aim with Mouse/WASD, click to shoot, R to reload");
    },
  };
}

function makeRealisticDriving(gamePackage) {
  const game = makeGamePackage(gamePackage);
  let speed = 0;
  const maxSpeed = 300;
  let carX = 0;
  const segments = [];
  let roadPosition = 0;
  const segmentLength = 200;
  const totalSegments = 500;
  const traffic = [];

  for (let i = 0; i < totalSegments; i++) {
    segments.push({
      curve: Math.sin(i / 30) * 2 * (i > 100 ? 1 : 0),
      y: i * segmentLength,
    });
  }

  for (let i = 0; i < 15; i++) {
    traffic.push({
      segmentIndex: 50 + i * 30 + Math.floor(Math.random() * 10),
      x: randomBetween(-0.6, 0.6),
      speed: randomBetween(80, 150),
      width: 0.3,
      color: game.colors[Math.floor(Math.random() * game.colors.length)],
    });
  }

  function reset() {
    game.score = 0;
    game.over = false;
    game.message = "";
    speed = 0;
    carX = 0;
    roadPosition = 0;
    traffic.forEach((t, i) => {
      t.segmentIndex = 50 + i * 30 + Math.floor(Math.random() * 10);
      t.x = randomBetween(-0.6, 0.6);
    });
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }

      if (input.action || input.pointer.active) {
        speed = clamp(speed + 120 * dt, 0, maxSpeed);
      } else {
        speed = clamp(speed - 90 * dt, 0, maxSpeed);
      }

      if (input.pointer.active) {
        const targetX = (input.pointer.x / WIDTH - 0.5) * 2.5;
        carX += (targetX - carX) * 5 * dt;
      } else {
        carX = clamp(carX + input.x * 2 * dt, -1.2, 1.2);
      }

      roadPosition += speed * dt;
      let currentSegmentIndex = Math.floor(roadPosition / segmentLength) % totalSegments;
      if (currentSegmentIndex < 0) currentSegmentIndex += totalSegments;
      const currentSegment = segments[currentSegmentIndex];

      if (currentSegment) {
        carX -= currentSegment.curve * 0.05 * (speed / maxSpeed) * dt;
      }

      traffic.forEach((t) => {
        t.segmentIndex = t.segmentIndex + (t.speed * dt) / segmentLength;
        if (t.segmentIndex >= totalSegments) {
          t.segmentIndex = 0;
          t.x = randomBetween(-0.7, 0.7);
        }

        const carSeg = roadPosition / segmentLength;
        if (Math.abs(t.segmentIndex - carSeg) < 0.1) {
          if (Math.abs(t.x - carX) < 0.3) {
            speed = 30;
            game.message = "CRASH!";
            game.score = Math.max(0, game.score - 50);
          }
        }
      });

      game.score += dt * (speed / 10);
    },
    draw(ctx) {
      ctx.fillStyle = "#070a12";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT / 2);
      skyGrad.addColorStop(0, "#0d1b2a");
      skyGrad.addColorStop(1, "#1b263b");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 112, WIDTH, HEIGHT / 2 - 112);

      ctx.fillStyle = "#0d1b2a";
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT / 2);
      for (let x = 0; x <= WIDTH; x += 40) {
        ctx.lineTo(x, HEIGHT / 2 - 15 - Math.sin(x / 50) * 10);
      }
      ctx.lineTo(WIDTH, HEIGHT / 2);
      ctx.closePath();
      ctx.fill();

      const maxDrawDistance = 80;
      const startSeg = Math.floor(roadPosition / segmentLength);
      let dCurve = 0;

      for (let i = maxDrawDistance; i > 0; i--) {
        const segment = segments[(startSeg + i) % totalSegments];
        dCurve += segment.curve;

        const z = i * segmentLength - (roadPosition % segmentLength);
        const nextZ = (i + 1) * segmentLength - (roadPosition % segmentLength);

        const scale = 250 / z;
        const nextScale = 250 / nextZ;

        const screenY = HEIGHT / 2 + scale * 100;
        const nextScreenY = HEIGHT / 2 + nextScale * 100;

        if (screenY <= HEIGHT / 2 || screenY >= HEIGHT) continue;

        const roadW = scale * 300;
        const nextRoadW = nextScale * 300;

        const screenX = WIDTH / 2 + dCurve * 5 - carX * scale * 100;
        const nextScreenX =
          WIDTH / 2 +
          (dCurve + segments[(startSeg + i + 1) % totalSegments].curve) * 5 -
          carX * nextScale * 100;

        ctx.fillStyle = (startSeg + i) % 2 === 0 ? "#112233" : "#0d1b2a";
        ctx.fillRect(0, nextScreenY, WIDTH, screenY - nextScreenY);

        ctx.fillStyle = (startSeg + i) % 2 === 0 ? "#334455" : "#223344";
        ctx.beginPath();
        ctx.moveTo(screenX - roadW, screenY);
        ctx.lineTo(nextScreenX - nextRoadW, nextScreenY);
        ctx.lineTo(nextScreenX + nextRoadW, nextScreenY);
        ctx.lineTo(screenX + roadW, screenY);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = (startSeg + i) % 2 === 0 ? "#ff4d6d" : "#ffffff";
        const rumbleW = roadW * 0.1;
        const nextRumbleW = nextRoadW * 0.1;

        ctx.beginPath();
        ctx.moveTo(screenX - roadW, screenY);
        ctx.lineTo(nextScreenX - nextRoadW, nextScreenY);
        ctx.lineTo(nextScreenX - nextRoadW + nextRumbleW, nextScreenY);
        ctx.lineTo(screenX - roadW + rumbleW, screenY);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(screenX + roadW - rumbleW, screenY);
        ctx.lineTo(nextScreenX + nextRoadW - nextRumbleW, nextScreenY);
        ctx.lineTo(nextScreenX + nextRoadW, nextScreenY);
        ctx.lineTo(screenX + roadW, screenY);
        ctx.closePath();
        ctx.fill();

        if ((startSeg + i) % 4 === 0) {
          ctx.fillStyle = "#ffd166";
          const dashW = roadW * 0.05;
          const nextDashW = nextRoadW * 0.05;
          ctx.beginPath();
          ctx.moveTo(screenX - dashW / 2, screenY);
          ctx.lineTo(nextScreenX - nextDashW / 2, nextScreenY);
          ctx.lineTo(nextScreenX + nextDashW / 2, nextScreenY);
          ctx.lineTo(screenX + dashW / 2, screenY);
          ctx.closePath();
          ctx.fill();
        }
      }

      const carSeg = roadPosition / segmentLength;
      const sortedTraffic = [...traffic]
        .map((t) => {
          let relativeSeg = t.segmentIndex - carSeg;
          if (relativeSeg < 0) relativeSeg += totalSegments;
          return { t, relativeSeg };
        })
        .filter((item) => item.relativeSeg > 0 && item.relativeSeg < maxDrawDistance)
        .sort((a, b) => b.relativeSeg - a.relativeSeg);

      sortedTraffic.forEach((item) => {
        const t = item.t;
        const relativeSeg = item.relativeSeg;
        const z = relativeSeg * segmentLength;
        const scale = 250 / z;

        let dCurve = 0;
        const start = Math.floor(carSeg);
        const end = Math.floor(t.segmentIndex);
        for (let i = start; i < end; i++) {
          dCurve += segments[i % totalSegments].curve;
        }

        const screenX = WIDTH / 2 + dCurve * 5 + (t.x - carX) * scale * 100;
        const screenY = HEIGHT / 2 + scale * 100;
        const w = 60 * scale;
        const h = 40 * scale;

        if (screenY > HEIGHT / 2 && screenY < HEIGHT) {
          ctx.fillStyle = t.color;
          ctx.fillRect(screenX - w / 2, screenY - h, w, h);
          ctx.fillStyle = "#000000";
          ctx.fillRect(screenX - w / 2 - 4 * scale, screenY - 10 * scale, 6 * scale, 10 * scale);
          ctx.fillRect(screenX + w / 2 - 2 * scale, screenY - 10 * scale, 6 * scale, 10 * scale);
        }
      });

      ctx.fillStyle = "#22252a";
      ctx.fillRect(0, HEIGHT - 60, WIDTH, 60);
      ctx.strokeStyle = "#4c5b6c";
      ctx.lineWidth = 4;
      ctx.strokeRect(0, HEIGHT - 60, WIDTH, 60);

      drawText(ctx, `SPEED: ${Math.floor(speed)} MPH`, 40, HEIGHT - 20, 24, "#ffd166");

      ctx.fillStyle = game.colors[0];
      const pW = 120;
      const pH = 70;
      ctx.fillRect(WIDTH / 2 - pW / 2, HEIGHT - 120, pW, pH);

      ctx.fillStyle = "#1b263b";
      ctx.fillRect(WIDTH / 2 - pW / 2 + 10, HEIGHT - 115, pW - 20, 25);

      ctx.fillStyle = "#ff4d6d";
      ctx.fillRect(WIDTH / 2 - pW / 2 + 5, HEIGHT - 85, 20, 10);
      ctx.fillRect(WIDTH / 2 + pW / 2 - 25, HEIGHT - 85, 20, 10);

      drawGameHud(
        ctx,
        game,
        "3D City Driving: Steer left/right with A/D or Mouse, hold Space to gas",
      );
    },
  };
}

function makeFlightSim(gamePackage) {
  const game = makeGamePackage(gamePackage);
  let roll = 0;
  let pitch = 0;
  let throttle = 50;
  let altitude = 1000;
  const rings = [];

  function spawnRing(index) {
    rings.push({
      x: randomBetween(-200, 200),
      y: randomBetween(-100, 100),
      z: index * 400 + 400,
      passed: false,
    });
  }

  for (let i = 0; i < 5; i++) {
    spawnRing(i);
  }

  function reset() {
    game.score = 0;
    game.over = false;
    game.message = "";
    roll = 0;
    pitch = 0;
    throttle = 50;
    altitude = 1000;
    rings.length = 0;
    for (let i = 0; i < 5; i++) {
      spawnRing(i);
    }
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }

      if (input.pointer.active) {
        roll += ((input.pointer.x / WIDTH - 0.5) * 2 - roll) * 4 * dt;
        pitch += ((input.pointer.y / HEIGHT - 0.5) * 2 - pitch) * 4 * dt;
      } else {
        roll = clamp(roll + input.x * 2 * dt, -1, 1);
        pitch = clamp(pitch + input.y * 2 * dt, -1, 1);
      }

      if (input.action) {
        throttle = clamp(throttle + 30 * dt, 30, 100);
      } else {
        throttle = clamp(throttle - 15 * dt, 30, 100);
      }

      const speed = throttle * 2;
      altitude += pitch * speed * dt;
      if (altitude <= 0) {
        altitude = 0;
        game.over = true;
        game.message = "CRASHED INTO TERRAIN";
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const ring = rings[i];
        ring.z -= speed * dt;
        ring.x -= roll * speed * 0.1 * dt;
        ring.y += pitch * speed * 0.1 * dt;

        if (ring.z < 20 && !ring.passed) {
          ring.passed = true;
          const dist = Math.hypot(ring.x, ring.y);
          if (dist < 80) {
            game.score += Math.round(100 - dist);
            game.message = "TARGET CLEARED!";
          } else {
            game.message = "MISSED TARGET";
          }
        }

        if (ring.z < -50) {
          rings.splice(i, 1);
          spawnRing(5);
        }
      }

      game.score += dt * (throttle / 10);
    },
    draw(ctx) {
      ctx.fillStyle = "#0d1b2a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.save();
      ctx.translate(WIDTH / 2, HEIGHT / 2);
      ctx.rotate(-roll * 0.4);

      ctx.fillStyle = "#1b263b";
      ctx.fillRect(-WIDTH, pitch * 100, WIDTH * 2, HEIGHT);

      ctx.strokeStyle = "#415a77";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = -WIDTH; x <= WIDTH; x += 100) {
        ctx.moveTo(x, pitch * 100);
        ctx.lineTo(x * 2, HEIGHT);
      }
      ctx.stroke();

      ctx.restore();

      const sortedRings = [...rings].sort((a, b) => b.z - a.z);
      sortedRings.forEach((ring) => {
        if (ring.z <= 0) return;
        const scale = 300 / ring.z;
        const rx = WIDTH / 2 + ring.x * scale;
        const ry = HEIGHT / 2 + ring.y * scale;
        const rSize = 60 * scale;

        if (rx > -rSize && rx < WIDTH + rSize && ry > -rSize && ry < HEIGHT + rSize) {
          ctx.strokeStyle = ring.passed ? "rgba(103, 255, 180, 0.4)" : "#ff3df2";
          ctx.lineWidth = Math.max(1, 4 * scale);
          ctx.beginPath();
          ctx.arc(rx, ry, rSize, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = ring.passed ? "rgba(103, 255, 180, 0.2)" : "rgba(255, 61, 242, 0.3)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx - rSize, ry);
          ctx.lineTo(rx + rSize, ry);
          ctx.moveTo(rx, ry - rSize);
          ctx.lineTo(rx, ry + rSize);
          ctx.stroke();
        }
      });

      ctx.strokeStyle = "#67ffb4";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(WIDTH / 2 - 40, HEIGHT / 2);
      ctx.lineTo(WIDTH / 2 - 20, HEIGHT / 2);
      ctx.lineTo(WIDTH / 2 - 20, HEIGHT / 2 + 10);
      ctx.moveTo(WIDTH / 2 + 40, HEIGHT / 2);
      ctx.lineTo(WIDTH / 2 + 20, HEIGHT / 2);
      ctx.lineTo(WIDTH / 2 + 20, HEIGHT / 2 + 10);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(WIDTH / 2, 130);
      ctx.lineTo(WIDTH / 2, 140);
      ctx.stroke();
      drawText(ctx, "HDG 354", WIDTH / 2, 120, 16, "#67ffb4", "center");

      drawText(ctx, `ALT: ${Math.round(altitude)} FT`, WIDTH - 160, 150, 20, "#67ffb4");
      drawText(ctx, `THR: ${Math.round(throttle)}%`, 40, 150, 20, "#67ffb4");
      drawText(ctx, `SPD: ${Math.round(throttle * 1.5)} KTS`, 40, 180, 16, "#91a4b8");

      ctx.beginPath();
      ctx.arc(WIDTH / 2, HEIGHT / 2, 120, -Math.PI / 6 - Math.PI / 2, Math.PI / 6 - Math.PI / 2);
      ctx.stroke();

      drawGameHud(
        ctx,
        game,
        "Flight Sim: Fly through rings, steer with WASD or Mouse, Space to speed up",
      );
    },
  };
}

function makeChess(gamePackage) {
  const game = makeGamePackage(gamePackage);
  const TILE = 50;
  const BOARD_X = 96;
  const BOARD_Y = 122;
  const aiDelay = game.tuning.aiDelay ?? 0.45;

  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const SOLID = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

  let board,
    turn,
    selected,
    legalForSelected,
    enPassant,
    castling,
    lastMove,
    capturedByWhite,
    capturedByBlack,
    aiTimer;

  function inside(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function cloneBoard(b) {
    return b.map((row) => row.slice());
  }

  function initBoard() {
    const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let c = 0; c < 8; c++) {
      b[0][c] = { type: back[c], color: "b" };
      b[1][c] = { type: "p", color: "b" };
      b[6][c] = { type: "p", color: "w" };
      b[7][c] = { type: back[c], color: "w" };
    }
    return b;
  }

  function reset() {
    board = initBoard();
    turn = "w";
    selected = null;
    legalForSelected = [];
    enPassant = null;
    castling = { w: { k: true, q: true }, b: { k: true, q: true } };
    lastMove = null;
    capturedByWhite = [];
    capturedByBlack = [];
    aiTimer = 0;
    game.over = false;
    game.score = 0;
    game.message = "White to move";
  }

  function attacked(b, byColor, r, c) {
    const dir = byColor === "w" ? -1 : 1;
    for (const dc of [-1, 1]) {
      const pr = r - dir;
      const pc = c - dc;
      if (inside(pr, pc)) {
        const p = b[pr][pc];
        if (p && p.color === byColor && p.type === "p") return true;
      }
    }
    const kn = [
      [-2, -1],
      [-2, 1],
      [-1, -2],
      [-1, 2],
      [1, -2],
      [1, 2],
      [2, -1],
      [2, 1],
    ];
    for (const [dr, dc] of kn) {
      const tr = r + dr;
      const tc = c + dc;
      if (inside(tr, tc)) {
        const p = b[tr][tc];
        if (p && p.color === byColor && p.type === "n") return true;
      }
    }
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const tr = r + dr;
        const tc = c + dc;
        if (inside(tr, tc)) {
          const p = b[tr][tc];
          if (p && p.color === byColor && p.type === "k") return true;
        }
      }
    }
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      let tr = r + dr;
      let tc = c + dc;
      while (inside(tr, tc)) {
        const p = b[tr][tc];
        if (p) {
          if (p.color === byColor && (p.type === "r" || p.type === "q")) return true;
          break;
        }
        tr += dr;
        tc += dc;
      }
    }
    for (const [dr, dc] of [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      let tr = r + dr;
      let tc = c + dc;
      while (inside(tr, tc)) {
        const p = b[tr][tc];
        if (p) {
          if (p.color === byColor && (p.type === "b" || p.type === "q")) return true;
          break;
        }
        tr += dr;
        tc += dc;
      }
    }
    return false;
  }

  function findKing(b, color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (p && p.color === color && p.type === "k") return { r, c };
      }
    }
    return null;
  }

  function inCheck(b, color) {
    const king = findKing(b, color);
    if (!king) return false;
    return attacked(b, color === "w" ? "b" : "w", king.r, king.c);
  }

  function genPiece(b, r, c, ep) {
    const p = b[r][c];
    if (!p) return [];
    const moves = [];
    const color = p.color;
    const enemy = color === "w" ? "b" : "w";
    const add = (tr, tc, opts) => moves.push({ from: { r, c }, to: { r: tr, c: tc }, ...opts });

    if (p.type === "p") {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const addPawn = (tr, tc, opts) => {
        const promo = tr === 0 || tr === 7;
        add(tr, tc, { ...opts, promotion: promo ? "q" : null });
      };
      if (inside(r + dir, c) && !b[r + dir][c]) {
        addPawn(r + dir, c, {});
        if (r === startRow && !b[r + 2 * dir][c])
          add(r + 2 * dir, c, { double: true, promotion: null });
      }
      for (const dc of [-1, 1]) {
        const tr = r + dir;
        const tc = c + dc;
        if (!inside(tr, tc)) continue;
        const target = b[tr][tc];
        if (target && target.color === enemy) addPawn(tr, tc, { capture: true });
        else if (ep && ep.r === tr && ep.c === tc)
          add(tr, tc, { enPassant: true, capture: true, promotion: null });
      }
    } else if (p.type === "n") {
      const kn = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [dr, dc] of kn) {
        const tr = r + dr;
        const tc = c + dc;
        if (inside(tr, tc) && (!b[tr][tc] || b[tr][tc].color === enemy))
          add(tr, tc, { capture: !!b[tr][tc] });
      }
    } else if (p.type === "k") {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const tr = r + dr;
          const tc = c + dc;
          if (inside(tr, tc) && (!b[tr][tc] || b[tr][tc].color === enemy))
            add(tr, tc, { capture: !!b[tr][tc] });
        }
      }
    } else {
      const dirs = [];
      if (p.type === "r" || p.type === "q") dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      if (p.type === "b" || p.type === "q") dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      for (const [dr, dc] of dirs) {
        let tr = r + dr;
        let tc = c + dc;
        while (inside(tr, tc)) {
          if (!b[tr][tc]) add(tr, tc, {});
          else {
            if (b[tr][tc].color === enemy) add(tr, tc, { capture: true });
            break;
          }
          tr += dr;
          tc += dc;
        }
      }
    }
    return moves;
  }

  function boardAfter(b, m) {
    const nb = cloneBoard(b);
    const p = nb[m.from.r][m.from.c];
    nb[m.to.r][m.to.c] = p;
    nb[m.from.r][m.from.c] = null;
    if (m.enPassant) nb[m.from.r][m.to.c] = null;
    if (m.promotion) nb[m.to.r][m.to.c] = { type: m.promotion, color: p.color };
    if (m.castle === "k") {
      nb[m.from.r][5] = nb[m.from.r][7];
      nb[m.from.r][7] = null;
    }
    if (m.castle === "q") {
      nb[m.from.r][3] = nb[m.from.r][0];
      nb[m.from.r][0] = null;
    }
    return nb;
  }

  function legalMoves(b, color, ep, cast) {
    const list = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p || p.color !== color) continue;
        for (const m of genPiece(b, r, c, ep)) {
          if (!inCheck(boardAfter(b, m), color)) list.push(m);
        }
      }
    }
    const rights = cast[color];
    const homeRow = color === "w" ? 7 : 0;
    const enemy = color === "w" ? "b" : "w";
    const king = b[homeRow][4];
    if (king && king.type === "k" && king.color === color && !attacked(b, enemy, homeRow, 4)) {
      const rk = b[homeRow][7];
      if (
        rights.k &&
        !b[homeRow][5] &&
        !b[homeRow][6] &&
        rk &&
        rk.type === "r" &&
        rk.color === color &&
        !attacked(b, enemy, homeRow, 5) &&
        !attacked(b, enemy, homeRow, 6)
      ) {
        list.push({ from: { r: homeRow, c: 4 }, to: { r: homeRow, c: 6 }, castle: "k" });
      }
      const rq = b[homeRow][0];
      if (
        rights.q &&
        !b[homeRow][1] &&
        !b[homeRow][2] &&
        !b[homeRow][3] &&
        rq &&
        rq.type === "r" &&
        rq.color === color &&
        !attacked(b, enemy, homeRow, 3) &&
        !attacked(b, enemy, homeRow, 2)
      ) {
        list.push({ from: { r: homeRow, c: 4 }, to: { r: homeRow, c: 2 }, castle: "q" });
      }
    }
    return list;
  }

  function doMove(m) {
    const p = board[m.from.r][m.from.c];
    const captured = m.enPassant ? board[m.from.r][m.to.c] : board[m.to.r][m.to.c];
    if (captured) {
      if (captured.color === "b") capturedByWhite.push(captured);
      else capturedByBlack.push(captured);
    }
    board = boardAfter(board, m);
    if (p.type === "k") {
      castling[p.color].k = false;
      castling[p.color].q = false;
    }
    if (p.type === "r") {
      const hr = p.color === "w" ? 7 : 0;
      if (m.from.r === hr && m.from.c === 0) castling[p.color].q = false;
      if (m.from.r === hr && m.from.c === 7) castling[p.color].k = false;
    }
    const enemy = p.color === "w" ? "b" : "w";
    const ehr = enemy === "w" ? 7 : 0;
    if (m.to.r === ehr && m.to.c === 0) castling[enemy].q = false;
    if (m.to.r === ehr && m.to.c === 7) castling[enemy].k = false;
    enPassant = m.double ? { r: (m.from.r + m.to.r) / 2, c: m.to.c } : null;
    lastMove = m;
    turn = enemy;
    game.score = capturedByWhite.reduce((s, q) => s + VALUE[q.type], 0) * 10;
  }

  function updateStatus() {
    const moves = legalMoves(board, turn, enPassant, castling);
    const checked = inCheck(board, turn);
    if (moves.length === 0) {
      game.over = true;
      if (checked) game.message = turn === "b" ? "VICTORY!" : "Checkmate — Black wins";
      else game.message = "Stalemate — Draw";
    } else {
      game.message = (turn === "w" ? "White" : "Black") + " to move" + (checked ? " — Check!" : "");
    }
  }

  function aiMove() {
    const moves = legalMoves(board, "b", enPassant, castling);
    if (!moves.length) return;
    let best = null;
    let bestScore = -Infinity;
    for (const m of moves) {
      let s = Math.random() * 0.5;
      const target = m.enPassant ? board[m.from.r][m.to.c] : board[m.to.r][m.to.c];
      if (target) s += VALUE[target.type] * 10;
      if (m.promotion) s += 8;
      const nb = boardAfter(board, m);
      if (inCheck(nb, "w")) {
        s += legalMoves(nb, "w", null, castling).length === 0 ? 1000 : 0.6;
      }
      if (attacked(nb, "w", m.to.r, m.to.c)) {
        s -= VALUE[board[m.from.r][m.from.c].type] * 6;
      }
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    doMove(best);
    updateStatus();
  }

  function selectSquare(r, c) {
    selected = { r, c };
    legalForSelected = legalMoves(board, "w", enPassant, castling).filter(
      (m) => m.from.r === r && m.from.c === c,
    );
  }

  function handleClick(r, c) {
    const p = board[r][c];
    if (selected) {
      const move = legalForSelected.find((m) => m.to.r === r && m.to.c === c);
      if (move) {
        doMove(move);
        selected = null;
        legalForSelected = [];
        updateStatus();
        if (!game.over && turn === "b") aiTimer = aiDelay;
        return;
      }
      if (p && p.color === "w") selectSquare(r, c);
      else {
        selected = null;
        legalForSelected = [];
      }
      return;
    }
    if (p && p.color === "w") selectSquare(r, c);
  }

  reset();

  function squareCenter(r, c) {
    return { x: BOARD_X + c * TILE + TILE / 2, y: BOARD_Y + r * TILE + TILE / 2 };
  }

  function drawPiece(ctx, piece, cx, cy) {
    ctx.font = `${TILE - 9}px "Apple Symbols", "Segoe UI Symbol", "Arial Unicode MS", system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const g = SOLID[piece.type];
    ctx.lineWidth = 2;
    ctx.strokeStyle = piece.color === "w" ? "#1a2436" : "#04060b";
    ctx.fillStyle = piece.color === "w" ? "#f4f6fb" : "#11151d";
    ctx.strokeText(g, cx, cy);
    ctx.fillText(g, cx, cy);
  }

  return {
    update(dt, input) {
      if (game.over) {
        if (input.restartPressed || input.actionPressed) reset();
        return;
      }
      if (input.restartPressed) {
        reset();
        return;
      }
      if (turn === "b") {
        aiTimer -= dt;
        if (aiTimer <= 0) aiMove();
        return;
      }
      if (input.pointer.pressed) {
        const c = Math.floor((input.pointer.x - BOARD_X) / TILE);
        const r = Math.floor((input.pointer.y - BOARD_Y) / TILE);
        if (inside(r, c)) handleClick(r, c);
      }
    },
    draw(ctx) {
      drawBackground(ctx, game.colors);

      const checkedColor = inCheck(board, turn) ? turn : null;
      const checkedKing = checkedColor ? findKing(board, checkedColor) : null;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const x = BOARD_X + c * TILE;
          const y = BOARD_Y + r * TILE;
          ctx.fillStyle = (r + c) % 2 === 0 ? "#ede6d2" : "#5d6b7c";
          ctx.fillRect(x, y, TILE, TILE);
        }
      }

      if (lastMove) {
        ctx.fillStyle = `${game.colors[1]}40`;
        ctx.fillRect(
          BOARD_X + lastMove.from.c * TILE,
          BOARD_Y + lastMove.from.r * TILE,
          TILE,
          TILE,
        );
        ctx.fillRect(BOARD_X + lastMove.to.c * TILE, BOARD_Y + lastMove.to.r * TILE, TILE, TILE);
      }

      if (checkedKing) {
        ctx.fillStyle = "rgba(255,72,109,0.45)";
        ctx.fillRect(BOARD_X + checkedKing.c * TILE, BOARD_Y + checkedKing.r * TILE, TILE, TILE);
      }

      if (selected) {
        ctx.strokeStyle = game.colors[0];
        ctx.lineWidth = 3;
        ctx.strokeRect(
          BOARD_X + selected.c * TILE + 1.5,
          BOARD_Y + selected.r * TILE + 1.5,
          TILE - 3,
          TILE - 3,
        );
      }

      for (const m of legalForSelected) {
        const center = squareCenter(m.to.r, m.to.c);
        ctx.fillStyle = `${game.colors[2]}cc`;
        ctx.beginPath();
        if (m.capture) {
          ctx.lineWidth = 4;
          ctx.strokeStyle = `${game.colors[2]}cc`;
          ctx.arc(center.x, center.y, TILE / 2 - 4, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece) {
            const center = squareCenter(r, c);
            drawPiece(ctx, piece, center.x, center.y);
          }
        }
      }

      // board border + coordinates
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(BOARD_X, BOARD_Y, TILE * 8, TILE * 8);
      ctx.textBaseline = "middle";
      for (let c = 0; c < 8; c++) {
        drawText(
          ctx,
          String.fromCharCode(97 + c),
          BOARD_X + c * TILE + TILE / 2,
          BOARD_Y + TILE * 8 + 12,
          12,
          "#7d8ba0",
          "center",
        );
      }
      for (let r = 0; r < 8; r++) {
        drawText(
          ctx,
          String(8 - r),
          BOARD_X - 12,
          BOARD_Y + r * TILE + TILE / 2,
          12,
          "#7d8ba0",
          "center",
        );
      }

      // side panel
      const panelX = BOARD_X + TILE * 8 + 36;
      drawText(ctx, "You — White", panelX, BOARD_Y + 16, 18, "#eef6ff", "left");
      drawText(ctx, "AI — Black", panelX, BOARD_Y + 44, 18, "#91a4b8", "left");
      drawText(ctx, "Captured", panelX, BOARD_Y + 92, 14, "#7d8ba0", "left");
      ctx.font = "24px 'Apple Symbols','Segoe UI Symbol','Arial Unicode MS',system-ui,sans-serif";
      ctx.textAlign = "left";
      ctx.fillStyle = "#f4f6fb";
      ctx.fillText(
        capturedByWhite.map((p) => SOLID[p.type]).join(" ") || "—",
        panelX,
        BOARD_Y + 118,
      );
      ctx.fillStyle = "#11151d";
      ctx.fillText(
        capturedByBlack.map((p) => SOLID[p.type]).join(" ") || "—",
        panelX,
        BOARD_Y + 150,
      );
      drawText(
        ctx,
        turn === "b" && !game.over ? "AI thinking…" : "Your move",
        panelX,
        BOARD_Y + 196,
        16,
        game.colors[0],
        "left",
      );
      drawText(ctx, "Click piece, then square", panelX, BOARD_Y + 228, 12, "#7d8ba0", "left");
      drawText(ctx, "R — new game", panelX, BOARD_Y + 250, 12, "#7d8ba0", "left");

      drawGameHud(ctx, game, "Chess: click a piece, then its destination");
    },
  };
}

function makeRuntime(gamePackage) {
  const makers = {
    "ai-arena": makeArenaBattle,
    chess: makeChess,
    "cyber-runner": makeCyberRunner,
    clicker: makeClicker,
    drawing: makeDrawing,
    flappy: makeFlappy,
    idle: makeIdle,
    match3: makeMatch3,
    memory: makeMemory,
    minigames: makeMinigames,
    quiz: makeQuiz,
    racing: makeRacing,
    runner: makeRunner,
    "space-shooter": makeSpaceShooter,
    "realistic-driving": makeRealisticDriving,
    "fps-survival": makeFpsSurvival,
    "flight-sim": makeFlightSim,
  };

  const runtime = (makers[gamePackage.templateId] ?? makeFlappy)(gamePackage);
  runtime.__gameState = latestGameState;
  latestGameState = null;
  return runtime;
}

export function ThreePreview({ gamePackage, onScoreSubmit }) {
  const mountRef = useRef(null);
  const wrapRef = useRef(null);
  const runtimeRef = useRef(null);
  const inputRef = useRef(makeInput());
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === wrapRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await wrapRef.current?.requestFullscreen?.();
      mountRef.current?.querySelector("canvas")?.focus();
      return;
    }

    await document.exitFullscreen?.();
  }

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.tabIndex = 0;
    mount.appendChild(canvas);

    runtimeRef.current = makeRuntime(gamePackage);

    let lastTime = performance.now();
    let animationId = 0;
    let scoreSubmittedForRun = false;

    function frame(time) {
      const dt = Math.max(0, Math.min(0.033, (time - lastTime) / 1000));
      lastTime = time;
      const input = inputRef.current;
      updateKeyboardInput(input);
      applyGamepad(input);
      runtimeRef.current.update(dt, input);
      const gameState = runtimeRef.current.__gameState;
      if (gameState?.over && !scoreSubmittedForRun) {
        scoreSubmittedForRun = true;
        onScoreSubmit?.(Math.max(0, Math.floor(gameState.score ?? 0)));
      }
      if (!gameState?.over) {
        scoreSubmittedForRun = false;
      }
      runtimeRef.current.draw(ctx);

      input.actionPressed = false;
      input.restartPressed = false;
      input.numberPressed = null;
      input.pointer.pressed = false;
      input.pointer.released = false;
      animationId = requestAnimationFrame(frame);
    }

    function setPointer(event, active) {
      const rect = canvas.getBoundingClientRect();
      inputRef.current.pointer.x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      inputRef.current.pointer.y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
      inputRef.current.pointer.active = active;
    }

    function handlePointerDown(event) {
      canvas.focus();
      setPointer(event, true);
      inputRef.current.pointer.pressed = true;
      inputRef.current.actionPressed = true;
    }

    function handlePointerMove(event) {
      setPointer(event, inputRef.current.pointer.active);
    }

    function handlePointerUp(event) {
      setPointer(event, false);
      inputRef.current.pointer.released = true;
    }

    function handleKeyDown(event) {
      if (isTypingTarget(event.target)) return;
      if (!CONTROL_KEYS.has(event.code)) return;
      event.preventDefault();
      if (!inputRef.current.keys.has(event.code)) {
        if (event.code === "Space" || event.code === "Enter") inputRef.current.actionPressed = true;
        if (event.code === "KeyR") inputRef.current.restartPressed = true;
        if (event.code.startsWith("Digit"))
          inputRef.current.numberPressed = Number(event.code.replace("Digit", ""));
      }
      inputRef.current.keys.add(event.code);
    }

    function handleKeyUp(event) {
      if (!CONTROL_KEYS.has(event.code)) return;
      event.preventDefault();
      inputRef.current.keys.delete(event.code);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerUp);
    animationId = requestAnimationFrame(frame);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerUp);
      cancelAnimationFrame(animationId);
      mount.removeChild(canvas);
    };
  }, [gamePackage, onScoreSubmit]);

  return (
    <div className="three-preview-wrap" ref={wrapRef}>
      <div
        className="three-preview"
        ref={mountRef}
        role="application"
        aria-label={`${gamePackage.templateName} playable game. Use WASD or arrow keys, Space, touch, or a connected controller.`}
      />
      <div className="player-controls" aria-label="Player controls">
        <span>
          Move <kbd>WASD</kbd> <kbd>Arrows</kbd>
        </span>
        <span>
          Action <kbd>Space</kbd> <kbd>Click</kbd>
        </span>
        <span>
          More <kbd>1-4</kbd> <kbd>R</kbd>
        </span>
      </div>
      <button
        type="button"
        className="fullscreen-button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
        title={isFullscreen ? "Exit full screen" : "Enter full screen"}
      >
        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
      </button>
    </div>
  );
}
