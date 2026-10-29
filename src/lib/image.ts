/**
 * Shrink an image before it is uploaded to a model: the long side is capped and the
 * result is a JPEG. A full-screen capture on a high-DPI display is several megabytes as
 * PNG, which takes minutes on a slow uplink; at 2048 px text is still easy to read.
 * Images that are already small enough are returned unchanged.
 */
export async function shrinkForUpload(
  dataUrl: string,
  maxSide = 2048,
  maxBytes = 900_000
) {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(
    1,
    maxSide / Math.max(img.naturalWidth, img.naturalHeight)
  )
  if (scale === 1 && dataUrl.length * 0.75 <= maxBytes) return dataUrl
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  const ctx = canvas.getContext("2d")!
  // JPEG has no transparency; screenshots with alpha would otherwise turn black.
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/jpeg", 0.9)
}
