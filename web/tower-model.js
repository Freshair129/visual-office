import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {makeAvatar} from './models.js';

export const FLOOR_HEIGHT = 2.45;

// Bake the existing office assets by material. All floors share geometry;
// the building does not create a renderer or an animation loop for each floor.
export function makeTower(room, desk, domains) {
  const source = new THREE.Group();
  source.add(room.clone(true));
  for (const [index, x] of [-3.5, 0, 3.5].entries()) {
    const station = desk.clone(true);
    station.position.set(x, 0, 0);
    source.add(station);
    const agent = makeAvatar({outfit: '#D6ECFA', skin: '#dfaf8c', hair: index === 1 ? 'bob' : 'short'});
    agent.position.set(x, 0, 1.1);
    agent.rotation.y = Math.PI;
    source.add(agent);
  }
  source.updateMatrixWorld(true);
  const batches = new Map(), temporary = new Set();
  source.traverse(node => {
    if (!node.isMesh) return;
    const geometry = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    // glTF geometry carries UVs, while source avatars do not. Only the
    // untextured position/normal attributes are needed for these baked assets.
    for (const name of Object.keys(geometry.attributes)) if (!['position', 'normal'].includes(name)) geometry.deleteAttribute(name);
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    if (!batches.has(node.material)) batches.set(node.material, []);
    batches.get(node.material).push(geometry);
  });
  // Avatar geometries were created for baking; glTF geometry remains owned by Office.
  source.children.filter(child => child.userData.body).forEach(child => child.traverse(node => { if (node.geometry) temporary.add(node.geometry); }));
  const template = new THREE.Group(), geometries = new Set(), materials = new Set();
  for (const [material, parts] of batches) {
    const geometry = mergeGeometries(parts);
    parts.forEach(part => part.dispose());
    geometries.add(geometry);
    template.add(new THREE.Mesh(geometry, material));
  }
  temporary.forEach(geometry => geometry.dispose());
  const building = new THREE.Group(), floors = [];
  const slabGeometry = new THREE.BoxGeometry(14.6, .18, 10.6);
  geometries.add(slabGeometry);
  for (const domain of domains) {
    const group = new THREE.Group();
    group.userData.domainKey = domain.key;
    group.position.y = (domain.number - 1) * FLOOR_HEIGHT;
    const interior = template.clone(true);
    interior.scale.y = .70;
    group.add(interior);
    const material = new THREE.MeshStandardMaterial({color: domain.color, roughness: .8});
    materials.add(material);
    const slab = new THREE.Mesh(slabGeometry, material);
    slab.position.y = -.30;
    group.add(slab);
    building.add(group);
    floors.push({domain, group, material});
  }
  const roofMaterial = new THREE.MeshStandardMaterial({color: '#ede9de', roughness: .9});
  materials.add(roofMaterial);
  const roof = new THREE.Mesh(slabGeometry, roofMaterial);
  roof.position.y = domains.length * FLOOR_HEIGHT - .30;
  building.add(roof);
  return {building, floors, geometries, materials};
}
