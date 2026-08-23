import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MIN_STAR_COUNT_KEY } from '../decorators/min-star-count.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { UserService } from '../../user/user.service';

@Injectable()
export class StarCountGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
  ) {}

  private normalizeUsername(value?: string | null): string {
    return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredStarCount = this.reflector.getAllAndOverride<number>(
      MIN_STAR_COUNT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredStarCount) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const tokenUsername = this.normalizeUsername(user.username);
    const userId = Number(user.sub);
    const userById = Number.isFinite(userId)
      ? await this.userService.findById(userId)
      : null;
    const idMatchesTokenUsername =
      userById &&
      (!tokenUsername ||
        this.normalizeUsername(userById.username) === tokenUsername);
    const fullUser = idMatchesTokenUsername
      ? userById
      : tokenUsername
        ? await this.userService.findByUsernameCaseInsensitive(tokenUsername)
        : null;

    if (!fullUser || !fullUser.role) {
      throw new ForbiddenException(
        'Access denied: You do not have the required permissions',
      );
    }

    // Attach full user to request for use in controllers
    request['fullUser'] = fullUser;
    request['user'] = {
      ...user,
      sub: fullUser.id,
    };

    if (fullUser.role.starCount < requiredStarCount) {
      throw new ForbiddenException(
        `Access denied: Minimum ${requiredStarCount} stars required (Admin status)`,
      );
    }

    return true;
  }
}
