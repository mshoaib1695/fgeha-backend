import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check - no auth required' })
  health(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('app-version')
  @ApiOperation({ summary: 'App version config - minimum/latest version and store URLs for force-update and soft prompt' })
  appVersion(): {
    minimumVersion: string;
    latestVersion?: string;
    storeUrlAndroid?: string;
    storeUrlIos?: string;
  } {
    return this.appService.getAppVersion();
  }
}
