import { Injectable, LoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger } from 'winston';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppLogger implements LoggerService {
  private logger: Logger;

  constructor(private configService: ConfigService) {
    const isProduction = configService.get('app.nodeEnv') === 'production';

    this.logger = createLogger({
      level: isProduction ? 'info' : 'debug',
      format: isProduction
        ? format.combine(format.timestamp(), format.json())
        : format.combine(
            format.colorize(),
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message, context, ...meta }) => {
              const ctx = context ? `[${context}]` : '';
              const metaStr = Object.keys(meta).length
                ? `\n${JSON.stringify(meta, null, 2)}`
                : '';
              return `${timestamp} ${level} ${ctx} ${message}${metaStr}`;
            }),
          ),
      transports: [
        new transports.Console(),
        // In production you'd add: new transports.File({ filename: 'logs/error.log', level: 'error' })
      ],
    });
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }
}