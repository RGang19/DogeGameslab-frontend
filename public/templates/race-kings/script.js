const CONFIG = {
            houseEdge: 0.94, 
            baseSpeed: 5,
            trackLengthPercent: 90, 
            minBet: 10,
            initialBalance: 1000,
            raceDurationMin: 4000, 
            raceDurationMax: 6000  
        };

        const CARS = [
            { id: 0, name: "Inferno", icon: '<img src="assets/car1.png" class="w-full h-auto drop-shadow-md" alt="Inferno" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/3097/3097003.png\';this.style.filter=\'hue-rotate(0deg)\';">', color: "text-red-500", bg: "bg-red-900", hex: "#ef4444" },
            { id: 1, name: "Azure", icon: '<img src="assets/car2.png" class="w-full h-auto drop-shadow-md" alt="Azure" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/3097/3097003.png\';this.style.filter=\'hue-rotate(240deg)\';">', color: "text-blue-500", bg: "bg-blue-900", hex: "#3b82f6" },
            { id: 2, name: "Viper", icon: '<img src="assets/car3.png" class="w-full h-auto drop-shadow-md" alt="Viper" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/3097/3097003.png\';this.style.filter=\'hue-rotate(120deg)\';">', color: "text-green-500", bg: "bg-green-900", hex: "#22c55e" },
            { id: 3, name: "Voltage", icon: '<img src="assets/car4.png" class="w-full h-auto drop-shadow-md" alt="Voltage" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/3097/3097003.png\';this.style.filter=\'hue-rotate(6deg)\';">', color: "text-yellow-500", bg: "bg-yellow-900", hex: "#eab308" },
            { id: 4, name: "Phantom", icon: '<img src="assets/car5.png" class="w-full h-auto drop-shadow-md" alt="Phantom" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/3097/3097003.png\';this.style.filter=\'hue-rotate(280deg)\';">', color: "text-purple-500", bg: "bg-purple-900", hex: "#a855f7" },
            { id: 5, name: "Enforcer", icon: '<img src="assets/car6.png" class="w-full h-auto drop-shadow-md" alt="Enforcer" onerror="this.src=\'https://cdn-icons-png.flaticon.com/512/3097/3097003.png\';this.style.filter=\'grayscale(100%)\';">', color: "text-slate-300", bg: "bg-slate-700", hex: "#cbd5e1" }
        ];

        /* --- AUDIO SYSTEM --- */
        const AudioSys = {
            ctx: null,
            enabled: true,
            
            init() {
                window.AudioContext = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AudioContext();
            },

            playTone(freq, type, duration, vol = 0.1) {
                if (!this.enabled || !this.ctx) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(vol, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            },

            playClick() { this.playTone(800, 'sine', 0.1, 0.05); },
            playBet() { this.playTone(1200, 'triangle', 0.15, 0.05); },
            playWin() { 
                if (!this.enabled) return;
                [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
                    setTimeout(() => this.playTone(f, 'square', 0.3, 0.1), i * 100);
                });
            },
            playEngine() {
                this.playTone(80, 'sawtooth', 0.8, 0.05);
            }
        };

        /* --- STATE MANAGEMENT --- */
        const Game = {
            state: 'PRELOADER',
            balance: CONFIG.initialBalance,
            currentBet: 0,
            selectedCarIndex: null,
            odds: [], 
            history: [],
            soundOn: true,
            raceInterval: null,
            winnerIndex: null,
            adInterval: null,

            /* --- INITIALIZATION --- */
            init() {
                this.runPreloader();
                
                this.loadData();
                this.renderTrack();
                this.generateOdds();
                this.updateUI();
                
                document.getElementById('custom-bet-input').addEventListener('input', (e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                        this.currentBet = val;
                        this.updateUI();
                    }
                });
            },
            
            /* --- PRELOADER & LOBBY LOGIC --- */
            runPreloader() {
                const preloader = document.getElementById('preloader-screen');
                const loaderBar = document.getElementById('loader-bar');
                const menuScreen = document.getElementById('menu-screen');
                const loadingText = document.getElementById('loading-text');
                
                setTimeout(() => {
                    loaderBar.style.width = '100%';
                    loaderBar.style.transition = 'width 3s ease-in-out';
                }, 100);

                setTimeout(() => loadingText.innerText = "TUNING ENGINE...", 1000);
                setTimeout(() => loadingText.innerText = "CHECKING TIRES...", 2000);
                setTimeout(() => loadingText.innerText = "READY TO RACE!", 2800);

                setTimeout(() => {
                    preloader.style.opacity = '0';
                    setTimeout(() => {
                        preloader.style.display = 'none';
                        menuScreen.classList.remove('hidden');
                        void menuScreen.offsetWidth; 
                        menuScreen.classList.remove('opacity-0');
                        this.state = 'MENU';
                    }, 1000); 
                }, 3000);
            },

            enterLobby() {
                const menu = document.getElementById('menu-screen');
                const gameUI = document.getElementById('main-game-ui');
                
                menu.style.opacity = '0';
                setTimeout(() => {
                    menu.style.display = 'none';
                    // Show Game UI
                    gameUI.classList.remove('hidden');
                    // Force reflow for transition
                    void gameUI.offsetWidth;
                    gameUI.classList.remove('opacity-0');
                    
                    this.state = 'LOBBY';
                }, 500);
                
                if (!AudioSys.ctx) AudioSys.init();
            },

            /* --- DATA PERSISTENCE --- */
            saveData() {
                const data = {
                    balance: this.balance,
                    history: this.history,
                    settings: { sound: this.soundOn }
                };
                localStorage.setItem('nitro6_data', JSON.stringify(data));
            },

            loadData() {
                const raw = localStorage.getItem('nitro6_data');
                if (raw) {
                    const data = JSON.parse(raw);
                    this.balance = data.balance;
                    this.history = data.history || [];
                    this.soundOn = data.settings?.sound ?? true;
                }
                this.updateSoundIcon();
            },

            hardReset() {
                if(confirm("Reset all game data? This cannot be undone.")) {
                    localStorage.removeItem('nitro6_data');
                    location.reload();
                }
            },

            /* --- CORE LOGIC --- */
            generateOdds() {
                let weights = Array.from({length: 6}, () => Math.random() * 0.5 + 0.5); 
                
                if (Math.random() > 0.7) {
                    const fav = Math.floor(Math.random() * 6);
                    weights[fav] += 1.0;
                }

                const totalWeight = weights.reduce((a, b) => a + b, 0);
                const probabilities = weights.map(w => w / totalWeight);
                
                this.odds = probabilities.map(p => {
                    let mult = (1 / p) * CONFIG.houseEdge;
                    return Math.max(1.1, parseFloat(mult.toFixed(2))); 
                });
                
                this.probabilities = probabilities;
                this.renderRacerSelection();
            },

            getSecureRandom() {
                if (window.crypto && window.crypto.getRandomValues) {
                    return window.crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
                }
                return Math.random();
            },

            determineWinner() {
                const r = this.getSecureRandom();
                let cumulative = 0;
                for (let i = 0; i < 6; i++) {
                    cumulative += this.probabilities[i];
                    if (r <= cumulative) return i;
                }
                return 5; 
            },

            /* --- BETTING ACTIONS --- */
            selectCar(index) {
                if (this.state !== 'LOBBY') return;
                this.selectedCarIndex = index;
                AudioSys.playClick();
                this.updateUI();
            },

            addChip(amount) {
                if (this.state !== 'LOBBY') return;
                const newTotal = this.currentBet + amount;
                if (newTotal <= this.balance) {
                    this.currentBet = newTotal;
                    AudioSys.playBet();
                    this.updateUI();
                } else {
                    document.getElementById('balance-display').classList.add('text-red-500');
                    setTimeout(()=>document.getElementById('balance-display').classList.remove('text-red-500'), 200);
                }
            },

            adjustBet(type) {
                if (this.state !== 'LOBBY') return;
                if (type === 'min') this.currentBet = CONFIG.minBet;
                if (type === 'half') this.currentBet = Math.floor(this.currentBet / 2);
                if (type === 'double') this.currentBet = this.currentBet * 2;
                if (type === 'max') this.currentBet = this.balance;
                
                if (this.currentBet > this.balance) this.currentBet = this.balance;
                if (this.currentBet < 0) this.currentBet = 0;
                
                this.updateUI();
            },

            handleAction() {
                if (this.state === 'LOBBY') {
                    if (this.selectedCarIndex === null || this.currentBet < CONFIG.minBet) return;
                    if (this.currentBet > this.balance) return;
                    
                    this.startRace();
                }
            },

            /* --- RACE ENGINE --- */
            startRace() {
                this.balance -= this.currentBet;
                this.state = 'RACING';
                this.saveData();
                this.updateUI();

                this.winnerIndex = this.determineWinner();
                
                const raceTime = CONFIG.raceDurationMin + Math.random() * (CONFIG.raceDurationMax - CONFIG.raceDurationMin);
                
                const carDurations = CARS.map((_, i) => {
                    if (i === this.winnerIndex) return raceTime;
                    return raceTime + 500 + (Math.random() * 1500);
                });

                const startTime = performance.now();
                AudioSys.playEngine();

                document.querySelectorAll('.car').forEach(el => el.style.transform = `translateX(0px)`);
                document.getElementById('status-text').innerText = "RACE IN PROGRESS...";

                const loop = (now) => {
                    const elapsed = now - startTime;
                    let finishedCount = 0;

                    CARS.forEach((car, i) => {
                        const duration = carDurations[i];
                        let progress = elapsed / duration;
                        
                        if (progress > 1) {
                            progress = 1;
                            finishedCount++;
                        }

                        const jitter = (progress < 1) ? Math.random() * 2 : 0;

                        const trackWidth = document.getElementById('track-area').clientWidth;
                        const maxPx = trackWidth * (CONFIG.trackLengthPercent / 100);
                        
                        const currentPx = (maxPx * progress) + jitter;
                        
                        const el = document.getElementById(`car-${i}`);
                        el.style.transform = `translateX(${currentPx}px)`;
                    });

                    document.getElementById('race-timer').innerText = (elapsed/1000).toFixed(2) + 's';

                    if (finishedCount < 6) {
                        requestAnimationFrame(loop);
                    } else {
                        this.endRace();
                    }
                };

                document.getElementById('race-timer').classList.remove('hidden');
                requestAnimationFrame(loop);
            },

            endRace() {
                this.state = 'FINISHED';
                const won = this.selectedCarIndex === this.winnerIndex;
                let payout = 0;

                if (won) {
                    const multiplier = this.odds[this.winnerIndex];
                    payout = Math.floor(this.currentBet * multiplier);
                    this.balance += payout;
                    AudioSys.playWin();
                    Confetti.start();
                }

                this.history.unshift({
                    time: new Date().toLocaleTimeString(),
                    winner: CARS[this.winnerIndex].name,
                    bet: this.currentBet,
                    payout: payout,
                    won: won
                });
                if (this.history.length > 50) this.history.pop();

                this.saveData();
                this.showResultModal(won, payout);
            },

            resetRace() {
                this.state = 'LOBBY';
                this.selectedCarIndex = null;
                this.generateOdds(); 
                Confetti.stop();
                
                document.querySelectorAll('.car').forEach(el => {
                    el.style.transform = `translateX(0px)`;
                });
                document.getElementById('result-modal').classList.remove('active');
                document.getElementById('race-timer').classList.add('hidden');
                document.getElementById('status-text').innerText = "WAITING FOR BETS...";
                
                this.updateUI();
            },

            /* --- UI UPDATES --- */
            renderTrack() {
                const container = document.getElementById('track-area');
                container.innerHTML = '<div class="finish-flag" style="left: '+CONFIG.trackLengthPercent+'%"></div>';
                
                CARS.forEach((car, i) => {
                    const lane = document.createElement('div');
                    lane.className = 'lane border-b border-slate-600';
                    
                    lane.innerHTML = `
                        <div id="car-${i}" class="car" style="top: 5px">
                            ${car.icon}
                        </div>
                        <div class="absolute left-2 text-xs text-slate-500 font-mono">${i+1}</div>
                    `;
                    container.appendChild(lane);
                });
            },

            renderRacerSelection() {
                const list = document.getElementById('racer-list');
                list.innerHTML = '';
                
                CARS.forEach((car, i) => {
                    const btn = document.createElement('button');
                    const odd = this.odds[i].toFixed(2);
                    const isSelected = this.selectedCarIndex === i;
                    
                    btn.className = `p-2 rounded border transition flex flex-col items-center justify-between relative overflow-hidden ${isSelected ? 'bg-slate-700 border-blue-400 ring-2 ring-blue-500' : 'bg-slate-800 border-slate-600 hover:border-slate-500'}`;
                    btn.onclick = () => this.selectCar(i);
                    
                    btn.innerHTML = `
                        <div class="w-12 h-auto mx-auto mb-1 flex items-center justify-center">
                            ${car.icon}
                        </div>
                        <div class="text-xs font-bold text-slate-300 w-full flex justify-between px-1">
                            <span>#${i+1}</span>
                            <span class="text-yellow-400">x${odd}</span>
                        </div>
                        ${isSelected ? '<div class="absolute top-0 right-0 w-3 h-3 bg-blue-500 rounded-bl"></div>' : ''}
                    `;
                    list.appendChild(btn);
                });
            },

            updateUI() {
                document.getElementById('balance-display').innerText = this.balance.toFixed(2);
                document.getElementById('custom-bet-input').value = this.currentBet > 0 ? this.currentBet : '';
                document.getElementById('current-bet-display').innerText = this.currentBet;
                
                let payout = 0;
                if (this.selectedCarIndex !== null) {
                    payout = this.currentBet * this.odds[this.selectedCarIndex];
                }
                document.getElementById('potential-payout').innerText = payout.toFixed(2);

                const btn = document.getElementById('action-btn');
                const isValid = this.selectedCarIndex !== null && this.currentBet >= CONFIG.minBet && this.currentBet <= this.balance;
                
                if (this.state === 'RACING') {
                    btn.innerText = "RACING...";
                    btn.disabled = true;
                    btn.className = "mt-auto w-full py-4 rounded-lg bg-slate-800 text-slate-500 font-bold text-xl tracking-wider cursor-wait";
                } else if (isValid) {
                    btn.innerText = "PLACE BET & RACE";
                    btn.disabled = false;
                    btn.className = "mt-auto w-full py-4 rounded-lg bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white font-bold text-xl uppercase tracking-wider transition shadow-lg transform active:scale-95";
                } else {
                    btn.innerText = this.selectedCarIndex === null ? "SELECT A CAR" : "PLACE BET";
                    btn.disabled = true;
                    btn.className = "mt-auto w-full py-4 rounded-lg bg-slate-700 text-slate-500 font-bold text-xl uppercase tracking-wider transition shadow-lg cursor-not-allowed opacity-50";
                }

                if(this.state === 'LOBBY') this.renderRacerSelection();
            },

            showResultModal(won, payout) {
                const modal = document.getElementById('result-modal');
                const icon = document.getElementById('result-winner-icon');
                const name = document.getElementById('result-winner-name');
                const outcome = document.getElementById('result-outcome');
                
                icon.innerHTML = `<div class="w-24 mx-auto">${CARS[this.winnerIndex].icon}</div>`;
                name.innerText = CARS[this.winnerIndex].name + " Wins!";
                name.className = `text-xl font-bold ${CARS[this.winnerIndex].color}`;

                if (won) {
                    outcome.innerHTML = `
                        <div class="text-green-400 text-lg font-bold">YOU WON!</div>
                        <div class="text-white text-3xl font-black digital-font">+${payout}</div>
                    `;
                    AudioSys.playWin();
                } else {
                    outcome.innerHTML = `
                        <div class="text-red-400 text-lg font-bold">YOU LOST</div>
                        <div class="text-slate-500 text-sm">Better luck next time</div>
                    `;
                }

                modal.classList.add('active');
            },

            toggleSettings() {
                const el = document.getElementById('settings-modal');
                el.classList.toggle('active');
            },

            toggleSoundConfig() {
                this.soundOn = !this.soundOn;
                AudioSys.enabled = this.soundOn;
                this.saveData();
                this.updateSoundIcon();
            },

            updateSoundIcon() {
                const btn = document.getElementById('toggle-sound');
                if (this.soundOn) {
                    btn.className = "w-12 h-6 bg-green-500 rounded-full relative transition-colors cursor-pointer";
                    btn.children[0].className = "w-4 h-4 bg-white rounded-full absolute top-1 left-7 transition-all shadow-md";
                } else {
                    btn.className = "w-12 h-6 bg-slate-600 rounded-full relative transition-colors cursor-pointer";
                    btn.children[0].className = "w-4 h-4 bg-white rounded-full absolute top-1 left-1 transition-all shadow-md";
                }
            },

            openAdModal() {
                const modal = document.getElementById('ad-modal');
                const timerEl = document.getElementById('ad-timer');
                const statusEl = document.getElementById('ad-status');
                
                modal.classList.add('active');
                statusEl.innerText = "";
                
                let timeLeft = 10;
                timerEl.innerText = timeLeft + "s";
                
                if (this.adInterval) clearInterval(this.adInterval);
                
                this.adInterval = setInterval(() => {
                    timeLeft--;
                    timerEl.innerText = timeLeft + "s";
                    
                    if (timeLeft <= 0) {
                        clearInterval(this.adInterval);
                        this.rewardAd();
                    }
                }, 1000);
            },
            
            rewardAd() {
                const statusEl = document.getElementById('ad-status');
                statusEl.innerText = "Reward Earned! +100 Credits";
                
                this.balance += 100;
                this.saveData();
                this.updateUI();
                AudioSys.playWin(); 
                
                setTimeout(() => {
                    document.getElementById('ad-modal').classList.remove('active');
                }, 1500);
            },

            showHistory() {
                const panel = document.getElementById('secondary-panel');
                const content = document.getElementById('secondary-content');
                document.getElementById('secondary-title').innerText = "Race History";
                
                if (this.history.length === 0) {
                    content.innerHTML = '<div class="text-center text-slate-500 mt-10">No races yet.</div>';
                } else {
                    content.innerHTML = this.history.map(h => `
                        <div class="flex justify-between items-center bg-slate-800 p-2 mb-2 rounded border-l-4 ${h.won ? 'border-green-500' : 'border-red-500'}">
                            <div>
                                <div class="text-xs text-slate-400">${h.time}</div>
                                <div class="font-bold text-white">Winner: ${h.winner}</div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-slate-400">Bet: ${h.bet}</div>
                                <div class="${h.won ? 'text-green-400' : 'text-slate-500'} font-bold">
                                    ${h.won ? '+' + h.payout : '-'+h.bet}
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
                panel.classList.remove('hidden');
            },

            hideSecondary() {
                document.getElementById('secondary-panel').classList.add('hidden');
            }
        };

        const Confetti = {
            canvas: null,
            ctx: null,
            particles: [],
            animationId: null,

            start() {
                this.canvas = document.getElementById('confetti-canvas');
                this.ctx = this.canvas.getContext('2d');
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
                this.particles = [];
                
                for(let i=0; i<150; i++) {
                    this.particles.push({
                        x: Math.random() * this.canvas.width,
                        y: Math.random() * this.canvas.height - this.canvas.height,
                        color: ['#f00', '#0f0', '#00f', '#ff0', '#0ff'][Math.floor(Math.random()*5)],
                        size: Math.random() * 5 + 5,
                        speedY: Math.random() * 3 + 2,
                        speedX: Math.random() * 2 - 1
                    });
                }
                this.animate();
            },

            animate() {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.particles.forEach(p => {
                    p.y += p.speedY;
                    p.x += Math.sin(p.y * 0.01) + p.speedX;
                    
                    this.ctx.fillStyle = p.color;
                    this.ctx.fillRect(p.x, p.y, p.size, p.size);

                    if (p.y > this.canvas.height) p.y = -10;
                });
                this.animationId = requestAnimationFrame(() => this.animate());
            },

            stop() {
                if (this.animationId) cancelAnimationFrame(this.animationId);
                if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            }
        };

        window.onload = () => Game.init();
        
        window.onresize = () => {
             if(Confetti.canvas) {
                 Confetti.canvas.width = window.innerWidth;
                 Confetti.canvas.height = window.innerHeight;
             }
        };