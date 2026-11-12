// Material conditions. Names are for researchers/developers only — the
// participant interface shows just the id (01–04). Each condition's module is
// loaded on demand (dynamic import), so only the active one is ever instantiated.

export const MATERIALS = Object.freeze([
  Object.freeze({ id: '01', key: 'structural', name: 'Structural / Memory', status: 'full', load: () => import('./StructuralMaterial.js') }),
  Object.freeze({ id: '02', key: 'gel', name: 'Gel / Flow', status: 'full', load: () => import('./GelMaterial.js') }),
  Object.freeze({ id: '03', key: 'plastic', name: 'Plastic / Crease', status: 'full', load: () => import('./PlasticMaterial.js') }),
  Object.freeze({ id: '04', key: 'silicone', name: 'Silicone / Elasticity', status: 'full', load: () => import('./SiliconeMaterial.js') }),
]);

export const CONDITION_IDS = Object.freeze(MATERIALS.map((m) => m.id));
export const materialById = (id) => MATERIALS.find((m) => m.id === id) || null;
