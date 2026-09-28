export interface AvatarCropRectangle {
  left: number
  top: number
  side: number
}

export function calculateAvatarCrop(
  width: number,
  height: number,
  zoom: number,
  horizontalPercent: number,
  verticalPercent: number,
): AvatarCropRectangle {
  const side = Math.min(width, height) / zoom
  return {
    left: ((width - side) * horizontalPercent) / 100,
    top: ((height - side) * verticalPercent) / 100,
    side,
  }
}
