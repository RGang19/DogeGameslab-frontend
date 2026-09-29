import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    console.log("Fetching repository file tree from GitHub API (master branch)...");
    const res = await fetch("https://api.github.com/repos/CoolDude2349/Offline-HTML-Games-Pack/git/trees/master?recursive=1");
    if (!res.ok) {
      throw new Error(`Failed to fetch tree: ${res.statusText}`);
    }
    const data = await res.json();
    const htmlFiles = data.tree.filter(node => node.path.endsWith('.html') && node.type === 'blob');
    console.log(`Found ${htmlFiles.length} HTML game files in the repository.`);
    
    // Save the list of files to a local JSON file for reference
    const outputPath = path.join(__dirname, 'games_list.json');
    fs.writeFileSync(outputPath, JSON.stringify(htmlFiles, null, 2));
    console.log(`Saved games list to ${outputPath}`);
  } catch (error) {
    console.error("Error fetching repository contents:", error);
  }
}

main();
