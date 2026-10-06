/** Rebind a fixture's stable edge object so captured request closures use fresh transport state. */
export const edgeBuilders = new WeakMap<object, () => object>();
export function refreshFixtureEdge(edge: object) {
  const build = edgeBuilders.get(edge);
  if (build !== undefined) Object.assign(edge, build());
}
