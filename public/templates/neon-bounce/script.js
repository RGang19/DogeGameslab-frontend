// --- 1. SOUND SYSTEM (Synth) ---
        const AudioSys = {
            ctx: new (window.AudioContext || window.webkitAudioContext)(),
            muted: false,
            
            playTone(freq, type, duration, vol=0.1) {
                if(this.muted) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = type;
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
                gain.gain.setValueAtTime(vol, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start();
                osc.stop(this.ctx.currentTime + duration);
            },
            
            sfx: {
                jump: () => {
                    // Sci-fi rise
                    if(AudioSys.muted) return;
                    const osc = AudioSys.ctx.createOscillator();
                    const gain = AudioSys.ctx.createGain();
                    osc.frequency.setValueAtTime(200, AudioSys.ctx.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(600, AudioSys.ctx.currentTime + 0.1);
                    gain.gain.setValueAtTime(0.2, AudioSys.ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0, AudioSys.ctx.currentTime + 0.1);
                    osc.connect(gain); gain.connect(AudioSys.ctx.destination);
                    osc.start(); osc.stop(AudioSys.ctx.currentTime + 0.1);
                },
                land: () => AudioSys.playTone(150, 'sawtooth', 0.1, 0.15),
                win: () => {
                    [440, 554, 659, 880].forEach((f, i) => setTimeout(() => AudioSys.playTone(f, 'square', 0.2, 0.1), i*80));
                },
                crash: () => {
                    // Noise buffer for crash
                    if(AudioSys.muted) return;
                    const bufferSize = AudioSys.ctx.sampleRate * 0.5;
                    const buffer = AudioSys.ctx.createBuffer(1, bufferSize, AudioSys.ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
                    const noise = AudioSys.ctx.createBufferSource();
                    noise.buffer = buffer;
                    const gain = AudioSys.ctx.createGain();
                    gain.gain.setValueAtTime(0.5, AudioSys.ctx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.01, AudioSys.ctx.currentTime + 0.5);
                    noise.connect(gain); gain.connect(AudioSys.ctx.destination);
                    noise.start();
                }
            }
        };

        // --- 2. 3D VISUALS (Three.js) ---
        class SceneManager {
            constructor() {
                this.container = document.getElementById('canvas-container');
                this.scene = new THREE.Scene();
                this.scene.fog = new THREE.FogExp2(0x050510, 0.04);

                this.camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 0.1, 100);
                this.camera.position.set(4, 5, 6);

                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
                this.renderer.setSize(window.innerWidth, window.innerHeight);
                this.renderer.setClearColor(0x050510);
                this.renderer.shadowMap.enabled = true;
                this.container.appendChild(this.renderer.domElement);

                // Objects
                this.ball = null;
                this.stairs = [];
                this.particles = [];
                this.trailPoints = [];
                
                this.setupLights();
                this.createEnvironment();
                this.createBall();

                // Loop
                this.animate = this.animate.bind(this);
                requestAnimationFrame(this.animate);

                window.addEventListener('resize', () => this.resize());
            }

            setupLights() {
                const ambient = new THREE.AmbientLight(0xffffff, 0.3);
                this.scene.add(ambient);

                const dirLight = new THREE.DirectionalLight(0x00f3ff, 0.8);
                dirLight.position.set(10, 20, 10);
                dirLight.castShadow = true;
                this.scene.add(dirLight);

                const pointLight = new THREE.PointLight(0xbc13fe, 1, 20);
                pointLight.position.set(0, 5, 0);
                this.scene.add(pointLight);
            }

            createEnvironment() {
                // Moving Grid Floor
                const gridHelper = new THREE.GridHelper(100, 50, 0x00f3ff, 0x111122);
                gridHelper.position.y = -2;
                this.scene.add(gridHelper);
                this.grid = gridHelper;
            }

            createBall() {
                const geo = new THREE.IcosahedronGeometry(0.4, 1);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0xffffff,
                    emissive: 0x00f3ff,
                    emissiveIntensity: 0.8,
                    roughness: 0.2,
                    metalness: 0.8,
                    flatShading: true
                });
                this.ball = new THREE.Mesh(geo, mat);
                this.ball.castShadow = true;
                this.ball.position.set(0, 0.4, 0);
                this.scene.add(this.ball);
            }

            spawnStair(index, x, y, z) {
                // Neon Pad Style
                const geo = new THREE.BoxGeometry(1.8, 0.4, 1.8);
                const mat = new THREE.MeshStandardMaterial({
                    color: 0x11111f,
                    roughness: 0.1,
                    metalness: 0.9
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(x, y - 0.2, z);
                mesh.receiveShadow = true;
                mesh.userData = { id: index, originalY: y - 0.2 };

                // Glowing Edge
                const edges = new THREE.EdgesGeometry(geo);
                const lineMat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.5 });
                const wireframe = new THREE.LineSegments(edges, lineMat);
                mesh.add(wireframe);

                mesh.scale.set(0,0,0);
                gsap.to(mesh.scale, {x:1, y:1, z:1, duration: 0.4, ease:"back.out(1.5)"});
                
                this.scene.add(mesh);
                this.stairs.push(mesh);
                return mesh;
            }

            spawnParticles(pos, color=0x00f3ff) {
                const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                const mat = new THREE.MeshBasicMaterial({ color: color });
                for(let i=0; i<15; i++) {
                    const p = new THREE.Mesh(geo, mat);
                    p.position.copy(pos);
                    p.userData.vel = new THREE.Vector3(
                        (Math.random()-0.5)*0.5,
                        Math.random()*0.5,
                        (Math.random()-0.5)*0.5
                    );
                    p.userData.life = 1.0;
                    this.scene.add(p);
                    this.particles.push(p);
                }
            }

            spawnTrail() {
                // Simple ghost trail
                if(!this.ball) return;
                const ghost = new THREE.Mesh(
                    this.ball.geometry,
                    new THREE.MeshBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.3 })
                );
                ghost.position.copy(this.ball.position);
                ghost.scale.copy(this.ball.scale);
                ghost.userData.life = 0.5; // seconds
                this.scene.add(ghost);
                this.trailPoints.push(ghost);
            }

            reset() {
                this.stairs.forEach(s => this.scene.remove(s));
                this.stairs = [];
                this.ball.position.set(0, 0.4, 0);
                this.ball.visible = true;
                this.camera.position.set(4, 5, 6);
                this.camera.lookAt(0,0,0);
                this.spawnStair(0,0,0,0);
            }

            animate() {
                requestAnimationFrame(this.animate);
                
                // Move Grid for speed effect
                if(this.grid) {
                    this.grid.position.z += 0.05;
                    if(this.grid.position.z > 0) this.grid.position.z = -2;
                }

                // Ball Rotate
                if(this.ball) {
                    this.ball.rotation.x -= 0.05;
                    this.ball.rotation.z -= 0.02;
                }

                // Particles
                for(let i=this.particles.length-1; i>=0; i--) {
                    const p = this.particles[i];
                    p.position.add(p.userData.vel);
                    p.userData.vel.y -= 0.01;
                    p.userData.life -= 0.02;
                    p.scale.setScalar(p.userData.life);
                    if(p.userData.life <= 0) {
                        this.scene.remove(p);
                        this.particles.splice(i,1);
                    }
                }

                // Trails
                if(window.game && window.game.isJumping) {
                   if(Math.random() > 0.5) this.spawnTrail();
                }

                for(let i=this.trailPoints.length-1; i>=0; i--) {
                    const t = this.trailPoints[i];
                    t.userData.life -= 0.02;
                    t.material.opacity = t.userData.life;
                    t.scale.multiplyScalar(0.95);
                    if(t.userData.life <= 0) {
                        this.scene.remove(t);
                        this.trailPoints.splice(i,1);
                    }
                }

                this.renderer.render(this.scene, this.camera);
            }

            resize() {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }
        }

        // --- 3. GAME LOGIC ---
        class Game {
            constructor() {
                this.scene = new SceneManager();
                this.wallet = parseFloat(localStorage.getItem('neon_wallet')) || 1000;
                this.bet = 100;
                // New History Data Structure: Array of { type: 'win'|'loss', amount: number, mult: number }
                // Migration: check if old format exists (array of numbers) and reset if so
                let storedHistory = JSON.parse(localStorage.getItem('neon_full_history'));
                
                if (!storedHistory) {
                    // Check for old format
                    const oldHistory = JSON.parse(localStorage.getItem('neon_history'));
                    if (oldHistory && oldHistory.length > 0 && typeof oldHistory[0] === 'number') {
                        // Reset because format changed
                        storedHistory = []; 
                    } else {
                        storedHistory = [];
                    }
                }
                this.history = storedHistory;

                this.isPlaying = false;
                this.isJumping = false;
                this.stairIndex = 0;
                this.currentMult = 1.0;

                // Bind UI
                this.els = {
                    wallet: document.getElementById('wallet-display'),
                    betInput: document.getElementById('bet-input'),
                    mult: document.getElementById('multiplier-display'),
                    risk: document.getElementById('risk-display'),
                    hud: document.getElementById('game-hud'),
                    betUi: document.getElementById('bet-ui'),
                    playUi: document.getElementById('play-ui'),
                    cashoutVal: document.getElementById('cashout-val'),
                    // msg: document.getElementById('message-area'), // Deprecated for toasts
                    historyStrip: document.getElementById('history-strip'), // Top strip
                    historyList: document.getElementById('full-history-list'), // Side panel (Mobile)
                    desktopHistory: document.getElementById('desktop-history-list'), // Side panel (Desktop)
                    sidebar: document.getElementById('history-sidebar'),
                    historyToggle: document.getElementById('history-toggle-btn'),
                    closeHistory: document.getElementById('close-history-btn'),
                    
                    adModal: document.getElementById('ad-modal'),
                    adBar: document.getElementById('ad-progress'),
                    adBtn: document.getElementById('claim-reward-btn'),
                    jumpBtn: document.getElementById('jump-btn'),
                    cashoutBtn: document.getElementById('cashout-btn'),
                    lb: document.getElementById('leaderboard'),
                    toastContainer: document.getElementById('toast-container')
                };

                this.init();
            }

            init() {
                this.updateWallet();
                this.renderHistory();
                this.generateFakeLeaderboard();

                // Listeners
                document.getElementById('start-btn').onclick = () => this.startRound();
                this.els.jumpBtn.onclick = () => this.jump();
                this.els.cashoutBtn.onclick = () => this.cashout();
                document.getElementById('ad-btn').onclick = () => this.openAd();
                
                // History Sidebar Toggles
                this.els.historyToggle.onclick = () => {
                    this.els.sidebar.classList.remove('sidebar-closed');
                    this.els.sidebar.classList.add('sidebar-open');
                };
                this.els.closeHistory.onclick = () => {
                    this.els.sidebar.classList.remove('sidebar-open');
                    this.els.sidebar.classList.add('sidebar-closed');
                };

                // UPDATED: Theme Randomizer Logic
                document.getElementById('theme-btn').onclick = () => this.randomizeTheme();

                document.getElementById('sound-btn').onclick = () => {
                    AudioSys.muted = !AudioSys.muted;
                    document.getElementById('sound-btn').style.opacity = AudioSys.muted ? 0.5 : 1;
                };

                // Remove splash
                setTimeout(() => {
                    document.getElementById('splash-screen').style.opacity = 0;
                    setTimeout(() => document.getElementById('splash-screen').remove(), 500);
                }, 2000);
            }

            randomizeTheme() {
                const hue = Math.floor(Math.random() * 360);
                const colorPrimary = `hsl(${hue}, 100%, 50%)`;
                const colorSecondary = `hsl(${(hue + 180) % 360}, 100%, 50%)`;
                
                document.documentElement.style.setProperty('--neon-blue', colorPrimary);
                document.documentElement.style.setProperty('--neon-pink', colorSecondary);
                
                const c = new THREE.Color(colorPrimary).multiplyScalar(0.1);
                gsap.to(this.scene.scene.fog.color, { r: c.r, g: c.g, b: c.b, duration: 0.5 });
                
                this.msgFlash("THEME RELOADED", "border-white");
            }

            updateWallet() {
                this.els.wallet.innerText = this.wallet.toFixed(2);
                localStorage.setItem('neon_wallet', this.wallet);
            }

            renderHistory() {
                // 1. Top Strip (Multipliers only)
                this.els.historyStrip.innerHTML = '';
                this.history.slice(-10).reverse().forEach(item => {
                    const el = document.createElement('div');
                    const isWin = item.type === 'win';
                    el.className = `px-3 py-1 rounded bg-slate-800/80 border text-xs font-mono whitespace-nowrap ${isWin ? 'border-green-500 text-green-400' : 'border-red-500 text-red-400'}`;
                    el.innerText = item.mult.toFixed(2) + 'x';
                    this.els.historyStrip.appendChild(el);
                });

                // Generate HTML for history row
                const generateRowHTML = (item) => {
                    const isWin = item.type === 'win';
                    return `
                        <div class="p-2 rounded border-l-2 bg-slate-800/30 flex justify-between items-center text-xs ${isWin ? 'border-green-500' : 'border-red-500'}">
                            <div>
                                <div class="font-bold ${isWin ? 'text-green-400' : 'text-red-400'}">${isWin ? 'WIN' : 'CRASH'}</div>
                                <div class="text-slate-500 text-[10px]">${item.mult.toFixed(2)}x Multiplier</div>
                            </div>
                            <div class="text-right">
                                <div class="font-mono font-bold ${isWin ? 'text-green-400' : 'text-red-400'}">
                                    ${isWin ? '+' : '-'}$${item.amount.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    `;
                };

                // 2. Populate Mobile List
                this.els.historyList.innerHTML = '';
                if(this.history.length === 0) {
                    this.els.historyList.innerHTML = '<div class="text-center text-slate-500 text-xs mt-10">No rounds played yet.</div>';
                } else {
                    this.history.slice().reverse().forEach(item => {
                        const div = document.createElement('div');
                        div.innerHTML = generateRowHTML(item);
                        this.els.historyList.appendChild(div.firstElementChild);
                    });
                }

                // 3. Populate Desktop List
                this.els.desktopHistory.innerHTML = '';
                if(this.history.length === 0) {
                    this.els.desktopHistory.innerHTML = '<div class="text-center text-slate-500 text-[10px] mt-4">No rounds yet.</div>';
                } else {
                    this.history.slice().reverse().forEach(item => {
                        const div = document.createElement('div');
                        div.innerHTML = generateRowHTML(item);
                        this.els.desktopHistory.appendChild(div.firstElementChild);
                    });
                }

                localStorage.setItem('neon_full_history', JSON.stringify(this.history));
            }

            generateFakeLeaderboard() {
                const names = ['CyberWolf', 'NeonK', 'Glitch_0', 'Viper', 'Tr0n'];
                this.els.lb.innerHTML = '';
                names.forEach(n => {
                    const row = document.createElement('div');
                    row.className = 'flex justify-between text-[10px] text-slate-400 bg-black/30 p-1 px-2 rounded border-l-2 border-slate-600';
                    row.innerHTML = `<span>${n}</span><span class="text-[#00f3ff]">${(Math.random()*2+1).toFixed(2)}x</span>`;
                    this.els.lb.appendChild(row);
                });
                setInterval(() => {
                    if(Math.random() > 0.7) {
                        const rows = this.els.lb.children;
                        const r = rows[Math.floor(Math.random()*rows.length)];
                        const mult = (Math.random()*5 + 1).toFixed(2);
                        r.querySelector('span:last-child').innerText = mult + 'x';
                        r.style.borderColor = '#00f3ff';
                        setTimeout(() => r.style.borderColor = '#475569', 500);
                    }
                }, 2000);
            }

            setBet(v) { this.els.betInput.value = v; }
            doubleBet() { this.els.betInput.value = Math.min(5000, this.els.betInput.value * 2); }
            maxBet() { this.els.betInput.value = Math.min(this.wallet, 5000); }

            startRound() {
                const b = parseFloat(this.els.betInput.value);
                if(b > this.wallet) return this.msgFlash("INSUFFICIENT FUNDS", "text-red-500");
                if(b < 10) return this.msgFlash("MIN BET 10", "text-red-500");

                this.wallet -= b;
                this.bet = b;
                this.updateWallet();

                this.isPlaying = true;
                this.stairIndex = 0;
                this.currentMult = 1.0;
                this.scene.reset();

                // UI Switch
                this.els.betUi.classList.add('hidden');
                this.els.playUi.classList.remove('hidden');
                this.els.playUi.classList.add('flex');
                this.els.hud.style.opacity = 1;
                this.els.mult.innerText = "1.00x";
                this.els.risk.innerText = "2%";
                this.els.cashoutVal.innerText = "$0.00"; // Initially 0 return
                this.els.cashoutBtn.disabled = true; // Disabled initially
                this.els.jumpBtn.disabled = false;

                this.spawnNextTarget();
            }

            spawnNextTarget() {
                const x = (Math.random()-0.5) * 1;
                const y = (this.stairIndex + 1) * 0.5;
                const z = -(this.stairIndex + 1) * 2;
                this.scene.spawnStair(this.stairIndex+1, x, y, z);
            }

            jump() {
                if(this.isJumping || !this.isPlaying) return;
                this.isJumping = true;
                this.els.jumpBtn.disabled = true;
                this.els.cashoutBtn.disabled = true;

                const nextIdx = this.stairIndex + 1;
                const stair = this.scene.stairs.find(s => s.userData.id === nextIdx);
                
                if (!stair) {
                    this.isJumping = false;
                    return;
                }

                const chance = Math.min(0.9, 0.05 + (nextIdx * 0.04));
                const crashed = Math.random() < chance;
                
                const ball = this.scene.ball;
                const targetPos = { x: stair.position.x, y: stair.position.y + 0.6, z: stair.position.z };

                AudioSys.sfx.jump();

                const tl = gsap.timeline({
                    onComplete: () => {
                        this.isJumping = false;
                        if(crashed) this.doCrash(stair);
                        else this.doLand(nextIdx);
                    }
                });

                tl.to(ball.position, { x: targetPos.x, z: targetPos.z, duration: 0.6, ease: "linear" }, 0);
                tl.to(ball.position, { y: targetPos.y + 1.5, duration: 0.3, ease: "circ.out" }, 0);
                tl.to(ball.position, { y: targetPos.y, duration: 0.3, ease: "circ.in" }, 0.3);

                gsap.to(this.scene.camera.position, {
                    x: targetPos.x + 3, y: targetPos.y + 5, z: targetPos.z + 6, duration: 0.8
                });
            }

            doLand(idx) {
                this.stairIndex = idx;
                this.currentMult = Math.pow(1.15, idx).toFixed(2);
                
                AudioSys.sfx.land();
                this.scene.spawnParticles(this.scene.ball.position);
                
                this.els.mult.style.transform = "scale(1.2)";
                setTimeout(() => this.els.mult.style.transform = "scale(1)", 100);

                this.els.mult.innerText = this.currentMult + "x";
                this.els.cashoutVal.innerText = "$" + (this.bet * this.currentMult).toFixed(2);
                this.els.risk.innerText = Math.round((0.05 + ((idx+1)*0.04))*100) + "%";
                
                this.els.jumpBtn.disabled = false;
                this.els.cashoutBtn.disabled = false;
                
                if(this.scene.stairs.length > 6) {
                    const old = this.scene.stairs.shift();
                    this.scene.scene.remove(old);
                }
                this.spawnNextTarget();
            }

            doCrash(stair) {
                AudioSys.sfx.crash();
                this.scene.spawnParticles(this.scene.ball.position, 0xff0055);
                this.scene.ball.visible = false;
                
                gsap.to(stair.rotation, {x: 0.5, z: 0.5, duration: 0.5});
                gsap.to(stair.position, {y: -5, duration: 0.5});

                // Add to history
                this.history.push({ type: 'loss', amount: this.bet, mult: 0 });
                this.renderHistory();
                this.msgFlash("SYSTEM FAILURE", "text-red-500");
                
                setTimeout(() => this.endRound(), 1500);
            }

            cashout() {
                if(!this.isPlaying) return;
                const win = this.bet * this.currentMult;
                this.wallet += win;
                this.updateWallet();
                
                AudioSys.sfx.win();
                confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#00f3ff', '#bc13fe'] });
                
                // Add to history
                this.history.push({ type: 'win', amount: win - this.bet, mult: parseFloat(this.currentMult) });
                this.renderHistory();
                this.msgFlash(`WON $${win.toFixed(2)}`, "text-[#00f3ff]");

                this.endRound();
            }

            endRound() {
                this.isPlaying = false;
                this.els.playUi.classList.add('hidden');
                this.els.playUi.classList.remove('flex');
                this.els.betUi.classList.remove('hidden');
                this.els.hud.style.opacity = 0;
                gsap.to(this.scene.camera.position, { x: 4, y: 5, z: 6, duration: 1.5 });
            }

            // NEW MODERN TOAST SYSTEM
            msgFlash(txt, cls) {
                const el = document.createElement('div');
                
                // Determine styling based on class
                let borderColor = 'border-blue-500';
                let icon = '<i class="ph-bold ph-info text-2xl text-blue-400"></i>';
                
                if (cls.includes('red')) {
                    borderColor = 'border-red-500 shadow-red-500/20';
                    icon = '<i class="ph-bold ph-warning-circle text-2xl text-red-400"></i>';
                } else if (cls.includes('#00f3ff') || cls.includes('green') || cls.includes('#0aff0a')) {
                    borderColor = 'border-[#0aff0a] shadow-[#0aff0a]/20';
                    icon = '<i class="ph-bold ph-check-circle text-2xl text-[#0aff0a]"></i>';
                } else if (cls.includes('yellow')) {
                    borderColor = 'border-yellow-500 shadow-yellow-500/20';
                    icon = '<i class="ph-bold ph-coins text-2xl text-yellow-400"></i>';
                }

                // Toast Structure
                el.className = `toast-enter pointer-events-auto bg-[#050510]/95 backdrop-blur-md border-l-4 ${borderColor} text-white p-4 pr-6 rounded-r-lg shadow-lg flex items-center gap-3 min-w-[200px] border-t border-b border-r border-white/5`;
                el.innerHTML = `
                    ${icon}
                    <div>
                        <div class="font-cyber font-bold tracking-wider text-sm uppercase">${txt}</div>
                    </div>
                `;

                this.els.toastContainer.appendChild(el);

                // Auto Remove
                setTimeout(() => {
                    el.style.opacity = '0';
                    el.style.transform = 'translateX(100%)';
                    el.style.transition = 'all 0.3s ease';
                    setTimeout(() => el.remove(), 300);
                }, 3000);
            }

            openAd() {
                this.els.adModal.classList.remove('hidden');
                let t = 5;
                this.els.adBar.style.width = '0%';
                this.els.adBtn.disabled = true;
                this.els.adBtn.innerText = `WAIT ${t}s`;
                this.els.adBtn.className = "w-full cyber-btn text-slate-500 cursor-not-allowed py-3 font-bold";

                const int = setInterval(() => {
                    t--;
                    this.els.adBar.style.width = `${((5-t)/5)*100}%`;
                    this.els.adBtn.innerText = `WAIT ${t}s`;
                    if(t <= 0) {
                        clearInterval(int);
                        this.els.adBtn.disabled = false;
                        this.els.adBtn.innerText = "CLAIM REWARD";
                        this.els.adBtn.className = "w-full cyber-btn cyber-btn-primary py-3 font-bold animate-pulse";
                        this.els.adBtn.onclick = () => {
                            this.wallet += 100;
                            this.updateWallet();
                            AudioSys.sfx.win();
                            this.closeAd();
                            this.msgFlash("+ $100", "text-yellow-400");
                        };
                    }
                }, 1000);
            }
            closeAd() { this.els.adModal.classList.add('hidden'); }
        }

        window.onload = () => window.game = new Game();