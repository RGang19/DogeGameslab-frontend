const IMAGES = { chicken: 'assets/chicken.png', car: 'assets/car1.png', truck: 'assets/car2.png' };
const loadedImages = {};
['chicken', 'car', 'truck'].forEach(key => {
    if (IMAGES[key]) { const img = new Image(); img.src = IMAGES[key]; img.onload = () => loadedImages[key] = img; }
});

const CONSTANTS = { LANE_HEIGHT: 60, PLAYER_SIZE: 40, CAR_HEIGHT: 35, START_BALANCE: 500, STORAGE_KEY: 'crc_data_v3', SALT: 'chicken_salt_2025' };
const THEMES = [
    { id: 0, name: "Night City", bg: "#2c3e50", road: "#34495e", lane: "#2c3e50", text: "#fff" },
    { id: 1, name: "Sunset", bg: "#2d1b2e", road: "#b65d36", lane: "#cc7a50", text: "#fce" },
    { id: 2, name: "Matrix", bg: "#000000", road: "#003300", lane: "#001100", text: "#0f0" },
    { id: 3, name: "Desert", bg: "#e67e22", road: "#d35400", lane: "#f39c12", text: "#fff" },
    { id: 4, name: "Ice", bg: "#dff9fb", road: "#c7ecee", lane: "#95afc0", text: "#333" },
    { id: 5, name: "Candy", bg: "#ff9ff3", road: "#feca57", lane: "#ff9ff3", text: "#fff" },
    { id: 6, name: "Neon", bg: "#000", road: "#111", lane: "#222", text: "#f0f" },
    { id: 7, name: "Forest", bg: "#2ecc71", road: "#27ae60", lane: "#16a085", text: "#fff" },
    { id: 8, name: "Ocean", bg: "#3498db", road: "#2980b9", lane: "#3498db", text: "#fff" },
    { id: 9, name: "Retro", bg: "#bdc3c7", road: "#7f8c8d", lane: "#95a5a6", text: "#000" }
];

const Storage = {
    data: { balance: CONSTANTS.START_BALANCE, unlockedThemes: [0], currentTheme: 0, leaderboard: [], hash: '' },
    init() {
        const stored = localStorage.getItem(CONSTANTS.STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const check = btoa(parsed.balance + CONSTANTS.SALT);
                if (check === parsed.hash) this.data = parsed;
                else { console.warn("Tampering detected."); this.save(); }
            } catch (e) { console.error("Save error", e); }
        } else this.save();
    },
    save() {
        this.data.hash = btoa(this.data.balance + CONSTANTS.SALT);
        localStorage.setItem(CONSTANTS.STORAGE_KEY, JSON.stringify(this.data));
        UI.updateBalance(this.data.balance);
    },
    updateBalance(amount) { this.data.balance += amount; this.save(); },
    addHistory(entry) { this.data.leaderboard.unshift(entry); this.data.leaderboard = this.data.leaderboard.slice(0, 10); this.save(); },
    unlockTheme(id) { if (!this.data.unlockedThemes.includes(id)) { this.data.unlockedThemes.push(id); this.save(); return true; } return false; }
};

