import { TRPCError, initTRPC } from '@trpc/server';
import { AuthenticatedUser } from 'auth';

export interface TrpcContext {
  user?: AuthenticatedUser;
}

export function createTrpcContext(user?: AuthenticatedUser): TrpcContext {
  return { user };
}

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isEditor = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const canEdit = ctx.user.roles.some(
    (role) => role === 'Admin' || role === 'Manager',
  );
  if (!canEdit) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin or Manager role required',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = publicProcedure.use(isAuthenticated);
export const editorProcedure = publicProcedure.use(isEditor);
