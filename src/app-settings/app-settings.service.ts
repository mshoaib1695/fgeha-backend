import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSettings } from './entities/app-settings.entity';
import { UserRole, User } from '../users/entities/user.entity';

export const NEWS_SECTION_TITLE_KEY = 'news_section_title';
export const NEWS_DETAIL_HEADER_KEY = 'news_detail_header';
export const SHOW_NEWS_SECTION_HEADING_KEY = 'show_news_section_heading';
export const SHOW_NEWS_CAROUSEL_OVERLAY_KEY = 'show_news_carousel_overlay';
export const RATING_ENABLED_KEY = 'rating_enabled';
export const PAYMENT_BLOCKING_MODE_KEY = 'payment_blocking_mode';
export const PAYMENT_GRACE_DAYS_DEFAULT_KEY = 'payment_grace_days_default';
export const DUES_SUPPORT_EMAIL_KEY = 'dues_support_email';
export const DUES_SUPPORT_PHONE_KEY = 'dues_support_phone';
const DEFAULT_NEWS_SECTION_TITLE = 'Latest News';
const DEFAULT_PAYMENT_BLOCKING_MODE = 'blockAfterGracePeriod';
const DEFAULT_PAYMENT_GRACE_DAYS = 30;

@Injectable()
export class AppSettingsService {
  constructor(
    @InjectRepository(AppSettings)
    private readonly repo: Repository<AppSettings>,
  ) {}

  /** Public: get settings for app (news section title, detail header, rating, etc.). */
  async getForApp(): Promise<{
    newsSectionTitle: string;
    newsDetailHeader: string;
    showNewsSectionHeading: boolean;
    showNewsCarouselOverlay: boolean;
    ratingEnabled: boolean;
    paymentBlockingMode: 'blockOnAnyDue' | 'blockAfterGracePeriod';
    paymentGraceDaysDefault: number;
    duesSupportEmail: string;
    duesSupportPhone: string;
  }> {
    const [sectionRow, detailRow, headingRow, overlayRow, ratingRow, blockingModeRow, graceDaysRow, duesSupportEmailRow, duesSupportPhoneRow] = await Promise.all([
      this.repo.findOne({ where: { key: NEWS_SECTION_TITLE_KEY } }),
      this.repo.findOne({ where: { key: NEWS_DETAIL_HEADER_KEY } }),
      this.repo.findOne({ where: { key: SHOW_NEWS_SECTION_HEADING_KEY } }),
      this.repo.findOne({ where: { key: SHOW_NEWS_CAROUSEL_OVERLAY_KEY } }),
      this.repo.findOne({ where: { key: RATING_ENABLED_KEY } }),
      this.repo.findOne({ where: { key: PAYMENT_BLOCKING_MODE_KEY } }),
      this.repo.findOne({ where: { key: PAYMENT_GRACE_DAYS_DEFAULT_KEY } }),
      this.repo.findOne({ where: { key: DUES_SUPPORT_EMAIL_KEY } }),
      this.repo.findOne({ where: { key: DUES_SUPPORT_PHONE_KEY } }),
    ]);
    const headingVal = headingRow?.value?.trim()?.toLowerCase();
    const overlayVal = overlayRow?.value?.trim()?.toLowerCase();
    const ratingVal = ratingRow?.value?.trim()?.toLowerCase();
    const paymentBlockingModeRaw = (blockingModeRow?.value ?? '').trim();
    const paymentBlockingMode =
      paymentBlockingModeRaw === 'blockOnAnyDue' || paymentBlockingModeRaw === 'blockAfterGracePeriod'
        ? paymentBlockingModeRaw
        : DEFAULT_PAYMENT_BLOCKING_MODE;
    const paymentGraceDaysDefaultRaw = Number(graceDaysRow?.value ?? DEFAULT_PAYMENT_GRACE_DAYS);
    const paymentGraceDaysDefault = Number.isFinite(paymentGraceDaysDefaultRaw)
      ? Math.max(0, Math.min(365, Math.floor(paymentGraceDaysDefaultRaw)))
      : DEFAULT_PAYMENT_GRACE_DAYS;
    return {
      newsSectionTitle: sectionRow?.value?.trim() || DEFAULT_NEWS_SECTION_TITLE,
      newsDetailHeader: detailRow?.value?.trim() ?? '',
      showNewsSectionHeading: headingVal !== 'false' && headingVal !== '0',
      showNewsCarouselOverlay: overlayVal !== 'false' && overlayVal !== '0',
      ratingEnabled: ratingVal !== 'false' && ratingVal !== '0',
      paymentBlockingMode,
      paymentGraceDaysDefault,
      duesSupportEmail: duesSupportEmailRow?.value?.trim() ?? '',
      duesSupportPhone: duesSupportPhoneRow?.value?.trim() ?? '',
    };
  }

