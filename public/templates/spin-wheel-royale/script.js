/* --- GAME ENGINE --- */
const CONFIG = {
    wheelSegments: 10,
    colors: ['#000', '#b30000', '#000', '#b30000', '#000', '#b30000', '#000', '#b30000', '#000', '#b30000'],
    payouts: { low: { mult: 1.5, range: 0 }, med: { mult: 3.0, range: 0 }, high: { mult: 10.0, range: 0 } }
};

const STATE = {
    balance: 1000, bet: 50, targetNumber: 5, risk: 'high',
    isSpinning: false, skin: 'classic', vipUnlocked: false,
    adReason: null, adTimerInterval: null
};

/* --- MENU LOGIC --- */
const Menu = {
    init: () => {
        setTimeout(() => {
            document.getElementById('splashScreen').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('splashScreen').style.display = 'none';
                document.getElementById('gameMenu').style.display = 'flex';
            }, 500);
        }, 2500);
    },
    startGame: () => {
        document.getElementById('gameMenu').style.display = 'none';
        const gameDiv = document.getElementById('mainGame');
        gameDiv.classList.add('active'); // Add class to trigger correct CSS display
        Game.drawWheel();
        UI.log("Welcome! Good Luck.", "info");
    },
    showRules: () => { document.getElementById('rulesModal').style.display = 'flex'; },
    closeRules: () => { document.getElementById('rulesModal').style.display = 'none'; }
}

/* --- AUDIO & GAME LOGIC (Unchanged but included) --- */
const AudioCtx = new (window.AudioContext || window.webkitAudioContext)();
const Sound = {
    play: (freq, type, dur) => {
        if(!document.getElementById('soundToggle').checked) return;
        if(AudioCtx.state === 'suspended') AudioCtx.resume();
        const osc = AudioCtx.createOscillator();
        const gain = AudioCtx.createGain();
        osc.type = type; osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.1, AudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, AudioCtx.currentTime + dur);
        osc.connect(gain); gain.connect(AudioCtx.destination);
        osc.start(); osc.stop(AudioCtx.currentTime + dur);
    },
    click: () => Sound.play(800, 'sine', 0.1),
    tick: () => Sound.play(1200, 'triangle', 0.05),
    win: () => { Sound.play(500, 'sine', 0.2); setTimeout(() => Sound.play(700, 'sine', 0.2), 150); setTimeout(() => Sound.play(1000, 'square', 0.4), 300); },
    lose: () => Sound.play(150, 'sawtooth', 0.4)
};

