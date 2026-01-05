import 'styled-components'
import type { DefaultTheme } from 'styled-components'

declare module 'styled-components' {
  export interface DefaultTheme {
    light: boolean
  }
}
