// =========================================================
// INKFALL — 調整用パラメータ
// =========================================================

export const CONFIG = {
  version: '1.0.0',
  storageKey: 'inkfall',
  netVersion: 1,

  physics: {
    gravity: 28,
    maxFall: 32,
    moveSpeed: 7.4,
    ownInkBoost: 1.22,     // 自チームのインクの上では速い
    enemyInkSlow: 0.8,     // 敵のインクの上では遅い
    accelGround: 46,
    accelAir: 16,
    friction: 20,
    jumpSpeed: 9.4,
    radius: 0.5,
    coyoteTime: 0.12,
    jumpBuffer: 0.14,
    flipCooldown: 0.75,    // 重力切り替えのクールダウン
    flipDamp: 0.3,
    substep: 1 / 120,
    stampSpeed: 15,        // この速さ以上で着地すると INK STAMP
    // ルール「ムーンジャンプ」: 空中でジャンプ長押し → ふわっと浮く(ゲージ制)
    moon: {
      fuel: 2.0,           // 浮いていられる秒数
      recharge: 1.4,       // 着地中に 1 秒あたり回復する秒数
      minStart: 0.2,       // これ以上たまっていれば浮き始められる
      lift: 0.9,           // 浮いている間の上昇速度(m/s)
      response: 7,         // 上昇速度へ近づく速さ
      airAccel: 1.35,      // 浮いている間の横移動のききやすさ(倍)
      stampMul: 1.3,       // 浮いたあとの着地は、この倍の速さがないとスタンプにならない
    },
  },

  combat: {
    hp: 100,
    shotDamage: 34,
    fireInterval: 0.13,
    shotSpeed: 46,
    shotRange: 34,
    shotSplat: 1.35,       // 着弾時の塗り半径
    rollerRadius: 0.75,    // 足元の塗り半径
    stampRadius: 3.2,
    stampKillRadius: 2.4,
    respawnTime: 3,
    spawnShield: 2,
    specialCost: 160,      // スペシャル(グラビティボム)に必要な塗りマス数
    bombRadius: 4.2,
    bombFlipRadius: 5.5,
    overdriveMul: 1.5,
  },

  turf: {
    rounds: 2,
    duration: 120,
    overdrive: 20,         // 残り何秒から OVERDRIVE
    teamSize: 4,
  },

  tag: {
    fuse: 18,
    passCooldown: 1.0,
    shoveCooldown: 1.4,
    shoveForce: 13,
    minPlayers: 4,
    maxPlayers: 8,
  },

  challenge: { duration: 60, leaderboard: 'inkfall_challenge_60s' },

  camera: {
    fov: 66,
    distance: 3.9,
    height: 1.2,
    shoulder: 0.7,
    minDistance: 1.0,
    pitch: 0.12,
    minPitch: -1.35,
    maxPitch: 1.35,
    rotateDuration: 0.5,
    followLambda: 16,
    mouseSensitivity: 0.0024,
    touchSensitivity: 0.0058,
  },

  net: {
    stateHz: 20,
    paintHz: 10,
    shotBatchHz: 12,
    maxPayload: 2004,      // Wavedash P2P の上限(LASTFALL で確認済み)
    hostTimeout: 6,
  },

  teams: {
    standard: [{ id: 'A', name: 'NEON', color: '#ff3fa4' }, { id: 'B', name: 'AQUA', color: '#25d9ff' }],
    accessible: [{ id: 'A', name: 'NEON', color: '#ff9a1f' }, { id: 'B', name: 'AQUA', color: '#3d7bff' }],
  },
  // ばくだん鬼(個人戦)のプレイヤー色
  ffaColors: ['#ff3fa4', '#25d9ff', '#b6ff3d', '#ffb31f', '#a86bff', '#ff5a3d', '#3dffc4', '#ffffff'],

  // エフェクトの明るさ(設定 → 表示 → エフェクト)
  //  bloom: 試合中のブルーム / particle: しぶき等の明るさ / shot: 弾の明るさ / white: しぶきの芯を白く光らせるか
  //  fresh: 塗りたての光 / aura: キャラの後光 / flash: 被弾フラッシュ
  effects: {
    soft:   { bloom: { strength: 0.22, radius: 0.35, threshold: 0.9 }, particle: 0.45, ring: 0.45, shot: 1.0, white: false, fresh: 0.35, aura: 0.0,  flash: 0.4 },
    normal: { bloom: { strength: 0.42, radius: 0.4, threshold: 0.84 }, particle: 0.7,  ring: 0.65, shot: 1.25, white: false, fresh: 0.7, aura: 0.12, flash: 0.7 },
    vivid:  { bloom: { strength: 0.85, radius: 0.5, threshold: 0.7 },  particle: 1.0,  ring: 1.0,  shot: 2.2, white: true,  fresh: 1.4,  aura: 0.3,  flash: 1.0 },
  },
  quality: {
    low:    { pixelRatio: 1.0, bloom: false, shadows: false, particles: 700,  antialias: false },
    medium: { pixelRatio: 1.5, bloom: true,  shadows: false, particles: 1800, antialias: true },
    high:   { pixelRatio: 2.0, bloom: true,  shadows: true,  particles: 3200, antialias: true },
  },
};