  async getPaymentBlockingSettings(): Promise<{
    blockingMode: 'blockOnAnyDue' | 'blockAfterGracePeriod';
    graceDaysDefault: number;
  }> {
    const appSettings = await this.getForApp();
    return {
      blockingMode: appSettings.paymentBlockingMode,
      graceDaysDefault: appSettings.paymentGraceDaysDefault,
    };
  }

  /** Admin: get all settings. */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.repo.find();
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.key] = r.value ?? '';
    }
    return out;
  }

  /** Admin: update settings. */
  async update(
    updates: {
      newsSectionTitle?: string;
      newsDetailHeader?: string;
      showNewsSectionHeading?: boolean;
      showNewsCarouselOverlay?: boolean;
      ratingEnabled?: boolean;
      paymentBlockingMode?: 'blockOnAnyDue' | 'blockAfterGracePeriod';
      paymentGraceDaysDefault?: number;
      duesSupportEmail?: string;
      duesSupportPhone?: string;
    },
    user: User,
  ): Promise<{
    newsSectionTitle: string;
    newsDetailHeader: string;
    showNewsSectionHeading: boolean;
    showNewsCarouselOverlay: boolean;
    ratingEnabled: boolean;
    paymentBlockingMode: 'blockOnAnyDue' | 'blockAfterGracePeriod';
    paymentGraceDaysDefault: number;
    duesSupportEmail: string;
    duesSupportPhone: string;
  }> {
    if (user.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');

    if (updates.newsSectionTitle !== undefined && updates.newsSectionTitle !== null) {
      let row = await this.repo.findOne({ where: { key: NEWS_SECTION_TITLE_KEY } });
      const val = String(updates.newsSectionTitle ?? '').trim() || DEFAULT_NEWS_SECTION_TITLE;
      if (!row) {
        row = this.repo.create({
          key: NEWS_SECTION_TITLE_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.newsDetailHeader !== undefined) {
      let row = await this.repo.findOne({ where: { key: NEWS_DETAIL_HEADER_KEY } });
      const val = String(updates.newsDetailHeader ?? '').trim();
      if (!row) {
        row = this.repo.create({
          key: NEWS_DETAIL_HEADER_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.showNewsSectionHeading !== undefined) {
      let row = await this.repo.findOne({ where: { key: SHOW_NEWS_SECTION_HEADING_KEY } });
      const val = updates.showNewsSectionHeading ? 'true' : 'false';
      if (!row) {
        row = this.repo.create({
          key: SHOW_NEWS_SECTION_HEADING_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.showNewsCarouselOverlay !== undefined) {
      let row = await this.repo.findOne({ where: { key: SHOW_NEWS_CAROUSEL_OVERLAY_KEY } });
      const val = updates.showNewsCarouselOverlay ? 'true' : 'false';
      if (!row) {
        row = this.repo.create({
          key: SHOW_NEWS_CAROUSEL_OVERLAY_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.ratingEnabled !== undefined) {
      let row = await this.repo.findOne({ where: { key: RATING_ENABLED_KEY } });
      const val = updates.ratingEnabled === true ? 'true' : 'false';
      if (!row) {
        row = this.repo.create({
          key: RATING_ENABLED_KEY,
          value: val,
        });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.paymentBlockingMode !== undefined) {
      const val =
        updates.paymentBlockingMode === 'blockOnAnyDue'
          ? 'blockOnAnyDue'
          : 'blockAfterGracePeriod';
      let row = await this.repo.findOne({ where: { key: PAYMENT_BLOCKING_MODE_KEY } });
      if (!row) {
        row = this.repo.create({ key: PAYMENT_BLOCKING_MODE_KEY, value: val });
      } else {
        row.value = val;
      }
      await this.repo.save(row);
    }

    if (updates.paymentGraceDaysDefault !== undefined) {
      const normalized = Math.max(0, Math.min(365, Math.floor(Number(updates.paymentGraceDaysDefault))));
      let row = await this.repo.findOne({ where: { key: PAYMENT_GRACE_DAYS_DEFAULT_KEY } });
      if (!row) {
        row = this.repo.create({
          key: PAYMENT_GRACE_DAYS_DEFAULT_KEY,
          value: String(normalized),
        });
      } else {
        row.value = String(normalized);
      }
      await this.repo.save(row);
    }

    if (updates.duesSupportEmail !== undefined) {
      let row = await this.repo.findOne({ where: { key: DUES_SUPPORT_EMAIL_KEY } });
      const val = String(updates.duesSupportEmail ?? '').trim();
      if (!row) row = this.repo.create({ key: DUES_SUPPORT_EMAIL_KEY, value: val });
      else row.value = val;
      await this.repo.save(row);
    }

    if (updates.duesSupportPhone !== undefined) {
      let row = await this.repo.findOne({ where: { key: DUES_SUPPORT_PHONE_KEY } });
      const val = String(updates.duesSupportPhone ?? '').trim();
      if (!row) row = this.repo.create({ key: DUES_SUPPORT_PHONE_KEY, value: val });
      else row.value = val;
      await this.repo.save(row);
    }

    return this.getForApp();
  }
}
