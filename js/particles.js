/* particles.js - lightweight 2D particle system with sprite support.
 *
 * All visual juice in the game (sparks, explosions, floating numbers,
 * dust) flows through here. Particles are stored in flat typed arrays
 * for cache-friendly iteration. Capacity is hard-capped to keep GC
 * pressure out of the hot path.
 *
 * Kinds:
 *   0 - square (colored block)
 *   1 - floating text
 *   2 - spark line (trail)
 *   3 - expanding ring
 *   4 - sprite (uses Sprite.get(spriteId))
 */

class ParticleSystem {
  constructor(max = 1500) {
    this.max = max;
    this.x = new Float32Array(max);
    this.y = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.vy = new Float32Array(max);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.shrink = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.color = new Array(max).fill('#fff');
    this.kind = new Array(max).fill(0);
    this.text = new Array(max).fill('');
    this.spriteId = new Array(max).fill('');
    this.rotation = new Float32Array(max);
    this.rotSpeed = new Float32Array(max);
    this.radius = new Float32Array(max);
    this.count = 0;
    this.density = 1;
  }

  spawn(p) {
    if (p.kind !== 1 && this.density < 1 && Math.random() > this.density) return;
    if (this.count >= this.max) return;
    const i = this.count++;
    this.x[i] = p.x; this.y[i] = p.y;
    this.vx[i] = p.vx || 0; this.vy[i] = p.vy || 0;
    this.life[i] = p.life; this.maxLife[i] = p.life;
    this.size[i] = p.size || 4;
    this.shrink[i] = p.shrink || 0;
    this.gravity[i] = p.gravity || 0;
    this.color[i] = p.color || '#fff';
    this.kind[i] = p.kind || 0;
    this.text[i] = p.text || '';
    this.spriteId[i] = p.spriteId || '';
    this.rotation[i] = p.rotation || 0;
    this.rotSpeed[i] = p.rotSpeed || 0;
    this.radius[i] = p.radius || p._r || 80;
  }

  setDensity(value) {
    this.density = Math.max(0, Math.min(1, Number(value) || 0));
  }

  spawnBurst(x, y, color, count = 12, speed = 200) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.4,
        size: 2 + Math.random() * 3,
        shrink: 1, color, gravity: 0
      });
    }
  }

  spawnSparkBurst(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 100 + Math.random() * 200;
      this.spawn({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.4 + Math.random() * 0.3,
        size: 1, kind: 4, spriteId: 'vfx_spark',
        color, rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  }

  spawnRing(x, y, color, radius = 30) {
    this.spawn({
      x, y, vx: 0, vy: 0, life: 0.35, maxLife: 0.35,
      size: 1, shrink: 0, color, kind: 3, _r: radius
    });
  }

  spawnFloat(x, y, text, color = '#ffd84a', size = 18) {
    this.spawn({
      x, y, vx: 0, vy: -50, life: 0.9, maxLife: 0.9,
      size, color, kind: 1, text
    });
  }

  spawnCrit(x, y, text) {
    this.spawn({
      x, y, vx: 0, vy: -60, life: 1.1, maxLife: 1.1,
      size: 26, color: '#fbbf24', kind: 1, text
    });
    this.spawnSparkBurst(x, y - 8, '#fbbf24', 8);
  }

  spawnSlash(x, y, angle, color = '#ffffff') {
    this.spawn({
      x, y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2,
      size: 1, kind: 4, spriteId: 'vfx_slash',
      rotation: angle, color
    });
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.count--;
        if (i < this.count) {
          this.x[i] = this.x[this.count];
          this.y[i] = this.y[this.count];
          this.vx[i] = this.vx[this.count];
          this.vy[i] = this.vy[this.count];
          this.life[i] = this.life[this.count];
          this.maxLife[i] = this.maxLife[this.count];
          this.size[i] = this.size[this.count];
          this.shrink[i] = this.shrink[this.count];
          this.gravity[i] = this.gravity[this.count];
          this.color[i] = this.color[this.count];
          this.kind[i] = this.kind[this.count];
          this.text[i] = this.text[this.count];
          this.spriteId[i] = this.spriteId[this.count];
          this.rotation[i] = this.rotation[this.count];
          this.rotSpeed[i] = this.rotSpeed[this.count];
          this.radius[i] = this.radius[this.count];
        }
        i--;
        continue;
      }
      this.vy[i] += this.gravity[i] * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      if (this.shrink[i] > 0) this.size[i] = Math.max(0, this.size[i] - this.shrink[i] * dt);
      this.rotation[i] += this.rotSpeed[i] * dt;
    }
  }

  render(ctx, cam) {
    for (let i = 0; i < this.count; i++) {
      const t = this.life[i] / this.maxLife[i];
      const a = Math.max(0, Math.min(1, t));
      const k = this.kind[i];
      const c = this.color[i];
      const sx = this.x[i] - cam.x;
      const sy = this.y[i] - cam.y;
      ctx.globalAlpha = a;
      if (k === 0) {
        ctx.fillStyle = c;
        ctx.fillRect(sx - this.size[i] / 2, sy - this.size[i] / 2,
                     this.size[i], this.size[i]);
      } else if (k === 1) {
        ctx.fillStyle = c;
        ctx.font = 'bold ' + this.size[i] + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.text[i], sx, sy);
      } else if (k === 2) {
        ctx.strokeStyle = c;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx - this.vx[i] * 0.02, sy - this.vy[i] * 0.02);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      } else if (k === 3) {
        const r = (1 - a) * this.radius[i];
        ctx.strokeStyle = c;
        ctx.lineWidth = 2 + a * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0, r), 0, Math.PI * 2);
        ctx.stroke();
      } else if (k === 4) {
        if (Sprite.has(this.spriteId[i])) {
          const s = Sprite.get(this.spriteId[i]);
          const sc = this.size[i] || 1;
          ctx.save();
          ctx.translate(sx, sy);
          if (this.rotation[i]) ctx.rotate(this.rotation[i]);
          ctx.scale(sc, sc);
          ctx.drawImage(s.image, -s.w / 2, -s.h / 2);
          ctx.restore();
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() { this.count = 0; }
}
