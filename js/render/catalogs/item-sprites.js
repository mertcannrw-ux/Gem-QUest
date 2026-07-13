/*
 * render/catalogs/item-sprites.js - sprite-building functions for the item family.
 * Verbatim extraction from sprites.js; calls the shared helpers (reg, drawGrid,
 * drawGridOnto) declared in render/sprite.js. No behavioral change.
 */

  function makeItems() {
    reg('i_sword', 16, 16, (ctx) => drawGridOnto(ctx,
      '..........KKK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      '..........KZK....\n' +
      'KKKKKKKKKK.ZK....\n' +
      '.KTTTTTTTK.ZK....\n' +
      '..KTTTTTKKKZKKK..\n' +
      '...KKTTKK.K......\n' +
      '....KKK...K......\n' +
      '..........K......\n',
      0, 0, 1
    ));

    reg('i_boots', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK......KKK\n' +
      '...KTTTK......KkK\n' +
      '..KTTTTK......KkK\n' +
      '..KTTTTKKKKKKKKK.\n' +
      '..KTTTTTKKKKKKKKK\n' +
      '..KTTTTTTKYYYYK.K\n' +
      '..KTTTTTTKYQQYK.K\n' +
      '..KTTTTTKYYYYYYYK\n' +
      '..KTTTTKYYYYYYYK.\n' +
      '..KKKKKKYYYYYYK..\n' +
      '...KKKKKYYYYYK...\n' +
      '....KKKKKKKKKK...\n' +
      '....KKK....KKK...\n' +
      '....KKK....KKK...\n' +
      '....KKK....KKK...\n' +
      '....KKK....KKK...\n',
      0, 0, 1
    ));

    reg('i_heart', 14, 12, (ctx) => drawGridOnto(ctx,
      '.KK...KK.\n' +
      'KRK...KRK\n' +
      'KRRK.KRRK\n' +
      'KRRRRRRRK\n' +
      'KRRRRRRRK\n' +
      'KRRRRRRRK\n' +
      '.KRRRRRK.\n' +
      '..KRRRK..\n' +
      '...KRK...\n' +
      '....K....\n',
      1, 2, 1
    ));

    reg('i_magnet', 16, 14, (ctx) => drawGridOnto(ctx,
      'KKK......KKK..\n' +
      'KrK......KrK..\n' +
      'KrrKKKKKKKrrK.\n' +
      'KrrrrrrrrrrrK.\n' +
      'KKrrrrrrrrrKK.\n' +
      '..KrrrrrrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KrrK.KrrK...\n' +
      '..KKK...KKK...\n',
      0, 1, 1
    ));

    reg('i_rapid', 14, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '..KKYYYYKK..\n' +
      '.KYYYYYYYYK.\n' +
      'KYYWWWWWWYYK\n' +
      'KYYWWKKWWYYK\n' +
      'KYYWWKKWWYYK\n' +
      'KYYWWKKWWYYK\n' +
      'KYYWWWWWWYYK\n' +
      'KYYYYYYYYYYK\n' +
      'KKYYYYYYYYKK\n' +
      '.KKYYYYYYKK.\n' +
      '..KKKYYKKK..\n' +
      '...KKKKKK...\n' +
      '....KYYK....\n' +
      '....KYYK....\n' +
      '....KKKK....\n',
      1, 0, 1
    ));

    reg('i_crown', 16, 12, (ctx) => drawGridOnto(ctx,
      '..K......K....\n' +
      '.KRK....KRK...\n' +
      'KRRRK..KRRRK..\n' +
      'KRRRRKKKRRRRK.\n' +
      'KRRRRRRRRRRRRK\n' +
      'KRRRRRRRRRRRRK\n' +
      '.KKKKKKKKKKKK.\n' +
      '..KYYYYYYYYK..\n' +
      '..KYYYYYYYYK..\n' +
        '..KKKKKKKKKK..\n' +
        '...KEEEEEEK...\n' +
        '...KKKKKKK....\n',
      0, 1, 1
    ));

    reg('i_pouch', 14, 14, (ctx) => drawGridOnto(ctx,
      '..KKKKKKKKK..\n' +
      '.KYYYYYYYYYK.\n' +
      'KYYYYYYYYYYYK\n' +
      'KYYWWKYYKWWYK\n' +
      'KYYWKKYYKKWYK\n' +
      'KYYYYYYYYYYYK\n' +
      'KKKYYYYYYYYKK\n' +
      '.KKYYYYYYKK..\n' +
      '...KYYYYYK...\n' +
      '...KYYYYYK...\n' +
      '...KYYYYYK...\n' +
      '...KKKKKKK...\n',
      1, 1, 1
    ));

    reg('i_multishot', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKK.......\n' +
      '....KZK.......\n' +
      '....KZK.......\n' +
      'KKK.KZK.KKK...\n' +
      'KZK.KZK.KZK...\n' +
      'KZK.KZK.KZK...\n' +
      'KKK.KZK.KKK...\n' +
      '....KZK.......\n' +
      '....KZK.......\n' +
      'KKK.KZK.KKK...\n' +
      'KZK.KZK.KZK...\n' +
      'KZK.KZK.KZK...\n' +
      'KKK.KZK.KKK...\n' +
      '....KZK.......\n' +
      '....KZK.......\n' +
      '....KKK.......\n',
      0, 0, 1
    ));

    reg('i_bow', 16, 16, (ctx) => drawGridOnto(ctx,
      '..KKKKK.......\n' +
      '.KTTTTK.......\n' +
      'KTTTTTKKK.....\n' +
      'KTTTTKTTK.....\n' +
        'KTTTTKTK......\n' +
        'KTTTTTKK......\n' +
        'KTTTTTK.......\n' +
        'KTTTTTKK......\n' +
        'KTTTTKTK......\n' +
        'KTTTTTKKK.....\n' +
        'KTTTTKTTK.....\n' +
        '.KTTTTK.......\n' +
        '..KKKKK.......\n' +
        '....KKKK......\n' +
        '.....KKK......\n' +
        '......KK......\n',
      0, 0, 1
    ));

    reg('i_pierce', 16, 16, (ctx) => drawGridOnto(ctx,
      '..........KKKK\n' +
      '.........KZYYK\n' +
      '........KZYYYK\n' +
      '.......KZYYYKK\n' +
      '......KZYYYK..\n' +
      '.....KZYYYK...\n' +
      '....KZYYYK....\n' +
      '...KZYYYK.....\n' +
      '..KZYYYK......\n' +
      '.KZYYYK.......\n' +
      'KZYYYK........\n' +
      'KYYYK.........\n' +
      'KYK...........\n' +
      'KK............\n' +
      '..............\n' +
      '..............\n',
      0, 0, 1
    ));

    reg('i_crit', 16, 14, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '..KKLLLLKK..\n' +
      '.KLLLLLLLLK.\n' +
      'KLWLLLLLLWLK\n' +
      'KLLWLLLLWLLK\n' +
      'KLLLWLLWLLLK\n' +
      'KLLLLWWLLLLK\n' +
      'KLLLLLLLLLLK\n' +
      'KLLLLLLLLLLK\n' +
      '.KLLLLLLLLK.\n' +
      '..KKKKKKKK..\n' +
      '....KKKK....\n' +
      '...KKKKKK...\n' +
      '..KKKKKKKK..\n',
      0, 1, 1
    ));

    reg('i_shield', 14, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KBBBBBKK..\n' +
      '..KBBBBBBK..\n' +
      '..KBBYYBBK..\n' +
      '..KBBYYBBK..\n' +
      '..KBBBBBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBBBBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBnnBBK..\n' +
      '..KBBBBBBK..\n' +
      '..KKBBBBKK..\n' +
      '...KKBBKK...\n' +
      '....KKKK....\n',
      1, 0, 1
    ));

    reg('i_vampire', 14, 14, (ctx) => drawGridOnto(ctx,
      'KKK..KKK..\n' +
      'KWK..KWK..\n' +
      'KWKWKWKWK.\n' +
      'KWWWWWWWK.\n' +
      'KWWWWWWWK.\n' +
      '.KWWWWWK..\n' +
      '..KWWWK...\n' +
      '...KWK....\n' +
      '....K.....\n' +
      '..........\n' +
      '..........\n',
      0, 2, 1
    ));

    reg('i_bomb', 14, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...K....K...\n' +
      '..K.YY..K...\n' +
      '..KYYYY.K...\n' +
      '..KKKYYKK...\n' +
      '..KKKKKKK...\n' +
      '.KKKKKKKKK..\n' +
      '.KKKKKKKKK..\n' +
      '.KKKKKKKKK..\n' +
      'KKKKKKKKKKK.\n' +
      'KKKKKKKKKKK.\n' +
      'KKKKKKKKKKK.\n' +
      'KKKKKKKKKKK.\n' +
      '.KKKKKKKKK..\n' +
      '..KKKKKKK...\n' +
      '....KKKK....\n',
      0, 0, 1
    ));

    reg('i_lightning', 16, 16, (ctx) => drawGridOnto(ctx,
      '.......KK....\n' +
      '......KYYK...\n' +
      '......KYYK...\n' +
      '.....KYYYK...\n' +
      '.....KYYYK...\n' +
      '....KYYWK....\n' +
      '....KYYWK....\n' +
      '...KYYWK.....\n' +
      '...KYYWK.....\n' +
      '..KYYWK......\n' +
      '..KYYWK......\n' +
      '.KYYWK.......\n' +
      '.KYYWK.......\n' +
      'KYYWK........\n' +
      'KYYK.........\n' +
      'KK...........\n',
      0, 0, 1
    ));

    reg('i_frost', 16, 16, (ctx) => drawGridOnto(ctx,
      '.....KKKK....\n' +
      '....KCCCCK...\n' +
      '...KCCCCCCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KCGGGGGCK..\n' +
      '..KCGGGGGCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KCCGGCCCK..\n' +
      '..KKCCCCKK...\n' +
      '..KKCCCCKK...\n' +
      '..KK....KK...\n' +
      '..KK....KK...\n' +
        '..KK....KK...\n' +
        '..KK....KK...\n' +
        '..KK....KK...\n',
      0, 0, 1
    ));

    reg('i_poison', 14, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KLLLLLLK..\n' +
      '.KLLWWLLLLK.\n' +
      'KLWLLWLLLLLK\n' +
      'KLLLLLLLLLLK\n' +
      'KLLLwwwwLLLK\n' +
      '.KLwwwwwwLK.\n' +
      '..KLwwwwLK..\n' +
      '...KLwwLK...\n' +
      '....KLLK....\n' +
      '...KLLLK....\n' +
      '..KLLLLK....\n' +
      '.KLLLLLK....\n' +
      'KLLLLLK.....\n' +
      'KLLLLK......\n' +
      'KKKKK.......\n',
      0, 0, 1
    ));

    reg('i_boomerang', 16, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKKK...\n' +
      '..KTTTTTTTK..\n' +
      '.KTTYYYYYTTK.\n' +
      'KTYYKKKKYYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYKKKKKKYTK.\n' +
      'KTYYKKKKYYTK.\n' +
      '.KTTYYYYYTTK.\n' +
      '..KTTTTTTTK..\n' +
      '...KKKKKKK...\n',
      0, 1, 1
    ));

    reg('i_regen', 14, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...KFFOOK...\n' +
      '..KFOOOOOK..\n' +
      '..KOOwwOOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOWwwWOk..\n' +
      '..KOOwwOOk..\n' +
      '..KFOOOOOK..\n' +
      '...KFFOOK...\n' +
      '....KKKK....\n' +
      '....KKKK....\n' +
      '....KKKK....\n',
      0, 0, 1
    ));

    reg('i_tome', 14, 16, (ctx) => drawGridOnto(ctx,
      'KKKKKKKKKK...\n' +
      'KTTTTTTTK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBTTBBBK....\n' +
      'KTBBBBBBTK...\n' +
      'KTBBBBBBK....\n' +
      'KKKKKKKKKKK..\n' +
      '.KKKKKKKKKK..\n' +
      '...KKKKKK....\n' +
      '....KKKK.....\n',
      0, 0, 1
    ));

    reg('i_deathskull', 16, 16, (ctx) => drawGridOnto(ctx,
      '..KKKKKKKKKK..\n' +
      '.KWWWWWWWWWWK.\n' +
      'KWEEEEKKEEEEWK\n' +
      'KWEEEKKKKEEEWK\n' +
      'KWEEKKKKKKEEKW\n' +
      'KWEEKWWWWKEEKW\n' +
      'KWEEKWKKWEKWKW\n' +
      'KWEEKWKKWEKWKW\n' +
      'KWEEKWWWWKEKKW\n' +
      'KWEEKKKKKKEKKW\n' +
      'KWEEKKKKKKEKKW\n' +
      '.KWWKKKKKKKWWK\n' +
      '..KWWKKKKKWWK.\n' +
      '...KWWKKKKWWK.\n' +
      '....KWWKKKWWK.\n' +
      '.....KKKKKKK..\n',
      0, 0, 1
    ));

    reg('i_holycrown', 16, 14, (ctx) => drawGridOnto(ctx,
      '..K......K....\n' +
      '.KYYK..KYYK...\n' +
      'KYWYK.KYWYK...\n' +
      'KYWWKKKYYWWK..\n' +
      'KYWYYWWYYYYWK.\n' +
      'KYWWWWWWWWWWWK\n' +
      'KYWWWWWWWWWWWK\n' +
      'KYYWWWWWWWWYYK\n' +
      '.KYYYYYYYYYYK.\n' +
      '..KYYYYYYYYK..\n' +
      '..KYYWWWWYYK..\n' +
      '...KWWKKWWK...\n' +
      '....KKKKKK....\n' +
      '....KKKKKK....\n',
      0, 1, 1
    ));

    reg('i_wings', 16, 12, (ctx) => drawGridOnto(ctx,
      'WWK....K....\n' +
      'W..K..K..K..\n' +
      'W..K..K..K..\n' +
      'W...K.K..K..\n' +
      'W....K...K..\n' +
      'W....K...K..\n' +
      'W...K.K..K..\n' +
      'W..K..K..K..\n' +
      'W..K..K..K..\n' +
      'WWK....K....\n' +
      '............\n' +
      '............\n',
      0, 2, 1
    ));

    reg('i_hourglass', 12, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KYYYYYYK..\n' +
      '..KYYWWYYK..\n' +
      '..KYKKKKYK..\n' +
      '..KYYKYYK....\n' +
      '..KYKKYYK....\n' +
      '..KYYKKYK....\n' +
      '..KYKKYYK....\n' +
      '..KYYKKYYK...\n' +
      '..KYYKKYYK...\n' +
      '..KYYKKYYK...\n' +
      '..KYYKYYK....\n' +
      '..KYYKYYK....\n' +
      '..KYYWWYYK...\n' +
      '..KYYYYYYK...\n' +
      '...KKKKKK....\n',
      1, 0, 1
    ));

    // ===== NEW ITEMS (Phase 7) =====
    reg('i_doubler', 14, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKK....\n' +
      '..KDDD..DKK..\n' +
      '..KD....DDD..\n' +
      '..KD....DKD..\n' +
      '..KD....DKK..\n' +
      '..KDDDDDDK...\n' +
      '..KKKKKKKK...\n' +
      '..K.....KKK..\n' +
      '..K....DDD...\n' +
      '..K....DKD...\n' +
      '..K....DDD...\n' +
      '..KKKKKKK....\n' +
      '...KKKKK.....\n' +
      '.............\n',
      0, 1, 1
    ));

    reg('i_lifesteal', 14, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KR...RRK..\n' +
      '.KR.....RRK.\n' +
      'KR.......RRK\n' +
      'KR........RR\n' +
      'R....LR....R\n' +
      'R...LWR....R\n' +
      'R...LWR....R\n' +
      'R...LLR....R\n' +
      'R....LR....R\n' +
      'RR........RR\n' +
      '.RR.......RR\n' +
      '..RR.....RR.\n' +
      '...KKKKKK...\n',
      0, 0, 1
    ));

    reg('i_bounce', 14, 14, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...KZZZK....\n' +
      '..KZGGGZK...\n' +
      '.KZGGGGGZK..\n' +
      'KZGKKKKGGZK.\n' +
      'KGK....KGZK.\n' +
      'KGK....KGZK.\n' +
      'KGKKKKKKGZK.\n' +
      'KZZGGGGGZZK.\n' +
      '.KZZZZZZZK..\n' +
      '..KKKKKKK...\n' +
      '............\n' +
      '............\n' +
      '............\n',
      0, 1, 1
    ));

    reg('i_orbital', 16, 16, (ctx) => drawGridOnto(ctx,
      '.....KKKK....\n' +
      '....KGGGGK...\n' +
      '...KGYYYYGK..\n' +
      '...KGYWYYGK..\n' +
      '...KGYYYYGK..\n' +
      '....KGGGGK...\n' +
      '.....KKKK....\n' +
      '....KKKKKK...\n' +
      '...KGGGGGGK..\n' +
      '..KGYYYYYGGK.\n' +
      '..KGYYYYYGGK.\n' +
      '..KGGGGGGGGK.\n' +
      '..KGGGGGGGGK.\n' +
      '...KKKKKKKK..\n' +
      '....KKKKKK...\n' +
      '.....KKKK....\n',
      0, 0, 1
    ));

    reg('i_drone', 16, 16, (ctx) => drawGridOnto(ctx,
      '...KKKKKKKK...\n' +
      '..KKWWWWWWKK..\n' +
      '.KWWWWWWWWWWK.\n' +
      'KWWKKWWWWKKWWK\n' +
      'KWWKWWWWWWKWWK\n' +
      'KWWWWWWWWWWWWK\n' +
      'KWWWWBBBBWWWWK\n' +
      'KWWWWBBBBWWWWK\n' +
      'KWWWWWWWWWWWWK\n' +
      'KWWKWWWWWWKWWK\n' +
      'KWWKKWWWWKKWWK\n' +
      '.KWWWWWWWWWWK.\n' +
      '..KKWWWWWWKK..\n' +
      '...KKKKKKKK...\n' +
      '....KK..KK....\n' +
      '...KK....KK...\n',
      0, 0, 1
    ));

    reg('i_void', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKKK....\n' +
      '...KdddddK...\n' +
      '..KdKdddKdK..\n' +
      '.KddKdddKddK.\n' +
      'KdKKKdddKKKdK\n' +
      'KdddddddddddK\n' +
        'KdddKKdKKdddK\n' +
        'KdddKdKdKdddK\n' +
        'KdddKKdKKdddK\n' +
        'KdddddddddddK\n' +
        'KdKKKdddKKKdK\n' +
        '.KddKdddKddK.\n' +
        '..KdKdddKdK..\n' +
        '...KdddddK...\n' +
        '....KKKK....\n' +
        '.............\n',
      0, 0, 1
    ));

    reg('i_ember', 14, 16, (ctx) => drawGridOnto(ctx,
      '.....KK......\n' +
      '....KYYK.....\n' +
      '...KYFFYK....\n' +
      '...KFFOFOk...\n' +
      '..KFFOOOOK...\n' +
      '..KFOOOOOk...\n' +
      '.KFFOOOfOK...\n' +
      '.KFFfOOfOK...\n' +
      '.KffOOOOOK...\n' +
      '.KfOOOOOOK...\n' +
      '..KOOOOOK....\n' +
      '...KfOfK.....\n' +
      '...KffK......\n' +
      '....KK.......\n' +
      '.............\n' +
      '.............\n',
      0, 0, 1
    ));

    reg('i_chrono', 16, 16, (ctx) => drawGridOnto(ctx,
      '....KKKKKK...\n' +
      '...KCCCCCCK..\n' +
      '..KCCGGGGCCK.\n' +
      '..KCGGGGGGGC.\n' +
      '..KCGKKKKGGC.\n' +
      '..KCGGGGGGGC.\n' +
      '..KCGKWWKGGC.\n' +
      '..KCGKWKKGGC.\n' +
      '..KCGKKKKGGC.\n' +
      '..KCGGGGGGGC.\n' +
      '..KCCGGGGCCK.\n' +
      '...KCCCCCCK..\n' +
      '....KKKKKK...\n' +
      '....KKKKKK...\n' +
      '....KKKKKK...\n' +
      '....KKKKKK...\n',
      0, 0, 1
    ));

    reg('i_gem', 14, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKKK...\n' +
      '..KGGGGGGK..\n' +
      '.KGYYGGYYGK.\n' +
      'KGYYGGGGYYGK\n' +
      'KGYGGGGGGYGK\n' +
      'KGYGGGGGGYGK\n' +
      'KGYYGGGGYYGK\n' +
      '.KGYYGGYYGK.\n' +
      '..KGGGGGGK..\n' +
      '...KKKKKK...\n' +
      '............\n' +
      '............\n' +
      '............\n' +
      '............\n',
      1, 1, 1
    ));

    reg('i_aura', 16, 16, (ctx) => drawGridOnto(ctx,
      '.....KKKK....\n' +
      '....KyyyyK...\n' +
      '...KyyIIyyK..\n' +
      '..KyIyyyyIyK.\n' +
      '..KyIyyyyIyK.\n' +
      '.KyIyIIyIIyK.\n' +
      'KyIyIyIIyIIyK\n' +
      'KyyIyIIyIyyK.\n' +
      'KyyIyIIyIyyK.\n' +
      'KyIyIyIIyIIyK\n' +
      '.KyIyIIyIIyK.\n' +
      '..KyIyyyyIyK.\n' +
      '..KyIyyyyIyK.\n' +
      '...KyyIIyyK..\n' +
      '....KyyyyK...\n' +
      '.....KKKK....\n',
      0, 0, 1
    ));

    reg('i_meteor', 16, 16, (ctx) => drawGridOnto(ctx,
      '.......KKKK..\n' +
      '......KFFOOK.\n' +
      '.....KFFOOOFK\n' +
      '....KFFOOOOFK\n' +
      '...KFFOOOOFFK\n' +
      '..KFFOOFFFFFK\n' +
      '.KFFOOFFFFK.K\n' +
      'KFFOOFFFFK...\n' +
      'KFOOFFFFK....\n' +
      'KFFFFFK......\n' +
      'KFFKK........\n' +
      'KKK..........\n' +
      '.............\n' +
      '.............\n' +
      '.............\n' +
      '.............\n',
      0, 0, 1
    ));
  }

  function makeLootboxes() {
    reg('lootbox_bronze', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKKK....\n' +
      '....KOOOOOOOK...\n' +
      '...KOOOOOOOOOK..\n' +
      '..KOOOOOOOOOOOK.\n' +
      '..KOOOOyyyyOOOK.\n' +
      '..KOyyOOOOyyOOK.\n' +
      '..KOOOOOOOOOOOK.\n' +
      '..KOOOOOOOOOOOK.\n' +
      '..KKKOOOOOOOKKK.\n' +
      '....KKKKKKKK....\n' +
      '....KKyyyyyKK...\n' +
      '....KOOOOOOK....\n' +
      '...KKKyyyyKKK...\n' +
      '..KKKOOOOOOKKK..\n' +
      '.KKOOOOOOOOOOKK.\n' +
      'KKKKKKKKKKKKKKKK\n',
      0, 0, 1
    ));
    reg('lootbox_silver', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKKK....\n' +
      '....KAAAAAAAK...\n' +
      '...KAAAAAAAAAK..\n' +
      '..KAAAAAAAAAAAK.\n' +
      '..KAAAwwwwAAAK.\n' +
      '..KAwwAAAAwwAAK.\n' +
      '..KAAAAAAAAAAAK.\n' +
      '..KAAAAAAAAAAAK.\n' +
      '..KKKAAAAAAAKKK.\n' +
      '....KKKKKKKK....\n' +
      '....KKwwwwwKK...\n' +
      '....KAAAAAAAK....\n' +
      '...KKKwwwwKKK...\n' +
      '..KKKAAAAAAAKKK.\n' +
      '.KKAAAAAAAAAAAKK.\n' +
      'KKKKKKKKKKKKKKKK\n',
      0, 0, 1
    ));
    reg('lootbox_gold', 24, 24, (ctx) => drawGridOnto(ctx,
      '.....KKKKKKK....\n' +
      '....KIIIIIIIK...\n' +
      '...KIIIIIIIIIK..\n' +
      '..KIIIIIIIIIIK.\n' +
      '..KIIIyyyyIIIK.\n' +
      '..KIyyIIIIyyIK.\n' +
      '..KIIIIIIIIIIIK.\n' +
      '..KIIIIIIIIIIK.\n' +
      '..KKKIIIIIIIKKK.\n' +
      '....KKKKKKKK....\n' +
      '....KKyyyyyKK...\n' +
      '....KIIIIIIIK....\n' +
      '...KKKyyyyKKK...\n' +
      '..KKKIIIIIIIKKK.\n' +
      '.KKIIIIIIIIIIKK.\n' +
      'KKKKKKKKKKKKKKKK\n',
      0, 0, 1
    ));
  }

  function makePickups() {
    reg('pickup_gem', 12, 14, (ctx) => drawGridOnto(ctx,
      '...KKKKK....\n' +
      '..KGGGGGK...\n' +
      '.KGYYGGYGK..\n' +
      'KGYGGGYYGK..\n' +
      'KGYGGGGYGK..\n' +
      'KGYYGGYYGK..\n' +
      '.KGYYYYGK...\n' +
      '..KGGGGK....\n' +
      '...KKKK.....\n' +
      '............\n',
      0, 0, 1
    ));
    reg('pickup_coin', 10, 12, (ctx) => drawGridOnto(ctx,
      '..KKKKK....\n' +
      '.KIYYYK....\n' +
      'KIYYIIK....\n' +
      'KYIIYYK....\n' +
      'KYIIYYK....\n' +
      'KIYYIIK....\n' +
      '.KIYYYK....\n' +
      '..KKKKK....\n',
      0, 1, 1
    ));
  }

function registerItemSprites() {
  makeItems();
  makeLootboxes();
  makePickups();
}