const Game = {
    canvas: null, ctx: null, state: 'START', width: 0, height: 0,
    player: { x: 0, y: 0, lane: 0, maxLane: 0, targetY: 0, isDead: false },
    cars: [], lanes: [], particles: [],
    bet: 10, multiplier: 1.0, difficulty: 1.0, scrollOffset: 0, lastTime: 0,
    
    init() {
        setTimeout(() => {
            document.getElementById('splash-screen').style.opacity = '0';
            setTimeout(() => { document.getElementById('splash-screen').style.display = 'none'; }, 500);
        }, 2200);

        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', (e) => Input.handleKey(e));
        Storage.init(); UI.init(); this.resize();
        requestAnimationFrame((t) => this.loop(t));
    },

    resize() {
        const container = document.getElementById('game-container');
        this.width = container.clientWidth; this.height = container.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr; this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr); this.ctx.font = "bold 30px Arial";
    },

    setBet(val) {
        if (this.state !== 'START') return;
        let v = parseInt(val); if (isNaN(v) || v < 1) v = 1; this.bet = v;
        document.querySelectorAll('.btn-bet').forEach(b => {
            b.classList.remove('active'); if(b.textContent.includes(v)) b.classList.add('active');
        });
        document.getElementById('custom-bet').value = v;
    },

    startGame() {
        if (this.bet > Storage.data.balance) { 
            UI.showAlert("Not enough balance! Watch an Ad."); 
            return; 
        }
        if (this.bet <= 0) return;
        Storage.updateBalance(-this.bet);
        this.resetEntities();
        this.state = 'PLAYING'; this.multiplier = 1.0; this.difficulty = 1.0;
        UI.toggleOverlay('start-overlay', false); UI.setGameControls(true); UI.updateHUD(1.0); playSound('ui');
    },

    resetEntities() {
        this.player = { x: this.width / 2, y: this.height - 100, lane: 0, maxLane: 0, targetX: this.width / 2, targetY: this.height - 100, isDead: false };
        this.scrollOffset = 0; this.cars = []; this.particles = []; this.lanes = [];
        for (let i = 0; i < 20; i++) this.addLane(i);
    },

    addLane(index) {
        const isSafe = index < 2; 
        this.lanes.push({
            y: -index * CONSTANTS.LANE_HEIGHT, isSafe: isSafe,
            direction: Math.random() > 0.5 ? 1 : -1,
            speed: isSafe ? 0 : (Math.random() * 2 + 1.5) + (this.difficulty * 0.5),
            color: isSafe ? THEMES[Storage.data.currentTheme].bg : THEMES[Storage.data.currentTheme].road
        });
    },

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000; this.lastTime = timestamp;
        if (this.state === 'PLAYING') this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    },

    update(dt) {
        this.difficulty += dt * 0.02;
        const visibleLanesStart = this.player.lane - 2; const visibleLanesEnd = this.player.lane + 10;

        for (let i = Math.max(2, visibleLanesStart); i < visibleLanesEnd; i++) {
            if (i >= this.lanes.length) this.addLane(i);
            const lane = this.lanes[i];
            if (!lane.isSafe) {
                const carsInLane = this.cars.filter(c => c.laneIndex === i);
                let canSpawn = true;
                for(let c of carsInLane) {
                    if (lane.direction === 1 && c.x < 150) canSpawn = false;
                    if (lane.direction === -1 && c.x > this.width - 150) canSpawn = false;
                }
                if (canSpawn && Math.random() < 0.025 * this.difficulty) {
                    const isTruck = Math.random() > 0.7;
                    this.cars.push({
                        x: lane.direction === 1 ? -60 : this.width + 60,
                        laneIndex: i,
                        speed: lane.speed * (1 + (Math.random() * 0.3)),
                        width: isTruck ? 90 : 70,
                        type: isTruck ? 'truck' : 'car'
                    });
                }
            }
        }

        this.cars.forEach(car => { const lane = this.lanes[car.laneIndex]; car.x += lane.direction * car.speed * (60 * dt) * 2; });
        this.cars = this.cars.filter(c => c.x > -100 && c.x < this.width + 100);
        this.player.x += (this.player.targetX - this.player.x) * 12 * dt;
        this.player.y += (this.player.targetY - this.player.y) * 12 * dt;
        const desiredCamY = this.player.lane * CONSTANTS.LANE_HEIGHT;
        this.scrollOffset += (desiredCamY - this.scrollOffset) * 5 * dt;

        // Collision
        const pBox = { x: this.player.x - CONSTANTS.PLAYER_SIZE/2 + 12, y: this.player.y - CONSTANTS.PLAYER_SIZE/2 + 12, w: CONSTANTS.PLAYER_SIZE - 24, h: CONSTANTS.PLAYER_SIZE - 24 };
        const getLaneY = (idx) => this.height - 100 - (idx * CONSTANTS.LANE_HEIGHT) + this.scrollOffset;

        for (let car of this.cars) {
            const laneScreenY = getLaneY(car.laneIndex);
            if (Math.abs(laneScreenY - this.player.y) < 30) {
                const cBox = { x: car.x, y: laneScreenY - CONSTANTS.CAR_HEIGHT/2, w: car.width, h: CONSTANTS.CAR_HEIGHT };
                if (pBox.x < cBox.x + cBox.w && pBox.x + pBox.w > cBox.x && pBox.y < cBox.y + cBox.h && pBox.y + pBox.h > cBox.y) {
                    this.handleCrash(); break;
                }
            }
        }
    },

    draw() {
        this.ctx.fillStyle = THEMES[Storage.data.currentTheme].bg;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.lanes.forEach((lane, i) => {
            const screenY = this.height - 100 - (i * CONSTANTS.LANE_HEIGHT) + this.scrollOffset;
            if (screenY > this.height + 100 || screenY < -100) return;
            this.ctx.fillStyle = lane.color;
            this.ctx.fillRect(0, screenY - CONSTANTS.LANE_HEIGHT/2, this.width, CONSTANTS.LANE_HEIGHT - 2);
            if (!lane.isSafe) {
                this.ctx.fillStyle = "rgba(255,255,255,0.2)";
                this.ctx.fillRect(0, screenY - 2, this.width, 4);
                if (i >= 2) {
                    const visualMult = (1 + (i > 1 ? (i - 1) * 0.15 + Math.pow(i-1, 1.1)*0.05 : 0)).toFixed(2);
                    this.ctx.fillStyle = "rgba(255,255,255,0.1)"; this.ctx.font = "12px Arial"; this.ctx.textAlign = "center";
                    this.ctx.fillText(visualMult + "x", this.width / 2, screenY + 20);
                }
            }
        });

        this.ctx.textAlign = "left"; this.ctx.textBaseline = "middle";
        this.cars.forEach(car => {
            const screenY = this.height - 100 - (car.laneIndex * CONSTANTS.LANE_HEIGHT) + this.scrollOffset;
            if (screenY > this.height + 100 || screenY < -100) return;
            const img = loadedImages[car.type]; 
            this.ctx.save();
            this.ctx.translate(car.x + car.width/2, screenY);
            if (this.lanes[car.laneIndex].direction === -1) this.ctx.scale(-1, 1);
            if (img) { this.ctx.drawImage(img, -car.width/2, -CONSTANTS.CAR_HEIGHT/2 - 10, car.width, CONSTANTS.CAR_HEIGHT + 20); } 
            else { this.ctx.font = "30px Arial"; this.ctx.fillText(car.type === 'truck' ? '🚚' : '🚗', -15, 2); }
            this.ctx.restore();
        });

        if (!this.player.isDead) {
            this.ctx.save();
            this.ctx.translate(this.player.x, this.player.y);
            const bounce = Math.abs(Math.sin(Date.now() / 100)) * 5;
            this.ctx.translate(0, -bounce);
            this.ctx.fillStyle = "rgba(0,0,0,0.4)";
            this.ctx.beginPath();
            this.ctx.ellipse(0, 15 + bounce, 15, 5, 0, 0, Math.PI*2);
            this.ctx.fill();
            if (loadedImages.chicken) { this.ctx.drawImage(loadedImages.chicken, -25, -25, 50, 60); } 
            else { this.ctx.font = "35px Arial"; this.ctx.textAlign = "center"; this.ctx.textBaseline = "middle"; this.ctx.fillText("🐔", 0, 0); }
            this.ctx.restore();
        } else {
            this.particles.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.alpha -= 0.02;
                this.ctx.globalAlpha = p.alpha; this.ctx.fillStyle = p.color;
                this.ctx.fillRect(p.x, p.y, p.size, p.size);
                this.ctx.globalAlpha = 1.0;
            });
        }
    },

    handleCrash() {
        this.state = 'CRASHED'; this.player.isDead = true; playSound('crash');
        for(let i=0; i<30; i++) {
            this.particles.push({ x: this.player.x, y: this.player.y, vx: (Math.random() - 0.5) * 15, vy: (Math.random() - 0.5) * 15, color: Math.random() > 0.5 ? '#fff' : '#e74c3c', size: Math.random() * 6 + 2, alpha: 1.0 });
        }
        setTimeout(() => {
            document.getElementById('crash-mult').innerText = this.multiplier.toFixed(2) + 'x';
            document.getElementById('crash-loss').innerText = this.bet;
            UI.setGameControls(false); UI.toggleOverlay('crash-overlay', true);
            Storage.addHistory({ result: 'LOSS', amount: this.bet, mult: this.multiplier, date: new Date().toLocaleTimeString() });
        }, 800);
    },

    cashOut() {
        if (this.state !== 'PLAYING') return;
        if (this.multiplier < 1.20) return;
        this.state = 'WIN'; playSound('cashout');
        const winAmount = Math.floor(this.bet * this.multiplier);
        Storage.updateBalance(winAmount);
        document.getElementById('win-amount').innerText = winAmount;
        document.getElementById('win-mult').innerText = this.multiplier.toFixed(2) + 'x';
        UI.setGameControls(false); UI.toggleOverlay('win-overlay', true);
        Storage.addHistory({ result: 'WIN', amount: winAmount, mult: this.multiplier, date: new Date().toLocaleTimeString() });
        for(let i=0; i<60; i++) {
            this.particles.push({ x: this.width/2, y: this.height/2, vx: (Math.random() - 0.5) * 25, vy: (Math.random() - 0.5) * 25, color: CONSTANTS.ACCENT_COLOR, size: 6, alpha: 1 });
        }
    },

    resetGame() {
        this.state = 'START';
        UI.toggleOverlay('crash-overlay', false); UI.toggleOverlay('win-overlay', false); UI.toggleOverlay('start-overlay', true);
    },
    
    resetData() {
        UI.showConfirm("Are you sure you want to clear all data and progress?", () => {
            localStorage.removeItem(CONSTANTS.STORAGE_KEY);
            location.reload();
        });
    },
    
    downloadScreenshot() { const link = document.createElement('a'); link.download = `ChickenWin_${Date.now()}.png`; link.href = this.canvas.toDataURL(); link.click(); },
    toggleSettings() {
        const el = document.getElementById('settings-overlay');
        if(el.classList.contains('hidden')) { UI.renderThemes(); UI.toggleOverlay('settings-overlay', true); }
        else UI.toggleOverlay('settings-overlay', false);
    },
    toggleLeaderboard() {
        const el = document.getElementById('leaderboard-overlay');
        if(el.classList.contains('hidden')) { UI.renderLeaderboard(); UI.toggleOverlay('leaderboard-overlay', true); }
        else UI.toggleOverlay('leaderboard-overlay', false);
    }
};

