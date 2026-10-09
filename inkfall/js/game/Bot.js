// =========================================================
// Bot — CPU の考え方(ホストだけで動く)
//  turf : 塗れていない場所を探して移動・射撃。見えている面へ重力を切り替えて飛び移る
//  tag  : ばくだんを持っていれば追いかけ、持っていなければ逃げる
//  dummy: 練習用のまと(撃ってこない)
// =========================================================
import * as THREE from 'three';
import { Arena } from './Arena.js';
import { CONFIG } from '../config.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const DIRS = [
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0),
  new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
];

export class Bot {
  constructor(actor, match, { kind = 'turf', level = 'normal' } = {}) {
    this.a = actor;
    this.m = match;
    this.kind = kind;
    this.L = CONFIG.cpu[level] || CONFIG.cpu.normal;
    this.skill = this.L.skill;
    this.think = Math.random();
    this.target = null;       // { pos, normal, cell }
    this.enemy = null;
    this.stuck = 0;
    this.wish = new THREE.Vector3();
    this.basis = { forward: new THREE.Vector3(), right: new THREE.Vector3() };
    this.fireWant = false;
    this.jitter = new THREE.Vector3();
    // 撃ち合いの「人間らしさ」
    this.react = 0;                    // 敵を見つけてから撃ち始めるまで
    this.aimErr = new THREE.Vector3(); // ゆっくり変わる照準のずれ
    this.errT = 0;
    this.burst = 0;                    // 連射している残り時間
    this.rest = 0;                     // 連射の合間
    this.hoverT = 0;                   // ムーンジャンプでジャンプを押し続ける残り時間
  }

  update(dt) {
    const a = this.a;
    a.ctrl.moveX = 0; a.ctrl.moveY = 0; a.ctrl.jump = false; a.ctrl.jumpHeld = false;
    this.fireWant = false;
    if (!a.alive || a.out) { this.hoverT = 0; return; }
    this.think -= dt;
    // ムーンジャンプ: ときどき跳んで、しばらく浮く
    if (a.moon) {
      if (this.hoverT > 0) { this.hoverT -= dt; a.ctrl.jumpHeld = true; }
      else if (a.grounded && Math.random() < dt * (this.enemy || this.kind === 'tag' ? 0.5 : 0.18)) {
        a.ctrl.jump = true; a.ctrl.jumpHeld = true;
        this.hoverT = 0.5 + Math.random() * 1.3;
      }
    }
    if (this.kind === 'dummy') return this._dummy(dt);
    if (this.kind === 'tag') return this._tag(dt);
    return this._turf(dt);
  }

  // ---------- 共通 ----------
  _moveToward(point, dt) {
    const a = this.a;
    _a.subVectors(point, a.pos);
    _a.addScaledVector(a.up, -_a.dot(a.up));
    const d = _a.length();
    if (d < 0.6) return d;
    _a.divideScalar(d);
    this.basis.forward.copy(_a);
    this.basis.right.crossVectors(_a, a.up).normalize();
    a.ctrl.moveY = 1;
    // 引っかかり検出
    if (a.grounded && a.speed01 < 0.15) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (this.stuck > 0.7) { a.ctrl.jump = true; a.ctrl.jumpHeld = true; }
    if (this.stuck > 2.2) { this.stuck = 0; this._randomFlip(); }
    return d;
  }

  _aimAt(point, spread = 0, dt = 1 / 60, turn = 14) {
    const a = this.a;
    _b.subVectors(point, a.pos).normalize();
    if (spread) { this.jitter.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(spread); _b.add(this.jitter).normalize(); }
    a.aim.lerp(_b, 1 - Math.exp(-dt * turn)).normalize();
  }

  _randomFlip() {
    const a = this.a;
    const options = DIRS.filter((d) => d.dot(a.gravity) < 0.5);
    const d = options[Math.floor(Math.random() * options.length)];
    const hit = this.m.arena.raycast(a.pos, d, 40);
    if (hit && hit.t > 2.5) this.m.botFlip(a, hit.normal.clone().negate());
  }

