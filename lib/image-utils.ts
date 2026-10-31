export async function compressImage(file: File, maxWidth = 800): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  try {
    const img = await loadImage(dataUrl);
    const scale = Math.min(1, maxWidth / img.width);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.round(img.height * scale) || 1;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', file.size < 200_000 ? 0.92 : 0.75);
  } catch {
    return dataUrl;
  }
}

export async function prepareImageForOcr(file: File): Promise<string> {
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const maxWidth = 1800;
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (gray - 128) * 1.5 + 128));
    image.data[i] = contrast;
    image.data[i + 1] = contrast;
    image.data[i + 2] = contrast;
  }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.92);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
