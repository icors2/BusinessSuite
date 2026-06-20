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

const isOperator = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const allowed = ctx.user.roles.some((role) =>
    ['Admin', 'Manager', 'Supervisor', 'Operator'].includes(role),
  );
  if (!allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Operator role or higher required',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isSupervisor = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const allowed = ctx.user.roles.some((role) =>
    ['Admin', 'Supervisor'].includes(role),
  );
  if (!allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Supervisor role required',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isInspector = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const allowed = ctx.user.roles.some((role) =>
    ['Admin', 'Manager', 'Supervisor', 'Inspector'].includes(role),
  );
  if (!allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Inspector role or higher required',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const isTechnician = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  const allowed = ctx.user.roles.some((role) =>
    ['Admin', 'Manager', 'Supervisor', 'Technician'].includes(role),
  );
  if (!allowed) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Technician role or higher required',
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = publicProcedure.use(isAuthenticated);
export const editorProcedure = publicProcedure.use(isEditor);
export const operatorProcedure = publicProcedure.use(isOperator);
export const supervisorProcedure = publicProcedure.use(isSupervisor);
export const inspectorProcedure = publicProcedure.use(isInspector);
export const technicianProcedure = publicProcedure.use(isTechnician);
