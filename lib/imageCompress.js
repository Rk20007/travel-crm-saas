/** Client-only image compression to a target byte size, encoded as a JPEG
 * data URL — same downscale-then-reencode approach used for gallery/hotel
 * photos (components/settings/GalleryManager.jsx), reused here so payment
 * screenshots don't bloat the database or slow the app down. */

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function dataUrlSize(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  return Math.ceil((base64.length * 3) / 4)
}

function compressImage(file, targetBytes, maxDimension = 1200, startQuality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      let dimension = maxDimension
      let quality = startQuality
      let dataUrl = ''
      // Shrink quality first (cheap, preserves detail), then dimension, until
      // the encoded size fits the target — bail out after a bounded number of
      // passes so a stubborn image can't loop forever.
      for (let attempt = 0; attempt < 10; attempt++) {
        const scale = Math.min(1, dimension / Math.max(img.width, img.height))
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        dataUrl = canvas.toDataURL('image/jpeg', quality)
        if (dataUrlSize(dataUrl) <= targetBytes || (quality <= 0.25 && dimension <= 320)) break
        if (quality > 0.25) quality -= 0.12
        else dimension = Math.round(dimension * 0.8)
      }
      resolve(dataUrl)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

/** Compresses an image file down to (best-effort) `targetBytes` and returns
 * a JPEG data URL. Non-image files fall back to a plain data URL. */
export async function toCompressedDataUrl(file, targetBytes = 70 * 1024) {
  if (!file.type?.startsWith('image/')) return readFileAsDataUrl(file)
  try {
    return await compressImage(file, targetBytes)
  } catch {
    return readFileAsDataUrl(file)
  }
}

export { dataUrlSize }