  /** 今立っている面と同じ平面か(歩いて行けるか) */
  _samePlane(pos, normal) {
    const a = this.a;
    if (normal.dot(a.up) < 0.9) return false;
    _c.subVectors(pos, a.pos);
    return Math.abs(_c.dot(a.up) + 0.5) < 0.6;
  }

  /** 同じチームの CPU のうち、o をねらっている数 */
  _focusOn(o) {
    let n = 0;
    for (const x of this.m.actors) if (x !== this.a && x.brain && x.team === this.a.team && x.brain.enemy === o) n++;
    return n;
  }

  _nearestEnemy(range, needLos = true) {
    let best = null, bd = range;
    for (const o of this.m.actors) {
      // 復活直後の無敵中・出撃エリアにいる相手はねらわない(リスポーン狩りをしない)
      if (o === this.a || !o.alive || o.out || o.team === this.a.team || o.shield > 0 || this.m.inSafe(o) || this.m.freshSpawn(o)) continue;
      const d = o.pos.distanceTo(this.a.pos);
      // 1 人を大勢で囲まない(すぐ近くにいる相手だけは例外)
      if (d > 4 && this._focusOn(o) >= this.L.focus) continue;
      if (d < bd && (!needLos || this.m.arena.lineOfSight(this.a.pos, o.pos))) { bd = d; best = o; }
    }
    return best;
  }

  // ---------- 陣取り ----------
  _turf(dt) {
    const a = this.a, m = this.m, arena = m.arena;
    if (this.think <= 0) {
      this.think = 0.6 + Math.random() * 0.8;
      const prev = this.enemy;
      this.enemy = this._nearestEnemy(this.L.range);
      if (this.enemy && this.enemy !== prev) this.react = (0.35 + (1 - this.skill) * 0.6 + Math.random() * 0.25) * this.L.react;
      if (!this.target || Math.random() < 0.35 || (this.target.cell >= 0 && arena.owner[this.target.cell] === a.team)) this._pickTarget();
    }
    if (this.enemy && (!this.enemy.alive || this.enemy.out || this.enemy.shield > 0 || m.inSafe(this.enemy) || m.freshSpawn(this.enemy) || this.enemy.pos.distanceTo(a.pos) > this.L.range + 6)) this.enemy = null;

    // 移動
    if (this.target) {
      if (this._samePlane(this.target.pos, this.target.normal)) {
        const d = this._moveToward(this.target.pos, dt);
        if (d < 1.2) this.target = null;
      } else if (a.grounded && a.flipCD <= 0) {
        // 別の面: 見えていれば重力を切り替えて飛ぶ
        _a.copy(this.target.pos).addScaledVector(this.target.normal, 0.6);
        if (arena.lineOfSight(a.pos, _a)) m.botFlip(a, this.target.normal.clone().negate());
        else this.target = null;
      }
    } else {
      // うろうろ
      _a.copy(a.pos).addScaledVector(a.aim, 3);
      this._moveToward(_a, dt);
    }

    // ねらい
    if (this.enemy) {
      this._fight(dt);
      if (Math.random() < dt * 0.6) { a.ctrl.jump = true; a.ctrl.jumpHeld = true; }
      if (a.special >= 1 && Math.random() < dt * 0.8) m.throwBomb(a);
    } else {
      // 足元の少し先 or ターゲットへ撃って塗る
      if (this.target) _a.copy(this.target.pos);
      else _a.copy(a.pos).addScaledVector(this.basis.forward, 4).addScaledVector(a.up, -0.6);
      this._aimAt(_a, 0.18, dt, 10);
      this.fireWant = Math.random() < 0.85;
    }
  }

