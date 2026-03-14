// === Hitster Game Logic ===

const app = {
    // Game state
    players: [],
    currentPlayerIndex: 0,
    deck: [],
    currentCard: null,
    selectedSlot: null,
    round: 1,
    tokenEarnedThisTurn: false,
    gamePhase: 'setup', // setup | playing | finished
    spotifyController: null,
    spotifyReady: false,
    spotifyIFrameAPI: null,
    cardsToWin: 5,

    // === SETUP ===
    init() {
        this.bindSetupEvents();
    },

    bindSetupEvents() {
        const input = document.getElementById('player-name-input');
        const addBtn = document.getElementById('add-player-btn');
        const startBtn = document.getElementById('start-game-btn');

        addBtn.addEventListener('click', () => this.addPlayer());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addPlayer();
        });
        startBtn.addEventListener('click', () => this.startGame());
    },

    addPlayer() {
        const input = document.getElementById('player-name-input');
        const name = input.value.trim();
        if (!name) return;
        if (this.players.length >= 10) return;
        if (this.players.some(p => p.name === name)) {
            input.value = '';
            return;
        }

        this.players.push({
            name,
            timeline: [],
            tokens: 2
        });

        input.value = '';
        input.focus();
        this.renderPlayerList();
        this.updateStartButton();
    },

    removePlayer(index) {
        this.players.splice(index, 1);
        this.renderPlayerList();
        this.updateStartButton();
    },

    renderPlayerList() {
        const list = document.getElementById('player-list');
        list.innerHTML = this.players.map((p, i) => `
            <div class="player-item player-color-${i}">
                <span class="player-item-name">${this.escapeHtml(p.name)}</span>
                <button class="remove-btn" onclick="app.removePlayer(${i})">✕</button>
            </div>
        `).join('');

        const hint = document.getElementById('player-count-hint');
        const count = this.players.length;
        if (count === 0) {
            hint.textContent = 'הוסיפו 2-10 שחקנים כדי להתחיל';
        } else if (count === 1) {
            hint.textContent = 'צריך לפחות עוד שחקן אחד';
        } else {
            hint.textContent = `${count} שחקנים מוכנים!`;
        }
    },

    updateStartButton() {
        const btn = document.getElementById('start-game-btn');
        btn.disabled = this.players.length < 2;
    },

    adjustCardsToWin(delta) {
        this.cardsToWin = Math.min(10, Math.max(3, this.cardsToWin + delta));
        document.getElementById('cards-to-win-value').textContent = this.cardsToWin;
    },

    // === SPOTIFY LOGIN ===
    openSpotifyLogin() {
        window.open('https://accounts.spotify.com/login', '_blank', 'width=500,height=700');
        // Update text to remind user
        const text = document.getElementById('spotify-login-text');
        text.textContent = 'התחברתם? השירים ינוגנו במלואם!';
        const btn = document.getElementById('spotify-login-btn');
        btn.textContent = '✓ מחובר';
        btn.classList.add('btn-spotify-connected');
    },

    // === GAME START ===
    startGame() {
        if (this.players.length < 2) return;

        // Shuffle deck
        this.deck = this.shuffleArray([...SONGS]);
        document.getElementById('cards-to-win-display').textContent = this.cardsToWin;
        this.currentPlayerIndex = 0;
        this.round = 1;
        this.gamePhase = 'playing';

        // Give each player their starting card
        this.players.forEach(p => {
            p.timeline = [];
            p.tokens = 2;
            if (this.deck.length > 0) {
                const card = this.deck.pop();
                p.timeline.push(card);
            }
        });

        this.showScreen('game-screen');
        this.startTurn();
    },

    // === TURN MANAGEMENT ===
    startTurn() {
        if (this.deck.length === 0) {
            this.endGameNoCards();
            return;
        }

        this.currentCard = this.deck.pop();
        this.selectedSlot = null;
        this.tokenEarnedThisTurn = false;

        // Update UI
        this.updateTopBar();
        this.updateScoreboard();
        this.loadSong(this.currentCard.spotifyId);
        this.showOverlay();
        this.renderTimeline();
        this.updateTokenButtons();

        document.getElementById('earn-token-btn').disabled = false;
    },

    updateTopBar() {
        document.getElementById('round-number').textContent = this.round;
        const player = this.players[this.currentPlayerIndex];
        const nameEl = document.getElementById('current-player-name');
        nameEl.textContent = player.name;
        this.triggerAnimEl(nameEl, 'anim-turn');
    },

    updateScoreboard() {
        const sb = document.getElementById('scoreboard');
        sb.innerHTML = this.players.map((p, i) => `
            <div class="score-item ${i === this.currentPlayerIndex ? 'active-player' : ''} player-color-${i}">
                <span class="score-name">${this.escapeHtml(p.name)}</span>
                <span class="score-cards">🃏 ${p.timeline.length}</span>
                <span class="score-tokens">🪙 ${p.tokens}</span>
            </div>
        `).join('');
    },

    // === SPOTIFY EMBED PLAYER ===
    initSpotifyEmbed(spotifyId) {
        const element = document.getElementById('spotify-embed');

        const createController = (IFrameAPI) => {
            element.innerHTML = '';
            const options = {
                uri: `spotify:track:${spotifyId}`,
                width: '100%',
                height: 80,
            };
            IFrameAPI.createController(element, options, (controller) => {
                this.spotifyController = controller;
                this.spotifyReady = true;
                console.log('Spotify embed ready');
            });
        };

        if (this.spotifyIFrameAPI) {
            createController(this.spotifyIFrameAPI);
        } else {
            window.onSpotifyIframeApiReady = (IFrameAPI) => {
                this.spotifyIFrameAPI = IFrameAPI;
                createController(IFrameAPI);
            };
        }
    },

    loadSong(spotifyId) {
        if (this.spotifyController && this.spotifyReady) {
            this.spotifyController.loadUri(`spotify:track:${spotifyId}`);
        } else {
            this.initSpotifyEmbed(spotifyId);
        }
    },

    playFromOverlay() {
        if (this.spotifyController && this.spotifyReady) {
            this.spotifyController.play();
        } else {
            console.log('Spotify not ready, retrying in 500ms...');
            setTimeout(() => this.playFromOverlay(), 500);
        }
    },

    showOverlay() {
        const overlay = document.getElementById('player-overlay');
        overlay.classList.remove('hidden');
        const songInfo = document.getElementById('song-info');
        songInfo.classList.add('hidden');
    },

    toggleOverlay() {
        const overlay = document.getElementById('player-overlay');
        const songInfo = document.getElementById('song-info');

        // Hide the overlay to reveal the Spotify player
        overlay.classList.add('hidden');

        // Show song info
        if (this.currentCard) {
            songInfo.innerHTML = `<span class="song-info-year">${this.currentCard.year}</span>
                <span class="song-info-title">${this.escapeHtml(this.currentCard.title)}</span>
                <span class="song-info-artist">${this.escapeHtml(this.currentCard.artist)}</span>`;
            songInfo.classList.remove('hidden');
        }
    },

    // === TIMELINE ===
    renderTimeline() {
        const player = this.players[this.currentPlayerIndex];
        document.getElementById('timeline-player-name').textContent = player.name;

        const container = document.getElementById('timeline-cards');
        const sorted = [...player.timeline].sort((a, b) => b.year - a.year);

        let html = '';

        // Placement slot before first card (biggest year side)
        html += this.createSlot(0, sorted.length === 0 ? 'מקם כאן' : `${sorted[0].year} <`);

        sorted.forEach((card, i) => {
            html += this.createCardHtml(card);
            const label = i < sorted.length - 1
                ? `${sorted[i + 1].year} >=< ${card.year}`
                : `> ${card.year}`;
            html += this.createSlot(i + 1, label);
        });

        container.innerHTML = html;

        // Bind slot clicks
        container.querySelectorAll('.placement-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                container.querySelectorAll('.placement-slot').forEach(s => s.classList.remove('selected'));
                slot.classList.add('selected');
                this.selectedSlot = parseInt(slot.dataset.index);
                document.getElementById('placement-hint').textContent =
                    `מיקום נבחר: ${slot.querySelector('.slot-label').textContent}`;
            });
        });
    },

    createSlot(index, label) {
        return `<div class="placement-slot" data-index="${index}">
            <span class="slot-label">${label}</span>
        </div>`;
    },

    createCardHtml(card) {
        const imgUrl = card.imageUrl || '';
        const imgStyle = imgUrl ? `background-image: url('${imgUrl}')` : '';
        return `<div class="timeline-card flip-card" data-song-id="${card.spotifyId}">
            <div class="flip-card-inner">
                <div class="flip-card-front">
                    <div class="card-inner">
                        <div class="card-corner card-corner-top">${card.year}</div>
                        <div class="card-center">
                            <div class="card-icon">♪</div>
                            <div class="card-year">${card.year}</div>
                            <div class="card-title">${this.escapeHtml(card.title)}</div>
                            <div class="card-artist">${this.escapeHtml(card.artist)}</div>
                        </div>
                        <div class="card-corner card-corner-bottom">${card.year}</div>
                    </div>
                </div>
                <div class="flip-card-back" style="${imgStyle}">
                    <div class="flip-back-overlay">
                        <div class="flip-back-artist">${this.escapeHtml(card.artist)}</div>
                        <div class="flip-back-title">${this.escapeHtml(card.title)}</div>
                        <div class="flip-back-year">${card.year}</div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    // === ACTIONS ===
    markCorrect() {
        if (this.selectedSlot === null) {
            document.getElementById('placement-hint').textContent = '⚠️ בחרו מיקום על ציר הזמן קודם!';
            return;
        }

        const player = this.players[this.currentPlayerIndex];
        const sorted = [...player.timeline].sort((a, b) => b.year - a.year);

        // Insert card at position
        sorted.splice(this.selectedSlot, 0, this.currentCard);

        // Check if placement is actually correct (year order - descending)
        let isCorrect = true;
        for (let i = 1; i < sorted.length; i++) {
            if (sorted[i].year > sorted[i - 1].year) {
                isCorrect = false;
                break;
            }
        }

        // Add to timeline regardless (host said correct)
        player.timeline.push(this.currentCard);
        this.currentCard = null;

        // Check win
        if (player.timeline.length >= this.cardsToWin) {
            this.finishGame(player);
            return;
        }

        this.renderTimeline();
        this.updateScoreboard();
        this.selectedSlot = null;
        this.showHint('✅ קלף נוסף לציר הזמן!');
        this.triggerAnim('timeline-container', 'anim-correct');
        this.triggerScoreAnim('anim-score');
    },

    markWrong() {
        this.currentCard = null;
        this.showHint('❌ הקלף הושלך. תור הבא!');
        this.selectedSlot = null;
        this.triggerAnim('timeline-container', 'anim-wrong');
    },

    earnToken() {
        if (this.tokenEarnedThisTurn) return;
        const player = this.players[this.currentPlayerIndex];
        if (player.tokens >= 5) return;

        player.tokens++;
        this.tokenEarnedThisTurn = true;
        document.getElementById('earn-token-btn').disabled = true;
        this.updateScoreboard();
        this.updateTokenButtons();
        this.triggerScoreAnim('anim-token');
    },

    skipSong() {
        const player = this.players[this.currentPlayerIndex];
        if (player.tokens < 1) return;

        player.tokens--;
        this.updateScoreboard();

        // Flip animation then draw new card
        this.triggerAnim('spotify-container', 'anim-skip');
        setTimeout(() => {
            if (this.deck.length === 0) {
                this.endGameNoCards();
                return;
            }
            this.currentCard = this.deck.pop();
            this.loadSong(this.currentCard.spotifyId);
            this.showOverlay();
            this.selectedSlot = null;
            this.renderTimeline();
            this.updateTokenButtons();
            this.showHint('🎵 שיר חדש! בחרו מיקום על ציר הזמן');
        }, 400);
    },

    tradeTokens() {
        const player = this.players[this.currentPlayerIndex];
        if (player.tokens < 3) return;
        if (this.deck.length === 0) return;

        player.tokens -= 3;
        const freeCard = this.deck.pop();
        player.timeline.push(freeCard);

        // Check win
        if (player.timeline.length >= this.cardsToWin) {
            this.finishGame(player);
            return;
        }

        this.renderTimeline();
        this.updateScoreboard();
        this.updateTokenButtons();
        this.showHint(`🔄 הקלף "${freeCard.title}" (${freeCard.year}) נוסף אוטומטית!`);
        this.triggerAnim('timeline-container', 'anim-correct');
        this.triggerScoreAnim('anim-score');
    },

    updateTokenButtons() {
        const player = this.players[this.currentPlayerIndex];
        document.getElementById('skip-btn').disabled = player.tokens < 1;
        document.getElementById('trade-btn').disabled = player.tokens < 3;
    },

    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        if (this.currentPlayerIndex === 0) {
            this.round++;
        }
        this.startTurn();
    },

    // === END GAME ===
    finishGame(winner) {
        this.gamePhase = 'finished';
        document.getElementById('winner-name').textContent = winner.name;

        // Sort players by cards
        const sorted = [...this.players].sort((a, b) => b.timeline.length - a.timeline.length);
        const fsb = document.getElementById('final-scoreboard');
        fsb.innerHTML = sorted.map((p, i) => `
            <div class="final-score-item ${p === winner ? 'winner' : ''}">
                <span class="final-rank">${i + 1}.</span>
                <span class="final-name">${this.escapeHtml(p.name)}</span>
                <span class="final-cards">🃏 ${p.timeline.length}</span>
            </div>
        `).join('');

        document.getElementById('winner-overlay').classList.remove('hidden');
        this.launchConfetti();
    },

    endGameNoCards() {
        // Find player with most cards
        const sorted = [...this.players].sort((a, b) => b.timeline.length - a.timeline.length);
        this.finishGame(sorted[0]);
    },

    resetGame() {
        document.getElementById('winner-overlay').classList.add('hidden');
        this.players.forEach(p => {
            p.timeline = [];
            p.tokens = 2;
        });
        this.currentPlayerIndex = 0;
        this.round = 1;
        this.gamePhase = 'setup';
        this.showScreen('setup-screen');
    },

    // === CONFETTI ===
    launchConfetti() {
        const container = document.getElementById('confetti');
        container.innerHTML = '';
        const colors = ['#e94560', '#f5c518', '#2ecc71', '#3498db', '#9b59b6', '#ff6b81'];

        for (let i = 0; i < 60; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + 'vw';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDuration = (2 + Math.random() * 3) + 's';
            piece.style.animationDelay = Math.random() * 2 + 's';
            piece.style.width = (6 + Math.random() * 8) + 'px';
            piece.style.height = (6 + Math.random() * 8) + 'px';
            piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
            container.appendChild(piece);
        }
    },

    // === UTILITIES ===
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        document.getElementById(screenId).classList.add('active');
    },

    shuffleArray(arr) {
        // Fisher-Yates shuffle
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        // Check if two artists are related (exact match or one contains the other)
        const sameArtist = (a, b) => {
            if (a === b) return true;
            const na = a.replace(/\s+/g, ' ').trim();
            const nb = b.replace(/\s+/g, ' ').trim();
            // Check if first word (main artist name) matches
            const firstA = na.split(' ').slice(0, 2).join(' ');
            const firstB = nb.split(' ').slice(0, 2).join(' ');
            if (firstA === firstB) return true;
            // Check containment
            if (na.includes(nb) || nb.includes(na)) return true;
            return false;
        };
        // Ensure no consecutive songs by the same/related artist (multiple passes)
        for (let pass = 0; pass < 3; pass++) {
            for (let i = 1; i < arr.length; i++) {
                if (sameArtist(arr[i].artist, arr[i - 1].artist)) {
                    for (let j = i + 1; j < arr.length; j++) {
                        if (!sameArtist(arr[j].artist, arr[i - 1].artist) &&
                            (i + 1 >= arr.length || !sameArtist(arr[j].artist, arr[i + 1]?.artist))) {
                            [arr[i], arr[j]] = [arr[j], arr[i]];
                            break;
                        }
                    }
                }
            }
        }
        return arr;
    },

    // === ANIMATION HELPERS ===
    triggerAnim(elementId, className) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.classList.remove(className);
        void el.offsetWidth; // force reflow
        el.classList.add(className);
        el.addEventListener('animationend', () => el.classList.remove(className), { once: true });
    },

    triggerAnimEl(el, className) {
        if (!el) return;
        el.classList.remove(className);
        void el.offsetWidth;
        el.classList.add(className);
        el.addEventListener('animationend', () => el.classList.remove(className), { once: true });
    },

    triggerScoreAnim(className) {
        const scoreItem = document.querySelectorAll('.score-item')[this.currentPlayerIndex];
        if (!scoreItem) return;
        scoreItem.classList.remove(className);
        void scoreItem.offsetWidth;
        scoreItem.classList.add(className);
        scoreItem.addEventListener('animationend', () => scoreItem.classList.remove(className), { once: true });
    },

    showHint(text) {
        const hint = document.getElementById('placement-hint');
        hint.textContent = text;
        this.triggerAnimEl(hint, 'anim-hint');
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => app.init());
