// Inventory ceilings are provisional and require lead review; they are not
// evidence that a floor meets a frame-time or device-performance target.
export const PROPOSED_INVENTORY_LIMITS = Object.freeze({
  characterBytes: 6_000_000,
  characterTriangles: 85_000,
  floorUniqueCharacterBytes: 11_000_000,
});

export function summarizeIntervals(samples) {
  if (!Array.isArray(samples) || samples.some(n => !Number.isFinite(n) || n < 0)) {
    throw new TypeError('Intervals must be finite nonnegative milliseconds');
  }
  if (!samples.length) return {count: 0, p50Ms: null, p95Ms: null, p99Ms: null, maxMs: null, fps: null, over35Ms: 0, over40Ms: 0, over50Ms: 0, over100Ms: 0};
  const sorted = [...samples].sort((a, b) => a - b);
  // Match the 31 October Tycoon harness: floor(N * quantile), zero indexed.
  const q = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const countOver = limit => samples.filter(value => value > limit).length;
  return {
    count: samples.length, p50Ms: q(.5), p95Ms: q(.95), p99Ms: q(.99),
    maxMs: sorted.at(-1), fps: samples.reduce((a, b) => a + b, 0) ? samples.length * 1000 / samples.reduce((a, b) => a + b, 0) : null,
    over35Ms: countOver(35), over40Ms: countOver(40), over50Ms: countOver(50), over100Ms: countOver(100),
  };
}

export function evaluateCharacter(asset, limits = PROPOSED_INVENTORY_LIMITS) {
  if (!asset || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 ||
      !Number.isSafeInteger(asset.triangles) || asset.triangles <= 0) {
    throw new TypeError('Character bytes and triangles must be positive integers');
  }
  return {bytes: asset.bytes, triangles: asset.triangles,
    bytesPass: asset.bytes <= limits.characterBytes,
    trianglesPass: asset.triangles <= limits.characterTriangles};
}

export function evaluateScene(appearances, assets, limits = PROPOSED_INVENTORY_LIMITS) {
  if (!Array.isArray(appearances) || !appearances.length) throw new TypeError('Scene must have characters');
  const byId = new Map(assets.map(asset => [asset.id, asset]));
  if (byId.size !== assets.length) throw new TypeError('Duplicate character asset ID');
  const unique = new Set();
  let instanceTriangles = 0;
  for (const id of appearances) {
    const asset = byId.get(id);
    if (!asset) throw new TypeError(`Unknown character ${id}`);
    evaluateCharacter(asset, limits);
    unique.add(id);
    instanceTriangles += asset.triangles;
  }
  const uniqueBytes = [...unique].reduce((sum, id) => sum + byId.get(id).bytes, 0);
  return {instances: appearances.length, uniqueAssets: unique.size, uniqueBytes, instanceTriangles,
    payloadPass: uniqueBytes <= limits.floorUniqueCharacterBytes};
}
