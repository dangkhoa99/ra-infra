import { getError } from '@/utilities';
import dayjs from 'dayjs';

const applicationLogger = console;

export type TLogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface ILogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

export class Logger implements ILogger {
  private static instance: Logger;
  private isDebugEnabled: boolean;

  constructor(opts?: { enableDebug: boolean }) {
    this.isDebugEnabled = opts?.enableDebug ?? false;
  }

  static getInstance(opts?: { enableDebug: boolean }): Logger {
    if (!this.instance) {
      this.instance = new Logger(opts);
    }

    this.instance.isDebugEnabled = opts?.enableDebug ?? false;
    return this.instance;
  }

  getTimestamp() {
    return dayjs().toISOString();
  }

  toggleDebug(opts?: { state: boolean }) {
    this.isDebugEnabled = opts?.state || !this.isDebugEnabled;
  }

  generateLog(opts: { level: TLogLevel; message: any; args: any[] }) {
    const { level, message, args } = opts;
    const timestamp = this.getTimestamp();

    switch (typeof message) {
      case 'string': {
        return {
          message: `${timestamp} - [${level}] ${message}`,
          args,
        };
      }
      default: {
        return {
          message: `${timestamp} - [${level}]`,
          args: [message, ...args],
        };
      }
    }
  }

  private log(level: TLogLevel, message: any, ...args: any[]) {
    if (!applicationLogger) {
      throw getError({ message: '[info] Invalid logger instance!' });
    }

    if (level === 'debug' && !this.isDebugEnabled) {
      return;
    }

    const generated = this.generateLog({ level, message, args });
    applicationLogger.info(generated.message, ...generated.args);
  }

  debug(message: any, ...args: any[]) {
    this.log('debug', message, ...args);
  }

  info(message: any, ...args: any[]) {
    this.log('info', message, ...args);
  }

  warn(message: any, ...args: any[]) {
    this.log('warn', message, ...args);
  }

  error(message: any, ...args: any[]) {
    this.log('error', message, ...args);
  }
}
