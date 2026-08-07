import sharp from 'sharp';

export const IMAGE_SECURITY_LIMITS = {
  maxInputBytes: 8 * 1024 * 1024,
  maxPixels: 20_000_000,
  maxAxisPixels: 8192,
} as const;

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

export type SanitizedImage = {
  buffer: Buffer;
  mimetype: 'image/png';
  width: number;
  height: number;
  sourceFormat: 'jpeg' | 'png' | 'webp';
};

export type ImageSecurityErrorCode =
  | 'IMAGE_TOO_LARGE'
  | 'IMAGE_TYPE_MISMATCH'
  | 'IMAGE_UNSUPPORTED'
  | 'IMAGE_DECODE_FAILED'
  | 'IMAGE_PIXEL_LIMIT_EXCEEDED'
  | 'IMAGE_SANITIZATION_FAILED';

export class ImageSecurityError extends Error {
  constructor(readonly code: ImageSecurityErrorCode) {
    super(code);
    this.name = 'ImageSecurityError';
  }
}

export async function sanitizeImageForVision(
  input: Buffer,
  declaredMimeType: string,
): Promise<SanitizedImage> {
  if (input.length > IMAGE_SECURITY_LIMITS.maxInputBytes) {
    throw new ImageSecurityError('IMAGE_TOO_LARGE');
  }

  const detectedFormat = detectImageFormat(input);
  if (!detectedFormat) throw new ImageSecurityError('IMAGE_UNSUPPORTED');
  if (mimeTypeForFormat(detectedFormat) !== declaredMimeType) {
    throw new ImageSecurityError('IMAGE_TYPE_MISMATCH');
  }
  const containerState = inspectContainerLength(input, detectedFormat);
  if (containerState === 'trailing') throw new ImageSecurityError('IMAGE_UNSUPPORTED');
  if (containerState === 'truncated') throw new ImageSecurityError('IMAGE_DECODE_FAILED');
  if (isAnimatedContainer(input, detectedFormat)) throw new ImageSecurityError('IMAGE_UNSUPPORTED');

  try {
    const decoder = sharp(input, {
      animated: false,
      failOn: 'error',
      limitInputPixels: IMAGE_SECURITY_LIMITS.maxPixels,
    });
    const metadata = await decoder.metadata();
    const width = metadata.width;
    const height = metadata.height;

    if (!width || !height) throw new ImageSecurityError('IMAGE_DECODE_FAILED');
    if (
      width > IMAGE_SECURITY_LIMITS.maxAxisPixels ||
      height > IMAGE_SECURITY_LIMITS.maxAxisPixels ||
      width * height > IMAGE_SECURITY_LIMITS.maxPixels
    ) {
      throw new ImageSecurityError('IMAGE_PIXEL_LIMIT_EXCEEDED');
    }
    if ((metadata.pages ?? 1) !== 1) throw new ImageSecurityError('IMAGE_UNSUPPORTED');

    const sanitized = await decoder
      .rotate()
      .png({ adaptiveFiltering: true, compressionLevel: 9, palette: false })
      .toBuffer({ resolveWithObject: true });

    return {
      buffer: sanitized.data,
      mimetype: 'image/png',
      width: sanitized.info.width,
      height: sanitized.info.height,
      sourceFormat: detectedFormat,
    };
  } catch (error) {
    if (error instanceof ImageSecurityError) throw error;
    if (isPixelLimitError(error)) throw new ImageSecurityError('IMAGE_PIXEL_LIMIT_EXCEEDED');
    throw new ImageSecurityError('IMAGE_DECODE_FAILED');
  }
}

function detectImageFormat(input: Buffer): SanitizedImage['sourceFormat'] | undefined {
  if (input.length >= 3 && input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return 'jpeg';
  if (
    input.length >= 8 &&
    input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return 'png';
  if (
    input.length >= 12 &&
    input.subarray(0, 4).toString('ascii') === 'RIFF' &&
    input.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'webp';
  return undefined;
}

function mimeTypeForFormat(format: SanitizedImage['sourceFormat']): AcceptedImageMimeType {
  if (format === 'jpeg') return 'image/jpeg';
  if (format === 'png') return 'image/png';
  return 'image/webp';
}

function inspectContainerLength(
  input: Buffer,
  format: SanitizedImage['sourceFormat'],
): 'exact' | 'trailing' | 'truncated' {
  if (format === 'jpeg') {
    const endMarker = input.lastIndexOf(Buffer.from([0xff, 0xd9]));
    if (endMarker < 0) return 'truncated';
    return endMarker === input.length - 2 ? 'exact' : 'trailing';
  }
  if (format === 'webp') {
    const declaredLength = input.readUInt32LE(4) + 8;
    if (declaredLength === input.length) return 'exact';
    return declaredLength < input.length ? 'trailing' : 'truncated';
  }

  const iend = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  const endMarker = input.lastIndexOf(iend);
  if (endMarker < 0) return 'truncated';
  return endMarker === input.length - iend.length ? 'exact' : 'trailing';
}

function isAnimatedContainer(input: Buffer, format: SanitizedImage['sourceFormat']) {
  if (format !== 'webp') return false;
  for (let offset = 12; offset + 8 <= input.length;) {
    const chunkType = input.subarray(offset, offset + 4).toString('ascii');
    const chunkSize = input.readUInt32LE(offset + 4);
    if (chunkType === 'ANIM' || chunkType === 'ANMF') return true;
    const nextOffset = offset + 8 + chunkSize + (chunkSize % 2);
    if (nextOffset <= offset || nextOffset > input.length) return false;
    offset = nextOffset;
  }
  return false;
}

function isPixelLimitError(error: unknown) {
  return error instanceof Error && /pixel limit|limitInputPixels/i.test(error.message);
}
