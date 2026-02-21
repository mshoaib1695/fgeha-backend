import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getHello(): string {
    return 'Hello World!';
  }

  /** Used by the mobile app: force-update (minimumVersion) and optional soft prompt (latestVersion). */
  getAppVersion(): {
    minimumVersion: string;
    latestVersion?: string;
    storeUrlAndroid?: string;
    storeUrlIos?: string;
  } {
    const minimumVersion =
      this.config.get<string>('APP_MINIMUM_VERSION') ?? '1.0.0';
    const latestVersion =
      this.config.get<string>('APP_LATEST_VERSION') ?? minimumVersion;
    const storeUrlAndroid =
      this.config.get<string>('APP_STORE_URL_ANDROID') ??
      'https://play.google.com/store/apps/details?id=com.fgeha.app';
    const storeUrlIos =
      this.config.get<string>('APP_STORE_URL_IOS');
    return {
      minimumVersion,
      latestVersion,
      storeUrlAndroid,
      ...(storeUrlIos && { storeUrlIos }),
    };
  }
}
