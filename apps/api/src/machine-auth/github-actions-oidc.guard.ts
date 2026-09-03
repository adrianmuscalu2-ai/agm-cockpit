import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GitHubActionsOidcService } from './github-actions-oidc.service';

@Injectable()
export class GitHubActionsOidcGuard implements CanActivate {
  constructor(private readonly oidc: GitHubActionsOidcService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string }; machineProvisioning?: unknown }>();
    const match = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? '');
    if (!match) throw new UnauthorizedException();
    request.machineProvisioning = await this.oidc.authenticate(match[1]);
    return true;
  }
}
