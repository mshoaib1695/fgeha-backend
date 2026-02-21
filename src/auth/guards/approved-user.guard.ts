import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ApprovalStatus, AccountStatus } from '../../users/entities/user.entity';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class ApprovedUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Not authenticated');
    if (user.accountStatus === AccountStatus.DEACTIVATED) {
      throw new ForbiddenException('Your account is deactivated');
    }
    if (user.emailVerified === false) {
      throw new ForbiddenException('Please verify your email before signing in. Check your inbox for the verification link.');
    }
    if (user.role === UserRole.ADMIN) return true;
    if (user.approvalStatus !== ApprovalStatus.APPROVED)
      throw new ForbiddenException('Your registration is not yet approved');
    return true;
  }
}
