import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import { AuthService, LoginInput, RegisterInput } from './auth.service';
import { Public, Roles } from './decorators';
import { AuthenticatedUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: RegisterInput) {
    if (process.env['NODE_ENV'] === 'production') {
      throw new ForbiddenException(
        'Public registration is disabled. Contact an administrator.',
      );
    }
    return this.authService.register(body);
  }

  @Public()
  @Post('login')
  login(@Body() body: LoginInput) {
    return this.authService.login(body);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Get('admin-only')
  @Roles('Admin')
  adminOnly(@Req() req: { user: AuthenticatedUser }) {
    return {
      message: 'Admin access granted',
      user: req.user,
    };
  }

  @Get('manager-or-admin')
  @Roles('Admin', 'Manager')
  managerOrAdmin(@Req() req: { user: AuthenticatedUser }) {
    return {
      message: 'Manager or Admin access granted',
      user: req.user,
    };
  }
}
