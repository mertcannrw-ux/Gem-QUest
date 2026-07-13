/*
 * render/catalogs/enemy-sprites.js - sprite-building functions for the enemy family.
 * Verbatim extraction from sprites.js; calls the shared helpers (reg, drawGrid,
 * drawGridOnto) declared in render/sprite.js. No behavioral change.
 */

  function makeSlime() {
    reg('slime', 16, 16, (ctx, w, h) => {
      drawGridOnto(ctx,
        '.....KKKKKKK.....\n' +
        '....KLLLLLLLK....\n' +
        '...KLLLLLLLLLK...\n' +
        '..KLLLLLLLLLLLK..\n' +
        '..KLWWLLLLLLLLLK.\n' +
        '..KLLLLLLLLLLLLK.\n' +
        '..KLWWLLLLLLLLLK.\n' +
        '..KLLLLLLLLLLLLK.\n' +
        '..KKLLLLLLLLLLKK.\n' +
        '...KKLLLLLLLLKK..\n' +
        '....KKKKKKKKKK...\n',
        2, 2
      );
    });
  }

  function makeBat() {
    reg('bat', 18, 14, (ctx, w, h) => {
      drawGridOnto(ctx,
        'KKK.......KKK......\n' +
        'KdKK.....KKdK......\n' +
        'KddKK...KKddK......\n' +
        'KdddKKKKKdddK......\n' +
        '.KdddddddddK.......\n' +
        '..KdMMMMdK.........\n' +
        '...KMMMMK..........\n' +
        '..KddEdddK.........\n' +
        '..KddEdddK.........\n' +
        '...KMMMK...........\n',
        0, 0, 1
      );
    });
  }

  function makeSpider() {
    reg('spider', 18, 16, (ctx, w, h) => {
      drawGridOnto(ctx,
        'KK..........KK.....\n' +
        'KdK........KdK.....\n' +
        'KddKKKKKKKKddK.....\n' +
        'KdddddddddddddK....\n' +
        'KdddddddddddddK....\n' +
        'KddEEEEEEEEddK.....\n' +
        'KddddddddddK.......\n' +
        '.KddddddddK........\n' +
        '.KddKKKKddK........\n' +
        '..KK....KK.........\n',
        0, 0, 1
      );
    });
  }

  function makeSkeleton() {
    reg('skeleton', 14, 18, (ctx, w, h) => {
      drawGridOnto(ctx,
        '..KKKKKKKK..\n' +
        '.KWWWWWWWWK.\n' +
        'KWEEEKKEWEEK\n' +
        'KWEEKKKKEEEK\n' +
        '.KWWWWWWWWK.\n' +
        '..KKKKKKKK..\n' +
        '...KwwK.....\n' +
        '..KwwKwwK...\n' +
        '.KwwK..KwwK.\n' +
        'KKKKKKKKKKKK\n' +
        'KwKK....KKwK\n' +
        'KwK......KwK\n' +
        'KK........KK\n' +
        'K..........K\n' +
        'K..........K\n' +
        'KK........KK\n',
        0, 0, 1
      );
    });
  }

  function makeBrute() {
    reg('brute', 20, 20, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKKKKKKK....\n' +
        '...KTTLLLLLLLTK...\n' +
        '..KTLWWLLLLLLLTK..\n' +
        '..KLWWLLTTLLLLTK..\n' +
        '..KLLLLTyyTLLLLK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLwwLLLTTK..\n' +
        '..KKTTLLwwLLTTKK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '..KTTLLLLLLLLTTK..\n' +
        '...KKTTTTTTTTKK...\n' +
        '...KTTLLLLLLTTK...\n' +
        '...KTTLLLLLLTTK...\n' +
        '...KKTTTTTTTTKK...\n' +
        '....KKLLLLLLKK....\n' +
        '...KTTK....KTTK...\n' +
        '..KKKK......KKKK..\n' +
        '..KK..........KK..\n',
        0, 0, 1
      );
    });
  }

  function makeMage() {
    reg('mage', 14, 18, (ctx, w, h) => {
      drawGridOnto(ctx,
        '...KKKKKK....\n' +
        '..KddMMMddK..\n' +
        '..KdMMMMMMK..\n' +
        '..KMMEEEEEEK..\n' +
        '..KMEEEEEEEMK.\n' +
        '..KKMMMMMMKK..\n' +
        '...KMMMMMK....\n' +
        '...KMMMMMK....\n' +
        '...KmdmddK....\n' +
        '..KmddmddmK...\n' +
        '..KmddmddmK...\n' +
        '..KmdddddmK...\n' +
        '..KmmmmmmK....\n' +
        '..KmmmmmmK....\n' +
        '..KmmKKmmK....\n' +
        '...KK..KK.....\n' +
        '...KK..KK.....\n' +
        '...KK..KK.....\n',
        0, 0, 1
      );
    });
  }

  function makeGhost() {
    reg('ghost', 16, 16, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKKKKK....\n' +
        '...KWWWWWWWWK...\n' +
        '..KWEEWWWWWEEWK..\n' +
        '..KWEEWWWWWEEWK..\n' +
        '..KWWWWWWWWWWWK..\n' +
        '..KWWWWWWWWWWWK..\n' +
        '..KWWWWWWWWWWWK..\n' +
        '..KKWWWWWWWWKKK..\n' +
        '..K.KWWWWWWK.KK..\n' +
        '..K..KKKKKK..KK..\n' +
        '..K..........K...\n' +
        '..KK........KK...\n',
        0, 0, 1
      );
    });
  }

  function makeWraith() {
    reg('wraith', 16, 18, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKKKKK....\n' +
        '...KddddddddK...\n' +
        '..KdddddddddK...\n' +
        '..KddMEEEEEddK..\n' +
        '..KdMMMEEEMMMdK..\n' +
        '..KdddddddddK....\n' +
        '...KdddddddK....\n' +
        '...KddddddK.....\n' +
        '..KdddddddddK...\n' +
        '..KdddmmmdddK...\n' +
        '..KddmMmmMddK...\n' +
        '..KdmMMMMMMmdK..\n' +
        '..KmMMMMMMMMmK..\n' +
        '..KddmmMMmmddK..\n' +
        '..Kkkdmmmmdkk...\n' +
        '...KkKKKKKkK....\n' +
        '...KK......KK...\n',
        0, 0, 1
      );
    });
  }

  function makeCrystal() {
    reg('crystal', 14, 14, (ctx, w, h) => {
      drawGridOnto(ctx,
        '....KKKKK.....\n' +
        '...KcccccK....\n' +
        '..KccCCCccK...\n' +
        '..KcCCCCCcK...\n' +
        '..KcCCCCCcK...\n' +
        '..KCCCCCCCcK..\n' +
        '..KCCCCCCcK...\n' +
        '..KcCCCCCcK...\n' +
        '..KcCCCCCcK...\n' +
        '..KccccccK....\n' +
        '...KKKKKK.....\n',
        0, 0, 1
      );
    });
  }

  function makeBossTreant() {
    reg('boss_treant', 48, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '...........KKKKKKKKK................\n' +
        '..........KLLLLLLLLLLK..............\n' +
        '.........KLWWWWWWWWWWLLK............\n' +
        '.........KLWEEEEEEEEEWLK............\n' +
        '........KKLWWWWWWWWWWWWLK...........\n' +
        '.......KLLLLLLLLLLLLLLLLK...........\n' +
        '......KLTTLLLLLLLLLLLLLLLK..........\n' +
        '....KKLTTLLLLLLLLLLLLLLLLLK.........\n' +
        '...KLTTLLLLLLLLLLLLLLLLLLLLK........\n' +
        '...KLTTLLLwwwwwwwwwwwLLLLLLK........\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLwwwwwwwwwwwLLLLLLLK.......\n' +
        '..KLLLLLLLLLLLLLLLLLLLLLLLLLK.......\n' +
        '..KLLLLLLLLLLLLLLLLLLLLLLLLLK.......\n' +
        '..KKLLLLLLLLLLLLLLLLLLLLLLLKK.......\n' +
        '...KKLLLLLLLLLLLLLLLLLLLLLKK........\n' +
        '....KKLLLLLLLLLLLLLLLLLLLKK.........\n' +
        '.....KKKKLLLLLLLLLLLLLLKKK..........\n' +
        '........KKKLLLLLLLLLKKK.............\n' +
        '...........KKKLLLLKKK...............\n' +
        '.............KKKKKK.................\n' +
        '....................................\n' +
        '....................................\n' +
        '....................................\n' +
        '....................................\n',
        0, 0, 1
      );
    });
  }

  function makeBossGolem() {
    reg('boss_golem', 48, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '............KKKKKKKKKK..............\n' +
        '..........KKddddddddddKK............\n' +
        '.........KddddddddddddddK...........\n' +
        '........KddMEEEEEEEEEEddK...........\n' +
        '........KdMMMMMMMMMMMMMdK...........\n' +
        '........KddMMddddddMMdddK...........\n' +
        '........KKKKddddddddKKKKK...........\n' +
        '.......KKddDddddddDdddDK............\n' +
        '......KdDDDddddddddDDDDdK...........\n' +
        '......KdDDDddddddddDDDDdK...........\n' +
        '......KKddddddddddddddKK............\n' +
        '......KddddddddddddddddK............\n' +
        '......KddddddddddddddddK............\n' +
        '......KddddDDDDDDDDDDddK............\n' +
        '......KdddDDDddddddDDddK............\n' +
        '......KdddDddddddddDddK.............\n' +
        '......KddddddddddddddK..............\n' +
        '......KddKKddddddddKKdK.............\n' +
        '......KKK..KKKKKKKK..KKK............\n' +
        '.....KK..............KKK............\n' +
        '....KK................KK............\n' +
        '....K..................KK...........\n' +
        '....KK.................KK...........\n' +
        '.....KK................KK..........\n' +
        '......KK...............KK..........\n' +
        '.......KK..............KK..........\n' +
        '........KK...........KK............\n' +
        '.........KKKKKKKKKKKKK.............\n',
        0, 0, 1
      );
    });
  }

  function makeBossVampire() {
    reg('boss_vampire', 48, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '............KKKKKKKKKK..............\n' +
        '..........KKhhhhhhhhhhKK............\n' +
        '.........KhhhhhhhhhhhhhhK...........\n' +
        '........KhhHhhhhhhhhhhhHhk..........\n' +
        '........KhHhhEEEEEEEEEhhHk..........\n' +
        '........KhHHhEEEEEhEEEEhHk..........\n' +
        '........KhhhhEEEEEEEEhhhhK..........\n' +
        '........KKhhhhhEEEEhhhhhKK..........\n' +
        '........KKhhhhhhhhhhhhhhKK..........\n' +
        '.......KKhhhhhhhhhhhhhhhhhKK........\n' +
        '......KhhhhhhhhhhhhhhhhhhhhK........\n' +
        '......KhRRhhhRRRRRRhhhRRRhhK........\n' +
        '......KhRRhhhRRRRRRhhhRRRhhK........\n' +
        '......KhhhhhhhhhhhhhhhhhhK..........\n' +
        '......KhhhhhhhhhhhhhhhhhhK..........\n' +
        '......KhhhhhhhhhhhhhhhhhK...........\n' +
        '......KKhhhhhhhhhhhhhhhKK...........\n' +
        '......KKhhhhhhhhhhhhhhhKK...........\n' +
        '......KKKKhhhhhhhhhhhKKKK...........\n' +
        '.....KK..KKhhhhhhhhhKK..KK..........\n' +
        '....KK....KKhhhhhhhKK....KK.........\n' +
        '....K......KKhhhhhKK......KK........\n' +
        '....K........KKKKK.........KK.......\n' +
        '....KK......................KK......\n' +
        '.....KK....................KK.......\n' +
        '......KKK.................KK........\n' +
        '........KKKK...........KKK..........\n' +
        '............KKKKKKKKKKK.............\n',
        0, 0, 1
      );
    });
  }

  function makeBossDragon() {
    reg('boss_dragon', 56, 48, (ctx, w, h) => {
      drawGridOnto(ctx,
        '......................KKKKKKKKKKKK................\n' +
        '....................KKrrrrrrrrrrrKKK..............\n' +
        '...................KrrrrrrrrrrrrrrrK..............\n' +
        '..................KrrRrrrYYYYYrrrrrrK.............\n' +
        '.................KrRrrrrrYYYrrrrrrrrrK............\n' +
        '.................KrRrrrrrrrYrrrrrrrrK.............\n' +
        '................KrrrRrrrrrrrrrrrrrrrrK............\n' +
        '...............KrrrrrrrrrrrrrrrrrrrrrK............\n' +
        '..............KrrrrrWWrrrrrrrrrrrrrrrrK...........\n' +
        '..............KrrrrWWWWrrrrrrrrrrrrrrrK...........\n' +
        '.............KrrrrrWWrrrrrrrrrrrrrrrrrrK..........\n' +
        '............KrrrrrrrrrrrrrrrrrrrrrrrrrrK..........\n' +
        '...........KrrrrrrrrrrrrrrrrrrrrrrrrrrrrK.........\n' +
        '...........KrrrrrrrrrrrrrrrrrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrrrrrrrrrrrrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrrrrrryyyyyrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrrrryyyyyyyrrrrrrrrrrrK..........\n' +
        '..........KrrrrrrrryyyyyyyyrrrrrrrrrrrK...........\n' +
        '..........KrrrrrrryyyyyyyrrrFrrrrrrrrrK...........\n' +
        '...........KrrrrrryyyyyyrrFrrrrrrrrrrK............\n' +
        '............KrrrrryyyyyyrrFrrrrrrrrrrK............\n' +
        '.............KrrryyyyyyrrrrrrrrrrrrrrK............\n' +
        '..............KryyyyyrrrrrrrrrrrrrrrK.............\n' +
        '...............KyyyyrrrrrrrrrrrrrrrrK.............\n' +
        '................KyyrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '.................KrrrrrrrrrrrrrrrrrrK.............\n' +
        '................KKrrrrrrrrrrrrrrrrrrKK............\n' +
        '..............KK..KKrrrrrrrrrrrrrrrKK.............\n' +
        '.............KK......KKrrrrrrrrrrrKK..............\n' +
        '............KK.........KKrrrrrrrrrK...............\n' +
        '...........KK............KKrrrrrrrK...............\n' +
        '..........KK..............KKrrrrrrK...............\n' +
        '.........KK................KKrrrrK................\n' +
        '........KK...................KKKK..................\n' +
        '.......KK.........................................\n' +
        '......KK..........................................\n' +
        '.....KK...........................................\n' +
        '....KK............................................\n' +
        '...KK.............................................\n' +
        '..KK..............................................\n' +
        '.KK...............................................\n' +
        'KK................................................\n' +
        '.................................................\n',
        0, 0, 1
      );
    });
  }

function registerEnemySprites() {
  makeSlime();
  makeBat();
  makeSpider();
  makeSkeleton();
  makeBrute();
  makeMage();
  makeGhost();
  makeWraith();
  makeCrystal();
  makeBossTreant();
  makeBossGolem();
  makeBossVampire();
  makeBossDragon();
}
