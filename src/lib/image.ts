/**
 * Convert an image File chosen from the device into a compressed JPEG data URL.
 *
 * The image is drawn onto a canvas, scaled down so its largest side is at most
 * `maxDimension` px, and exported as a quality-compressed JPEG string. That
 * string is saved directly in products.image — no network upload needed, which
 * sidesteps flaky-connection upload failures and keeps the photo "in the
 * database" with the product.
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDimension = 700,
  quality = 0.75
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG, PNG, or WebP).');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('That image is very large (over 15 MB). Please pick a smaller one.');
  }

  // Read the file into a data URL.
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  // Load it into an <img> so we can draw and resize it.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('That file does not look like a valid image.'));
    i.src = rawDataUrl;
  });

  // Compute scaled dimensions (preserve aspect ratio).
  let { width, height } = img;
  if (Math.max(width, height) > maxDimension) {
    if (width >= height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process the image.');

  // White backdrop so transparent PNGs do not turn black when saved as JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}
