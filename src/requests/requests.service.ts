import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, SelectQueryBuilder } from 'typeorm';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { Request as RequestEntity, RequestStatus } from './entities/request.entity';
import { RequestTypeEntity } from '../request-types/entities/request-type.entity';
import { RequestTypeOptionEntity } from '../request-type-options/entities/request-type-option.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { SubSector } from '../users/entities/sub-sector.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { UpdateRequestDto } from './dto/update-request.dto';
import { FindRequestsQueryDto } from './dto/find-requests-query.dto';

/**
 * IANA timezone for admin time inputs (e.g. Pakistan).
 * Uses the system/ICU timezone database so any future DST or offset changes are applied automatically.
 * Override with env ADMIN_INPUT_TIMEZONE if needed (e.g. "Asia/Karachi").
 */
const ADMIN_INPUT_TIMEZONE_DEFAULT = 'Asia/Karachi';
function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function resolveAdminInputTimeZone(raw?: string): string {
  const configured = raw?.trim();
  if (!configured) return ADMIN_INPUT_TIMEZONE_DEFAULT;

  if (isValidIanaTimeZone(configured)) return configured;

  console.warn(
    `[RequestsService] Invalid ADMIN_INPUT_TIMEZONE="${configured}". Using "${ADMIN_INPUT_TIMEZONE_DEFAULT}" instead.`,
  );
  return ADMIN_INPUT_TIMEZONE_DEFAULT;
}

const ADMIN_INPUT_TIMEZONE = resolveAdminInputTimeZone(process.env.ADMIN_INPUT_TIMEZONE);
const REQUEST_IMAGE_DIR = 'request-images';
const MAX_REQUEST_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_REQUEST_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function getPartsInZone(date: Date, timeZone: string): Record<string, number> {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== 'literal') parts[p.type] = parseInt(p.value, 10);
  }
  return parts;
}

/** Current calendar date (y, m, d) in the admin input timezone. */
function getTodayInAdminTz(now: Date): { y: number; m: number; d: number } {
  const p = getPartsInZone(now, ADMIN_INPUT_TIMEZONE);
  return {
    y: p.year,
    m: p.month - 1, // 0-indexed for Date
    d: p.day,
  };
}

/** Day of week in admin timezone (0=Sun, 1=Mon, ..., 6=Sat). */
function getDayOfWeekInAdminTz(now: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ADMIN_INPUT_TIMEZONE,
    weekday: 'short',
  }).format(now);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? 0;
}

/**
 * Convert a local time (y, m, d, hour, minute) in the given IANA timezone to UTC timestamp.
 * Uses the system timezone database so DST/offset changes (e.g. if Pakistan changes) are applied automatically.
 */
function localTimeInZoneToUtc(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  // Search window: full calendar day in zone can span ~2 UTC days for any offset
  const low = Date.UTC(y, m, d - 1, 0, 0, 0, 0);
  const high = Date.UTC(y, m, d + 2, 0, 0, 0, 0);
  let lo = low;
  let hi = high;
  const targetMins = hour * 60 + minute;
  for (let i = 0; i < 25; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = getPartsInZone(new Date(mid), timeZone);
    const py = parts.year ?? y;
    const pm = (parts.month ?? m + 1) - 1;
    const pd = parts.day ?? d;
    const sameDay = py === y && pm === m && pd === d;
    const currentMins = (parts.hour ?? 0) * 60 + (parts.minute ?? 0);
    if (!sameDay || currentMins < targetMins) lo = mid;
    else hi = mid;
  }
  return Math.floor((lo + hi) / 2);
}

/**
 * Adds a calendar-based period condition using UTC so the limit is universal (not server timezone).
 */
function addCalendarPeriodCondition(
  qb: SelectQueryBuilder<RequestEntity>,
  period: string,
  utcNow: Date,
): void {
  const utcDateStr = utcNow.toISOString().slice(0, 10);
  const utcYear = utcNow.getUTCFullYear();
  const utcMonth = utcNow.getUTCMonth() + 1;
  const getISOWeek = (d: Date) => {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const isoYear = t.getUTCFullYear();
    return { isoYear, isoWeek };
  };
  const { isoYear, isoWeek } = getISOWeek(utcNow);

  switch (period) {
    case 'day':
      qb.andWhere('DATE(CONVERT_TZ(r.createdAt, @@session.time_zone, "+00:00")) = :utcDate', {
        utcDate: utcDateStr,
      });
      break;
    case 'week': {
      const yearWeek = isoYear * 100 + isoWeek;
      qb.andWhere(
        'YEARWEEK(CONVERT_TZ(r.createdAt, @@session.time_zone, "+00:00"), 1) = :yearWeek',
        { yearWeek },
      );
      break;
    }
    case 'month':
      qb.andWhere(
        'YEAR(CONVERT_TZ(r.createdAt, @@session.time_zone, "+00:00")) = :utcYear AND MONTH(CONVERT_TZ(r.createdAt, @@session.time_zone, "+00:00")) = :utcMonth',
        { utcYear, utcMonth },
      );
      break;
    default:
      break;
  }
}

