// Sprite Loader — preloads all 2D pixel art assets
const SPRITES = {};
const SPRITE_LIST = [
  // Player
  'choroki_idle', 'choroki_run_v2', 'choroki_bell', 'choroki_swing',
  // Neighbors
  'neighbor_grandma', 'neighbor_muscle', 'neighbor_dog', 'neighbor_ghost',
  'neighbor_ajumma_v2', 'neighbor_guard', 'neighbor_cat', 'neighbor_pajamas',
  // Environment
  'door_closed', 'door_open', 'corridor_floor', 'hiding_spot',
  'cctv', 'patrol_drone', 'ceiling_light', 'wall_graffiti',
  // UI
  'ui_heart', 'ui_bell', 'ui_wanted_star', 'ui_good_halo',
  // Good deeds
  'good_deed_cat', 'good_deed_package', 'good_deed_broken_light',
  // Effects
  'effect_ring', 'effect_dash', 'effect_caught',
  // Backgrounds
  'bg_neon_city_v2', 'bg_basement',
];

// Map neighbor trait to sprite key
const NEIGHBOR_SPRITE_MAP = {
  slow: 'neighbor_grandma',
  fast: 'neighbor_muscle',
  far: 'neighbor_dog',
  ghost: 'neighbor_ghost',
  alarm: 'neighbor_ajumma_v2',
  alert: 'neighbor_guard',
  stun: 'neighbor_cat',
  throw: 'neighbor_pajamas',
};

// Map good deed emoji to sprite key
const GOOD_DEED_SPRITE_MAP = {
  '🐱': 'good_deed_cat',
  '📦': 'good_deed_package',
  '🔧': 'good_deed_broken_light',
};

let spritesLoaded = 0;
let spritesTotal = SPRITE_LIST.length;

function loadSprites(callback) {
  if (spritesTotal === 0) { callback(); return; }
  SPRITE_LIST.forEach(name => {
    const img = new Image();
    img.onload = () => {
      SPRITES[name] = img;
      spritesLoaded++;
      // Update loading bar
      const pct = Math.floor((spritesLoaded / spritesTotal) * 100);
      const bar = document.getElementById('loadbar');
      if (bar) bar.style.width = pct + '%';
      const txt = document.getElementById('loadtxt');
      if (txt) txt.textContent = `로딩 중... ${pct}%`;
      if (spritesLoaded >= spritesTotal) callback();
    };
    img.onerror = () => {
      console.warn('Failed to load sprite:', name);
      spritesLoaded++;
      if (spritesLoaded >= spritesTotal) callback();
    };
    img.src = 'assets/2d/' + name + '.png';
  });
}

// Helper to draw a sprite scaled to fit a box, centered
function drawSprite(ctx, key, x, y, w, h, flipX) {
  const img = SPRITES[key];
  if (!img) return false;
  ctx.save();
  if (flipX) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
  return true;
}

// Draw a single frame from a sprite sheet (horizontal strip)
function drawSpriteFrame(ctx, key, frameIndex, totalFrames, x, y, w, h, flipX) {
  const img = SPRITES[key];
  if (!img) return false;
  const fw = img.width / totalFrames;
  const fh = img.height;
  ctx.save();
  if (flipX) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, fw * frameIndex, 0, fw, fh, 0, 0, w, h);
  } else {
    ctx.drawImage(img, fw * frameIndex, 0, fw, fh, x, y, w, h);
  }
  ctx.restore();
  return true;
}