const Input = {
    handleKey(e) {
        if (Game.state !== 'PLAYING') return;
        switch(e.key) {
            case 'ArrowUp': case 'w': case ' ': this.action('up'); break;
            case 'ArrowLeft': case 'a': this.action('left'); break;
            case 'ArrowRight': case 'd': this.action('right'); break;
            case 'c': Game.cashOut(); break;
        }
    },
    action(dir) {
        if (Game.state !== 'PLAYING') return;
        if (dir === 'up') {
            Game.player.lane++; playSound('jump');
            if (Game.player.lane > Game.player.maxLane) {
                Game.player.maxLane = Game.player.lane;
                if (Game.player.lane >= 2) {
                    const l = Game.player.lane;
                    const increase = (l - 1) * 0.15 + Math.pow(l-1, 1.1) * 0.05;
                    Game.multiplier = 1 + increase;
                    UI.updateHUD(Game.multiplier);
                    if (Game.multiplier > 2.0) Game.scrollOffset += (Math.random()-0.5)*10;
                }
            }
        } else if (dir === 'left') Game.player.targetX = Math.max(30, Game.player.targetX - 40);
        else if (dir === 'right') Game.player.targetX = Math.min(Game.width - 30, Game.player.targetX + 40);
    }
};

const UI = {
    currentCallback: null,

    init() { this.updateBalance(Storage.data.balance); },
    
    // --- CUSTOM MODAL FUNCTIONS ---
    showAlert(msg, type = 'info') {
        const modal = document.getElementById('custom-modal');
        const icon = document.getElementById('modal-icon');
        const cancelBtn = document.getElementById('btn-modal-cancel');
        
        document.getElementById('modal-msg').innerText = msg;
        document.getElementById('modal-title').innerText = type === 'confirm' ? 'CONFIRM' : 'NOTICE';
        icon.innerText = type === 'confirm' ? '❓' : '⚠️';
        
        // Reset Buttons
        cancelBtn.classList.add('hidden');
        this.currentCallback = null;
        
        UI.toggleOverlay('custom-modal', true);
    },

    showConfirm(msg, callback) {
        this.showAlert(msg, 'confirm');
        document.getElementById('btn-modal-cancel').classList.remove('hidden');
        this.currentCallback = callback;
    },

    confirmModal() {
        if (this.currentCallback) this.currentCallback();
        UI.closeModal();
    },

    closeModal() {
        UI.toggleOverlay('custom-modal', false);
        this.currentCallback = null;
    },
    // -------------------------------

    updateBalance(val) {
        document.getElementById('ui-balance').innerText = val;
        if (Game.state === 'PLAYING') {
            const currentWin = Math.floor(Game.bet * Game.multiplier);
            const btn = document.getElementById('btn-cashout');
            if(Game.multiplier >= 1.20) {
                document.getElementById('cashout-val').innerText = '₹' + currentWin;
                btn.disabled = false;
            } else {
                document.getElementById('cashout-val').innerText = 'LOCKED';
                btn.disabled = true;
            }
        }
    },
    updateHUD(mult) {
        const hudMult = document.getElementById('hud-mult');
        hudMult.innerText = mult.toFixed(2) + 'x';
        hudMult.style.transform = "scale(1.2)"; setTimeout(() => hudMult.style.transform = "scale(1)", 100);
        
        const btn = document.getElementById('btn-cashout');
        const valDisplay = document.getElementById('cashout-val');
        
        if (mult < 1.20) {
            valDisplay.innerText = "LOCKED";
            btn.disabled = true;
        } else {
            valDisplay.innerText = '₹' + Math.floor(Game.bet * mult);
            btn.disabled = false;
        }

        const msg = document.getElementById('hud-msg');
        let txt = "";
        if (mult >= 1.2) txt = "Unlocked! 🔓"; 
        if (mult > 1.5) txt = "Awesome! 🔥";
        if (mult > 2.0) txt = "JACKPOT! 💎";
        
        if(txt) {
            msg.innerText = txt; 
            msg.classList.add('show');
            setTimeout(() => msg.classList.remove('show'), 1500);
        }
    },
    toggleOverlay(id, show) {
        const el = document.getElementById(id);
        if (show) el.classList.remove('hidden'); else el.classList.add('hidden');
    },
    setGameControls(active) {
        document.getElementById('bet-ui').style.display = active ? 'none' : 'flex';
        const btn = document.getElementById('btn-cashout');
        if(active) {
            btn.disabled = true; document.getElementById('cashout-val').innerText = 'LOCKED';
        } else {
            btn.disabled = true; document.getElementById('cashout-val').innerText = 'LOCKED';
        }
    },
    renderThemes() {
        const container = document.getElementById('theme-container'); container.innerHTML = '';
        THEMES.forEach(t => {
            const div = document.createElement('div'); div.className = 'theme-item'; div.style.background = t.bg; div.title = t.name;
            if (!Storage.data.unlockedThemes.includes(t.id)) div.classList.add('locked');
            if (Storage.data.currentTheme === t.id) div.classList.add('active');
            div.onclick = () => { 
                if (Storage.data.unlockedThemes.includes(t.id)) { 
                    Storage.data.currentTheme = t.id; Storage.save(); this.renderThemes(); 
                } else {
                    UI.showAlert("Locked! Watch an ad to unlock.");
                }
            };
            container.appendChild(div);
        });
    },
    renderLeaderboard() {
        const list = document.getElementById('leaderboard-list'); list.innerHTML = '';
        if (Storage.data.leaderboard.length === 0) { list.innerHTML = '<li>No games played yet.</li>'; return; }
        Storage.data.leaderboard.forEach(entry => {
            const li = document.createElement('li'); li.style.borderBottom = '1px solid #333'; li.style.padding = '5px 0';
            const color = entry.result === 'WIN' ? 'var(--success-color)' : 'var(--danger-color)';
            li.innerHTML = `<span style="color:${color}; font-weight:bold">${entry.result}</span> <span style="float:right">${entry.date}</span><br> ₹${entry.amount} @ ${entry.mult.toFixed(2)}x`;
            list.appendChild(li);
        });
    }
};