function parseHHmm(s: string): { h: number; m: number } {
  const [h, m] = s.trim().split(':').map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

type ReportsPeriod = 'today' | 'week' | 'month' | 'custom';
const TANKER_OPTION_SLUG = 'order_water_tanker';

function deriveOptionRequestNumberPrefix(
  option: Pick<RequestTypeOptionEntity, 'label' | 'requestNumberPrefix'>,
): string {
  const configured = option.requestNumberPrefix?.trim();
  if (configured) return configured.toUpperCase();
  const seed = (option.label || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return seed.slice(0, 6) || 'SRV';
}

function formatRequestNumber(prefix: string, num: number, padding: number): string {
  return `${prefix}#${String(num).padStart(padding, '0')}`;
}

/**
 * Check if current time (UTC) is within the request type restriction.
 * Start/end and allowed days use the admin timezone (e.g. Asia/Karachi); no hardcoded offset.
 */
function assertWithinRestriction(
  type: RequestTypeEntity,
  typeName: string,
): void {
  const start = type.restrictionStartTime?.trim();
  const end = type.restrictionEndTime?.trim();
  const days = type.restrictionDays?.trim();
  if (!start || !end || !days) return;

  const now = new Date();
  const currentDay = getDayOfWeekInAdminTz(now);
  const allowedDays = days.split(',').map((d) => parseInt(d.trim(), 10));
  if (!allowedDays.includes(currentDay)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const allowedNames = allowedDays.map((d) => dayNames[d] ?? d).join(', ');
    throw new ForbiddenException(
      `${typeName} request window: allowed only on ${allowedNames}.`,
    );
  }

  const { y, m, d } = getTodayInAdminTz(now);
  const startPkt = parseHHmm(start);
  const endPkt = parseHHmm(end);
  const startUtc = localTimeInZoneToUtc(y, m, d, startPkt.h, startPkt.m, ADMIN_INPUT_TIMEZONE);
  const endUtc = localTimeInZoneToUtc(y, m, d, endPkt.h, endPkt.m, ADMIN_INPUT_TIMEZONE);
  const nowUtc = now.getTime();

  if (nowUtc < startUtc || nowUtc > endUtc) {
    throw new ForbiddenException(
      `${typeName} request window: allowed only between ${start} and ${end}.`,
    );
  }
}

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(RequestEntity)
    private readonly requestRepo: Repository<RequestEntity>,
    @InjectRepository(RequestTypeEntity)
    private readonly requestTypeRepo: Repository<RequestTypeEntity>,
    @InjectRepository(RequestTypeOptionEntity)
    private readonly requestTypeOptionRepo: Repository<RequestTypeOptionEntity>,
    @InjectRepository(SubSector)
    private readonly subSectorRepo: Repository<SubSector>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private resolveReportsDateRange(
    periodRaw?: string,
    fromRaw?: string,
    toRaw?: string,
  ): { period: ReportsPeriod; start: Date; endExclusive: Date; from: string; to: string } {
    const period = (periodRaw ?? 'month').toLowerCase() as ReportsPeriod;
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    const endExclusive = new Date(start);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);

    const isValidDateString = (value?: string): value is string =>
      typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parseDateString = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
    const toDateOnly = (value: Date): string => value.toISOString().slice(0, 10);

    if (period === 'today') {
      return {
        period,
        start,
        endExclusive,
        from: toDateOnly(start),
        to: toDateOnly(start),
      };
    }

    if (period === 'week') {
      const day = start.getUTCDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      start.setUTCDate(start.getUTCDate() - diffToMonday);
      endExclusive.setTime(start.getTime());
      endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
      return {
        period,
        start,
        endExclusive,
        from: toDateOnly(start),
        to: toDateOnly(new Date(endExclusive.getTime() - 86400000)),
      };
    }

    if (period === 'custom' && isValidDateString(fromRaw) && isValidDateString(toRaw)) {
      const customFrom = parseDateString(fromRaw);
      const customTo = parseDateString(toRaw);
      const rangeStart = customFrom <= customTo ? customFrom : customTo;
      const rangeEnd = customFrom <= customTo ? customTo : customFrom;
      const customEndExclusive = new Date(rangeEnd);
      customEndExclusive.setUTCDate(customEndExclusive.getUTCDate() + 1);
      return {
        period,
        start: rangeStart,
        endExclusive: customEndExclusive,
        from: toDateOnly(rangeStart),
        to: toDateOnly(rangeEnd),
      };
    }

    // Default month range (or invalid custom input fallback).
    start.setUTCDate(1);
    endExclusive.setUTCFullYear(start.getUTCFullYear());
    endExclusive.setUTCMonth(start.getUTCMonth() + 1, 1);
    endExclusive.setUTCHours(0, 0, 0, 0);
    return {
      period: 'month',
      start,
      endExclusive,
      from: toDateOnly(start),
      to: toDateOnly(new Date(endExclusive.getTime() - 86400000)),
    };
  }

  private saveRequestImage(file: { buffer: Buffer; originalname: string; mimetype: string }): string {
    if (file.buffer.length > MAX_REQUEST_IMAGE_SIZE) {
      throw new ConflictException('Issue image too large (max 5MB)');
    }
    if (!ALLOWED_REQUEST_IMAGE_MIMES.includes(file.mimetype)) {
      throw new ConflictException('Issue image must be PNG, JPEG, WebP, or GIF');
    }
    const dir = join(process.cwd(), REQUEST_IMAGE_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const ext = file.originalname.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext) ? ext : 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
    writeFileSync(join(dir, filename), file.buffer);
    return `/${REQUEST_IMAGE_DIR}/${filename}`;
  }

  async create(
    createRequestDto: CreateRequestDto,
    user: User,
    issueImage?: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<RequestEntity> {
    const now = new Date();
    const timeUtc = now.toISOString();
    const timeAdminTz = new Intl.DateTimeFormat('en-CA', {
      timeZone: ADMIN_INPUT_TIMEZONE,
      dateStyle: 'short',
      timeStyle: 'medium',
      hour12: false,
    }).format(now);

    const requestType = await this.requestTypeRepo.findOne({
      where: { id: createRequestDto.requestTypeId },
    });
    if (!requestType)
      throw new ForbiddenException('Invalid request type');

    this.logger.log(
      `[Request create] attempt userId=${user.id} requestTypeId=${createRequestDto.requestTypeId} requestTypeName="${requestType.name}" ` +
        `timeUtc=${timeUtc} timeAdminTz=${timeAdminTz} (${ADMIN_INPUT_TIMEZONE})`,
    );

    const start = requestType.restrictionStartTime?.trim();
    const end = requestType.restrictionEndTime?.trim();
    const days = requestType.restrictionDays?.trim();
    if (start && end && days) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const allowedDayNames = days.split(',').map((d) => dayNames[parseInt(d.trim(), 10)] ?? d.trim()).join(', ');
      this.logger.log(
        `[Request create] allowed window for "${requestType.name}": ${start}-${end} (${ADMIN_INPUT_TIMEZONE}) days=[${allowedDayNames}]`,
      );
    } else {
      this.logger.log(`[Request create] no time restriction for "${requestType.name}"`);
    }

    try {
      assertWithinRestriction(requestType, requestType.name);
    } catch (e) {
      this.logger.warn(
        `[Request create] REJECTED userId=${user.id} requestTypeName="${requestType.name}" timeUtc=${timeUtc} timeAdminTz=${timeAdminTz} reason=${e instanceof Error ? e.message : String(e)}`,
      );
      throw e;
    }

    const subSector = await this.subSectorRepo.findOne({
      where: { id: createRequestDto.subSectorId },
    });
    if (!subSector)
      throw new ConflictException('Invalid sub sector');

    let issueImageRequirement: 'none' | 'optional' | 'required' = 'none';
    const selectedOption = await this.requestTypeOptionRepo.findOne({
      where: {
        id: createRequestDto.requestTypeOptionId,
        requestTypeId: createRequestDto.requestTypeId,
      },
    });
    if (!selectedOption) {
      throw new ConflictException('Invalid service option selected');
    }
    if (selectedOption.optionType === 'form') {
      const cfgRequirement = selectedOption.config?.issueImage;
      issueImageRequirement =
        cfgRequirement === 'none' || cfgRequirement === 'optional' || cfgRequirement === 'required'
          ? cfgRequirement
          : 'optional';
    }
    if (issueImageRequirement === 'required' && !issueImage) {
      throw new ConflictException('Please upload an issue image for this service');
    }
    const issueImageUrl = issueImage ? this.saveRequestImage(issueImage) : null;

    const period = (requestType.duplicateRestrictionPeriod ?? 'none').toLowerCase();
    if (period && period !== 'none') {
      const qb = this.requestRepo
        .createQueryBuilder('r')
        .where('r.request_type_id = :requestTypeId', { requestTypeId: createRequestDto.requestTypeId })
        .andWhere('r.house_no = :houseNo', { houseNo: createRequestDto.houseNo.trim() })
        .andWhere('r.street_no = :streetNo', { streetNo: createRequestDto.streetNo.trim() })
        .andWhere('r.sub_sector_id = :subSectorId', { subSectorId: createRequestDto.subSectorId });
      qb.andWhere('r.request_type_option_id = :requestTypeOptionId', {
        requestTypeOptionId: createRequestDto.requestTypeOptionId,
      });
      addCalendarPeriodCondition(qb, period, new Date());
      const count = await qb.getCount();
      if (count > 0) {
        const periodLabel = period === 'day' ? 'calendar day' : period === 'week' ? 'calendar week' : 'calendar month';
        const scopeName = selectedOption?.label?.trim() || requestType.name;
        this.logger.warn(
          `[Request create] REJECTED duplicate userId=${user.id} scope="${scopeName}" period=${periodLabel}`,
        );
        throw new ForbiddenException(
          `Only one ${scopeName} request per ${periodLabel} is allowed for the same house, street and sector. There is already a request for this address in this ${periodLabel}.`,
        );
      }
    }

    const description = (createRequestDto.description ?? '').trim();
    const saved = await this.requestRepo.manager.transaction(async (manager) => {
      const requestTypeRepo = manager.getRepository(RequestTypeEntity);
      const requestTypeOptionRepo = manager.getRepository(RequestTypeOptionEntity);
      const requestRepo = manager.getRepository(RequestEntity);
      const lockedType = await requestTypeRepo.findOne({
        where: { id: createRequestDto.requestTypeId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedType) {
        throw new ForbiddenException('Invalid request type');
      }
      const lockedOption = await requestTypeOptionRepo.findOne({
        where: {
          id: createRequestDto.requestTypeOptionId,
          requestTypeId: createRequestDto.requestTypeId,
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedOption) {
        throw new ForbiddenException('Invalid service option selected');
      }
      const prefix = deriveOptionRequestNumberPrefix(lockedOption);
      const rawPadding = lockedOption.requestNumberPadding ?? 4;
      const padding = Math.max(1, Math.min(12, rawPadding));
      let seq = lockedOption.requestNumberNext ?? 1;
      if (seq < 1) seq = 1;

      let requestNumber = formatRequestNumber(prefix, seq, padding);
      // Defensive uniqueness handling in case of legacy/manual data edits.
      while (await requestRepo.exist({ where: { requestNumber } })) {
        seq += 1;
        requestNumber = formatRequestNumber(prefix, seq, padding);
      }

      lockedOption.requestNumberNext = seq + 1;
      await requestTypeOptionRepo.save(lockedOption);

      const request = requestRepo.create({
        requestTypeId: createRequestDto.requestTypeId,
        requestTypeOptionId: createRequestDto.requestTypeOptionId,
        requestNumber,
        description: description || '',
        issueImageUrl,
        houseNo: createRequestDto.houseNo.trim(),
        streetNo: createRequestDto.streetNo.trim(),
        subSectorId: createRequestDto.subSectorId,
        userId: user.id,
        status: RequestStatus.PENDING,
      });
      return requestRepo.save(request);
    });
    this.logger.log(
      `[Request create] SUCCESS requestId=${saved.id} userId=${user.id} requestTypeName="${requestType.name}" timeUtc=${timeUtc}`,
    );
    return saved;
  }

  async findMy(userId: number): Promise<RequestEntity[]> {
    return this.requestRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['user', 'requestType', 'requestTypeOption'],
    });
  }

  async findAll(
    user: User,
    query: FindRequestsQueryDto = {},
  ): Promise<{ data: RequestEntity[]; total: number }> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const qb = this.requestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'user')
      .leftJoinAndSelect('r.requestType', 'requestType')
      .leftJoinAndSelect('r.requestTypeOption', 'requestTypeOption')
      .orderBy('r.createdAt', 'DESC');
    if (query.requestTypeId != null) {
      qb.andWhere('r.request_type_id = :requestTypeId', { requestTypeId: query.requestTypeId });
    }
    if (query.requestTypeOptionId != null) {
      qb.andWhere('r.request_type_option_id = :requestTypeOptionId', {
        requestTypeOptionId: query.requestTypeOptionId,
      });
    }
    if (query.status) {
      if (query.status === RequestStatus.COMPLETED) {
        qb.andWhere('r.status IN (:...statuses)', {
          statuses: [RequestStatus.COMPLETED, RequestStatus.DONE],
        });
      } else {
        qb.andWhere('r.status = :status', { status: query.status });
      }
    }
    if (query.dateFrom) {
      qb.andWhere('DATE(r.createdAt) >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('DATE(r.createdAt) <= :dateTo', { dateTo: query.dateTo });
    }
    const total = await qb.getCount();
    const start = query._start ?? 0;
    const end = query._end;
    if (end != null && end > start) {
      qb.skip(start).take(end - start);
    }
    const data = await qb.getMany();
    return { data, total };
  }

  async findOne(id: number, user: User): Promise<RequestEntity> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['user', 'requestType', 'requestTypeOption'],
    });
    if (!request) throw new NotFoundException('Request not found');
    if (user.role !== UserRole.ADMIN && request.userId !== user.id)
      throw new ForbiddenException('Cannot view this request');
    return request;
  }

  async updateStatus(
    id: number,
    dto: UpdateRequestStatusDto,
    currentUser: User,
  ): Promise<RequestEntity> {
    if (currentUser.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    request.status = dto.status;
    return this.requestRepo.save(request);
  }

  async update(
    id: number,
    dto: UpdateRequestDto,
    currentUser: User,
  ): Promise<RequestEntity> {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (dto.requestTypeId != null) {
      const requestType = await this.requestTypeRepo.findOne({
        where: { id: dto.requestTypeId },
      });
      if (!requestType) {
        throw new ConflictException('Invalid request type');
      }
      request.requestTypeId = dto.requestTypeId;
    }

    if (dto.requestTypeOptionId !== undefined) {
      if (dto.requestTypeOptionId == null) {
        request.requestTypeOptionId = null;
      } else {
        const option = await this.requestTypeOptionRepo.findOne({
          where: { id: dto.requestTypeOptionId, requestTypeId: request.requestTypeId },
        });
        if (!option) {
          throw new ConflictException('Invalid service option');
        }
        request.requestTypeOptionId = dto.requestTypeOptionId;
      }
    }

    if (dto.subSectorId != null) {
      const subSector = await this.subSectorRepo.findOne({
        where: { id: dto.subSectorId },
      });
      if (!subSector) {
        throw new ConflictException('Invalid sub sector');
      }
      request.subSectorId = dto.subSectorId;
    }

    if (dto.houseNo != null) {
      request.houseNo = dto.houseNo.trim();
    }
    if (dto.streetNo != null) {
      request.streetNo = dto.streetNo.trim();
    }
    if (dto.description != null) {
      request.description = dto.description.trim();
    }
    if (dto.status != null) {
      request.status = dto.status;
    }

    return this.requestRepo.save(request);
  }

  async remove(id: number, user: User): Promise<void> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Request not found');
    if (user.role !== UserRole.ADMIN && request.userId !== user.id)
      throw new ForbiddenException('Cannot delete this request');
    await this.requestRepo.delete(id);
  }

  /** Admin: request counts (total and by type) */
  async getStats(user: User): Promise<{ total: number; byType: { requestTypeId: number; name: string; slug: string; count: number }[] }> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    const all = await this.requestRepo.find({
      relations: ['requestType'],
    });
    const total = all.length;
    const byTypeMap = new Map<number, { name: string; slug: string; count: number }>();
    for (const req of all) {
      const typeId = req.requestTypeId;
      const type = req.requestType;
      const name = type?.name ?? 'Unknown';
      const slug = type?.slug ?? '';
      if (!byTypeMap.has(typeId)) {
        byTypeMap.set(typeId, { name, slug, count: 0 });
      }
      byTypeMap.get(typeId)!.count += 1;
    }
    const byType = Array.from(byTypeMap.entries()).map(([requestTypeId, v]) => ({
      requestTypeId,
      name: v.name,
      slug: v.slug,
      count: v.count,
    }));
    return { total, byType };
  }

  /** Admin: request counts grouped by UTC day for dashboard charting. */
  async getDailyStats(
    user: User,
    days = 14,
  ): Promise<{ date: string; count: number }[]> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    const normalizedDays = Number.isFinite(days)
      ? Math.max(1, Math.min(60, Math.floor(days)))
      : 14;
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);
    startDate.setUTCDate(startDate.getUTCDate() - (normalizedDays - 1));

    const rows = await this.requestRepo.find({
      select: ['createdAt'],
      where: {
        createdAt: MoreThanOrEqual(startDate),
      },
      order: { createdAt: 'ASC' },
    });

    const countsByDate = new Map<string, number>();
    for (let i = 0; i < normalizedDays; i += 1) {
      const d = new Date(startDate);
      d.setUTCDate(startDate.getUTCDate() + i);
      countsByDate.set(d.toISOString().slice(0, 10), 0);
    }

    for (const row of rows) {
      const key = row.createdAt.toISOString().slice(0, 10);
      if (countsByDate.has(key)) {
        countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
      }
    }

    return Array.from(countsByDate.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  async getDashboardReports(
    user: User,
    periodRaw?: string,
    fromRaw?: string,
    toRaw?: string,
  ): Promise<{
    filter: { period: ReportsPeriod; from: string; to: string };
    usersBySubSectorHouse: Array<{
      subSectorId: number;
      subSectorName: string;
      houseNo: string;
      streetNo: string;
      userName: string;
      cnicNo: string | null;
      mobileNo: string;
      usersInHouse: number;
    }>;
    requestsPerHouseDateStatus: Array<{
      subSectorId: number;
      subSectorName: string;
      houseNo: string;
      streetNo: string;
      date: string;
      status: string;
      requestCount: number;
    }>;
    usersSummary: {
      totalUsers: number;
      bySubSector: Array<{ subSectorId: number; subSectorName: string; usersCount: number }>;
    };
    requestsSummary: {
      totalRequests: number;
      bySubSector: Array<{ subSectorId: number; subSectorName: string; requestsCount: number }>;
      byStatus: Array<{ status: string; requestsCount: number }>;
    };
    tankerSummary: {
      requested: number;
      delivered: number;
      pending: number;
      cancelled: number;
      bySubSector: Array<{
        subSectorId: number;
        subSectorName: string;
        requested: number;
        delivered: number;
        pending: number;
      }>;
      requests: Array<{
        requestId: number;
        requestNumber: string | null;
        createdAt: string;
        subSectorName: string;
        houseNo: string;
        streetNo: string;
        serviceOptionLabel: string;
        status: string;
        userName: string;
        mobileNo: string;
      }>;
    };
    insights: {
      completionRate: number;
      cancellationRate: number;
      backlogCount: number;
      avgResolutionHours: number;
      requestsGrowthPercent: number;
      usersGrowthPercent: number;
      topSubSectorByRequests: { subSectorId: number; subSectorName: string; requestsCount: number } | null;
      topSubSectorByUsers: { subSectorId: number; subSectorName: string; usersCount: number } | null;
    };
    analytics: {
      dailyTrend: Array<{ date: string; total: number; completed: number; pending: number }>;
      topRequestTypes: Array<{ requestTypeName: string; requestTypeSlug: string; requestsCount: number }>;
      topServiceOptions: Array<{ serviceOptionLabel: string; requestsCount: number }>;
      topHouses: Array<{
        subSectorName: string;
        houseNo: string;
        streetNo: string;
        totalRequests: number;
        pendingRequests: number;
      }>;
      subSectorPerformance: Array<{
        subSectorId: number;
        subSectorName: string;
        usersCount: number;
        requestsCount: number;
        completedCount: number;
        completionRate: number;
      }>;
      statusMixBySubSector: Array<{
        subSectorId: number;
        subSectorName: string;
        totalRequests: number;
        pendingCount: number;
        inProgressCount: number;
        completedCount: number;
        cancelledCount: number;
        completionRate: number;
      }>;
      agingBuckets: Array<{ bucket: string; count: number }>;
      repeatDemandHouses: Array<{
        subSectorName: string;
        houseNo: string;
        streetNo: string;
        totalRequests: number;
      }>;
      hourlyDemand: Array<{ hour: number; count: number }>;
    };
  }> {
    if (user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Admin only');
    }

    const range = this.resolveReportsDateRange(periodRaw, fromRaw, toRaw);
    const dateParams = { start: range.start, endExclusive: range.endExclusive };
    const periodMs = range.endExclusive.getTime() - range.start.getTime();
    const previousRangeStart = new Date(range.start.getTime() - periodMs);
    const previousRangeEnd = new Date(range.endExclusive.getTime() - periodMs);

    const houseCountsRows = await this.userRepo
      .createQueryBuilder('u')
      .select('u.sub_sector_id', 'subSectorId')
      .addSelect('u.house_no', 'houseNo')
      .addSelect('COUNT(*)', 'usersInHouse')
      .where('u.createdAt >= :start AND u.createdAt < :endExclusive', dateParams)
      .groupBy('u.sub_sector_id')
      .addGroupBy('u.house_no')
      .getRawMany<{
        subSectorId: string;
        houseNo: string;
        usersInHouse: string;
      }>();
    const usersInHouseMap = new Map<string, number>();
    for (const row of houseCountsRows) {
      usersInHouseMap.set(
        `${row.subSectorId}::${row.houseNo}`,
        Number(row.usersInHouse) || 0,
      );
    }

    const usersBySubSectorHouseRaw = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.subSector', 'ss')
      .select('u.sub_sector_id', 'subSectorId')
      .addSelect('COALESCE(ss.name, "N/A")', 'subSectorName')
      .addSelect('u.house_no', 'houseNo')
      .addSelect('u.street_no', 'streetNo')
      .addSelect('u.full_name', 'userName')
      .addSelect('NULL', 'cnicNo')
      .addSelect('CONCAT(COALESCE(u.phone_country_code, ""), " ", COALESCE(u.phone_number, ""))', 'mobileNo')
      .where('u.createdAt >= :start AND u.createdAt < :endExclusive', dateParams)
      .orderBy('ss.name', 'ASC')
      .addOrderBy('u.house_no', 'ASC')
      .addOrderBy('u.full_name', 'ASC')
      .getRawMany<{
        subSectorId: string;
        subSectorName: string;
        houseNo: string;
        streetNo: string;
        userName: string;
        cnicNo: string | null;
        mobileNo: string;
      }>();
    const usersBySubSectorHouse = usersBySubSectorHouseRaw.map((row) => {
      const key = `${row.subSectorId}::${row.houseNo}`;
      return {
        subSectorId: Number(row.subSectorId) || 0,
        subSectorName: row.subSectorName,
        houseNo: row.houseNo,
        streetNo: (row.streetNo ?? '').trim(),
        userName: row.userName,
        cnicNo: row.cnicNo,
        mobileNo: (row.mobileNo ?? '').trim(),
        usersInHouse: usersInHouseMap.get(key) ?? 0,
      };
    });

    const requestsPerHouseDateStatusRaw = await this.requestRepo
      .createQueryBuilder('r')
      .leftJoin(SubSector, 'ss', 'ss.id = r.sub_sector_id')
      .leftJoin('r.requestTypeOption', 'rto')
      .select('r.sub_sector_id', 'subSectorId')
      .addSelect('COALESCE(ss.name, "N/A")', 'subSectorName')
      .addSelect('r.house_no', 'houseNo')
      .addSelect('r.street_no', 'streetNo')
      .addSelect('DATE(r.createdAt)', 'date')
      .addSelect('r.status', 'status')
      .addSelect('COUNT(*)', 'requestCount')
      .where('r.createdAt >= :start AND r.createdAt < :endExclusive', dateParams)
      .groupBy('r.sub_sector_id')
      .addGroupBy('ss.name')
      .addGroupBy('r.house_no')
      .addGroupBy('r.street_no')
      .addGroupBy('DATE(r.createdAt)')
      .addGroupBy('r.status')
      .orderBy('DATE(r.createdAt)', 'DESC')
      .addOrderBy('ss.name', 'ASC')
      .addOrderBy('r.house_no', 'ASC')
      .getRawMany<{
        subSectorId: string;
        subSectorName: string;
        houseNo: string;
        streetNo: string;
        date: string;
        status: string;
        requestCount: string;
      }>();
    const requestsPerHouseDateStatus = requestsPerHouseDateStatusRaw.map((row) => ({
      subSectorId: Number(row.subSectorId) || 0,
      subSectorName: row.subSectorName,
      houseNo: row.houseNo,
      streetNo: row.streetNo,
      date: row.date,
      status: row.status,
      requestCount: Number(row.requestCount) || 0,
    }));

    const usersSummaryBySubSectorRaw = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.subSector', 'ss')
      .select('u.sub_sector_id', 'subSectorId')
      .addSelect('COALESCE(ss.name, "N/A")', 'subSectorName')
      .addSelect('COUNT(*)', 'usersCount')
      .where('u.createdAt >= :start AND u.createdAt < :endExclusive', dateParams)
      .groupBy('u.sub_sector_id')
      .addGroupBy('ss.name')
      .orderBy('ss.name', 'ASC')
      .getRawMany<{ subSectorId: string; subSectorName: string; usersCount: string }>();
    const usersSummary = {
      totalUsers: usersSummaryBySubSectorRaw.reduce(
        (acc, row) => acc + (Number(row.usersCount) || 0),
        0,
      ),
      bySubSector: usersSummaryBySubSectorRaw.map((row) => ({
        subSectorId: Number(row.subSectorId) || 0,
        subSectorName: row.subSectorName,
        usersCount: Number(row.usersCount) || 0,
      })),
    };

    const requestsSummaryBySubSectorRaw = await this.requestRepo
      .createQueryBuilder('r')
      .leftJoin(SubSector, 'ss', 'ss.id = r.sub_sector_id')
      .leftJoin('r.requestTypeOption', 'rto')
      .select('r.sub_sector_id', 'subSectorId')
      .addSelect('COALESCE(ss.name, "N/A")', 'subSectorName')
      .addSelect('COUNT(*)', 'requestsCount')
      .where('r.createdAt >= :start AND r.createdAt < :endExclusive', dateParams)
      .groupBy('r.sub_sector_id')
      .addGroupBy('ss.name')
      .orderBy('ss.name', 'ASC')
      .getRawMany<{ subSectorId: string; subSectorName: string; requestsCount: string }>();
    const requestsSummaryByStatusRaw = await this.requestRepo
      .createQueryBuilder('r')
      .leftJoin('r.requestTypeOption', 'rto')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'requestsCount')
      .where('r.createdAt >= :start AND r.createdAt < :endExclusive', dateParams)
      .groupBy('r.status')
      .orderBy('r.status', 'ASC')
      .getRawMany<{ status: string; requestsCount: string }>();
    const requestsSummary = {
      totalRequests: requestsSummaryBySubSectorRaw.reduce(
        (acc, row) => acc + (Number(row.requestsCount) || 0),
        0,
      ),
      bySubSector: requestsSummaryBySubSectorRaw.map((row) => ({
        subSectorId: Number(row.subSectorId) || 0,
        subSectorName: row.subSectorName,
        requestsCount: Number(row.requestsCount) || 0,
      })),
      byStatus: requestsSummaryByStatusRaw.map((row) => ({
        status: row.status,
        requestsCount: Number(row.requestsCount) || 0,
      })),
    };

    const tankerBaseQb = this.requestRepo
      .createQueryBuilder('r')
      .leftJoin('r.requestType', 'rt')
      .leftJoin('r.requestTypeOption', 'rto')
      .where('r.createdAt >= :start AND r.createdAt < :endExclusive', dateParams)
      .andWhere('LOWER(COALESCE(rto.slug, "")) = :tankerOptionSlug', {
        tankerOptionSlug: TANKER_OPTION_SLUG,
      });
    const tankerCountsRaw = await tankerBaseQb
      .clone()
      .select('COUNT(*)', 'requested')
      .addSelect(
        'SUM(CASE WHEN r.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)',
        'delivered',
      )
      .addSelect('SUM(CASE WHEN r.status = :cancelled THEN 1 ELSE 0 END)', 'cancelled')
      .setParameters({
        deliveredStatuses: [RequestStatus.COMPLETED, RequestStatus.DONE],
        cancelled: RequestStatus.CANCELLED,
      })
      .getRawOne<{ requested: string; delivered: string; cancelled: string }>();
    const requested = Number(tankerCountsRaw?.requested ?? 0);
    const delivered = Number(tankerCountsRaw?.delivered ?? 0);
    const cancelled = Number(tankerCountsRaw?.cancelled ?? 0);

    const tankerBySubSectorRaw = await tankerBaseQb
      .clone()
      .leftJoin(SubSector, 'ss', 'ss.id = r.sub_sector_id')
      .select('r.sub_sector_id', 'subSectorId')
      .addSelect('COALESCE(ss.name, "N/A")', 'subSectorName')
      .addSelect('COUNT(*)', 'requested')
      .addSelect(
        'SUM(CASE WHEN r.status IN (:...deliveredStatuses) THEN 1 ELSE 0 END)',
        'delivered',
      )
      .groupBy('r.sub_sector_id')
      .addGroupBy('ss.name')
      .orderBy('ss.name', 'ASC')
      .setParameters({
        deliveredStatuses: [RequestStatus.COMPLETED, RequestStatus.DONE],
      })
      .getRawMany<{
        subSectorId: string;
        subSectorName: string;
        requested: string;
        delivered: string;
      }>();

    const tankerRequestsRaw = await tankerBaseQb
      .clone()
      .leftJoin(SubSector, 'ss', 'ss.id = r.sub_sector_id')
      .leftJoin(User, 'u', 'u.id = r.userId')
      .select('r.id', 'requestId')
      .addSelect('r.request_number', 'requestNumber')
      .addSelect('r.createdAt', 'createdAt')
      .addSelect('COALESCE(ss.name, "N/A")', 'subSectorName')
      .addSelect('r.house_no', 'houseNo')
      .addSelect('r.street_no', 'streetNo')
      .addSelect('COALESCE(rto.label, "Water Tanker")', 'serviceOptionLabel')
      .addSelect('r.status', 'status')
      .addSelect('COALESCE(u.full_name, "N/A")', 'userName')
      .addSelect('CONCAT(COALESCE(u.phone_country_code, ""), " ", COALESCE(u.phone_number, ""))', 'mobileNo')
      .orderBy('r.createdAt', 'DESC')
      .getRawMany<{
        requestId: string;
        requestNumber: string | null;
        createdAt: Date;
        subSectorName: string;
        houseNo: string;
        streetNo: string;
        serviceOptionLabel: string;
        status: string;
        userName: string;
        mobileNo: string;
      }>();

    const tankerSummary = {
      requested,
      delivered,
      pending: Math.max(0, requested - delivered - cancelled),
      cancelled,
      bySubSector: tankerBySubSectorRaw.map((row) => {
        const rowRequested = Number(row.requested) || 0;
        const rowDelivered = Number(row.delivered) || 0;
        return {
          subSectorId: Number(row.subSectorId) || 0,
          subSectorName: row.subSectorName,
          requested: rowRequested,
          delivered: rowDelivered,
          pending: Math.max(0, rowRequested - rowDelivered),
        };
      }),
      requests: tankerRequestsRaw.map((row) => ({
        requestId: Number(row.requestId) || 0,
        requestNumber: row.requestNumber,
        createdAt:
          row.createdAt instanceof Date
            ? row.createdAt.toISOString()
            : new Date(row.createdAt).toISOString(),
        subSectorName: row.subSectorName,
        houseNo: row.houseNo,
        streetNo: row.streetNo,
        serviceOptionLabel: row.serviceOptionLabel,
        status: row.status,
        userName: row.userName,
        mobileNo: (row.mobileNo ?? '').trim(),
      })),
    };

    const requestAnalyticsRows = await this.requestRepo
      .createQueryBuilder('r')
      .leftJoin('r.requestType', 'rt')
      .leftJoin('r.requestTypeOption', 'rto')
      .leftJoin(SubSector, 'ss', 'ss.id = r.sub_sector_id')
      .select('r.createdAt', 'createdAt')
      .addSelect('r.updatedAt', 'updatedAt')
      .addSelect('r.status', 'status')
      .addSelect('r.house_no', 'houseNo')
      .addSelect('r.street_no', 'streetNo')
      .addSelect('r.sub_sector_id', 'subSectorId')
      .addSelect('COALESCE(ss.name, "N/A")', 'subSectorName')
      .addSelect('COALESCE(rt.name, "Unknown")', 'requestTypeName')
      .addSelect('COALESCE(rt.slug, "")', 'requestTypeSlug')
      .addSelect('COALESCE(rto.label, "General")', 'serviceOptionLabel')
      .where('r.createdAt >= :start AND r.createdAt < :endExclusive', dateParams)
      .getRawMany<{
        createdAt: Date;
        updatedAt: Date;
        status: string;
        houseNo: string;
        streetNo: string;
        subSectorId: string;
        subSectorName: string;
        requestTypeName: string;
        requestTypeSlug: string;
        serviceOptionLabel: string;
      }>();

    const isCompletedStatus = (status: string): boolean =>
      status === RequestStatus.COMPLETED || status === RequestStatus.DONE;
    const isPendingStatus = (status: string): boolean =>
      status === RequestStatus.PENDING || status === RequestStatus.IN_PROGRESS;

    const byDateMap = new Map<string, { total: number; completed: number; pending: number }>();
    const byTypeMap = new Map<string, { requestTypeName: string; requestTypeSlug: string; requestsCount: number }>();
    const byOptionMap = new Map<string, { serviceOptionLabel: string; requestsCount: number }>();
    const byHouseMap = new Map<string, { subSectorName: string; houseNo: string; streetNo: string; totalRequests: number; pendingRequests: number }>();
    const subSectorPerfMap = new Map<number, { subSectorId: number; subSectorName: string; requestsCount: number; completedCount: number }>();
    const subSectorStatusMixMap = new Map<
      number,
      {
        subSectorId: number;
        subSectorName: string;
        totalRequests: number;
        pendingCount: number;
        inProgressCount: number;
        completedCount: number;
        cancelledCount: number;
      }
    >();
    const hourlyDemandMap = new Map<number, number>();

    let completedCount = 0;
    let cancelledCount = 0;
    let backlogCount = 0;
    let totalResolutionHours = 0;
    let resolvedRows = 0;
    for (const row of requestAnalyticsRows) {
      const dateKey = new Date(row.createdAt).toISOString().slice(0, 10);
      const dateBucket = byDateMap.get(dateKey) ?? { total: 0, completed: 0, pending: 0 };
      dateBucket.total += 1;
      if (isCompletedStatus(row.status)) dateBucket.completed += 1;
      if (isPendingStatus(row.status)) dateBucket.pending += 1;
      byDateMap.set(dateKey, dateBucket);

      const typeKey = `${row.requestTypeSlug}::${row.requestTypeName}`;
      const typeBucket = byTypeMap.get(typeKey) ?? {
        requestTypeName: row.requestTypeName,
        requestTypeSlug: row.requestTypeSlug,
        requestsCount: 0,
      };
      typeBucket.requestsCount += 1;
      byTypeMap.set(typeKey, typeBucket);

      const optionBucket = byOptionMap.get(row.serviceOptionLabel) ?? {
        serviceOptionLabel: row.serviceOptionLabel,
        requestsCount: 0,
      };
      optionBucket.requestsCount += 1;
      byOptionMap.set(row.serviceOptionLabel, optionBucket);

      const houseKey = `${row.subSectorName}::${row.houseNo}::${row.streetNo}`;
      const houseBucket = byHouseMap.get(houseKey) ?? {
        subSectorName: row.subSectorName,
        houseNo: row.houseNo,
        streetNo: row.streetNo,
        totalRequests: 0,
        pendingRequests: 0,
      };
      houseBucket.totalRequests += 1;
      if (isPendingStatus(row.status)) houseBucket.pendingRequests += 1;
      byHouseMap.set(houseKey, houseBucket);

      const subSectorId = Number(row.subSectorId) || 0;
      const subSectorBucket = subSectorPerfMap.get(subSectorId) ?? {
        subSectorId,
        subSectorName: row.subSectorName,
        requestsCount: 0,
        completedCount: 0,
      };
      subSectorBucket.requestsCount += 1;
      if (isCompletedStatus(row.status)) subSectorBucket.completedCount += 1;
      subSectorPerfMap.set(subSectorId, subSectorBucket);

      const statusMixBucket = subSectorStatusMixMap.get(subSectorId) ?? {
        subSectorId,
        subSectorName: row.subSectorName,
        totalRequests: 0,
        pendingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        cancelledCount: 0,
      };
      statusMixBucket.totalRequests += 1;
      if (row.status === RequestStatus.PENDING) statusMixBucket.pendingCount += 1;
      if (row.status === RequestStatus.IN_PROGRESS) statusMixBucket.inProgressCount += 1;
      if (isCompletedStatus(row.status)) statusMixBucket.completedCount += 1;
      if (row.status === RequestStatus.CANCELLED) statusMixBucket.cancelledCount += 1;
      subSectorStatusMixMap.set(subSectorId, statusMixBucket);

      const hour = new Date(row.createdAt).getUTCHours();
      hourlyDemandMap.set(hour, (hourlyDemandMap.get(hour) ?? 0) + 1);

      if (isCompletedStatus(row.status)) {
        completedCount += 1;
        const createdAtMs = new Date(row.createdAt).getTime();
        const updatedAtMs = new Date(row.updatedAt).getTime();
        if (updatedAtMs > createdAtMs) {
          totalResolutionHours += (updatedAtMs - createdAtMs) / (1000 * 60 * 60);
          resolvedRows += 1;
        }
      }
      if (row.status === RequestStatus.CANCELLED) cancelledCount += 1;
      if (isPendingStatus(row.status)) backlogCount += 1;
    }

    const dailyTrend = Array.from(byDateMap.entries())
      .map(([date, v]) => ({ date, total: v.total, completed: v.completed, pending: v.pending }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const topRequestTypes = Array.from(byTypeMap.values())
      .sort((a, b) => b.requestsCount - a.requestsCount)
      .slice(0, 8);
    const topServiceOptions = Array.from(byOptionMap.values())
      .sort((a, b) => b.requestsCount - a.requestsCount)
      .slice(0, 8);
    const topHouses = Array.from(byHouseMap.values())
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, 10);
    const repeatDemandHouses = Array.from(byHouseMap.values())
      .filter((row) => row.totalRequests >= 2)
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, 10)
      .map((row) => ({
        subSectorName: row.subSectorName,
        houseNo: row.houseNo,
        streetNo: row.streetNo,
        totalRequests: row.totalRequests,
      }));

    const usersBySubSectorMap = new Map<number, number>();
    for (const row of usersSummary.bySubSector) {
      usersBySubSectorMap.set(row.subSectorId, row.usersCount);
    }
    const subSectorPerformance = Array.from(subSectorPerfMap.values())
      .map((row) => ({
        subSectorId: row.subSectorId,
        subSectorName: row.subSectorName,
        usersCount: usersBySubSectorMap.get(row.subSectorId) ?? 0,
        requestsCount: row.requestsCount,
        completedCount: row.completedCount,
        completionRate:
          row.requestsCount > 0
            ? Number(((row.completedCount / row.requestsCount) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.requestsCount - a.requestsCount);
    const statusMixBySubSector = Array.from(subSectorStatusMixMap.values())
      .map((row) => ({
        ...row,
        completionRate:
          row.totalRequests > 0
            ? Number(((row.completedCount / row.totalRequests) * 100).toFixed(1))
            : 0,
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);

    const agingBucketsSeed = new Map<string, number>([
      ['0-1 day', 0],
      ['2-3 days', 0],
      ['4-7 days', 0],
      ['8+ days', 0],
    ]);
    const nowMs = Date.now();
    for (const row of requestAnalyticsRows) {
      if (!isPendingStatus(row.status)) continue;
      const ageDays = (nowMs - new Date(row.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      const bucket = ageDays <= 1 ? '0-1 day' : ageDays <= 3 ? '2-3 days' : ageDays <= 7 ? '4-7 days' : '8+ days';
      agingBucketsSeed.set(bucket, (agingBucketsSeed.get(bucket) ?? 0) + 1);
    }
    const agingBuckets = Array.from(agingBucketsSeed.entries()).map(([bucket, count]) => ({ bucket, count }));

    const hourlyDemand: Array<{ hour: number; count: number }> = [];
    for (let hour = 0; hour < 24; hour += 1) {
      hourlyDemand.push({ hour, count: hourlyDemandMap.get(hour) ?? 0 });
    }

    const previousRequests = await this.requestRepo
      .createQueryBuilder('r')
      .leftJoin('r.requestTypeOption', 'rto')
      .where('r.createdAt >= :start AND r.createdAt < :endExclusive', {
        start: previousRangeStart,
        endExclusive: previousRangeEnd,
      })
      .getCount();
    const previousUsers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.createdAt >= :start AND u.createdAt < :endExclusive', {
        start: previousRangeStart,
        endExclusive: previousRangeEnd,
      })
      .getCount();

    const requestsGrowthPercent =
      previousRequests > 0
        ? Number((((requestsSummary.totalRequests - previousRequests) / previousRequests) * 100).toFixed(1))
        : requestsSummary.totalRequests > 0
          ? 100
          : 0;
    const usersGrowthPercent =
      previousUsers > 0
        ? Number((((usersSummary.totalUsers - previousUsers) / previousUsers) * 100).toFixed(1))
        : usersSummary.totalUsers > 0
          ? 100
          : 0;

    const topSubSectorByRequests =
      requestsSummary.bySubSector.length > 0
        ? [...requestsSummary.bySubSector].sort((a, b) => b.requestsCount - a.requestsCount)[0]
        : null;
    const topSubSectorByUsers =
      usersSummary.bySubSector.length > 0
        ? [...usersSummary.bySubSector].sort((a, b) => b.usersCount - a.usersCount)[0]
        : null;
    const insights = {
      completionRate:
        requestsSummary.totalRequests > 0
          ? Number(((completedCount / requestsSummary.totalRequests) * 100).toFixed(1))
          : 0,
      cancellationRate:
        requestsSummary.totalRequests > 0
          ? Number(((cancelledCount / requestsSummary.totalRequests) * 100).toFixed(1))
          : 0,
      backlogCount,
      avgResolutionHours: resolvedRows > 0 ? Number((totalResolutionHours / resolvedRows).toFixed(1)) : 0,
      requestsGrowthPercent,
      usersGrowthPercent,
      topSubSectorByRequests,
      topSubSectorByUsers,
    };

    return {
      filter: {
        period: range.period,
        from: range.from,
        to: range.to,
      },
      usersBySubSectorHouse,
      requestsPerHouseDateStatus,
      usersSummary,
      requestsSummary,
      tankerSummary,
      insights,
      analytics: {
        dailyTrend,
        topRequestTypes,
        topServiceOptions,
        topHouses,
        subSectorPerformance,
        statusMixBySubSector,
        agingBuckets,
        repeatDemandHouses,
        hourlyDemand,
      },
    };
  }
}
