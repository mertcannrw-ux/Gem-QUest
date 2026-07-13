/*
 * render/catalogs/tile-sprites.js - sprite-building functions for the tile family.
 * Verbatim extraction from sprites.js; calls the shared helpers (reg, drawGrid,
 * drawGridOnto) declared in render/sprite.js. No behavioral change.
 */

  function makeTiles() {
    // Forest: grass
    reg('tile_forest', 32, 32, (ctx) => {
      ctx.fillStyle = '#1a3a1a'; ctx.fillRect(0, 0, 32, 32);
      // Grass texture
      for (let i = 0; i < 6; i++) {
        const x = (i * 7) % 32, y = (i * 13) % 32;
        ctx.fillStyle = (i % 2) ? '#2d5a2d' : '#234a23';
        ctx.fillRect(x, y, 3, 3);
        ctx.fillRect(x + 1, y - 1, 1, 1);
      }
    });
    reg('tile_forest_moss', 32, 32, (ctx) => {
      ctx.fillStyle = '#193d1d'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 13; i++) {
        const x = (i * 11 + 3) % 32, y = (i * 7 + 5) % 32;
        ctx.fillStyle = i % 3 ? '#2f6a32' : '#578b3d';
        ctx.fillRect(x, y, 3, 2);
        if (i % 2 === 0) ctx.fillRect(x + 1, y - 2, 1, 2);
      }
      ctx.fillStyle = 'rgba(167,198,79,.35)';
      ctx.fillRect(5, 11, 8, 2); ctx.fillRect(20, 23, 6, 2);
    });
    // Forest: stone path
    reg('tile_path', 32, 32, (ctx) => {
      ctx.fillStyle = '#4a3a2a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 8; i++) {
        const x = (i * 11) % 32, y = (i * 7) % 32;
        ctx.fillStyle = (i % 2) ? '#5a4a3a' : '#6a5a4a';
        ctx.fillRect(x, y, 2, 2);
      }
    });
    // Caves: stone
    reg('tile_cave', 32, 32, (ctx) => {
      ctx.fillStyle = '#1a1a3a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 6; i++) {
        const x = (i * 5) % 32, y = (i * 9) % 32;
        ctx.fillStyle = (i % 2) ? '#2a2a4a' : '#3b2a5a';
        ctx.fillRect(x, y, 3, 3);
      }
    });
    reg('tile_cave_glint', 32, 32, (ctx) => {
      ctx.fillStyle = '#1c1b3e'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 9; i++) {
        const x = (i * 9 + 2) % 32, y = (i * 13 + 3) % 32;
        ctx.fillStyle = i % 2 ? '#312a5c' : '#263158';
        ctx.fillRect(x, y, 4, 3);
      }
      ctx.fillStyle = '#5ad5eb';
      ctx.fillRect(7, 7, 2, 6); ctx.fillRect(5, 9, 6, 2);
      ctx.fillStyle = 'rgba(202,249,255,.7)'; ctx.fillRect(7, 9, 2, 2);
    });
    // Castle: dark stone
    reg('tile_castle', 32, 32, (ctx) => {
      ctx.fillStyle = '#1a0a1a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 5; i++) {
        const x = (i * 6) % 32, y = (i * 11) % 32;
        ctx.fillStyle = '#3a0a2a';
        ctx.fillRect(x, y, 3, 3);
      }
      // Brick pattern
      ctx.fillStyle = '#2a0a1a';
      ctx.fillRect(0, 8, 32, 1);
      ctx.fillRect(0, 24, 32, 1);
    });
    reg('tile_castle_worn', 32, 32, (ctx) => {
      ctx.fillStyle = '#1c0c21'; ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#351331';
      ctx.fillRect(0, 7, 32, 2); ctx.fillRect(0, 23, 32, 2);
      ctx.fillRect(8, 0, 2, 7); ctx.fillRect(22, 9, 2, 14);
      ctx.fillStyle = '#51204a';
      ctx.fillRect(2, 3, 5, 2); ctx.fillRect(12, 12, 8, 2); ctx.fillRect(25, 27, 5, 2);
      ctx.strokeStyle = '#6f2b59'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(5, 19); ctx.lineTo(12, 14); ctx.lineTo(14, 20); ctx.stroke();
    });
    // Dragon's lair: lava floor
    reg('tile_lava', 32, 32, (ctx) => {
      ctx.fillStyle = '#2a0a0a'; ctx.fillRect(0, 0, 32, 32);
      for (let i = 0; i < 4; i++) {
        const x = (i * 7) % 32, y = (i * 9) % 32;
        ctx.fillStyle = (i % 2) ? '#5a1a1a' : '#7a2a1a';
        ctx.fillRect(x, y, 4, 4);
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(x + 1, y + 1, 2, 2);
      }
    });
    reg('tile_lava_crack', 32, 32, (ctx) => {
      ctx.fillStyle = '#310b0a'; ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = '#53201a';
      ctx.fillRect(3, 5, 8, 5); ctx.fillRect(18, 13, 10, 7); ctx.fillRect(7, 25, 13, 4);
      ctx.strokeStyle = '#ef5427'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(10, 13); ctx.lineTo(15, 18); ctx.lineTo(24, 17); ctx.lineTo(32, 24); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,198,69,.8)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(10, 13); ctx.lineTo(15, 18); ctx.lineTo(24, 17); ctx.lineTo(32, 24); ctx.stroke();
    });
  }

function registerTileSprites() {
  makeTiles();
}