const Game = {
    init: () => {
        Game.drawWheel(); Game.renderNumberGrid();
        const saved = localStorage.getItem('royalBalance');
        if(saved) STATE.balance = parseInt(saved);
        Game.updateUI();
        window.addEventListener('resize', Game.drawWheel);
    },
    save: () => { localStorage.setItem('royalBalance', STATE.balance); },
    renderNumberGrid: () => {
        const grid = document.getElementById('numberGrid'); grid.innerHTML = '';
        for(let i=1; i<=10; i++) {
            const btn = document.createElement('button');
            btn.className = `num-btn ${i === STATE.targetNumber ? 'selected' : ''}`;
            btn.innerText = i; btn.onclick = () => Game.selectNumber(i);
            grid.appendChild(btn);
        }
    },
    selectNumber: (num) => { if(STATE.isSpinning) return; STATE.targetNumber = num; Game.renderNumberGrid(); Sound.click(); },
    setRisk: (level) => {
        if(STATE.isSpinning) return; STATE.risk = level;
        document.querySelectorAll('.risk-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`risk${level.charAt(0).toUpperCase() + level.slice(1)}`).classList.add('active');
        Sound.click();
    },
    setBet: (amount) => {
        if(STATE.isSpinning) return; STATE.bet = amount;
        document.getElementById('currentBetDisplay').innerText = `₹${amount}`;
        document.querySelectorAll('.chip').forEach(c => {
            c.classList.remove('active');
            if(parseInt(c.innerText) === amount || (c.innerText === '1k' && amount === 1000)) c.classList.add('active');
        });
        Sound.click();
    },
    setSkin: (skin) => { STATE.skin = skin; Game.drawWheel(); },
    tryVip: () => { if(STATE.vipUnlocked) { Game.setSkin('vip'); } else { Game.watchAd('vip'); } },
    spin: () => {
        if(STATE.isSpinning) return;
        if(STATE.balance < STATE.bet) { UI.log("Insufficient funds! Add money.", "lose"); return; }
        STATE.balance -= STATE.bet; Game.updateUI();
        STATE.isSpinning = true; document.getElementById('spinBtn').disabled = true;
        UI.log(`Spinning... Bet: ₹${STATE.bet}`, "info");
        let resultNumber = Math.floor(Math.random() * 10) + 1; 
        if (resultNumber === STATE.targetNumber) {
            let forceLoss = false;
            if (STATE.risk === 'high' && Math.random() < 0.7) forceLoss = true;
            if (STATE.risk === 'med' && Math.random() < 0.4) forceLoss = true;
            if (forceLoss) resultNumber = (resultNumber % 10) + 1;
        }
        const segSize = 360 / 10;
        const segmentCenter = ((resultNumber - 1) * segSize) + (segSize / 2);
        const targetRotation = 270 - segmentCenter;
        const jitter = (Math.random() * 28) - 14; 
        const spins = 5;
        const currentMod = currentRotation % 360;
        let diff = (targetRotation - currentMod);
        if(diff < 0) diff += 360;
        const finalRot = currentRotation + (spins * 360) + diff + jitter;
        Game.animate(finalRot, resultNumber);
    },
    animate: (targetRot, result) => {
        const start = currentRotation; const change = targetRot - start;
        const duration = document.getElementById('turboMode').checked ? 2000 : 4000;
        const startTime = performance.now();
        function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            currentRotation = start + (change * ease);
            const canvas = document.getElementById('wheelCanvas');
            canvas.style.transform = `rotate(${currentRotation}deg)`;
            if(Math.floor(currentRotation / 36) !== Math.floor((currentRotation - change*0.01)/36)) Sound.tick();
            if(progress < 1) requestAnimationFrame(step); else Game.endSpin(result);
        }
        requestAnimationFrame(step);
    },
    endSpin: (result) => {
        STATE.isSpinning = false; document.getElementById('spinBtn').disabled = false;
        const riskData = CONFIG.payouts[STATE.risk];
        let won = (result === STATE.targetNumber);
        if(won) {
            const payout = Math.floor(STATE.bet * riskData.mult);
            STATE.balance += payout;
            UI.log(`WINNER! Hit ${result}. Won ₹${payout}`, "win");
            Sound.win();
        } else {
            UI.log(`Result: ${result}. Lost ₹${STATE.bet}`, "lose");
            Sound.lose();
        }
        Game.save(); Game.updateUI();
    },
    watchAd: (reason) => {
        STATE.adReason = reason; const modal = document.getElementById('adModal');
        const timer = document.getElementById('adTimer'); const bar = document.getElementById('adProgress');
        const text = document.getElementById('adReason'); const closeBtn = document.getElementById('adCloseBtn');
        const timerSection = document.getElementById('timerSection');
        modal.style.display = 'flex'; 
        text.innerText = reason === 'money' ? 'add ₹100' : 'unlock VIP Wheel';
        closeBtn.style.display = 'none'; timerSection.style.display = 'block'; 
        bar.style.width = '0%'; bar.style.transition = 'none';
        let timeLeft = 10; timer.innerText = timeLeft;
        setTimeout(() => { bar.style.transition = 'width 10s linear'; bar.style.width = '100%'; }, 50);
        if(STATE.adTimerInterval) clearInterval(STATE.adTimerInterval);
        STATE.adTimerInterval = setInterval(() => {
            timeLeft--; timer.innerText = timeLeft;
            if(timeLeft <= 0) { clearInterval(STATE.adTimerInterval); timerSection.style.display = 'none'; closeBtn.style.display = 'block'; }
        }, 1000);
    },
    closeAd: () => { document.getElementById('adModal').style.display = 'none'; Game.completeAd(STATE.adReason); STATE.adReason = null; },
    completeAd: (reason) => {
        if(reason === 'money') { STATE.balance += 100; UI.log("Ad Reward: Added ₹100", "win"); }
        else if(reason === 'vip') { STATE.vipUnlocked = true; document.getElementById('vipLockIcon').className = 'fas fa-unlock'; Game.setSkin('vip'); UI.log("VIP Wheel Unlocked!", "win"); }
        Game.updateUI(); Game.save();
    },
    updateUI: () => { document.getElementById('balanceDisplay').innerText = STATE.balance; },
    drawWheel: () => {
        const canvas = document.getElementById('wheelCanvas'); if (!canvas) return;
        const ctx = canvas.getContext('2d'); const w = canvas.width; const h = canvas.height;
        const cx = w/2; const cy = h/2; const r = w/2 - 20;
        ctx.clearRect(0,0,w,h);
        const isVip = STATE.skin === 'vip'; const segSize = (Math.PI * 2) / 10;
        if(isVip) { ctx.save(); ctx.shadowBlur = 30; ctx.shadowColor = "#D4AF37"; ctx.beginPath(); ctx.arc(cx, cy, r + 10, 0, Math.PI*2); ctx.strokeStyle = "rgba(212, 175, 55, 0.5)"; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
        for(let i=0; i<10; i++) {
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, i*segSize, (i+1)*segSize);
            if (isVip) {
                const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                if (i % 2 === 0) { grd.addColorStop(0, '#FFF5C3'); grd.addColorStop(0.5, '#D4AF37'); grd.addColorStop(1, '#AA8C2C'); }
                else { grd.addColorStop(0, '#444'); grd.addColorStop(0.6, '#111'); grd.addColorStop(1, '#000'); }
                ctx.fillStyle = grd;
            } else { ctx.fillStyle = CONFIG.colors[i]; }
            ctx.fill();
            ctx.strokeStyle = isVip ? '#FFD700' : '#D4AF37'; ctx.lineWidth = isVip ? 2 : 2; ctx.stroke();
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(i*segSize + segSize/2); ctx.textAlign = "right";
            if (isVip) { ctx.fillStyle = i%2===0 ? '#000' : '#FFD700'; ctx.shadowColor = i%2===0 ? "transparent" : "#D4AF37"; ctx.shadowBlur = 10; }
            else { ctx.fillStyle = '#fff'; }
            ctx.font = isVip ? "900 55px Cinzel" : "bold 50px Cinzel"; ctx.fillText(i+1, r - 30, 15); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2);
        if (isVip) {
            const ringGrad = ctx.createLinearGradient(0, 0, w, h);
            ringGrad.addColorStop(0, '#D4AF37'); ringGrad.addColorStop(0.25, '#FFF'); ringGrad.addColorStop(0.5, '#D4AF37'); ringGrad.addColorStop(0.75, '#FFF'); ringGrad.addColorStop(1, '#D4AF37');
            ctx.strokeStyle = ringGrad; ctx.lineWidth = 15; ctx.stroke();
            for(let j=0; j<40; j++) {
                const angle = (Math.PI * 2 * j) / 40; const dotX = cx + (r * Math.cos(angle)); const dotY = cy + (r * Math.sin(angle));
                ctx.beginPath(); ctx.arc(dotX, dotY, 4, 0, Math.PI*2); ctx.fillStyle = "#fff"; ctx.shadowBlur = 5; ctx.shadowColor = "#fff"; ctx.fill();
            }
        } else { ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 10; ctx.stroke(); }
    }
};

const UI = {
    log: (msg, type) => {
        const container = document.getElementById('historyLog'); const div = document.createElement('div');
        div.className = `log-item ${type}`;
        let icon = 'fa-info-circle'; if(type === 'win') icon = 'fa-trophy'; if(type === 'lose') icon = 'fa-times-circle';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        div.innerHTML = `<i class="fas ${icon}" style="font-size:1.1rem;"></i><span>${msg}</span><span class="log-time">${time}</span>`;
        container.prepend(div); if(container.children.length > 50) container.removeChild(container.lastChild);
    },
    clearHistory: () => { document.getElementById('historyLog').innerHTML = ''; }
};

let currentRotation = 0; window.game = Game; window.onload = Menu.init; Game.init();