const Ads = {
    watchAd(rewardType) {
        document.querySelectorAll('.overlay').forEach(el => { if(el.id !== 'ad-overlay') el.classList.add('hidden'); });
        UI.toggleOverlay('ad-overlay', true);
        const bar = document.getElementById('ad-progress-fill'); const timerTxt = document.getElementById('ad-timer');
        let width = 0; let timeLeft = 5; bar.style.width = '0%';
        const interval = setInterval(() => {
            width += 2; timeLeft = 5 - Math.floor(width / 20); bar.style.width = width + '%'; timerTxt.innerText = timeLeft + 's';
            if (width >= 100) { clearInterval(interval); this.completeAd(rewardType); }
        }, 100);
    },
    completeAd(type) {
        UI.toggleOverlay('ad-overlay', false); playSound('coin');
        if (type === 'money') {
            Storage.updateBalance(100); 
            UI.showAlert("Success! ₹100 added.");
            if (Game.state === 'CRASHED') UI.toggleOverlay('crash-overlay', true); else if (Game.state === 'START') UI.toggleOverlay('start-overlay', true);
        } else if (type === 'theme') {
            const locked = THEMES.filter(t => !Storage.data.unlockedThemes.includes(t.id));
            if (locked.length > 0) { 
                const random = locked[Math.floor(Math.random() * locked.length)]; 
                Storage.unlockTheme(random.id); 
                UI.showAlert(`Unlocked: ${random.name}!`); 
                Game.toggleSettings(); 
            } else { 
                UI.showAlert("All themes unlocked!"); 
                Game.toggleSettings(); 
            }
        }
    }
};

window.onload = () => Game.init();

//Audio Script

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const playSound = (type) => {
        if (localStorage.getItem('crc_mute') === 'true') return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === 'jump') {
            osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1); osc.start(now); osc.stop(now + 0.1);
        } else if (type === 'crash') {
            osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(10, now + 0.3); gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); osc.start(now); osc.stop(now + 0.3);
        } else if (type === 'cashout') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.linearRampToValueAtTime(800, now + 0.1); osc.frequency.linearRampToValueAtTime(1200, now + 0.3); gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0, now + 0.4); osc.start(now); osc.stop(now + 0.4);
        } else if (type === 'coin') {
            osc.type = 'sine'; osc.frequency.setValueAtTime(1000, now); osc.frequency.exponentialRampToValueAtTime(1500, now + 0.1); gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.1); osc.start(now); osc.stop(now + 0.1);
        }
    };