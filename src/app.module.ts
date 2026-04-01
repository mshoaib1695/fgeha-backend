import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SentryModule, SentryGlobalFilter } from '@sentry/nestjs/setup';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RequestsModule } from './requests/requests.module';
import { RequestTypesModule } from './request-types/request-types.module';
import { DailyBulletinModule } from './daily-bulletin/daily-bulletin.module';
import { RequestTypeOptionsModule } from './request-type-options/request-type-options.module';
import { SubSectorsModule } from './sub-sectors/sub-sectors.module';
import { FeedbackModule } from './feedback/feedback.module';
import { NewsModule } from './news/news.module';
import { AppSettingsModule } from './app-settings/app-settings.module';
import { HouseDuesModule } from './house-dues/house-dues.module';
import { VGuard } from './auth/guards/v.guard';
import { HttpLoggingInterceptor } from './common/http-logging.interceptor';

const useSentry = !!process.env.SENTRY_DSN?.trim();

@Module({
  imports: [
    ...(useSentry ? [SentryModule.forRoot()] : []),
    ConfigModule.forRoot({
      envFilePath: ['.env', 'src/.env'],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get('DB_HOST', 'localhost'),
        port: +config.get('DB_PORT', 3306),
        username: config.get('DB_USERNAME', 'root'),
        password: config.get('DB_PASSWORD', ''),
        database: config.get('DB_DATABASE', 'nest_crud'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    UsersModule,
    AuthModule,
    RequestsModule,
    RequestTypesModule,
    RequestTypeOptionsModule,
    DailyBulletinModule,
    SubSectorsModule,
    FeedbackModule,
    NewsModule,
    AppSettingsModule,
    HouseDuesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    ...(useSentry ? [{ provide: APP_FILTER, useClass: SentryGlobalFilter }] : []),
    { provide: APP_GUARD, useClass: VGuard },
    { provide: APP_INTERCEPTOR, useClass: HttpLoggingInterceptor },
  ],
})
export class AppModule {}
