// ---------- Splash Screen Transition ----------
    document.getElementById('play-btn').addEventListener('click', function() {
      const splash = document.getElementById('splash-screen');
      splash.classList.add('hidden');
      
      setTimeout(() => {
        splash.style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
      }, 500);
    });

    // ---------- CONFIG (you can tweak here) ----------
    // Increase per-mine risk bonus factor: each extra mine adds 0.5× step to every safe click multiplier.
    // Change step or baseMines as you like.
    const RISK = {
      step: 0.5,     // ← ek mine badhane par +0.5×
      baseMines: 1   // comparison baseline mines
    };

    // ---------- Utility ----------
    const el = id => document.getElementById(id);
    const formatINR = v => `₹${Number(v).toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

    // Simple SHA-256 (browser SubtleCrypto)
    async function sha256(str){
      const buf = new TextEncoder().encode(str);
      const hash = await crypto.subtle.digest('SHA-256', buf);
      const bytes = Array.from(new Uint8Array(hash));
      return bytes.map(b=>b.toString(16).padStart(2,'0')).join('');
    }

    // Deterministic PRNG (Mulberry32)
    function mulberry32(seed){
      let t = seed >>> 0;
      return function(){
        t += 0x6D2B79F5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
      }
    }

    function hashToSeedInt(hex){
      // take first 8 hex chars => 32-bit int
      return parseInt(hex.slice(0,8),16) >>> 0;
    }

    function toast(msg){
      const t = el('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(()=>t.classList.remove('show'), 1800);
    }

    // ---------- Game State ----------
    const STATE = {
      balance: 1000,
      bet: 10,
      mines: 3,
      total: 25,
      serverSeed: '',
      clientSeed: 'tukda-bhai',
      nonce: 0,
      roundActive: false,
      opened: new Set(),
      mineSet: new Set(),
      multiplier: 1,
    };

    const AUTO = {
      running: false,
      remaining: 0,
      targetClicks: 1,
      intervalMs: 1200,
      timer: null,
      roundClicks: 0,
    };

    // ---------- UI Setup ----------
    const grid = el('grid');
    const betInput = el('bet');
    const mineRange = el('mineCount');
    const mineView = el('mineCountView');
    const clientSeedInput = el('clientSeed');
    const startBtn = el('start');
    const cashoutBtn = el('cashout');
    const revealAllBtn = el('revealAll');
    const addFunds = el('addFunds');

    function drawGrid(){
      grid.innerHTML = '';
      for(let i=0;i<STATE.total;i++){
        const d = document.createElement('button');
        d.className = 'tile';
        d.dataset.idx = i;
        d.addEventListener('click', ()=>onTile(i,d));
        grid.appendChild(d);
      }
      updateKpis();
    }

    function riskBonus(){
      return Math.max(0, 1 + RISK.step * (STATE.mines - RISK.baseMines));
    }

    function updateKpis(){
      el('balance').textContent = formatINR(STATE.balance);
      el('betView').textContent = formatINR(STATE.bet);
      el('multView').textContent = `${STATE.multiplier.toFixed(2)}×`;
      const pot = STATE.bet * STATE.multiplier;
      el('potView').textContent = formatINR(pot);

      const safeTotal = STATE.total - STATE.mines;
      el('revealedView').textContent = `${STATE.opened.size} / ${safeTotal}`;
      el('nonce').textContent = String(STATE.nonce);

      // auto status
      el('autoStatus').textContent = AUTO.running ? `running (${AUTO.remaining} left)` : 'idle';
    }

    function refreshControls(){
      betInput.value = STATE.bet;
      mineRange.value = STATE.mines;
      mineView.textContent = STATE.mines;
      clientSeedInput.value = STATE.clientSeed;

      betInput.disabled = STATE.roundActive;
      mineRange.disabled = STATE.roundActive;
      clientSeedInput.disabled = STATE.roundActive;
      startBtn.disabled = STATE.roundActive;
      cashoutBtn.disabled = !STATE.roundActive || STATE.opened.size===0;
    }

    // ---------- Provably-fair like mine placement ----------
    async function newRound(){
      // Validate bet
      STATE.bet = Math.max(1, Math.floor(Number(betInput.value)||10));
      if(STATE.bet > STATE.balance){ toast('Insufficient balance'); stopAuto(); return; }

      STATE.clientSeed = clientSeedInput.value.trim() || 'client';
      STATE.mines = Math.max(1, Math.min(24, Number(mineRange.value)||3));
      STATE.nonce += 1;
      STATE.roundActive = true;
      STATE.opened = new Set();
      STATE.multiplier = 1; // reset
      AUTO.roundClicks = 0;

      // Hidden server seed for this round
      STATE.serverSeed = crypto.getRandomValues(new Uint32Array(4)).join('-');
      const seedStr = `${STATE.serverSeed}|${STATE.clientSeed}|${STATE.nonce}`;
      const hex = await sha256(seedStr);
      const seedInt = hashToSeedInt(hex);
      const prng = mulberry32(seedInt);

      // Generate mine indices by shuffling 0..24 using PRNG and taking first N
      const arr = Array.from({length:STATE.total}, (_,i)=>i);
      for(let i=arr.length-1;i>0;i--){
        const j = Math.floor(prng()* (i+1));
        [arr[i],arr[j]] = [arr[j],arr[i]];
      }
      STATE.mineSet = new Set(arr.slice(0, STATE.mines));

      // UI
      drawGrid();
      refreshControls();
      const seedPreview = (await sha256(STATE.serverSeed)).slice(0,16);
      el('seedHash').textContent = `serverSeedHash: ${seedPreview}…`;
      el('serverSeed').textContent = 'Hidden until round ends';
      toast('Round started!');
    }

    function fairStepMultiplier(){
      // Base fair odds for this step
      const opened = STATE.opened.size;
      const total = STATE.total;
      const mines = STATE.mines;
      const remainingCells = total - opened;
      const remainingSafe = (total - mines) - opened;
      if(remainingSafe <= 0) return STATE.multiplier;

      // Risk bonus scales with mines count
      const step = (remainingCells / remainingSafe) * riskBonus();
      return STATE.multiplier * step;
    }

    function revealTile(idx, btn){
      const isMine = STATE.mineSet.has(idx);
      btn.classList.add('revealed');
      if(isMine){
        btn.classList.add('mine');
        btn.innerHTML = '<img src="img/bomb.gif" width="80" height="80" alt="Mine">';
      }else{
        btn.classList.add('safe');
        btn.innerHTML = '<img src="img/diamond.gif" width="80" height="80" alt="Mine">';
      }
      btn.disabled = true;
    }

    function revealAll(){
      const tiles = grid.querySelectorAll('.tile');
      tiles.forEach((b,i)=>{
        if(!b.classList.contains('revealed')){
          b.classList.add('revealed');
          if(STATE.mineSet.has(i)){
            b.classList.add('mine'); b.innerHTML='<img src="img/bomb.gif" width="80" height="80" alt="Mine">';
          }else{ b.classList.add('safe'); b.innerHTML='<img src="img/diamond.gif" width="80" height="80" alt="Mine">'; }
          b.disabled = true;
        }
      });
    }

    function endRound(lost=false){
      STATE.roundActive = false;
      refreshControls();
      revealAll();
      el('serverSeed').textContent = STATE.serverSeed;
      el('seedHash').textContent = 'seed: –';
      if(AUTO.running){
        AUTO.remaining = Math.max(0, AUTO.remaining - 1);
        updateKpis();
      }
    }

    function playClick(){ const a = el('sndClick'); a && a.play().catch(()=>{}); }
    function playBlast(){ const a = el('sndBlast'); a && a.play().catch(()=>{}); }

    function onTile(idx, btn){
      if(!STATE.roundActive) return;
      if(btn.classList.contains('revealed')) return;

      const isMine = STATE.mineSet.has(idx);
      revealTile(idx, btn);

      if(isMine){
        playBlast();
        // lose bet
        STATE.balance -= STATE.bet;
        toast('Boom! You hit a mine. -' + formatINR(STATE.bet));
        endRound(true);
        updateKpis();
      }else{
        playClick();
        STATE.opened.add(idx);
        // update multiplier fairly + risk bonus
        STATE.multiplier = fairStepMultiplier();
        updateKpis();
        cashoutBtn.disabled = false;

        if(AUTO.running){
          AUTO.roundClicks += 1;
          if(AUTO.roundClicks >= AUTO.targetClicks){
            cashout();
          }
        }
      }
    }

    function cashout(){
      if(!STATE.roundActive || STATE.opened.size===0) return;
      const win = +(STATE.bet * STATE.multiplier).toFixed(2);
      STATE.balance += (win - STATE.bet); // net profit added
      toast('Cashed out: +'+formatINR(win - STATE.bet));
      endRound(false);
      updateKpis();
    }

    // ---------- Auto Play ----------
    function randomUnopenedIndex(){
      const tiles = [];
      for(let i=0;i<STATE.total;i++){
        if(!STATE.opened.has(i)){
          const btn = grid.children[i];
          if(!btn.classList.contains('revealed')) tiles.push(i);
        }
      }
      if(!tiles.length) return -1;
      return tiles[Math.floor(Math.random()*tiles.length)];
    }

    function autoTick(){
      if(!AUTO.running){ return; }
      if(AUTO.remaining <= 0){ stopAuto(); return; }

      if(!STATE.roundActive){
        newRound();
        return;
      }
      // If round active, click a random cell
      const idx = randomUnopenedIndex();
      if(idx === -1){ cashout(); return; }
      const btn = grid.children[idx];
      onTile(idx, btn);
    }

    function startAuto(){
      AUTO.remaining = Math.max(1, Number(el('autoCount').value)||1);
      AUTO.targetClicks = Math.max(1, Math.min(24, Number(el('autoClicks').value)||1));
      AUTO.intervalMs = Math.max(300, Number(el('autoMs').value)||1200);
      if(AUTO.running) stopAuto();
      AUTO.running = true;
      el('autoStatus').textContent = `running (${AUTO.remaining} left)`;
      AUTO.timer = setInterval(autoTick, AUTO.intervalMs);
      setTimeout(autoTick, 50);
      toast('Auto started');
    }

    function stopAuto(){
      AUTO.running = false;
      if(AUTO.timer) clearInterval(AUTO.timer);
      AUTO.timer = null;
      el('autoStatus').textContent = 'idle';
      toast('Auto stopped');
    }

    // ---------- Events ----------
    betInput.addEventListener('change', ()=>{ STATE.bet = Math.max(1, Math.floor(Number(betInput.value)||10)); updateKpis(); });
    mineRange.addEventListener('input', ()=>{ STATE.mines = Number(mineRange.value); mineView.textContent = STATE.mines; updateKpis(); });
    clientSeedInput.addEventListener('change', ()=>{ STATE.clientSeed = clientSeedInput.value; });

    startBtn.addEventListener('click', newRound);
    cashoutBtn.addEventListener('click', cashout);
    revealAllBtn.addEventListener('click', ()=>{ revealAll(); });
    addFunds.addEventListener('click', ()=>{ STATE.balance += 1000; updateKpis(); toast('Funds added'); });

    el('autoStart').addEventListener('click', startAuto);
    el('autoStop').addEventListener('click', stopAuto);

    // ---------- Init ----------
    drawGrid();
    refreshControls();
    updateKpis();