  /** 敵との撃ち合い: 反応の遅れ・照準のずれ・ゆっくりした振り向き・連射の切れ目 */
  _fight(dt) {
    const a = this.a, e = this.enemy;
    const dist = e.pos.distanceTo(a.pos);
    this.errT -= dt;
    if (this.errT <= 0) {
      this.errT = 0.25 + Math.random() * 0.3;
      const ang = (0.05 + (1 - this.skill) * 0.2) * (0.6 + dist / 12);
      this.aimErr.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(Math.random() * ang * dist);
    }
    _a.copy(e.pos).add(this.aimErr);
    this._aimAt(_a, 0, dt, 3 + this.skill * 5);
    this.react -= dt;
    if (this.react > 0) return;
    // 照準がだいたい向いているときだけ撃つ
    _b.subVectors(e.pos, a.pos).normalize();
    if (a.aim.dot(_b) < 0.94) return;
    if (this.burst > 0) { this.burst -= dt; this.fireWant = true; if (this.burst <= 0) this.rest = (0.3 + Math.random() * 0.5) * this.L.rest; }
    else if ((this.rest -= dt) <= 0) this.burst = 0.45 + Math.random() * 0.6;
  }

  _pickTarget() {
    const a = this.a, arena = this.m.arena;
    let best = null, bs = -Infinity;
    const p = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < 28; i++) {
      const c = arena.randomCell();
      const o = arena.owner[c];
      if (o === Arena.DISABLED) continue;
      arena.cellCenter(c, p);
      // 相手の出撃エリアには入らない
      if (this.m.nearZone(p, a.team === 1 ? 2 : 1, CONFIG.spawnCare.margin)) continue;
      arena.cellNormalVec(c, n);
      const d = p.distanceTo(a.pos);
      let s = (o === a.team ? -3 : o === 0 ? 2 : 3) - d * 0.06 + Math.random();
      const walk = this._samePlane(p, n);
      if (!walk) {
        _a.copy(p).addScaledVector(n, 0.6);
        if (!arena.lineOfSight(a.pos, _a)) continue;
        s += 0.8; // 飛び移るのは楽しい
      }
      if (s > bs) { bs = s; best = { pos: p.clone(), normal: n.clone(), cell: c }; }
    }
    this.target = best;
  }

  // ---------- ばくだん鬼 ----------
  _tag(dt) {
    const a = this.a, m = this.m;
    const others = m.actors.filter((o) => o !== a && o.alive && !o.out);
    if (!others.length) return;
    if (a.holding) {
      let best = null, bd = Infinity;
      for (const o of others) { if (o.holding) continue; const d = o.pos.distanceTo(a.pos); if (d < bd) { bd = d; best = o; } }
      if (!best) return;
      this._aimAt(best.pos);
      if (best.up.dot(a.up) > 0.9 && Math.abs(_c.subVectors(best.pos, a.pos).dot(a.up)) < 1.2) this._moveToward(best.pos, dt);
      else if (a.grounded && a.flipCD <= 0 && m.arena.lineOfSight(a.pos, best.pos) && this.think <= 0) {
        this.think = 0.5;
        m.botFlip(a, best.gravity.clone());
      } else this._moveToward(best.pos, dt);
      if (bd < 3) { a.ctrl.jump = Math.random() < dt * 2; a.ctrl.jumpHeld = a.ctrl.jump; }
    } else {
      const holder = others.filter((o) => o.holding).sort((x, y) => x.pos.distanceTo(a.pos) - y.pos.distanceTo(a.pos))[0];
      if (!holder) { _a.copy(a.pos).addScaledVector(a.aim, 3); this._moveToward(_a, dt); return; }
      const d = holder.pos.distanceTo(a.pos);
      this._aimAt(holder.pos);
      if (d < 9) {
        _a.subVectors(a.pos, holder.pos).add(a.pos);
        this._moveToward(_a, dt);
        if (d < 5 && a.grounded && a.flipCD <= 0 && this.think <= 0) { this.think = 0.8; this._randomFlip(); }
        if (d < 2.6 && Math.random() < dt * (1 + this.skill * 2.5)) m.shove(a);
      } else if (this.think <= 0) {
        this.think = 1;
        this.wander = a.pos.clone().addScaledVector(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(), 5);
      } else if (this.wander) this._moveToward(this.wander, dt);
    }
  }

  // ---------- まと ----------
  _dummy(dt) {
    if (this.think <= 0) {
      this.think = 2 + Math.random() * 2;
      this.wander = this.a.pos.clone().addScaledVector(this.basis.forward.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize(), 3);
    }
    if (this.wander) this._moveToward(this.wander, dt);
  }
}
