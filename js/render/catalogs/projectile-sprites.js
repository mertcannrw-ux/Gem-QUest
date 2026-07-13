/*
 * render/catalogs/projectile-sprites.js - sprite-building functions for the projectile family.
 * Verbatim extraction from sprites.js; calls the shared helpers (reg, drawGrid,
 * drawGridOnto) declared in render/sprite.js. No behavioral change.
 */

  function makeProjectiles() {
    reg('proj_basic', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KYYYK..\n' +
      'KYWWYYK.\n' +
      'KYWWWWK.\n' +
      'KYWWWWK.\n' +
      'KYWWYYK.\n' +
      '.KYYYK..\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_crit', 10, 10, (ctx) => drawGridOnto(ctx,
      '...KKKK...\n' +
      '..KRRRRK..\n' +
      '.KRRYYRRK.\n' +
      'KRYWYYWYRK\n' +
      'KRYWKKWYRK\n' +
      'KRYWKKWYRK\n' +
      'KRYWYYWYRK\n' +
      '.KRRYYRRK.\n' +
      '..KRRRRK..\n' +
      '...KKKK...\n',
      0, 0, 1
    ));
    reg('proj_poison', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KLLLLK.\n' +
      'KLWWLLK.\n' +
      'KLWLLLK.\n' +
      'KLWLLLK.\n' +
      'KLWWLLK.\n' +
      '.KLLLLK.\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_frost', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KCCCCK.\n' +
      'KCGGGCK.\n' +
      'KCGGGCK.\n' +
      'KCGGGCK.\n' +
      'KCGGGCK.\n' +
      '.KCCCCK.\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_ember', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KFFFK..\n' +
      'KFOFFK..\n' +
      'KFFFFK..\n' +
      'KFFFFK..\n' +
      'KFOFFK..\n' +
      '.KFFFK..\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
    reg('proj_void', 10, 10, (ctx) => drawGridOnto(ctx,
      '...KKKK...\n' +
      '..KdddddK.\n' +
      '.KdddddKK.\n' +
      'KddKdddKdd\n' +
      'Kddddddddd\n' +
      'KddKdddKdd\n' +
      'Kddddddddd\n' +
      '.KdddddddK\n' +
      '..KddddddK\n' +
      '...KKKKKK.\n',
      0, 0, 1
    ));
    reg('proj_enemy', 8, 8, (ctx) => drawGridOnto(ctx,
      '..KKKK..\n' +
      '.KRRRRK.\n' +
      'KRYYRRK.\n' +
      'KRYWYRK.\n' +
      'KRYWYRK.\n' +
      'KRYYRRK.\n' +
      '.KRRRRK.\n' +
      '..KKKK..\n',
      0, 0, 1
    ));
  }

  function makeVFX() {
    reg('vfx_slash', 24, 24, (ctx) => drawGridOnto(ctx,
      '............KKKK......\n' +
      '..........KKWWWK......\n' +
      '........KKWWBBWK......\n' +
      '......KKWWBBWWWK......\n' +
      '....KKWWBBWWBBWK......\n' +
      '..KKWWBBWWBBWWWK......\n' +
      'KKWWBBWWBBWWBBWKKKKKKK\n' +
      'KKWBBWWBBWWBBWWKKKKKKK\n' +
      '..KKKWWBBWWBBWWWK.....\n' +
      '....KKKWBBWWBBWK......\n' +
      '......KKWBBWWWK.......\n' +
      '........KKWWK.........\n' +
      '..........KK..........\n',
      0, 0, 1
    ));
    reg('vfx_explosion', 20, 20, (ctx) => drawGridOnto(ctx,
      '....KKKKKK....\n' +
      '..KKOOOOOOKK..\n' +
      '.KOOYYYYYOOOK.\n' +
      'KOYYYRRRYYYOK.\n' +
      'KOYRRWWWWRYOK.\n' +
      'KOYRWKKKWRYOK.\n' +
      'KOYRWKKKWRYOK.\n' +
      'KOYRRWWWWRYOK.\n' +
      'KOYYYRRRYYYOK.\n' +
      '.KOOYYYYYOOOK.\n' +
      '..KKOOOOOOKK..\n' +
      '....KKKKKK....\n',
      0, 0, 1
    ));
    reg('vfx_spark', 6, 6, (ctx) => drawGridOnto(ctx,
      '..KK..\n' +
      '.KWYK.\n' +
      'KYYYK.\n' +
      'KKYKK.\n' +
      '..K...\n' +
      '......\n',
      0, 0, 1
    ));
    reg('vfx_lightning', 16, 32, (ctx) => drawGridOnto(ctx,
      '......KK......\n' +
      '.....KYYK.....\n' +
      '.....KYYK.....\n' +
      '....KYYWK.....\n' +
      '....KYYWK.....\n' +
      '...KYYWK......\n' +
      '...KYWK.......\n' +
      '..KYYWK.......\n' +
      '..KYWK........\n' +
      '.KYWK.........\n' +
      '.KYYWK........\n' +
      '.KYYWK........\n' +
      '.KYWK.........\n' +
      'KYYWK.........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYYK..........\n' +
      'KYK...........\n' +
      'KK............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n' +
      '..............\n',
      0, 0, 1
    ));
    reg('vfx_ring', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKK....\n' +
      '...KK......KK..\n' +
      '..K..........K.\n' +
      '.K............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      'K..............K\n' +
      '.K............K\n' +
      '..K..........K.\n' +
      '...KK......KK..\n' +
      '.....KKKKKK....\n',
      0, 0, 1
    ));
    reg('vfx_aura', 20, 20, (ctx) => drawGridOnto(ctx,
      '.....KKKKK....\n' +
      '...KyyyyyyK...\n' +
      '..KyyIIyIyyK..\n' +
      '.KyIyIIyIyyK..\n' +
      'KyIyIIyIyIyK..\n' +
      'KyIIyIyIyIyK..\n' +
      'KyIyIyIIyIyK..\n' +
      'KyIyIIyIIyK...\n' +
      'KyyIyyIIyyK...\n' +
      '.KyyyyyyyyK...\n' +
      '..KyyyyyyK....\n' +
      '....KKKKK.....\n',
      0, 0, 1
    ));
  }

function registerProjectileSprites() {
  makeProjectiles();
  makeVFX();
}
