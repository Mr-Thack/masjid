export function beforeNavigate() {}
export function afterNavigate() {}
export function goto() {
  return Promise.resolve();
}
export function invalidate() {
  return Promise.resolve();
}
export function preloadData() {
  return Promise.resolve(null);
}
export function preloadCode() {
  return Promise.resolve();
}
