const app = {
            config: {
                currency: '', 
                startingBalance: 0,
                minWithdraw: 5000,
                maxWithdraw: 50000,
                cards: {
                    standard: { name: 'Standard', cost: 10, payout: [0, 0, 2, 5, 10, 50], color: '#3b82f6' },
                    silver: { name: 'Silver 7s', cost: 50, payout: [0, 0, 5, 10, 25, 100], color: '#94a3b8' },
                    gold: { name: 'Gold Rush', cost: 100, payout: [0, 0, 10, 50, 100, 500], color: '#eab308' },
                    platinum: { name: 'Platinum', cost: 500, payout: [0, 0, 5, 100, 1000, 5000], color: '#a855f7' } 
                },
                sounds: true
            },
            state: {
                gameActive: false,
                forcedWin: false,
                betAmount: 10,
                selectedCardType: 'standard',
                currentOutcome: null,
                batchResults: []
            },

            // --- Theme Manager ---
            themes: {
                list: [
                    { id: 'gold', name: 'Neon Gold', primary: '#ffd700', secondary: '#00f3ff', locked: false },
                    { id: 'ruby', name: 'Cyber Ruby', primary: '#ff0055', secondary: '#ffcc00', locked: false },
                    { id: 'matrix', name: 'Matrix Green', primary: '#00ff41', secondary: '#003b00', locked: false },
                    { id: 'ocean', name: 'Deep Ocean', primary: '#0066ff', secondary: '#00ffff', locked: true },
                    { id: 'purple', name: 'Ultra Violet', primary: '#bf00ff', secondary: '#ff00ff', locked: true },
                    { id: 'sunset', name: 'Sunset Blvd', primary: '#ff4d00', secondary: '#ffcc00', locked: true },
                    { id: 'teal', name: 'Electric Teal', primary: '#008080', secondary: '#00ffcc', locked: true },
                    { id: 'mono', name: 'Monochrome', primary: '#ffffff', secondary: '#808080', locked: true },
                    { id: 'hotpink', name: 'Hot Pink', primary: '#ff1493', secondary: '#ff69b4', locked: true },
                    { id: 'lime', name: 'Acid Lime', primary: '#ccff00', secondary: '#000000', locked: true }
                ],
                unlocked: ['gold', 'ruby', 'matrix'], 
                current: 'gold',

                init: function() {
                    const saved = localStorage.getItem('scratcher_themes');
                    const savedCurrent = localStorage.getItem('scratcher_current_theme');
                    if(saved) this.unlocked = JSON.parse(saved);
                    if(savedCurrent) this.apply(savedCurrent);
                    else this.apply('gold');
                },
                apply: function(id) {
                    const t = this.list.find(x => x.id === id);
                    if(!t) return;
                    this.current = id;
                    document.documentElement.style.setProperty('--theme-primary', t.primary);
                    document.documentElement.style.setProperty('--theme-secondary', t.secondary);
                    localStorage.setItem('scratcher_current_theme', id);
                    app.ui.renderThemes();
                },
                unlock: function(id) {
                    if(!this.unlocked.includes(id)) {
                        this.unlocked.push(id);
                        localStorage.setItem('scratcher_themes', JSON.stringify(this.unlocked));
                        this.apply(id);
                        app.ui.notify("Theme Unlocked!", 'success');
                    }
                }
            },

            // --- Ad Manager ---
            ads: {
                activeCallback: null,
                timer: 10,
                interval: null,
                play: function(type, payload) {
                    this.activeCallback = { type, payload };
                    this.timer = 10;
                    document.getElementById('ad-timer').innerText = this.timer;
                    document.getElementById('ad-modal').classList.remove('hidden');
                    this.interval = setInterval(() => {
                        this.timer--;
                        document.getElementById('ad-timer').innerText = this.timer;
                        if(this.timer <= 0) this.finish();
                    }, 1000);
                },
                finish: function() {
                    clearInterval(this.interval);
                    document.getElementById('ad-modal').classList.add('hidden');
                    if(this.activeCallback) {
                        const { type, payload } = this.activeCallback;
                        if(type === 'add_funds') app.wallet.addFunds(500, 'DEPOSIT', 'Ad Reward');
                        else if (type === 'withdraw') app.wallet.processWithdraw();
                        else if (type === 'unlock_theme') app.themes.unlock(payload);
                        this.activeCallback = null;
                    }
                }
            },

            // --- Audio System ---
            audio: {
                ctx: null,
                init: function() {
                    window.AudioContext = window.AudioContext || window.webkitAudioContext;
                    this.ctx = new AudioContext();
                },
                playTone: function(freq, type, duration) {
                    if (!app.config.sounds || !this.ctx) return;
                    const osc = this.ctx.createOscillator();
                    const gain = this.ctx.createGain();
                    osc.type = type;
                    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
                    osc.connect(gain);
                    gain.connect(this.ctx.destination);
                    osc.start();
                    osc.stop(this.ctx.currentTime + duration);
                },
                sfx: {
                    click: () => app.audio.playTone(800, 'sine', 0.1),
                    win: () => { [440, 554, 659].forEach((f, i) => setTimeout(() => app.audio.playTone(f, 'square', 0.3), i*100)); }
                }
            },

            // --- RNG & Logic ---
            math: {
                random: () => {
                    const arr = new Uint32Array(1);
                    window.crypto.getRandomValues(arr);
                    return arr[0] / (0xffffffff + 1);
                }
            },

            // --- Wallet ---
            wallet: {
                balance: 0,
                history: [],
                load: function() {
                    const stored = localStorage.getItem('scratcher_wallet');
                    this.balance = stored ? parseFloat(JSON.parse(stored).balance) : app.config.startingBalance;
                    this.history = JSON.parse(localStorage.getItem('scratcher_history')) || [];
                    app.ui.updateBalance();
                    app.ui.renderHistory();
                },
                save: function() {
                    localStorage.setItem('scratcher_wallet', JSON.stringify({ balance: this.balance }));
                    localStorage.setItem('scratcher_history', JSON.stringify(this.history));
                },
                deduct: function(amount) {
                    if (this.balance >= amount) {
                        this.balance -= amount;
                        this.save();
                        app.ui.updateBalance();
                        return true;
                    }
                    return false;
                },
                addFunds: function(amount, type = 'WIN', detail = 'Scratch Win', silent = false) {
                    this.balance += amount;
                    this.logTransaction(type, amount, detail);
                    this.save();
                    app.ui.updateBalance();
                    if(!silent) {
                        app.ui.notify(`${amount} Added successfully!`, 'success');
                        app.audio.sfx.win();
                    }
                },
                initiateWithdraw: function() {
                    if(this.balance < app.config.minWithdraw) return app.ui.notify(`Minimum withdrawal is ${app.config.minWithdraw}`, 'error');
                    if(this.balance > app.config.maxWithdraw) return app.ui.notify(`Maximum withdrawal is ${app.config.maxWithdraw}`, 'error');
                    app.ads.play('withdraw');
                },
                processWithdraw: function() {
                    const amount = this.balance;
                    this.balance = 0;
                    this.logTransaction('WITHDRAW', amount, 'To Bank Account');
                    this.save();
                    app.ui.updateBalance();
                    app.ui.closeModals();
                    app.ui.notify(`Withdrawal Success! ${amount} sent.`, 'success');
                },
                logTransaction: function(type, amount, detail) {
                    this.history.unshift({ time: new Date().toLocaleTimeString(), type, amount, detail });
                    if (this.history.length > 50) this.history.pop();
                    this.save();
                    app.ui.renderHistory();
                },
                reset: function() {
                    this.balance = 0;
                    this.history = [];
                    this.save();
                    app.ui.updateBalance();
                    app.ui.renderHistory();
                    app.ui.notify("Wallet Reset", 'info');
                }
            },

            // --- Game Logic ---
            game: {
                // 3D Fluent Emojis (Microsoft) URLs
                symbols: [
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Cherries/3D/cherries_3d.png',
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Lemon/3D/lemon_3d.png',
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Grapes/3D/grapes_3d.png',
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Gem%20stone/3D/gem_stone_3d.png',
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Bell/3D/bell_3d.png',
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Crown/3D/crown_3d.png',
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Four%20leaf%20clover/3D/four_leaf_clover_3d.png',
                    'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/Star/3D/star_3d.png'
                ],
                rtp: 0.30, 

                adjustBet: function(delta) {
                    let newBet = app.state.betAmount + delta;
                    if (newBet < 10) newBet = 10;
                    this.updateBet(newBet);
                },
                setBet: function(val) {
                    let newBet = parseInt(val);
                    if (isNaN(newBet) || newBet < 10) newBet = 10;
                    if (newBet > 10000) newBet = 10000;
                    this.updateBet(newBet);
                },
                updateBet: function(newBet) {
                    app.state.betAmount = newBet;
                    document.getElementById('bet-input').value = newBet;
                },
                changeCardType: function(type) {
                    app.state.selectedCardType = type;
                    const cost = app.config.cards[type].cost;
                    if (app.state.betAmount < cost) {
                        this.updateBet(cost);
                    }
                },
                checkLineWin: function(grid) {
                    const lines = [
                        [0,1,2], [3,4,5], [6,7,8], // Rows
                        [0,3,6], [1,4,7], [2,5,8], // Cols
                        [0,4,8], [2,4,6]           // Diagonals
                    ];
                    for (let line of lines) {
                        const [a, b, c] = line;
                        if (grid[a] && grid[a] === grid[b] && grid[a] === grid[c]) return true;
                    }
                    return false;
                },
                generateOutcome: function(bet, cardConfig, forceResult = null) {
                    let isWin;
                    if (forceResult !== null) {
                        isWin = forceResult;
                    } else {
                        isWin = app.state.forcedWin || (app.math.random() < this.rtp);
                    }
                    app.state.forcedWin = false;
                    
                    let grid = new Array(9).fill(null);
                    let winSym = null;
                    let multiplier = 0;

                    if (isWin) {
                        const payouts = cardConfig.payout;
                        const rand = app.math.random();
                        if (rand > 0.95) multiplier = payouts[5];
                        else if (rand > 0.80) multiplier = payouts[4];
                        else multiplier = payouts[2];

                        winSym = this.symbols[Math.floor(Math.random() * this.symbols.length)];
                        const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
                        const line = lines[Math.floor(Math.random() * lines.length)];
                        line.forEach(i => grid[i] = winSym);
                        
                        for(let i=0; i<9; i++) {
                            if(grid[i] === null) {
                                let s;
                                do { s = this.symbols[Math.floor(Math.random() * this.symbols.length)]; } 
                                while(s === winSym);
                                grid[i] = s;
                            }
                        }
                    } else {
                        let safe = false;
                        while(!safe) {
                            for(let i=0; i<9; i++) grid[i] = this.symbols[Math.floor(Math.random() * this.symbols.length)];
                            if (!this.checkLineWin(grid)) safe = true;
                        }
                    }

                    return { win: isWin, amount: isWin ? bet * multiplier : 0, grid: grid, symbol: winSym };
                },
                buyCard: function() {
                    if (app.state.gameActive) return;
                    const cost = app.state.betAmount;
                    const cardConfig = app.config.cards[app.state.selectedCardType];
                    
                    if (cost < cardConfig.cost) return app.ui.notify(`Min bet: ${cardConfig.cost}`, 'error');
                    if (!app.wallet.deduct(cost)) return app.ui.openWallet();

                    app.state.gameActive = true;
                    app.ui.toggleControls(false);
                    app.ui.hideResult();
                    app.audio.sfx.click();
                    
                    app.state.currentOutcome = this.generateOutcome(cost, cardConfig, null);
                    
                    const el = document.getElementById('card-underlayer');
                    el.innerHTML = '';
                    app.state.currentOutcome.grid.forEach(s => {
                        const cell = document.createElement('div');
                        cell.className = 'flex items-center justify-center bg-gray-800 rounded shadow-inner overflow-hidden';
                        // RENDER 3D IMAGE instead of text
                        cell.innerHTML = `<img src="${s}" class="w-12 h-12 object-contain drop-shadow-lg filter brightness-110">`;
                        el.appendChild(cell);
                    });

                    app.canvas.reset();
                    app.ui.notify("Scratch to reveal!", 'info');
                },
                buyBatch: function(count) {
                    if (app.state.gameActive) return;
                    const costPerCard = app.state.betAmount;
                    const totalCost = costPerCard * count;
                    const cardConfig = app.config.cards[app.state.selectedCardType];

                    if (costPerCard < cardConfig.cost) return app.ui.notify(`Min bet: ${cardConfig.cost}`, 'error');
                    if (!app.wallet.deduct(totalCost)) return app.ui.openWallet();

                    app.audio.sfx.click();
                    app.state.batchResults = [];
                    
                    // Determine Batch Luck Profile
                    const luck = Math.random();
                    let winRate;
                    
                    if (luck > 0.90) { // 10% Super Luck
                        winRate = 0.7 + (Math.random() * 0.2); 
                    } else if (luck > 0.60) { // 30% Good Luck
                        winRate = 0.4 + (Math.random() * 0.2);
                    } else { // 60% Normal Luck
                        winRate = 0.2 + (Math.random() * 0.2);
                    }

                    const targetWins = Math.round(count * winRate);
                    let results = Array(count).fill(false);
                    for(let i=0; i<targetWins && i<count; i++) results[i] = true;
                    
                    for (let i = results.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [results[i], results[j]] = [results[j], results[i]];
                    }

                    // Max Win Cap Logic
                    let maxWinCap = 100; // Default for 5, 10, 20
                    if (count === 100) maxWinCap = 40;
                    else if (count === 50) maxWinCap = 60;

                    for(let i=0; i<count; i++) {
                        let res = this.generateOutcome(costPerCard, cardConfig, results[i]);
                        // Apply dynamic cap
                        if(res.win && res.amount > maxWinCap) res.amount = maxWinCap;
                        app.state.batchResults.push(res);
                    }
                    app.ui.openBatchResults();
                },
                finishRound: function() {
                    if (!app.state.gameActive) return;
                    app.state.gameActive = false;
                    app.canvas.clear();
                    const res = app.state.currentOutcome;
                    
                    if (res.win) {
                        app.wallet.addFunds(res.amount, 'WIN', 'Scratch Win');
                        app.ui.showResult(true, res.amount);
                        app.effects.spawnConfetti();
                    } else {
                        app.wallet.logTransaction('LOSS', app.state.betAmount, 'Scratch Card');
                        app.ui.showResult(false, 0);
                    }
                    app.ui.toggleControls(true);
                },
                reset: function() {
                    app.ui.hideResult();
                    app.canvas.reset(true);
                }
            },

            // --- Canvas ---
            canvas: {
                el: null, ctx: null, isDrawing: false, strokeCount: 0,
                init: function() {
                    this.el = document.getElementById('scratch-canvas');
                    this.ctx = this.el.getContext('2d', { willReadFrequently: true });
                    const h = (e) => {
                        e.preventDefault();
                        if(!app.state.gameActive) return;
                        const pt = this.getPos(e);
                        if(e.type === 'mousedown' || e.type === 'touchstart') this.isDrawing = true;
                        if(e.type === 'mouseup' || e.type === 'touchend') this.isDrawing = false;
                        if(this.isDrawing) this.scratch(pt);
                    };
                    ['mousedown','mousemove','mouseup','touchstart','touchmove','touchend'].forEach(evt => 
                        this.el.addEventListener(evt, h, {passive: false})
                    );
                    this.reset(true);
                },
                getPos: function(e) {
                    const r = this.el.getBoundingClientRect();
                    const t = e.touches ? e.touches[0] : e;
                    // Adjust for scaling if canvas size doesn't match display size
                    const scaleX = this.el.width / r.width;
                    const scaleY = this.el.height / r.height;
                    return { 
                        x: (t.clientX - r.left) * scaleX, 
                        y: (t.clientY - r.top) * scaleY 
                    };
                },
                reset: function(cover) {
                    this.ctx.globalCompositeOperation = 'source-over';
                    this.strokeCount = 0;
                    if(cover) {
                        this.ctx.fillStyle = '#333';
                        this.ctx.fillRect(0,0,300,300);
                        const g = this.ctx.createLinearGradient(0,0,300,300);
                        g.addColorStop(0, '#111');
                        g.addColorStop(0.5, getComputedStyle(document.documentElement).getPropertyValue('--theme-primary'));
                        g.addColorStop(1, '#111');
                        this.ctx.fillStyle = g;
                        this.ctx.fillRect(0,0,300,300);
                        this.ctx.fillStyle = "rgba(255,255,255,0.2)";
                        this.ctx.font = "bold 30px Montserrat";
                        this.ctx.textAlign = "center";
                        this.ctx.fillText("SCRATCH", 150, 140);
                    }
                },
                clear: function() { this.ctx.clearRect(0,0,300,300); },
                scratch: function(p) {
                    this.ctx.globalCompositeOperation = 'destination-out';
                    this.ctx.beginPath();
                    this.ctx.arc(p.x, p.y, 30, 0, Math.PI*2);
                    this.ctx.fill();
                    this.strokeCount++;
                    if(this.strokeCount % 15 === 0) this.checkProgress();
                },
                checkProgress: function() {
                    const img = this.ctx.getImageData(0,0,300,300);
                    let t = 0;
                    for(let i=3; i<img.data.length; i+=16) if(img.data[i] < 128) t++;
                    const pct = (t / (img.data.length/16)) * 100; 
                    if(pct > 65) app.game.finishRound(); 
                }
            },

            // --- UI ---
            ui: {
                updateBalance: () => {
                    document.getElementById('nav-balance').innerText = app.wallet.balance.toFixed(0);
                    document.getElementById('wallet-balance-display').innerText = `${app.wallet.balance.toFixed(2)}`;
                },
                toggleControls: (e) => {
                    const btn = document.getElementById('action-btn');
                    btn.disabled = !e;
                    btn.innerText = e ? "Buy Card" : "Scratching...";
                },
                showResult: (win, amt) => {
                    document.getElementById('result-overlay').classList.remove('hidden');
                    const title = document.getElementById('result-title');
                    title.innerText = win ? "YOU WON!" : "NO LUCK";
                    title.className = win ? "text-4xl font-bold text-theme-primary mb-2" : "text-2xl font-bold text-gray-400 mb-2";
                    document.getElementById('result-amount').innerText = win ? `${amt}` : "Try Again";
                    if(win) app.audio.sfx.win();
                },
                hideResult: () => document.getElementById('result-overlay').classList.add('hidden'),
                
                notify: (msg, type = 'info') => {
                    const container = document.getElementById('notification-container');
                    const toast = document.createElement('div');
                    toast.className = 'modern-toast';
                    let icon = 'fa-info-circle';
                    if(type === 'success') icon = 'fa-check-circle text-green-400';
                    if(type === 'error') icon = 'fa-exclamation-circle text-red-400';
                    toast.innerHTML = `<i class="fas ${icon} toast-icon"></i><span class="font-bold text-sm">${msg}</span>`;
                    container.appendChild(toast);
                    setTimeout(() => {
                        toast.style.transform = 'translateX(100%)';
                        setTimeout(() => toast.remove(), 300);
                    }, 3000);
                },

                renderHistory: () => {
                    const container = document.getElementById('session-log');
                    container.innerHTML = '';
                    if (app.wallet.history.length === 0) {
                        container.innerHTML = '<div class="text-gray-500 italic text-center py-4">No history yet...</div>';
                        return;
                    }
                    app.wallet.history.forEach(h => {
                        const el = document.createElement('div');
                        
                        let typeColor = 'text-gray-400';
                        let amountColor = 'text-gray-400';
                        let borderClass = 'border-gray-700';
                        
                        if (h.type === 'WIN') {
                            typeColor = 'text-green-400';
                            amountColor = 'text-green-400';
                            borderClass = 'border-green-500';
                        } else if (h.type === 'LOSS') {
                            typeColor = 'text-red-500';
                            amountColor = 'text-red-500';
                            borderClass = 'border-red-500';
                        } else if (h.type === 'DEPOSIT') {
                            typeColor = 'text-yellow-400';
                            amountColor = 'text-yellow-400';
                            borderClass = 'border-yellow-500';
                        } else if (h.type === 'WITHDRAW') {
                            typeColor = 'text-cyan-400 text-shine';
                            amountColor = 'text-cyan-400';
                            borderClass = 'border-cyan-500';
                        }

                        el.className = `flex justify-between items-center bg-gray-900/50 p-2 rounded border-l-2 ${borderClass}`;
                        el.innerHTML = `
                            <div class="flex flex-col">
                                <span class="font-bold ${typeColor}">${h.type}</span>
                                <span class="text-[10px] text-gray-500">${h.detail}</span>
                            </div>
                            <span class="font-mono font-bold ${amountColor}">${h.type === 'WIN' || h.type === 'DEPOSIT' ? '+' : '-'}${h.amount}</span>
                        `;
                        container.appendChild(el);
                    });
                },

                toggleMobileSidebar: () => {
                    const sidebar = document.getElementById('left-sidebar');
                    sidebar.classList.toggle('-translate-x-[120%]');
                },

                // Settings Logic
                toggleSettings: () => {
                    document.getElementById('settings-modal').classList.remove('hidden');
                    app.ui.updateSettingsUI();
                },
                setSound: (enabled) => {
                    app.config.sounds = enabled;
                    localStorage.setItem('scratcher_sound', enabled);
                    app.ui.updateSettingsUI();
                },
                updateSettingsUI: () => {
                    const btnOn = document.getElementById('btn-sound-on');
                    const btnOff = document.getElementById('btn-sound-off');
                    
                    if (app.config.sounds) {
                        btnOn.className = "px-4 py-1 rounded-md text-xs font-bold transition-colors bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.5)]";
                        btnOff.className = "px-4 py-1 rounded-md text-xs font-bold transition-colors text-gray-500 hover:text-white";
                    } else {
                        btnOn.className = "px-4 py-1 rounded-md text-xs font-bold transition-colors text-gray-500 hover:text-white";
                        btnOff.className = "px-4 py-1 rounded-md text-xs font-bold transition-colors bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.5)]";
                    }
                },

                openWallet: () => document.getElementById('wallet-modal').classList.remove('hidden'),
                openThemes: () => {
                    document.getElementById('theme-modal').classList.remove('hidden');
                    app.ui.renderThemes();
                },
                closeModals: () => document.querySelectorAll('[id$="-modal"]').forEach(e => e.classList.add('hidden')),
                
                openBatchResults: () => {
                    const grid = document.getElementById('batch-grid');
                    grid.innerHTML = '';
                    app.state.batchResults.forEach((res, idx) => {
                        const div = document.createElement('div');
                        div.className = `mini-card ${res.win ? 'win' : ''}`;
                        div.innerHTML = `
                            <div class="mini-card-cover" onclick="app.ui.revealBatchItem(${idx})">
                                <i class="fas fa-gem text-gray-500"></i>
                            </div>
                            <span class="${res.win ? 'text-theme-primary font-bold' : 'text-gray-500'}">
                                ${res.win ? ''+res.amount : '❌'}
                            </span>
                        `;
                        div.id = `batch-card-${idx}`;
                        grid.appendChild(div);
                    });
                    document.getElementById('batch-total-win').innerText = '0';
                    document.getElementById('batch-modal').classList.remove('hidden');
                },
                revealBatchItem: (idx, silent = false) => {
                    const el = document.getElementById(`batch-card-${idx}`);
                    if(!el || el.classList.contains('revealed')) return 0;
                    el.classList.add('revealed');
                    const res = app.state.batchResults[idx];
                    if(res.win) {
                        app.wallet.addFunds(res.amount, 'WIN', 'Batch Win', silent); 
                        if(!silent) app.audio.sfx.win();
                        return res.amount;
                    } else {
                        if(!silent) app.audio.sfx.click();
                        return 0;
                    }
                    app.ui.updateBatchTotal(); // Only useful for individual clicks really, but harmless
                },
                revealAllBatch: () => {
                    let totalNewWin = 0;
                    app.state.batchResults.forEach((_, idx) => {
                        totalNewWin += app.ui.revealBatchItem(idx, true);
                    });
                    if(totalNewWin > 0) {
                        app.audio.sfx.win();
                        app.ui.notify(`Batch Total Win: ${totalNewWin}`, 'success');
                    }
                    app.ui.updateBatchTotal();
                },
                updateBatchTotal: () => {
                    const total = app.state.batchResults.reduce((acc, curr, idx) => {
                        const revealed = document.getElementById(`batch-card-${idx}`).classList.contains('revealed');
                        return acc + (revealed ? curr.amount : 0);
                    }, 0);
                    document.getElementById('batch-total-win').innerText = `${total}`;
                },
                
                renderThemes: () => {
                    const list = document.getElementById('theme-list');
                    list.innerHTML = '';
                    app.themes.list.forEach(t => {
                        const isUnlocked = app.themes.unlocked.includes(t.id);
                        const isCurrent = app.themes.current === t.id;
                        const div = document.createElement('div');
                        div.className = `p-3 rounded border cursor-pointer relative overflow-hidden ${isCurrent ? 'border-white ring-2 ring-white' : 'border-gray-700 bg-gray-800'}`;
                        if(isCurrent) div.style.backgroundColor = t.primary + '20';
                        let content = `<div class="w-full h-12 rounded mb-2" style="background: linear-gradient(45deg, ${t.primary}, ${t.secondary})"></div>
                            <div class="text-xs font-bold text-white flex justify-between"><span>${t.name}</span>${isCurrent ? '<i class="fas fa-check text-green-400"></i>' : ''}</div>`;
                        if(!isUnlocked) {
                            div.onclick = () => app.ads.play('unlock_theme', t.id);
                            content += `<div class="absolute inset-0 bg-black/70 flex items-center justify-center flex-col text-xs text-gray-300"><i class="fas fa-lock mb-1"></i><span>Watch Ad</span></div>`;
                        } else {
                            div.onclick = () => app.themes.apply(t.id);
                        }
                        div.innerHTML = content;
                        list.appendChild(div);
                    });
                },
                
                toggleAdmin: () => {
                    const modal = document.getElementById('input-modal');
                    const title = document.getElementById('input-modal-title');
                    const field = document.getElementById('input-modal-field');
                    const btn = document.getElementById('input-modal-confirm');
                    
                    title.innerText = "Enter Admin PIN";
                    field.value = '';
                    field.type = "password";
                    modal.classList.remove('hidden');
                    
                    btn.onclick = () => {
                        if(field.value === '1234') {
                            modal.classList.add('hidden');
                            document.getElementById('admin-modal').classList.remove('hidden');
                        } else {
                            app.ui.notify("Access Denied", 'error');
                        }
                    };
                }
            },
            
            // --- Visuals ---
            effects: {
                spawnConfetti: () => {
                    for(let i=0; i<50; i++) {
                        const c = document.createElement('div');
                        c.className = 'confetti';
                        c.style.left = Math.random()*100+'vw';
                        c.style.animationDuration = (Math.random()*2+1)+'s';
                        document.body.appendChild(c);
                        setTimeout(()=>c.remove(), 3000);
                    }
                },
                startJackpotTicker: () => {
                    setInterval(() => {
                        document.getElementById('jackpot-display').innerText = '' + (120500 + Math.random()*100).toFixed(2);
                    }, 2000);
                }
            },
            
            admin: {
                updateRTP: (v) => app.game.rtp = parseFloat(v),
                forceWinNext: () => { app.state.forcedWin = true; app.ui.closeModals(); app.ui.notify("Next round rigged.", 'success'); }
            },

            init: function() {
                // Load Settings
                const savedSound = localStorage.getItem('scratcher_sound');
                if (savedSound !== null) {
                    app.config.sounds = (savedSound === 'true');
                }

                // Splash Screen Logic
                setTimeout(() => {
                    const splash = document.getElementById('splash-screen');
                    splash.style.opacity = '0';
                    setTimeout(() => splash.remove(), 800); // Remove from DOM after fade
                }, 2000); // Show for 2.5s

                this.audio.init();
                this.wallet.load();
                this.themes.init();
                this.canvas.init();
                this.effects.startJackpotTicker();
                
                const l = document.getElementById('leaderboard-list');
                ['CryptoKing','LuckyUser','Winner777'].forEach((n,i) => {
                    l.innerHTML += `<div class="flex justify-between text-xs border-b border-gray-800 pb-2 mb-2"><span class="text-gray-400">${i+1}. ${n}</span><span class="text-theme-primary">${10000-i*2000}</span></div>`;
                });
                
                document.body.addEventListener('click', () => { if(app.audio.ctx.state==='suspended') app.audio.ctx.resume(); }, {once:true});
            }
        };

        window.addEventListener('load', () => app.init());