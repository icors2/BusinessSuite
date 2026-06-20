import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { AppConfig } from 'config';
import { PrismaService } from 'database';
import { AuditService } from 'audit';

describe('AuthService', () => {
  const config: AppConfig = {
    nodeEnv: 'development',
    port: 3000,
    databaseUrl: 'postgresql://test',
    redisUrl: 'redis://localhost',
    minio: {
      endpoint: 'localhost',
      port: 9000,
      accessKey: 'key',
      secretKey: 'secret',
      bucket: 'bucket',
      useSsl: false,
    },
    jwt: {
      accessSecret: 'access-secret',
      refreshSecret: 'refresh-secret',
      accessExpiresIn: '15m',
      refreshExpiresIn: '7d',
    },
  };

  it('hashes passwords during registration flow', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }) => ({
          id: 'user-1',
          email: data.email,
          passwordHash: data.passwordHash,
          roles: [{ role: { name: 'Manager' } }],
        })),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'Manager' }]),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
      },
    } as unknown as PrismaService;

    const jwtService = new JwtService({});
    const auditService = { record: jest.fn() } as unknown as AuditService;
    const service = new AuthService(prisma, jwtService, config, auditService);

    const tokens = await service.register({
      email: 'user@example.com',
      password: 'Password123!',
    });

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();

    const createCall = (prisma.user.create as jest.Mock).mock.calls[0][0];
    const valid = await bcrypt.compare(
      'Password123!',
      createCall.data.passwordHash,
    );
    expect(valid).toBe(true);
  });
});
