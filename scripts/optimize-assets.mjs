#!/usr/bin/env node
/**
 * Resize + compress bundled PNG/JPG assets for faster loads.
 * Run: npm run optimize:assets
 */
import { execSync } from "node:child_process";
import { existsSync, statSync, unlinkSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "src/assets");

function sizeKb(path) {
  return (statSync(path).size / 1024).toFixed(1);
}

function hasCmd(cmd) {
  try {
    execSync(`command -v ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasCwebp = hasCmd("cwebp");

/** maxPx = longest edge (sips -Z) */
const jobs = [
  // Current mobile home artwork
  ["background.webp", 2800],
  ["Frame0.webp", 900],
  ["Frame1.webp", 360],
  ["Frame2.webp", 360],
  ["Frame3.webp", 360],
  ["Frame4.webp", 360],
  ["Frame5.webp", 360],
  ["left1.webp", 480],
  ["right1.webp", 480],
  ["center1.webp", 480],
  ["chatAvatarLeft.webp", 260],
  ["chatAvatarRight.webp", 260],
  ["dogeGameCartoonGlove.webp", 256],
  ["robot.webp", 1300],
  // Navigation and category icons
  ["categoryAction.webp", 128],
  ["categoryArcade.webp", 128],
  ["categoryPuzzle.webp", 128],
  ["categorySports.webp", 128],
  ["categoryStrategy.webp", 128],
  ["navHome.webp", 128],
  ["navProfile.webp", 128],
  ["navRanks.webp", 128],
  ["navTemplates.webp", 128],
  // Shared brand artwork
  ["creatorStudioLogo.webp", 320],
  // Create suggestions
  ["create-suggestion-cyberpunk.webp", 480],
  ["create-suggestion-farm.webp", 480],
  // Leaderboard avatars
  ["leaderboard-rank-1.webp", 128],
  ["leaderboard-rank-2.webp", 128],
  ["leaderboard-rank-3.webp", 128],
];

function toWebp(pngPath, quality = 82) {
  if (!hasCwebp) return null;
  const webpPath = pngPath.replace(/\.png$/i, ".webp");
  execSync(`cwebp -q ${quality} -m 6 -mt -quiet "${pngPath}" -o "${webpPath}"`, {
    stdio: "ignore",
  });
  return webpPath;
}

function optimize(file, maxPx) {
  const path = join(assets, file);
  if (!existsSync(path)) {
    console.log(`skip (missing): ${file}`);
    return;
  }

  const before = sizeKb(path);
  const dimOut = execSync(`sips -g pixelWidth -g pixelHeight "${path}"`, { encoding: "utf8" });
  const width = Number(dimOut.match(/pixelWidth: (\d+)/)?.[1] ?? 0);
  const height = Number(dimOut.match(/pixelHeight: (\d+)/)?.[1] ?? 0);
  const longest = Math.max(width, height);

  if (longest > maxPx) {
    execSync(`sips -Z ${maxPx} "${path}"`, { stdio: "ignore" });
  }

  const ext = extname(file).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") {
    execSync(`sips -s format jpeg -s formatOptions 80 "${path}" --out "${path}"`, {
      stdio: "ignore",
    });
  } else if (ext === ".png") {
    execSync(`sips -s format png "${path}" --out "${path}"`, { stdio: "ignore" });
  }

  let after = sizeKb(path);
  console.log(`resize ${file}: ${before}KB -> ${after}KB`);

  if (ext === ".png" && hasCwebp && Number(after) > 24) {
    const webpPath = toWebp(path, 82);
    if (webpPath && existsSync(webpPath) && Number(sizeKb(webpPath)) < Number(after)) {
      unlinkSync(path);
      console.log(`  webp ${file.replace(/\.png$/i, ".webp")}: ${sizeKb(webpPath)}KB (removed png)`);
    }
  }
}

console.log(`Optimizing assets in ${assets}${hasCwebp ? " (webp enabled)" : ""}…\n`);

for (const [file, maxPx] of jobs) optimize(file, maxPx);

console.log("\nAsset optimization complete.");
