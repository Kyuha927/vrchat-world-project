// Character Select System — 빌런 에이전트 선택 화면
// Loads character profiles from JSON and manages the selection UI

const CHARACTER_PROFILES = {};
let selectedCharId = 'deathammer';
let charSelectAnimFrame = 0;

// Load all character profiles
async function loadCharacterProfiles() {
  const res = await fetch('characters/characters.json');
  const registry = await res.json();
  for (const entry of registry.characters) {
    const cRes = await fetch('characters/' + entry.file);
    CHARACTER_PROFILES[entry.id] = await cRes.json();
  }
  selectedCharId = registry.defaultCharacter;
}

// Build character select UI dynamically
function buildCharSelectUI() {
  const container = document.getElementById('char-cards');
  if (!container) return;
  container.innerHTML = '';

  Object.values(CHARACTER_PROFILES).forEach(char => {
    const card = document.createElement('div');
    card.className = 'char-card' + (char.id === selectedCharId ? ' selected' : '');
    card.dataset.charId = char.id;
    card.style.setProperty('--char-color', char.color);
    card.style.setProperty('--char-color-sub', char.colorSub);

    card.innerHTML = `
      <div class="char-card-glow"></div>
      <div class="char-card-inner">
        <div class="char-preview">
          <div class="char-emoji">${char.emoji}</div>
          <div class="char-class-badge">${char.classLabel}</div>
        </div>
        <div class="char-info">
          <div class="char-name">${char.name}</div>
          <div class="char-name-en">${char.nameEn}</div>
          <div class="char-desc">${char.description}</div>
          <div class="char-stats">
            <div class="stat-row">
              <span class="stat-label">속도</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${(char.stats.speed / 6) * 100}%;background:${char.color}"></div></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">체력</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${(char.stats.lives / 4) * 100}%;background:${char.color}"></div></div>
            </div>
            <div class="stat-row">
              <span class="stat-label">은신</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${(1 - char.stats.detectionMod + 0.5) * 70}%;background:${char.color}"></div></div>
            </div>
          </div>
          <div class="char-ability">
            <span class="ability-key">${char.ability.key}</span>
            <span class="ability-name">${char.ability.name}</span>
            <span class="ability-desc">${char.ability.description}</span>
          </div>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.char-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCharId = char.id;
      updateCharPreviewGlow(char);
      // Play select sound
      if (typeof snd === 'function') {
        snd(660, 0.08, 'sine', 0.07);
        snd(880, 0.1, 'sine', 0.06, 0.06);
      }
    });

    container.appendChild(card);
  });

  // Animate cards in
  setTimeout(() => {
    document.querySelectorAll('.char-card').forEach((c, i) => {
      setTimeout(() => c.classList.add('visible'), i * 120);
    });
  }, 100);
}

function updateCharPreviewGlow(char) {
  const title = document.querySelector('#charselect h1');
  if (title) {
    title.style.color = char.color;
    title.style.textShadow = `0 0 30px ${char.color}80, 0 0 60px ${char.color}40`;
  }
}

// Show character select screen
function showCharSelect() {
  if (!ac) ia();
  document.getElementById('title').classList.add('hid');
  const cs = document.getElementById('charselect');
  cs.style.display = 'flex';
  cs.classList.remove('hid');
  buildCharSelectUI();
  snd(440, 0.15, 'sine', 0.06);
  snd(660, 0.12, 'sine', 0.05, 0.1);
}

// Start game with selected character
function startWithChar() {
  const char = CHARACTER_PROFILES[selectedCharId];
  if (!char) return;
  const cs = document.getElementById('charselect');
  cs.classList.add('hid');
  setTimeout(() => { cs.style.display = 'none'; }, 400);

  // Load character-specific sprites then start
  loadCharacterSprites(char, () => {
    startAmb();
    document.getElementById('over').style.display = 'none';
    document.getElementById('hud').classList.remove('hid');
    G = new Game(char);
    G.upHUD();
  });
}

// Load character-specific sprites
function loadCharacterSprites(char, callback) {
  const spritesToLoad = Object.values(char.sprites);
  // Filter out already loaded sprites
  const needed = spritesToLoad.filter(s => !SPRITES[s]);
  if (needed.length === 0) { callback(); return; }

  let loaded = 0;
  needed.forEach(name => {
    const img = new Image();
    img.onload = () => {
      SPRITES[name] = img;
      loaded++;
      if (loaded >= needed.length) callback();
    };
    img.onerror = () => {
      console.warn('Character sprite not found, using fallback:', name);
      // Fallback to choroki equivalent
      const fallbackMap = { '_idle': 'choroki_idle', '_run': 'choroki_run_v2', '_bell': 'choroki_bell', '_swing': 'choroki_swing' };
      for (const [suffix, fallback] of Object.entries(fallbackMap)) {
        if (name.endsWith(suffix) && SPRITES[fallback]) {
          SPRITES[name] = SPRITES[fallback];
          break;
        }
      }
      loaded++;
      if (loaded >= needed.length) callback();
    };
    img.src = 'assets/2d/' + name + '.png';
  });
}
