import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAMES_LIST_PATH = path.join(__dirname, 'games_list.json');
const PUBLIC_TEMPLATES_DIR = path.resolve(__dirname, '../public/templates');
const TEMPLATES_TS_PATH = path.resolve(__dirname, '../src/lib/templates.ts');
const STUDIO_META_TS_PATH = path.resolve(__dirname, '../src/lib/studio-meta.ts');

const CATEGORIES = ["Arcade", "Puzzle", "Action", "Racing", "Sports", "Casual", "Strategy", "Retro"];

function cleanGameName(filename) {
  let name = filename.replace(/\.html$/, '');
  name = name.replace(/([A-Z0-9])/g, ' $1').trim(); // Add space before uppercase/digits
  return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getCategoryFromName(name) {
  const lowercase = name.toLowerCase();
  if (lowercase.includes('race') || lowercase.includes('car') || lowercase.includes('motorcycle') || lowercase.includes('drift')) return 'Racing';
  if (lowercase.includes('soccer') || lowercase.includes('tennis') || lowercase.includes('basketball') || lowercase.includes('sport') || lowercase.includes('billiards') || lowercase.includes('ball')) return 'Sports';
  if (lowercase.includes('puzzle') || lowercase.includes('sudoku') || lowercase.includes('match') || lowercase.includes('2048') || lowercase.includes('block') || lowercase.includes('candy')) return 'Puzzle';
  if (lowercase.includes('shoot') || lowercase.includes('bullet') || lowercase.includes('zombie') || lowercase.includes('war') || lowercase.includes('arena') || lowercase.includes('fight') || lowercase.includes('clash')) return 'Action';
  if (lowercase.includes('defense') || lowercase.includes('strategy') || lowercase.includes('chess')) return 'Strategy';
  if (lowercase.includes('retro') || lowercase.includes('snake') || lowercase.includes('pacman')) return 'Retro';
  if (lowercase.includes('runner') || lowercase.includes('run') || lowercase.includes('jump') || lowercase.includes('climb') || lowercase.includes('bird')) return 'Arcade';
  return CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buffer));
}

async function main() {
  try {
    if (!fs.existsSync(GAMES_LIST_PATH)) {
      throw new Error(`games_list.json not found at ${GAMES_LIST_PATH}`);
    }

    const allFiles = JSON.parse(fs.readFileSync(GAMES_LIST_PATH, 'utf8'));
    
    // Filter for games inside "offline/" folder and under 12MB (12582912 bytes)
    const candidates = allFiles.filter(node => 
      node.path.startsWith('offline/') && 
      node.size < 12582912 && 
      node.size > 10000 // avoid empty files
    );

    console.log(`Found ${candidates.length} candidate games under 12MB.`);
    
    // Select exactly 100 games
    const selectedGames = candidates.slice(0, 100);
    console.log(`Selected ${selectedGames.length} games to download and register.`);

    const newTemplates = [];
    const newUrls = {};
    const newThumbnails = {};

    for (let i = 0; i < selectedGames.length; i++) {
      const gameNode = selectedGames[i];
      const origFileName = path.basename(gameNode.path);
      const gameId = 'offline-' + origFileName.replace(/\.html$/, '').toLowerCase();
      const cleanName = cleanGameName(origFileName);
      const category = getCategoryFromName(cleanName);
      
      console.log(`[${i + 1}/100] Processing ${cleanName} (${gameId})...`);

      const targetDir = path.join(PUBLIC_TEMPLATES_DIR, gameId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const rawUrl = `https://raw.githubusercontent.com/CoolDude2349/Offline-HTML-Games-Pack/master/${encodeURIComponent(gameNode.path)}`;
      const destPath = path.join(targetDir, 'index.html');

      try {
        await downloadFile(rawUrl, destPath);
      } catch (err) {
        console.error(`Error downloading ${cleanName}:`, err.message);
        continue;
      }

      // Add to templates list
      newTemplates.push({
        id: gameId,
        name: cleanName,
        category: category,
        time: "Ready",
        reliability: "100%",
        accent: "#35e8ff",
        colors: ["#35e8ff", "#ffd166", "#67ffb4"],
        mechanic: `Classic ${cleanName} offline HTML5 edition. Survive and score high.`,
        controls: "Mouse, keyboard, or touch controls",
        assets: "HTML5 game engine assets",
        engine: "construct", // Serves via Html5Preview
        difficulty: {
          easy: { speedMultiplier: 0.8 },
          normal: { speedMultiplier: 1.0 },
          hard: { speedMultiplier: 1.2 }
        }
      });

      newUrls[gameId] = `/templates/${gameId}/index.html`;
      newThumbnails[gameId] = `/thumbnails/flappy-cover.png`; // Map to flappy thumbnail by default, or we can use generic template cover
    }

    console.log("Successfully downloaded all game files.");

    // Write new templates list file or append to templates.ts
    // Let's modify templates.ts to include the new game templates.
    let templatesContent = fs.readFileSync(TEMPLATES_TS_PATH, 'utf8');
    // Find where the rawGameTemplates array ends or starts
    const arrayStartMatch = templatesContent.match(/const rawGameTemplates = \[\s*\{/);
    if (!arrayStartMatch) {
      throw new Error("Could not find rawGameTemplates array in templates.ts");
    }

    // Parse the existing templates.ts and inject our new templates
    // A clean way is to export both rawGameTemplates and new offline games.
    // Let's insert our templates directly inside the array!
    const insertionIndex = templatesContent.indexOf('const rawGameTemplates = [') + 'const rawGameTemplates = ['.length;
    const templatesStr = '\n' + newTemplates.map(t => `  ${JSON.stringify(t, null, 4)},`).join('\n') + '\n';
    templatesContent = templatesContent.slice(0, insertionIndex) + templatesStr + templatesContent.slice(insertionIndex);
    fs.writeFileSync(TEMPLATES_TS_PATH, templatesContent, 'utf8');
    console.log("Updated templates.ts with new games.");

    // Update studio-meta.ts
    let metaContent = fs.readFileSync(STUDIO_META_TS_PATH, 'utf8');
    
    // Inject construct urls
    const urlsInsertIndex = metaContent.indexOf('export const constructGameUrls: Record<string, string> = {') + 'export const constructGameUrls: Record<string, string> = {'.length;
    const urlsStr = '\n' + Object.entries(newUrls).map(([id, url]) => `  "${id}": "${url}",`).join('\n') + '\n';
    metaContent = metaContent.slice(0, urlsInsertIndex) + urlsStr + metaContent.slice(urlsInsertIndex);

    // Inject thumbnails
    const thumbsInsertIndex = metaContent.indexOf('export const templateThumbnails: Record<string, string> = {') + 'export const templateThumbnails: Record<string, string> = {'.length;
    const thumbsStr = '\n' + Object.entries(newThumbnails).map(([id, thumb]) => `  "${id}": "${thumb}",`).join('\n') + '\n';
    metaContent = metaContent.slice(0, thumbsInsertIndex) + thumbsStr + metaContent.slice(thumbsInsertIndex);

    fs.writeFileSync(STUDIO_META_TS_PATH, metaContent, 'utf8');
    console.log("Updated studio-meta.ts with new games mapping.");

  } catch (error) {
    console.error("Error running download script:", error);
  }
}

main();
