import { getError } from '@/utilities';

const applicationLogger = console;

export interface ILogger {
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class Logger implements ILogger {
  private static instance: Logger;

  constructor() {}

  static getInstance(): Logger {
    if (!this.instance) {
      this.instance = new Logger();
    }

    return this.instance;
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  generateLog(opts: { level: 'INFO' | 'WARN' | 'ERROR'; message: string }) {
    const { level, message } = opts;
    const timestamp = this.getTimestamp();
    return `${timestamp} - [${level}]\t ${message}`;
  }

  info(message: string, ...args: any[]) {
    if (!applicationLogger) {
      throw getError({ message: '[info] Invalid logger instance!' });
    }

    applicationLogger.info(this.generateLog({ level: 'INFO', message }), ...args);
  }

  warn(message: string, ...args: any[]) {
    if (!applicationLogger) {
      throw getError({ message: '[error] Invalid logger instance!' });
    }

    applicationLogger.warn(this.generateLog({ level: 'WARN', message }), ...args);
  }

  error(message: string, ...args: any[]) {
    if (!applicationLogger) {
      throw getError({ message: '[error] Invalid logger instance!' });
    }

    applicationLogger.error(this.generateLog({ level: 'ERROR', message }), ...args);
  }
}
