import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const XLSX = require('xlsx');
import { AppSettingsService } from '../app-settings/app-settings.service';
import { SubSector } from '../users/entities/sub-sector.entity';
import { MailService } from '../users/mail.service';
import { AccountStatus, ApprovalStatus, User, UserRole } from '../users/entities/user.entity';
import { PushService } from '../users/push.service';
import { HouseDue } from './entities/house-due.entity';
import { HouseDueCategory } from './entities/house-due-category.entity';
import { HouseDueEntry } from './entities/house-due-entry.entity';
import { AddHouseDueEntryDto } from './dto/add-house-due-entry.dto';
import { ListHouseDuesQueryDto } from './dto/list-house-dues-query.dto';
import { UpdateHouseDueSettingsDto } from './dto/update-house-due-settings.dto';
import { UpsertHouseDueDto } from './dto/upsert-house-due.dto';
import { CreateHouseDueCategoryDto } from './dto/create-house-due-category.dto';
import { UpdateHouseDueCategoryDto } from './dto/update-house-due-category.dto';

type BlockingMode = 'blockOnAnyDue' | 'blockAfterGracePeriod';
type BulkEntryType = 'charge' | 'payment' | 'adjustment';
type BulkUploadOptions = { dryRun?: boolean; stopOnError?: boolean };
type BulkRowResult = {
  rowNumber: number;
  status: 'ok' | 'error';
  message: string;
};
type BulkUploadJobResult = {
  importId: string;
  createdAt: string;
  dryRun: boolean;
  stopOnError: boolean;
  totalRows: number;
  successCount: number;
  failCount: number;
  results: BulkRowResult[];
};

type EvaluatedDueStatus = {
  isBlocked: boolean;
  totalOutstanding: number;
  dueDate: string | null;
  message: string;
  duesSupportEmail: string;
  duesSupportPhone: string;
  ruleUsed: BlockingMode;
  charges: Array<{
    category: string;
    amount: number;
  }>;
};

function normalizeStr(v: string | null | undefined): string {
  return String(v ?? '').trim();
}

function toMoney(v: number): number {
  return Number(v.toFixed(2));
}

function buildDefaultNoticeMessage(graceDays: number): string {
  const days = Number.isFinite(graceDays) && graceDays >= 0 ? Math.floor(graceDays) : 30;
  if (days === 0) {
    return 'Please clear your outstanding payment immediately to continue receiving services.';
  }
  return `Please clear your outstanding payment within ${days} days to continue receiving services.`;
}

@Injectable()
export class HouseDuesService {
  private readonly importJobs = new Map<string, BulkUploadJobResult>();

  constructor(
    @InjectRepository(HouseDue)
    private readonly houseDueRepo: Repository<HouseDue>,
    @InjectRepository(HouseDueEntry)
    private readonly houseDueEntryRepo: Repository<HouseDueEntry>,
    @InjectRepository(HouseDueCategory)
    private readonly houseDueCategoryRepo: Repository<HouseDueCategory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(SubSector)
    private readonly subSectorRepo: Repository<SubSector>,
    private readonly appSettingsService: AppSettingsService,
    private readonly mailService: MailService,
    private readonly pushService: PushService,
  ) {}

