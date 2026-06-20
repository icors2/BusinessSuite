import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppConfig } from 'config';
import { PrismaService } from 'database';
import { AuditService } from 'audit';
import { AuthenticatedUser, JwtPayload } from './auth.types';

export interface RegisterInput {
  email: string;
  password: string;
  roleNames?: string[];
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: AppConfig,
    private readonly auditService: AuditService,
  ) {}

  async register(input: RegisterInput): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const roleNames = input.roleNames?.length ? input.roleNames : ['Manager'];
    const roles = await this.prisma.role.findMany({
      where: { name: { in: roleNames } },
    });

    if (roles.length !== roleNames.length) {
      throw new ConflictException('One or more roles are invalid');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash,
        roles: {
          create: roles.map((role) => ({ roleId: role.id })),
        },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.auditService.record({
      actorId: user.id,
      action: 'user.registered',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, roles: roleNames },
    });

    return this.issueTokens(user.id, user.email, roleNames);
  }

  async login(input: LoginInput): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.toLowerCase() },
      include: { roles: { include: { role: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const roleNames = user.roles.map((entry) => entry.role.name);

    await this.auditService.record({
      actorId: user.id,
      action: 'user.logged_in',
      entityType: 'User',
      entityId: user.id,
    });

    return this.issueTokens(user.id, user.email, roleNames);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.jwt.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: { include: { roles: { include: { role: true } } } },
      },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    await this.prisma.refreshToken.delete({ where: { id: stored.id } });

    const roleNames = stored.user.roles.map((entry) => entry.role.name);
    return this.issueTokens(stored.user.id, stored.user.email, roleNames);
  }

  private async issueTokens(
    userId: string,
    email: string,
    roles: string[],
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, roles };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.jwt.refreshSecret,
      expiresIn: this.config.jwt.refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });

    const refreshPayload = this.jwtService.decode(refreshToken) as {
      exp?: number;
    };

    const expiresAt = refreshPayload.exp
      ? new Date(refreshPayload.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
