export const clamp = (min, input, max) => {
  return Math.max(min, Math.min(input, max))
}

export const mapRange = (in_min, in_max, input, out_min, out_max) => {
  return ((input - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min
}

export const lerp = (start, end, amt) => {
  return (1 - amt) * start + amt * end
}

export const truncate = (value, decimals) => {
  return parseFloat(value.toFixed(decimals))
}

export const randomFromRange = (min, max) => {
  return Math.random() * (max - min) + min
}

export const randomFromArray = (array) => {
  return array[Math.floor(Math.random() * array.length)]
}

export const normalize = (val, min, max) => Math.max(0, Math.min(1, (val - min) / (max - min)))

// Simple ratio function given a width and height
export const ratio = (width, height) => {
  const ratioX = width > height ? width / height : 1
  const ratioY = width > height ? 1 : height / width

  return [ratioX, ratioY]
}
