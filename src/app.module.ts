import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { RequestsModule } from './requests/requests.module';
import { RequestTypesModule } from './request-types/request-types.module';
import { DailyBulletinModule } from './daily-bulletin/daily-bulletin.module';
import { RequestTypeOptionsModule } from './request-type-options/request-type-options.module';
import { VGuard } from './auth/guards/v.guard';

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: VGuard },
  ],
})
export class AppModule {}
