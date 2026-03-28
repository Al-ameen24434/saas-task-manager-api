import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { appConfig, databaseConfig, jwtConfig } from '@config/index';
import { GlobalExceptionFilter } from '@common/filters/http-exception.filter';
import { TransformInterceptor } from '@common/interceptors/transform.interceptor';
import { DatabaseModule } from '@database/database.module';

@Module({
  imports: [
    // ConfigModule loads .env and makes config injectable app-wide
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: '.env',
    }),
    DatabaseModule,
  ],
  providers: [
    // Register global filter (error handler)
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Register global interceptor (response wrapper)
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}