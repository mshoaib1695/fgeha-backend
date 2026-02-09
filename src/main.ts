import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const server = express();
  server.use(express.json({ limit: '10mb' }));
  server.use(express.urlencoded({ extended: true, limit: '10mb' }));
  server.use('/idcards', express.static(path.join(process.cwd(), 'idcards')));
  server.use('/profiles', express.static(path.join(process.cwd(), 'profiles')));
  server.use('/daily-files', express.static(path.join(process.cwd(), 'daily-files')));
  server.use('/request-type-icons', express.static(path.join(process.cwd(), 'request-type-icons')));
  server.use('/request-type-option-images', express.static(path.join(process.cwd(), 'request-type-option-images')));
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.enableCors({
    origin: true, // allow any origin in dev; set to admin URL in production
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('GEHA API')
    .setDescription('User registration, admin approval, and service requests')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`Backend listening on http://0.0.0.0:${port} (reachable from network at http://YOUR_IP:${port})`);
}
bootstrap();
