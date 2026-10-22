export function load(url, context, nextLoad) {
  if (/\.(jpeg|jpg|png|svg|webp|gif)$/i.test(url)) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `export default ${JSON.stringify(url)};`
    }
  }
  return nextLoad(url, context)
}
