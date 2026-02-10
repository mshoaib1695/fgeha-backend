import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Request as RequestEntity, RequestStatus } from './entities/request.entity';
import { RequestTypeEntity } from '../request-types/entities/request-type.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { SubSector } from '../users/entities/sub-sector.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestStatusDto } from './dto/update-request-status.dto';
import { FindRequestsQueryDto } from './dto/find-requests-query.dto';

/**
 * IANA timezone for admin time inputs (e.g. Pakistan).
 * Uses the system/ICU timezone database so any future DST or offset changes are applied automatically.
 * Override with env ADMIN_INPUT_TIMEZONE if needed (e.g. "Asia/Karachi").
 */
const ADMIN_INPUT_TIMEZONE = process.env.ADMIN_INPUT_TIMEZONE ?? 'Asia/Karachi';

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
    @InjectRepository(SubSector)
    private readonly subSectorRepo: Repository<SubSector>,
  ) {}

  async create(
    createRequestDto: CreateRequestDto,
    user: User,
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

    const period = (requestType.duplicateRestrictionPeriod ?? 'none').toLowerCase();
    if (period && period !== 'none') {
      const qb = this.requestRepo
        .createQueryBuilder('r')
        .where('r.request_type_id = :requestTypeId', { requestTypeId: createRequestDto.requestTypeId })
        .andWhere('r.house_no = :houseNo', { houseNo: createRequestDto.houseNo.trim() })
        .andWhere('r.street_no = :streetNo', { streetNo: createRequestDto.streetNo.trim() })
        .andWhere('r.sub_sector_id = :subSectorId', { subSectorId: createRequestDto.subSectorId });
      addCalendarPeriodCondition(qb, period, new Date());
      const count = await qb.getCount();
      if (count > 0) {
        const periodLabel = period === 'day' ? 'calendar day' : period === 'week' ? 'calendar week' : 'calendar month';
        this.logger.warn(
          `[Request create] REJECTED duplicate userId=${user.id} requestTypeName="${requestType.name}" period=${periodLabel}`,
        );
        throw new ForbiddenException(
          `Only one ${requestType.name} request per ${periodLabel} is allowed for the same house, street and sector. There is already a request for this address in this ${periodLabel}.`,
        );
      }
    }

    const description = (createRequestDto.description ?? '').trim();
    const request = this.requestRepo.create({
      requestTypeId: createRequestDto.requestTypeId,
      description: description || '',
      houseNo: createRequestDto.houseNo.trim(),
      streetNo: createRequestDto.streetNo.trim(),
      subSectorId: createRequestDto.subSectorId,
      userId: user.id,
      status: RequestStatus.PENDING,
    });
    const saved = await this.requestRepo.save(request);
    this.logger.log(
      `[Request create] SUCCESS requestId=${saved.id} userId=${user.id} requestTypeName="${requestType.name}" timeUtc=${timeUtc}`,
    );
    return saved;
  }

  async findMy(userId: number): Promise<RequestEntity[]> {
    return this.requestRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['user', 'requestType'],
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
      .orderBy('r.createdAt', 'DESC');
    if (query.requestTypeId != null) {
      qb.andWhere('r.request_type_id = :requestTypeId', { requestTypeId: query.requestTypeId });
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
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
      relations: ['user', 'requestType'],
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
}
