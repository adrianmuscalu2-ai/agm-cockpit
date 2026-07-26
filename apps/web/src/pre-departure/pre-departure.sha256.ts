export async function sha256Hex(value: string) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return [...new Uint8Array(digest)].map(toHex).join('');
  }
  return sha256Fallback(new TextEncoder().encode(value));
}

function sha256Fallback(input: Uint8Array) {
  const constants = new Uint32Array(64);
  const hashes = new Uint32Array(8);
  let primeCount = 0;
  for (let candidate = 2; primeCount < 64; candidate += 1) {
    let prime = true;
    for (let divisor = 2; divisor * divisor <= candidate; divisor += 1) {
      if (candidate % divisor === 0) { prime = false; break; }
    }
    if (!prime) continue;
    if (primeCount < 8) hashes[primeCount] = fractional(Math.sqrt(candidate));
    constants[primeCount] = fractional(Math.cbrt(candidate));
    primeCount += 1;
  }

  const bitLength = input.length * 8;
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength >>> 0);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));

  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4);
    for (let index = 16; index < 64; index += 1) {
      const left = words[index - 15];
      const right = words[index - 2];
      const sigma0 = rotate(left, 7) ^ rotate(left, 18) ^ (left >>> 3);
      const sigma1 = rotate(right, 17) ^ rotate(right, 19) ^ (right >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    const state = [...hashes];
    for (let index = 0; index < 64; index += 1) {
      const s1 = rotate(state[4], 6) ^ rotate(state[4], 11) ^ rotate(state[4], 25);
      const choice = (state[4] & state[5]) ^ (~state[4] & state[6]);
      const temp1 = (state[7] + s1 + choice + constants[index] + words[index]) >>> 0;
      const s0 = rotate(state[0], 2) ^ rotate(state[0], 13) ^ rotate(state[0], 22);
      const majority = (state[0] & state[1]) ^ (state[0] & state[2]) ^ (state[1] & state[2]);
      const temp2 = (s0 + majority) >>> 0;
      state.unshift((temp1 + temp2) >>> 0);
      state[4] = (state[4] + temp1) >>> 0;
      state.pop();
    }
    state.forEach((word, index) => { hashes[index] = (hashes[index] + word) >>> 0; });
  }
  return [...hashes].map((word) => word.toString(16).padStart(8, '0')).join('');
}

function rotate(value: number, shift: number) {
  return (value >>> shift) | (value << (32 - shift));
}

function fractional(value: number) {
  return ((value % 1) * 0x100000000) >>> 0;
}

function toHex(byte: number) {
  return byte.toString(16).padStart(2, '0');
}
