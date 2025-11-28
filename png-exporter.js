/**
 * PNG Exporter Module
 * Export processed components as transparent PNGs.
 */

/**
 * Export processed components as transparent PNGs.
 *
 * @param {ProcessedComponent[]} components - Extracted components
 * @returns {Promise<Blob[]>} - Array of PNG blobs
 */
export async function exportToPNG(components) {
  const pngBlobs = [];

  for (const component of components) {
    const canvas = document.createElement('canvas');
    canvas.width = component.width;
    canvas.height = component.height;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false; // Preserve pixel art
    ctx.putImageData(component.imageData, 0, 0);

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });

    pngBlobs.push({
      name: component.name,
      blob: blob,
      width: component.width,
      height: component.height
    });
  }

  return pngBlobs;
}
