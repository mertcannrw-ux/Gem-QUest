/*
 * render/catalogs/player-sprites.js - sprite-building functions for the player family.
 * Verbatim extraction from sprites.js; calls the shared helpers (reg, drawGrid,
 * drawGridOnto) declared in render/sprite.js. No behavioral change.
 */

  function makePlayer() {
    // The hero: helmeted knight with cape, holding a glowing sword.
    // 24x24, 4 walk frames (subtle leg shift), 3 attack frames (sword swing).
    const frames = [];
    // Walk frame 0 - stand
    const f0 = { canvas: null, w: 0, h: 0 };
    drawGrid(f0, playerGrid(0));
    frames.push(f0);
    // Walk frame 1 - left leg
    const f1 = { canvas: null, w: 0, h: 0 };
    drawGrid(f1, playerGrid(1));
    frames.push(f1);
    // Walk frame 2 - stand
    const f2 = { canvas: null, w: 0, h: 0 };
    drawGrid(f2, playerGrid(0));
    frames.push(f2);
    // Walk frame 3 - right leg
    const f3 = { canvas: null, w: 0, h: 0 };
    drawGrid(f3, playerGrid(2));
    frames.push(f3);
    // Use the first frame's dimensions
    regAnim('player', f0.w, f0.h, frames, 8);
  }

  function playerGrid(leg) {
    // Top-down-ish cute knight. 24x24.
    // Columns 0-23. '.' transparent.
    const cape = '.kkkkkkkkkkkkkkkkkkkkkk.\n' +
                 '.kbbbbbbbbbbbbbbbbbbbk.\n' +
                 '.kbNNNNNNNNNNNNNNNNNbk.\n' +
                 '.kbNnnnnnnnnnnnnnnNNbk.\n';
    const body =
                 '..kBBBBBBBBBBBBBBBBk..\n' +
                 '..kBYYBYYYYYYBYYBYYBk..\n' + // gold belt
                 '..kBBnnnnnnnnnnnnBBk..\n' + // body shadow
                 '..kBnnGGGGGGGGGGGnnBk..\n' + // armor plate
                 '..kBnnGGGGGGGGGGGnnBk..\n' +
                 '..kBBnnnnnnnnnnnnBBk..\n' +
                 '..kkBBBBBBBBBBBBBBkk..\n';
    // Head with helmet
    const head =
                 '...kKKKKKKKKKKKKKK....\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kKSsWSSSSSSSSWSSKk..\n' + // eyes
                 '..kKSsWSSSSSSSSWSSKk..\n' +
                 '..kKSSSSSSSSSSSSSSKk..\n' +
                 '..kkKKKKKKKKKKKKKKkk..\n';
    // Legs based on walk frame
    let legs;
    if (leg === 0) {
      legs =
                 '...kSSSSSSSSSSSSSS....\n' +  // straight
                 '...kSSSSSSSSSSSSSS....\n' +
                 '...kSSSSSSSSSSSSSS....\n' +
                 '...kkKKkkkkkkkkkkk....\n' +  // feet
                 '...kBBBKk...kBBBKk....\n' +  // boots
                 '....kkkk.....kkkk.....\n';
    } else if (leg === 1) {
      legs =
                 '...kSSSSSSSSSSSSSS....\n' +
                 '...kSSSSSSSSSSSSS.....\n' +
                 '...kSSSSSSSSSSS.......\n' +
                 '...kkKKkkkkkk.........\n' +
                 '...kBBBKk..............\n' +
                 '....kkkk...............\n';
    } else {
      legs =
                 '.....SSSSSSSSSSSSS....\n' +
                 '......SSSSSSSSSSSSSS...\n' +
                 '.......SSSSSSSSSSSSS...\n' +
                 '..........kkkkKKkk.....\n' +
                 '...........kBBBKk.kBBBK\n' +
                 '............kkkk....kkk\n';
    }
    return cape + body + head + legs;
  }

  function makeCombatDrones() {
    const makeDrone = (id, accent, accentBright) => {
      reg(id, 44, 28, (ctx) => {
        const bodyGradient = ctx.createLinearGradient(0, 5, 0, 24);
        bodyGradient.addColorStop(0, '#64748b');
        bodyGradient.addColorStop(0.42, '#26354c');
        bodyGradient.addColorStop(1, '#0b1220');

        // Swept stabilizer wings.
        ctx.fillStyle = '#070d18';
        ctx.strokeStyle = '#111c2f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(17, 8);
        ctx.lineTo(4, 4);
        ctx.lineTo(1, 9);
        ctx.lineTo(14, 14);
        ctx.lineTo(1, 20);
        ctx.lineTo(5, 24);
        ctx.lineTo(18, 19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(27, 8);
        ctx.lineTo(40, 4);
        ctx.lineTo(43, 9);
        ctx.lineTo(30, 14);
        ctx.lineTo(43, 20);
        ctx.lineTo(39, 24);
        ctx.lineTo(26, 19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Armored central fuselage.
        ctx.fillStyle = bodyGradient;
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(12, 10);
        ctx.lineTo(18, 4);
        ctx.lineTo(29, 5);
        ctx.lineTo(35, 11);
        ctx.lineTo(33, 20);
        ctx.lineTo(27, 25);
        ctx.lineTo(17, 24);
        ctx.lineTo(10, 19);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top armor highlight and central AI lens.
        ctx.strokeStyle = 'rgba(203,213,225,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(16, 9);
        ctx.lineTo(20, 6);
        ctx.lineTo(28, 7);
        ctx.stroke();

        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.ellipse(24, 14, 7, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const lens = ctx.createRadialGradient(25, 13, 0, 24, 14, 5);
        lens.addColorStop(0, '#ffffff');
        lens.addColorStop(0.25, accentBright);
        lens.addColorStop(1, accent);
        ctx.fillStyle = lens;
        ctx.beginPath();
        ctx.arc(24, 14, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Forward weapon barrel points along the sprite's +X axis.
        ctx.fillStyle = '#020617';
        ctx.fillRect(31, 12, 11, 5);
        ctx.fillStyle = accent;
        ctx.fillRect(39, 13, 4, 3);

        // Small navigation lights keep the silhouette readable at a glance.
        ctx.fillStyle = accentBright;
        ctx.fillRect(5, 7, 3, 2);
        ctx.fillRect(5, 19, 3, 2);
      });
    };

    makeDrone('combat_drone', '#0891b2', '#67e8f9');
    makeDrone('combat_drone_void', '#7c3aed', '#e9d5ff');
  }

function registerPlayerSprites() {
  makePlayer();
  playerGrid();
  makeCombatDrones();
}
