// Use a const that gets replaced by Vite at build time
// In production: ENABLED becomes false, all methods become no-ops
declare const __DEV__: boolean

const ENABLED: boolean = __DEV__

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  constructor(
    private context: string,
    private minLevel: LogLevel = LogLevel.DEBUG,
  ) {}

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!ENABLED) return
    if (level < this.minLevel) return

    const prefix = `[${this.context}]`
    const method =
      level === LogLevel.ERROR
        ? console.error
        : level === LogLevel.WARN
          ? console.warn
          : level === LogLevel.INFO
            ? console.info
            : console.log

    data !== undefined ? method(prefix, message, data) : method(prefix, message)
  }

  debug = (msg: string, data?: unknown) => this.log(LogLevel.DEBUG, msg, data)
  info = (msg: string, data?: unknown) => this.log(LogLevel.INFO, msg, data)
  warn = (msg: string, data?: unknown) => this.log(LogLevel.WARN, msg, data)
  error = (msg: string, data?: unknown) => this.log(LogLevel.ERROR, msg, data)
}

export const createLogger = (context: string) => new Logger(context)
export { LogLevel }
