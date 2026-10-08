// Browser-only: shrinks a photo before upload so it fits comfortably in the
// database and inside a server action's request limit.

export async function compressImage(file: Blob, maxSide = 1100, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", quality);
}

export function isImageFile(file: File): boolean {
  return /^image\/(jpeg|png|webp|gif|bmp)$/.test(file.type);
}
