export const AVIATION_MAP_STYLES = [
  { id: "standard", label: "Standard", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", credit: "OpenStreetMap contributors", maximumLevel: 18 },
  { id: "satellite", label: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", credit: "Esri World Imagery", maximumLevel: 19 },
  { id: "topographic", label: "Topographic", url: "https://tile.opentopomap.org/{z}/{x}/{y}.png", credit: "OpenTopoMap contributors", maximumLevel: 17 },
];

export function getAviationMapStyle(id) {
  return AVIATION_MAP_STYLES.find((style) => style.id === id) || AVIATION_MAP_STYLES[0];
}