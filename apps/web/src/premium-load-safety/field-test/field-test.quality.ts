import type { FieldPhotoQuality } from './field-test.types';

export async function prepareFieldPhoto(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 2_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    return blob
      ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified })
      : file;
  } finally {
    bitmap.close();
  }
}

export async function inspectFieldPhoto(file: File): Promise<FieldPhotoQuality> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 320 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const luminance = new Float32Array(canvas.width * canvas.height);
    let total = 0;
    for (let pixel = 0, index = 0; index < data.length; index += 4, pixel += 1) {
      const value = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      luminance[pixel] = value;
      total += value;
    }
    const exposure = total / Math.max(1, luminance.length);
    let laplacianTotal = 0;
    let laplacianSquared = 0;
    let count = 0;
    for (let y = 1; y < canvas.height - 1; y += 1) {
      for (let x = 1; x < canvas.width - 1; x += 1) {
        const index = y * canvas.width + x;
        const value =
          4 * luminance[index] -
          luminance[index - 1] -
          luminance[index + 1] -
          luminance[index - canvas.width] -
          luminance[index + canvas.width];
        laplacianTotal += value;
        laplacianSquared += value * value;
        count += 1;
      }
    }
    const average = laplacianTotal / Math.max(1, count);
    const sharpness = laplacianSquared / Math.max(1, count) - average * average;
    const issues: FieldPhotoQuality['issues'] = [];
    if (bitmap.width < 720 || bitmap.height < 480) issues.push('resolution');
    if (sharpness < 55) issues.push('blur');
    if (exposure < 42) issues.push('dark');
    if (exposure > 218) issues.push('bright');
    return {
      usable: issues.length === 0,
      width: bitmap.width,
      height: bitmap.height,
      sharpness: Math.round(sharpness),
      exposure: Math.round(exposure),
      issues,
    };
  } finally {
    bitmap.close();
  }
}
