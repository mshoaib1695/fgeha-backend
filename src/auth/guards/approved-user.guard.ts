import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalStatus } from '../../users/entities/user.entity';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class ApprovedUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Not authenticated');
    if (user.role === UserRole.ADMIN) return true;
    if (user.approvalStatus !== ApprovalStatus.APPROVED)
      throw new ForbiddenException('Your registration is not yet approved');
    return true;
  }
}