  private async getTotalOutstanding(row: HouseDue): Promise<number> {
    const sumRaw = await this.houseDueEntryRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.signed_amount), 0)', 'sum')
      .where('e.house_due_id = :houseDueId', { houseDueId: row.id })
      .getRawOne<{ sum: string }>();
    return toMoney(Number(sumRaw?.sum ?? 0));
  }

  private async getCategoryBalances(row: HouseDue): Promise<Array<{ category: string; amount: number }>> {
    const raw = await this.houseDueEntryRepo
      .createQueryBuilder('e')
      .select('COALESCE(e.category, "General")', 'category')
      .addSelect('COALESCE(SUM(e.signed_amount), 0)', 'sum')
      .where('e.house_due_id = :houseDueId', { houseDueId: row.id })
      .groupBy('e.category')
      .getRawMany<{ category: string; sum: string }>();
    return raw
      .map((r) => ({ category: r.category || 'General', amount: toMoney(Number(r.sum || 0)) }))
      .filter((r) => r.amount !== 0);
  }

  private buildDueDate(row: HouseDue): string | null {
    if (!row.noticeIssuedAt) return null;
    const d = new Date(row.noticeIssuedAt);
    d.setDate(d.getDate() + (row.graceDays ?? 30));
    return d.toISOString();
  }

  async evaluateHouseOutstanding(
    house: { subSectorId: number; houseNo: string; streetNo: string },
  ): Promise<EvaluatedDueStatus> {
    const houseNo = normalizeStr(house.houseNo);
    const streetNo = normalizeStr(house.streetNo);
    const dues = await this.houseDueRepo.findOne({
      where: {
        subSectorId: house.subSectorId,
        houseNo,
        streetNo,
      },
    });
    const settings = await this.appSettingsService.getPaymentBlockingSettings();
    const appSettings = await this.appSettingsService.getForApp();
    const ruleUsed = settings.blockingMode;

    if (!dues || !dues.isActive) {
      return {
        isBlocked: false,
        totalOutstanding: 0,
        dueDate: null,
        message: 'No outstanding payment.',
        duesSupportEmail: appSettings.duesSupportEmail,
        duesSupportPhone: appSettings.duesSupportPhone,
        ruleUsed,
        charges: [{ category: 'General', amount: 0 }],
      };
    }

    const totalOutstanding = await this.getTotalOutstanding(dues);
    const categoryBalances = await this.getCategoryBalances(dues);
    const dueDate = this.buildDueDate(dues);
    const baseMessage =
      normalizeStr(dues.noticeMessage) ||
      buildDefaultNoticeMessage(dues.graceDays ?? 30);

    let isBlocked = false;
    if (totalOutstanding > 0) {
      if (ruleUsed === 'blockOnAnyDue') {
        isBlocked = true;
      } else {
        const issuedAt = dues.noticeIssuedAt ? new Date(dues.noticeIssuedAt) : new Date(dues.updatedAt);
        const graceDays = dues.graceDays ?? 30;
        const graceDeadline = new Date(issuedAt);
        graceDeadline.setDate(graceDeadline.getDate() + graceDays);
        isBlocked = new Date() > graceDeadline;
      }
    }

    return {
      isBlocked,
      totalOutstanding,
      dueDate,
      message: baseMessage,
      duesSupportEmail: appSettings.duesSupportEmail,
      duesSupportPhone: appSettings.duesSupportPhone,
      ruleUsed,
      charges: categoryBalances.length ? categoryBalances : [{ category: 'General', amount: totalOutstanding }],
    };
  }

  async getMyStatus(user: User) {
    return this.evaluateHouseOutstanding({
      subSectorId: user.subSectorId,
      houseNo: user.houseNo,
      streetNo: user.streetNo,
    });
  }

  private async getOrCreateHouseDue(
    house: { subSectorId: number; houseNo: string; streetNo: string },
    currentUser: User,
  ): Promise<HouseDue> {
    const houseNo = normalizeStr(house.houseNo);
    const streetNo = normalizeStr(house.streetNo);
    const existing = await this.houseDueRepo.findOne({
      where: { subSectorId: house.subSectorId, houseNo, streetNo },
    });
    if (existing) return existing;
    return this.houseDueRepo.save(
      this.houseDueRepo.create({
        subSectorId: house.subSectorId,
        houseNo,
        streetNo,
        isActive: true,
        graceDays: 30,
        updatedByAdminId: currentUser.id,
      }),
    );
  }

  async addEntryAdmin(dto: AddHouseDueEntryDto, currentUser: User) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const row = await this.getOrCreateHouseDue(
      {
        subSectorId: dto.subSectorId,
        houseNo: dto.houseNo,
        streetNo: dto.streetNo,
      },
      currentUser,
    );

    const amount = toMoney(Number(dto.amount || 0));
    const currentOutstanding = await this.getTotalOutstanding(row);
    if (dto.entryType === 'payment' && amount > currentOutstanding) {
      throw new BadRequestException(
        `Payment amount (${amount.toFixed(2)}) cannot be greater than outstanding balance (${Math.round(currentOutstanding)}).`,
      );
    }
    let signedAmount = amount;
    if (dto.entryType === 'payment') signedAmount = -amount;
    if (dto.entryType === 'adjustment') {
      signedAmount = dto.adjustmentDirection === 'credit' ? -amount : amount;
    }

    const entry = this.houseDueEntryRepo.create({
      houseDueId: row.id,
      entryType: dto.entryType,
      category: normalizeStr(dto.category) || 'General',
      amount: String(amount),
      signedAmount: String(signedAmount),
      reference: normalizeStr(dto.reference) || null,
      note: normalizeStr(dto.note) || null,
      createdByAdminId: currentUser.id,
    });
    await this.houseDueEntryRepo.save(entry);

    row.noticeMessage = normalizeStr(dto.noticeMessage) || row.noticeMessage || null;
    row.graceDays = dto.graceDays ?? row.graceDays ?? 30;
    row.isActive = dto.isActive ?? row.isActive ?? true;
    row.updatedByAdminId = currentUser.id;
    // Finance-style behavior: start/reset grace window only when receivable increases.
    if (signedAmount > 0) {
      row.noticeIssuedAt = new Date();
    }
    await this.houseDueRepo.save(row);

    await this.sendNoticeEmailToHouseResidents(row, {
      entryType: dto.entryType,
      entryCategory: normalizeStr(dto.category) || null,
      entryAmount: amount,
    });
    const evaluated = await this.evaluateHouseOutstanding({
      subSectorId: dto.subSectorId,
      houseNo: dto.houseNo,
      streetNo: dto.streetNo,
    });
    return {
      account: row,
      entry,
      outstanding: evaluated,
    };
  }

  async upsertAdmin(dto: UpsertHouseDueDto, currentUser: User) {
    // Backward-compatible: convert legacy upsert into ledger charge entries.
    if (Number(dto.waterConservancyAmount || 0) > 0) {
      await this.addEntryAdmin(
        {
          subSectorId: dto.subSectorId,
          houseNo: dto.houseNo,
          streetNo: dto.streetNo,
          entryType: 'charge',
          category: 'Water & Conservancy',
          amount: Number(dto.waterConservancyAmount || 0),
          noticeMessage: dto.noticeMessage,
          graceDays: dto.graceDays,
          isActive: dto.isActive,
        },
        currentUser,
      );
    }
    if (Number(dto.occupancyAmount || 0) > 0) {
      await this.addEntryAdmin(
        {
          subSectorId: dto.subSectorId,
          houseNo: dto.houseNo,
          streetNo: dto.streetNo,
          entryType: 'charge',
          category: 'Occupancy',
          amount: Number(dto.occupancyAmount || 0),
          noticeMessage: dto.noticeMessage,
          graceDays: dto.graceDays,
          isActive: dto.isActive,
        },
        currentUser,
      );
    }
    const account = await this.getOrCreateHouseDue(
      { subSectorId: dto.subSectorId, houseNo: dto.houseNo, streetNo: dto.streetNo },
      currentUser,
    );
    const totalOutstanding = await this.getTotalOutstanding(account);
    return {
      ...account,
      totalOutstanding,
      dueDate: this.buildDueDate(account),
    };
  }

  async updateSettingsAdmin(dto: UpdateHouseDueSettingsDto, currentUser: User) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const row = await this.getOrCreateHouseDue(
      {
        subSectorId: dto.subSectorId,
        houseNo: dto.houseNo,
        streetNo: dto.streetNo,
      },
      currentUser,
    );
    if (dto.graceDays !== undefined) row.graceDays = dto.graceDays;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.noticeMessage !== undefined) row.noticeMessage = normalizeStr(dto.noticeMessage) || null;
    row.updatedByAdminId = currentUser.id;
    await this.houseDueRepo.save(row);
    const evaluated = await this.evaluateHouseOutstanding({
      subSectorId: dto.subSectorId,
      houseNo: dto.houseNo,
      streetNo: dto.streetNo,
    });
    return { ...row, ...evaluated };
  }

  private async sendNoticeEmailToHouseResidents(
    row: HouseDue,
    context?: {
      entryType?: 'charge' | 'payment' | 'adjustment';
      entryCategory?: string | null;
      entryAmount?: number;
    },
  ): Promise<void> {
    const totalOutstanding = await this.getTotalOutstanding(row);
    const isPaymentEvent = context?.entryType === 'payment';
    if (!row.isActive || (totalOutstanding <= 0 && !isPaymentEvent)) return;
    const residents = await this.userRepo.find({
      where: {
        role: UserRole.USER,
        approvalStatus: ApprovalStatus.APPROVED,
        accountStatus: AccountStatus.ACTIVE,
        subSectorId: row.subSectorId,
        houseNo: row.houseNo,
        streetNo: row.streetNo,
      },
      select: ['id', 'email', 'fullName', 'pushToken'],
    });
    if (!residents.length) return;
    const subSector = await this.subSectorRepo.findOne({ where: { id: row.subSectorId } });
    const subSectorName = subSector
      ? normalizeStr(subSector.name).toLowerCase() === normalizeStr(subSector.code).toLowerCase()
        ? normalizeStr(subSector.name)
        : `${normalizeStr(subSector.name)} (${normalizeStr(subSector.code)})`
      : null;
    const dueDate = this.buildDueDate(row);
    const categoryBalances = await this.getCategoryBalances(row);
    await Promise.all(
      residents.map((resident) =>
        this.mailService.sendOutstandingPaymentNoticeEmail({
          to: resident.email,
          fullName: resident.fullName,
          subSector: subSectorName,
          subSectorId: row.subSectorId,
          houseNo: row.houseNo,
          streetNo: row.streetNo,
          totalOutstanding,
          dueDate,
          graceDays: row.graceDays,
          charges: categoryBalances,
          entryType: context?.entryType,
          entryCategory: context?.entryCategory,
          entryAmount: context?.entryAmount,
          message:
            normalizeStr(row.noticeMessage) ||
            buildDefaultNoticeMessage(row.graceDays ?? 30),
        }),
      ),
    );
    const pushTokens = residents
      .map((resident) => resident.pushToken)
      .filter((token): token is string => !!token && token.trim().length > 0);
    const eventType = context?.entryType ?? 'charge';
    const title = eventType === 'payment' ? 'Payment Received' : 'New Outstanding Charge';
    const body =
      eventType === 'payment'
        ? totalOutstanding <= 0
          ? 'Your payment has been recorded. Your outstanding balance is now fully cleared.'
          : `Your payment has been recorded. Remaining outstanding: PKR ${Math.round(totalOutstanding)}.`
        : `A new charge has been added. Total outstanding: PKR ${Math.round(totalOutstanding)}.`;
    await this.pushService.send({
      to: pushTokens,
      title,
      body,
      data: {
        eventType,
        targetScreen: 'outstanding-payment',
        entryCategory: context?.entryCategory ?? null,
        entryAmount: context?.entryAmount ?? null,
        entryCreatedAt: new Date().toISOString(),
        subSectorId: row.subSectorId,
        houseNo: row.houseNo,
        streetNo: row.streetNo,
        totalOutstanding,
      },
    });
  }

  async getByHouseAdmin(
    house: { subSectorId: number; houseNo: string; streetNo: string },
    currentUser: User,
  ) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const data = await this.houseDueRepo.findOne({
      where: {
        subSectorId: house.subSectorId,
        houseNo: normalizeStr(house.houseNo),
        streetNo: normalizeStr(house.streetNo),
      },
    });
    if (!data) return null;
    const evaluated = await this.evaluateHouseOutstanding(house);
    return { ...data, ...evaluated };
  }

  async ledgerAdmin(
    house: { subSectorId: number; houseNo: string; streetNo: string },
    currentUser: User,
  ) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const account = await this.houseDueRepo.findOne({
      where: {
        subSectorId: house.subSectorId,
        houseNo: normalizeStr(house.houseNo),
        streetNo: normalizeStr(house.streetNo),
      },
    });
    if (!account) return { account: null, entries: [], runningOutstanding: 0 };
    const entries = await this.houseDueEntryRepo.find({
      where: { houseDueId: account.id },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    let running = 0;
    const enriched = entries.map((e) => {
      running = toMoney(running + Number(e.signedAmount || 0));
      return { ...e, runningOutstanding: running };
    });
    return { account, entries: enriched, runningOutstanding: running };
  }

  async listAdmin(query: ListHouseDuesQueryDto, currentUser: User) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const qb = this.houseDueRepo.createQueryBuilder('d').orderBy('d.updatedAt', 'DESC');
    if (query.subSectorId != null) qb.andWhere('d.sub_sector_id = :subSectorId', { subSectorId: query.subSectorId });
    if (normalizeStr(query.houseNo)) qb.andWhere('d.house_no = :houseNo', { houseNo: normalizeStr(query.houseNo) });
    if (normalizeStr(query.streetNo)) qb.andWhere('d.street_no = :streetNo', { streetNo: normalizeStr(query.streetNo) });
    const rows = await qb.getMany();
    const settings = await this.appSettingsService.getPaymentBlockingSettings();
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        totalOutstanding: await this.getTotalOutstanding(r),
        dueDate: this.buildDueDate(r),
        blockingMode: settings.blockingMode,
      })),
    );
  }

  async listCategoriesAdmin(currentUser: User, includeInactive = false) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const where = includeInactive ? {} : { isActive: true };
    return this.houseDueCategoryRepo.find({ where, order: { name: 'ASC' } });
  }

  async createCategoryAdmin(dto: CreateHouseDueCategoryDto, currentUser: User) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const name = normalizeStr(dto.name);
    const usage = dto.usage ?? 'both';
    const existing = await this.houseDueCategoryRepo.findOne({ where: { name } });
    if (existing) {
      existing.usage = usage;
      existing.isActive = true;
      return this.houseDueCategoryRepo.save(existing);
    }
    return this.houseDueCategoryRepo.save(
      this.houseDueCategoryRepo.create({
        name,
        usage,
        isActive: true,
        createdByAdminId: currentUser.id,
      }),
    );
  }

  async updateCategoryAdmin(id: number, dto: UpdateHouseDueCategoryDto, currentUser: User) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const existing = await this.houseDueCategoryRepo.findOne({ where: { id } });
    if (!existing) throw new ForbiddenException('Category not found');
    if (dto.name !== undefined) existing.name = normalizeStr(dto.name);
    if (dto.usage !== undefined) existing.usage = dto.usage;
    if (dto.isActive !== undefined) existing.isActive = dto.isActive;
    return this.houseDueCategoryRepo.save(existing);
  }

  private normalizeEntryType(value: unknown): BulkEntryType {
    const v = String(value ?? '').trim().toLowerCase();
    if (v === 'charge' || v === 'payment' || v === 'adjustment') return v;
    throw new Error(`entryType "${String(value ?? '')}" must be charge, payment, or adjustment`);
  }

  private normalizeAdjustmentDirection(value: unknown): 'debit' | 'credit' | undefined {
    const v = String(value ?? '').trim().toLowerCase();
    if (!v) return undefined;
    if (v === 'debit' || v === 'credit') return v;
    throw new Error(`adjustmentDirection "${String(value ?? '')}" must be debit or credit`);
  }

  async bulkUploadAdmin(
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
    options: BulkUploadOptions,
    currentUser: User,
  ): Promise<BulkUploadJobResult> {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    if (!file?.buffer?.length) throw new BadRequestException('Excel file is required.');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('Excel file has no sheet.');
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Array<Record<string, unknown>>;
    if (!rawRows.length) throw new BadRequestException('Excel file has no data rows.');

    const categories = await this.houseDueCategoryRepo.find({ where: { isActive: true } });
    const categoryById = new Map<number, HouseDueCategory>(categories.map((c) => [c.id, c]));

    const importId = randomUUID();
    const dryRun = options.dryRun === true;
    const stopOnError = options.stopOnError === true;
    const results: BulkRowResult[] = [];
    const houseOutstandingDelta = new Map<string, number>();
    const startingOutstanding = new Map<string, number>();
    const parsedRows: Array<{
      rowNumber: number;
      subSectorId: number;
      houseNo: string;
      streetNo: string;
      entryType: BulkEntryType;
      adjustmentDirection?: 'debit' | 'credit';
      categoryName: string;
      amount: number;
      graceDays?: number;
      reference?: string;
      note?: string;
    }> = [];

    for (let i = 0; i < rawRows.length; i += 1) {
      const rowNumber = i + 2;
      try {
        const raw = rawRows[i];
        const subSectorId = Number(raw.subSectorId);
        const houseNo = normalizeStr(raw.houseNo as string);
        const streetNo = normalizeStr(raw.streetNo as string);
        const entryType = this.normalizeEntryType(raw.entryType);
        const adjustmentDirection = this.normalizeAdjustmentDirection(raw.adjustmentDirection);
        const categoryId = Number(raw.categoryId);
        const amount = toMoney(Number(raw.amount));
        const graceRaw = String(raw.graceDays ?? '').trim();
        const graceDays = graceRaw ? Number(raw.graceDays) : undefined;
        const reference = normalizeStr(raw.reference as string) || undefined;
        const note = normalizeStr(raw.note as string) || undefined;

        if (!Number.isInteger(subSectorId) || subSectorId < 1) throw new Error('subSectorId must be a positive integer');
        if (!houseNo) throw new Error('houseNo is required');
        if (!streetNo) throw new Error('streetNo is required');
        if (!Number.isInteger(categoryId) || categoryId < 1) throw new Error('categoryId must be a positive integer');
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('amount must be greater than 0');
        if (graceDays !== undefined && (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 365)) {
          throw new Error('graceDays must be an integer between 0 and 365');
        }
        if (entryType === 'adjustment' && !adjustmentDirection) {
          throw new Error('adjustmentDirection is required for adjustment rows');
        }

        const category = categoryById.get(categoryId);
        if (!category) throw new Error(`categoryId ${categoryId} not found or inactive`);
        const usageOk =
          category.usage === 'both' ||
          (entryType === 'charge' && category.usage === 'charge') ||
          ((entryType === 'payment' || entryType === 'adjustment') && category.usage === 'payment');
        if (!usageOk) throw new Error(`category usage does not match entryType "${entryType}"`);

        const houseKey = `${subSectorId}|${houseNo}|${streetNo}`;
        if (!startingOutstanding.has(houseKey)) {
          const existing = await this.houseDueRepo.findOne({ where: { subSectorId, houseNo, streetNo } });
          startingOutstanding.set(houseKey, existing ? await this.getTotalOutstanding(existing) : 0);
        }
        const simulated = toMoney((startingOutstanding.get(houseKey) ?? 0) + (houseOutstandingDelta.get(houseKey) ?? 0));
        const signedAmount =
          entryType === 'charge' ? amount : entryType === 'payment' ? -amount : adjustmentDirection === 'credit' ? -amount : amount;
        if (entryType === 'payment' && amount > simulated) {
          throw new Error(`payment amount (${amount.toFixed(2)}) cannot exceed outstanding (${Math.round(simulated)})`);
        }
        houseOutstandingDelta.set(houseKey, toMoney((houseOutstandingDelta.get(houseKey) ?? 0) + signedAmount));

        parsedRows.push({
          rowNumber,
          subSectorId,
          houseNo,
          streetNo,
          entryType,
          adjustmentDirection,
          categoryName: category.name,
          amount,
          graceDays,
          reference,
          note,
        });
        results.push({ rowNumber, status: 'ok', message: dryRun ? 'Validated' : 'Validated for upload' });
      } catch (e) {
        results.push({ rowNumber, status: 'error', message: (e as Error).message });
        if (stopOnError) break;
      }
    }

    const hasValidationErrors = results.some((r) => r.status === 'error');
    if (!dryRun && !hasValidationErrors) {
      for (let i = 0; i < parsedRows.length; i += 1) {
        const row = parsedRows[i];
        try {
          await this.addEntryAdmin(
            {
              subSectorId: row.subSectorId,
              houseNo: row.houseNo,
              streetNo: row.streetNo,
              entryType: row.entryType,
              adjustmentDirection: row.adjustmentDirection,
              category: row.categoryName,
              amount: row.amount,
              graceDays: row.graceDays,
              reference: row.reference,
              note: row.note,
            },
            currentUser,
          );
          const idx = results.findIndex((r) => r.rowNumber === row.rowNumber);
          if (idx >= 0) results[idx] = { rowNumber: row.rowNumber, status: 'ok', message: 'Imported successfully' };
        } catch (e) {
          const idx = results.findIndex((r) => r.rowNumber === row.rowNumber);
          const msg = (e as Error).message || 'Import failed';
          if (idx >= 0) results[idx] = { rowNumber: row.rowNumber, status: 'error', message: msg };
          if (stopOnError) break;
        }
      }
    }

    const job: BulkUploadJobResult = {
      importId,
      createdAt: new Date().toISOString(),
      dryRun,
      stopOnError,
      totalRows: rawRows.length,
      successCount: results.filter((r) => r.status === 'ok').length,
      failCount: results.filter((r) => r.status === 'error').length,
      results,
    };
    this.importJobs.set(importId, job);
    return job;
  }

  getBulkImportJobAdmin(importId: string, currentUser: User) {
    if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const job = this.importJobs.get(importId);
    if (!job) throw new BadRequestException('Import job not found');
    return job;
  }
}
