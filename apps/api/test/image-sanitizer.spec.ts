import sharp from 'sharp';
import {
  IMAGE_SECURITY_LIMITS,
  ImageSecurityError,
  sanitizeImageForVision,
} from '../src/common/image-security/image-sanitizer';

describe('image sanitizer security contract', () => {
  it('accepts a valid JPEG and emits canonical PNG without source metadata', async () => {
    const input = await sharp({
      create: { width: 64, height: 32, channels: 3, background: '#cc2200' },
    })
      .withExif({ IFD0: { Copyright: 'private-test-value' } })
      .jpeg()
      .toBuffer();

    const result = await sanitizeImageForVision(input, 'image/jpeg');
    const metadata = await sharp(result.buffer).metadata();

    expect(result.mimetype).toBe('image/png');
    expect(result.sourceFormat).toBe('jpeg');
    expect(result.width).toBe(64);
    expect(result.height).toBe(32);
    expect(metadata.format).toBe('png');
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(metadata.iptc).toBeUndefined();
  });

  it('rejects MIME spoofing before decoding', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    }).png().toBuffer();

    await expectSecurityCode(sanitizeImageForVision(png, 'image/jpeg'), 'IMAGE_TYPE_MISMATCH');
  });

  it('rejects unsupported bytes', async () => {
    await expectSecurityCode(
      sanitizeImageForVision(Buffer.from('PK\u0003\u0004not-an-image'), 'image/png'),
      'IMAGE_UNSUPPORTED',
    );
  });

  it('rejects a PNG polyglot with trailing ZIP payload', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    }).png().toBuffer();
    const polyglot = Buffer.concat([png, Buffer.from('PK\u0003\u0004private-payload')]);

    await expectSecurityCode(sanitizeImageForVision(polyglot, 'image/png'), 'IMAGE_UNSUPPORTED');
  });

  it('rejects an animated WEBP container before decoding', async () => {
    const animatedWebp = webpWithAnimationChunk();
    await expectSecurityCode(sanitizeImageForVision(animatedWebp, 'image/webp'), 'IMAGE_UNSUPPORTED');
  });

  it('rejects a truncated image fail-closed', async () => {
    await expectSecurityCode(
      sanitizeImageForVision(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]), 'image/jpeg'),
      'IMAGE_DECODE_FAILED',
    );
  });

  it('rejects an oversized input before decoding', async () => {
    const oversized = Buffer.alloc(IMAGE_SECURITY_LIMITS.maxInputBytes + 1);
    await expectSecurityCode(sanitizeImageForVision(oversized, 'image/png'), 'IMAGE_TOO_LARGE');
  });

  it('rejects decoded dimensions above the per-axis limit', async () => {
    const wide = await sharp({
      create: {
        width: IMAGE_SECURITY_LIMITS.maxAxisPixels + 1,
        height: 1,
        channels: 3,
        background: '#ffffff',
      },
    }).png().toBuffer();

    await expectSecurityCode(sanitizeImageForVision(wide, 'image/png'), 'IMAGE_PIXEL_LIMIT_EXCEEDED');
  });

  it('rejects a decompression-bomb PNG header through the decoded pixel limit', async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    }).png().toBuffer();
    const bomb = withPngDimensions(png, 50_000, 50_000);

    await expectSecurityCode(sanitizeImageForVision(bomb, 'image/png'), 'IMAGE_PIXEL_LIMIT_EXCEEDED');
  });
});

function webpWithAnimationChunk() {
  const animationPayload = Buffer.alloc(6);
  const chunk = Buffer.concat([
    Buffer.from('ANIM', 'ascii'),
    uint32Le(animationPayload.length),
    animationPayload,
  ]);
  const riffPayload = Buffer.concat([Buffer.from('WEBP', 'ascii'), chunk]);
  return Buffer.concat([Buffer.from('RIFF', 'ascii'), uint32Le(riffPayload.length), riffPayload]);
}

function withPngDimensions(input: Buffer, width: number, height: number) {
  const output = Buffer.from(input);
  output.writeUInt32BE(width, 16);
  output.writeUInt32BE(height, 20);
  const chunkTypeAndData = output.subarray(12, 29);
  output.writeUInt32BE(crc32(chunkTypeAndData), 29);
  return output;
}

function uint32Le(value: number) {
  const output = Buffer.alloc(4);
  output.writeUInt32LE(value);
  return output;
}

function crc32(input: Buffer) {
  let crc = 0xffffffff;
  for (const byte of input) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function expectSecurityCode(promise: Promise<unknown>, code: ImageSecurityError['code']) {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(ImageSecurityError);
    expect((error as ImageSecurityError).code).toBe(code);
  }
}
