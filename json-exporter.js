/**
 * JSON Exporter Module
 * Export slice configuration as JSON.
 */

/**
 * Export slice configuration as JSON.
 *
 * @param {GridConfig} gridConfig - Detected grid configuration
 * @param {ProcessedComponent[]} components - Extracted components
 * @returns {string} - JSON string
 */
export function exportToJSON(gridConfig, components) {
  const output = {
    version: '1.0.0',
    generated: new Date().toISOString(),

    grid: {
      rows: gridConfig.rows,
      columns: gridConfig.columns,
      horizontalSlices: gridConfig.horizontalSlices,
      verticalSlices: gridConfig.verticalSlices
    },

    components: components.map(component => ({
      id: component.id,
      name: component.name,

      source: {
        x: component.sourceX,
        y: component.sourceY,
        width: component.width,
        height: component.height
      },

      nineSlice: component.nineSlice ? {
        top: component.nineSlice.top,
        right: component.nineSlice.right,
        bottom: component.nineSlice.bottom,
        left: component.nineSlice.left
      } : null,

      shapes: component.shapes.map(shape => ({
        type: shape.type,
        bounds: { x: shape.x, y: shape.y, width: shape.width, height: shape.height },
        color: shape.color ? `rgba(${shape.color.r}, ${shape.color.g}, ${shape.color.b}, ${shape.color.a / 255})` : null,
        cornerRadius: shape.cornerRadius || 0
      })),

      output: {
        filename: `${component.name}.png`,
        cssClass: `.ui-${component.name}`
      }
    }))
  };

  return JSON.stringify(output, null, 2);
}
