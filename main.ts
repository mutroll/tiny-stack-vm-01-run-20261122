// Tiny stack VM for make.fun's tiny-stack-vm-01 ISA (v1), written from ISA.md.
// Runs every /input/<id>/ program, writes /output/<id>/stdout.bin + exit.txt.
// No clock, no network, no files outside /input and /output: both graded runs agree.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
function run(p, q) {
  const s = new Int32Array(256); let sp = 0;
  const c = new Int32Array(64); let cp = 0;
  const m = new Int32Array(256);
  const o = new Uint8Array(65536); let ol = 0;
  let ip = 0, pc = 0, st = 0;
  const end = (e) => [o.subarray(0, ol), e];
  for (;;) {
    if (st === 1000000) return end(10);
    if (pc < 0 || pc >= p.length) return end(9);
    const op = p[pc];
    let n;
    if (op === 1) n = 1;
    else if (op === 2) n = 4;
    else if (op >= 0x30 && op <= 0x33) n = 2;
    else if (op === 0 || (op >= 3 && op <= 7) || (op >= 0x10 && op <= 0x1e) ||
      (op >= 0x20 && op <= 0x22) || op === 0x34 || op === 0x40 || op === 0x41 ||
      (op >= 0x50 && op <= 0x53)) n = 0;
    else return end(5);
    if (pc + n >= p.length) return end(9);
    st++;
    const nx = pc + 1 + n;
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1:
        if (sp > 255) return end(3);
        s[sp++] = (p[nx - 1] << 24) >> 24;
        break;
      case 2:
        if (sp > 255) return end(3);
        s[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24);
        break;
      case 3:
        if (sp < 1) return end(2);
        sp--;
        break;
      case 4:
        if (sp < 1) return end(2);
        if (sp > 255) return end(3);
        s[sp] = s[sp - 1]; sp++;
        break;
      case 5:
        if (sp < 2) return end(2);
        { const t = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = t; }
        break;
      case 6:
        if (sp < 2) return end(2);
        if (sp > 255) return end(3);
        s[sp] = s[sp - 2]; sp++;
        break;
      case 7:
        if (sp < 3) return end(2);
        { const a = s[sp - 3]; s[sp - 3] = s[sp - 2]; s[sp - 2] = s[sp - 1]; s[sp - 1] = a; }
        break;
      case 0x17:
        if (sp < 1) return end(2);
        s[sp - 1] = -s[sp - 1] | 0;
        break;
      case 0x1b:
        if (sp < 1) return end(2);
        s[sp - 1] = ~s[sp - 1];
        break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        if (sp < 2) return end(2);
        const b = s[sp - 1], a = s[sp - 2];
        let r;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) {
          if (b === 0) return end(4);
          r = a === -2147483648 && b === -1 ? a : (a / b) | 0;
        } else if (op === 0x14) {
          if (b === 0) return end(4);
          r = b === -1 ? 0 : (a % b) | 0;
        } else if (op === 0x15) {
          if (b === 0) return end(4);
          r = Math.floor((a >>> 0) / (b >>> 0)) | 0;
        } else if (op === 0x16) {
          if (b === 0) return end(4);
          r = ((a >>> 0) % (b >>> 0)) | 0;
        } else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2;
        s[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        if (op === 0x30) pc = nx + rel;
        else {
          if (sp < 1) return end(2);
          const v = s[--sp];
          if ((op === 0x31 && v === 0) || (op === 0x32 && v !== 0)) pc = nx + rel;
        }
        break;
      }
      case 0x33:
        if (cp === 64) return end(7);
        c[cp++] = nx;
        pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return end(8);
        pc = c[--cp];
        break;
      case 0x40:
        if (sp < 1) return end(2);
        { const a = s[sp - 1];
          if (a < 0 || a > 255) return end(6);
          s[sp - 1] = m[a]; }
        break;
      case 0x41:
        if (sp < 2) return end(2);
        { const a = s[sp - 1], v = s[sp - 2];
          if (a < 0 || a > 255) return end(6);
          sp -= 2;
          m[a] = v; }
        break;
      case 0x50:
        if (sp < 1) return end(2);
        { const t = String(s[sp - 1]);
          if (ol + t.length > 65536) return end(11);
          sp--;
          for (let i = 0; i < t.length; i++) o[ol++] = t.charCodeAt(i); }
        break;
      case 0x51:
        if (sp < 1) return end(2);
        if (ol > 65535) return end(11);
        o[ol++] = s[--sp] & 255;
        break;
      case 0x52:
        if (sp > 255) return end(3);
        s[sp++] = ip < q.length ? q[ip++] : -1;
        break;
      case 0x53:
        if (sp < 1) return end(2);
        return end(s[--sp] & 255);
    }
  }
}
for (const id of readdirSync(I).sort()) {
  let p = new Uint8Array(0), q = new Uint8Array(0);
  try { p = readFileSync(join(I, id, 'program.bin')); } catch {}
  try { q = readFileSync(join(I, id, 'input.bin')); } catch {}
  const [b, e] = run(p, q);
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), b);
  writeFileSync(join(O, id, 'exit.txt'), e + '\n');
}
