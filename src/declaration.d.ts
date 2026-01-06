declare module '*.css'
declare module '*.glsl'
declare module '*.wgsl' {
  const content: string
  export default content
}
declare module '*.md'

declare module '*.md' {
  const html: string
  export default html
}
