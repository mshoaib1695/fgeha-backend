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

/**
 * Adds a calendar-based period condition to the query: same calendar day, week (ISO), or month.
 * Uses server date (CURDATE()) so the limit is per calendar period, not rolling duration.
 */
function addCalendarPeriodCondition(
  qb: SelectQueryBuilder<RequestEntity>,
  period: string,
): void {
  switch (period) {
    case 'day':
      qb.andWhere('DATE(r.createdAt) = CURDATE()');
      break;
    case 'week':
      qb.andWhere('YEARWEEK(r.createdAt, 1) = YEARWEEK(CURDATE(), 1)');
      break;
    case 'month':
      qb.andWhere('YEAR(r.createdAt) = YEAR(CURDATE()) AND MONTH(r.createdAt) = MONTH(CURDATE())');
      break;
    default:
      break;
  }
}

/** Parse "HH:mm" to minutes since midnight. */
function timeToMinutes(s: string): number {
  const [h, m] = s.trim().split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Check if current time (server local) is within request type restriction. Throws if outside window. */
function assertWithinRestriction(
  type: RequestTypeEntity,
  typeName: string,
): void {
  const start = type.restrictionStartTime?.trim();
  const end = type.restrictionEndTime?.trim();
  const days = type.restrictionDays?.trim();
  if (!start || !end || !days) return; // no restriction

  const now = new Date();
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const allowedDays = days.split(',').map((d) => parseInt(d.trim(), 10));
  if (!allowedDays.includes(currentDay)) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const allowedNames = allowedDays.map((d) => dayNames[d] ?? d).join(', ');
    throw new ForbiddenException(
      `${typeName} request window: allowed only on ${allowedNames}.`,
    );
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
    throw new ForbiddenException(
      `${typeName} request window: allowed only between ${start} and ${end} (server time).`,
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
    const requestType = await this.requestTypeRepo.findOne({
      where: { id: createRequestDto.requestTypeId },
    });
    if (!requestType)
      throw new ForbiddenException('Invalid request type');
    assertWithinRestriction(requestType, requestType.name);

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
      addCalendarPeriodCondition(qb, period);
      const count = await qb.getCount();
      if (count > 0) {
        const periodLabel = period === 'day' ? 'calendar day' : period === 'week' ? 'calendar week' : 'calendar month';
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
    return this.requestRepo.save(request);
  }

  async findMy(userId: number): Promise<RequestEntity[]> {
    return this.requestRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['user', 'requestType'],
    });
  }

  async findAll(user: User): Promise<RequestEntity[]> {
    if (user.role !== UserRole.ADMIN)
      throw new ForbiddenException('Admin only');
    return this.requestRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['user', 'requestType'],
    });
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
