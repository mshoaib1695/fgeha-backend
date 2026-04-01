import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from './entities/user.entity';

type PushMessage = {
  to: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private expo: import('expo-server-sdk').Expo | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Expo } = require('expo-server-sdk') as typeof import('expo-server-sdk');
      this.expo = new Expo();
    } catch {
      this.logger.warn('expo-server-sdk not installed. Push notifications are disabled.');
    }
  }

  normalizeTokens(tokens: Array<string | null | undefined>): string[] {
    if (!this.expo) return [];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Expo } = require('expo-server-sdk') as typeof import('expo-server-sdk');
    const uniq = new Set<string>();
    for (const raw of tokens) {
      const t = String(raw ?? '').trim();
      if (!t) continue;
      if (!Expo.isExpoPushToken(t)) continue;
      uniq.add(t);
    }
    return [...uniq];
  }

  async send(message: PushMessage): Promise<void> {
    if (!this.expo) return;
    const tokens = this.normalizeTokens(message.to);
    if (!tokens.length) return;

    const notifications = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title: message.title,
      body: message.body,
      data: message.data ?? {},
    }));

    const chunks = this.expo.chunkPushNotifications(notifications);
    const tickets: import('expo-server-sdk').ExpoPushTicket[] = [];
    const receiptTokenById = new Map<string, string>();
    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
        ticketChunk.forEach((ticket, idx) => {
          if (ticket.status === 'ok' && 'id' in ticket) {
            const to = chunk[idx]?.to;
            if (ticket.id && typeof to === 'string') {
              receiptTokenById.set(ticket.id, to);
            }
          }
        });
      } catch (e) {
        this.logger.warn(`Push send failed for a chunk: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const receiptIds = tickets
      .filter((t): t is import('expo-server-sdk').ExpoPushSuccessTicket => t.status === 'ok' && 'id' in t)
      .map((t) => t.id);
    if (!receiptIds.length) return;

    const invalidTokens = new Set<string>();
    const receiptChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
    for (const chunk of receiptChunks) {
      try {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
        for (const receiptId of Object.keys(receipts)) {
          const receipt = receipts[receiptId];
          if (
            receipt.status === 'error' &&
            (receipt.details as { error?: string } | undefined)?.error === 'DeviceNotRegistered'
          ) {
            const token = receiptTokenById.get(receiptId);
            if (token) invalidTokens.add(token);
          }
        }
      } catch (e) {
        this.logger.warn(`Push receipt check failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (invalidTokens.size) {
      await this.userRepo.update({ pushToken: In([...invalidTokens]) }, { pushToken: null });
    }
  }
}
