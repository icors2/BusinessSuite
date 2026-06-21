import { z } from 'zod';

export const listUsersSchema = z.object({
  search: z.string().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roleNames: z.array(z.string().min(1)).min(1),
});

export const updateUserRolesSchema = z.object({
  userId: z.string().uuid(),
  roleNames: z.array(z.string().min(1)).min(1),
});

export const deactivateUserSchema = z.object({
  userId: z.string().uuid(),
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  password: z.string().min(8),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;
export type DeactivateUserInput = z.infer<typeof deactivateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
