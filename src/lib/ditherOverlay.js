// Enhanced dither overlay: CSS + SVG filter approach for cross-browser safety

export function enableDither() {
  document.body.classList.add('forge-matrix')
}

export function disableDither() {
  document.body.classList.remove('forge-matrix')
}

export function toggleDither() {
  const isOn = document.body.classList.toggle('forge-matrix')
  if (isOn) enableDither()
  else disableDither()
  return isOn
}
