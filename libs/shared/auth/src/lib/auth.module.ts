import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AppConfig } from 'config';
import { AuditModule } from 'audit';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard, RolesGuard } from './guards';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Module({})
export class AuthModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AuthModule,
      imports: [
        AuditModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({}),
      ],
      controllers: [AuthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        AuthService,
        {
          provide: JwtStrategy,
          useFactory: () => new JwtStrategy(config),
        },
        {
          provide: APP_GUARD,
          useClass: JwtAuthGuard,
        },
        {
          provide: APP_GUARD,
          useClass: RolesGuard,
        },
      ],
      exports: [AuthService],
    };
  }
}
