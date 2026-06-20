import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  department: z.string().optional(),
  badgeCode: z.string().optional(),
  laborRate: z.number().min(0).optional(),
  userId: z.string().uuid().optional(),
});

export const updateEmployeeSchema = z.object({
  employeeId: z.string().uuid(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  department: z.string().nullable().optional(),
  badgeCode: z.string().nullable().optional(),
  laborRate: z.number().min(0).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
  userId: z.string().uuid().nullable().optional(),
});

export const listEmployeesSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED']).optional(),
  department: z.string().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const upsertShiftSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  active: z.boolean().optional(),
});

export const listShiftsSchema = z.object({
  activeOnly: z.boolean().optional(),
  skip: z.number().int().min(0).optional(),
  take: z.number().int().min(1).max(100).optional(),
});

export const assignShiftSchema = z.object({
  shiftId: z.string().uuid(),
  employeeId: z.string().uuid(),
  date: z.coerce.date(),
});

export const listAssignmentsSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  shiftId: z.string().uuid().optional(),
});

export const markUnavailableSchema = z.object({
  employeeId: z.string().uuid(),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  reason: z.string().optional(),
});

export const clockInSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    badgeCode: z.string().optional(),
    workOrderId: z.string().uuid().optional(),
    department: z.string().optional(),
    clockIn: z.coerce.date().optional(),
  })
  .refine((data) => data.employeeId || data.badgeCode, {
    message: 'employeeId or badgeCode is required',
  });

export const clockOutSchema = z.object({
  employeeId: z.string().uuid().optional(),
  badgeCode: z.string().optional(),
  clockOut: z.coerce.date().optional(),
  maxShiftHours: z.number().positive().optional(),
});

export const laborCostReportSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  groupBy: z.enum(['workOrder', 'department', 'both']).optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ListEmployeesInput = z.infer<typeof listEmployeesSchema>;
export type UpsertShiftInput = z.infer<typeof upsertShiftSchema>;
export type ListShiftsInput = z.infer<typeof listShiftsSchema>;
export type AssignShiftInput = z.infer<typeof assignShiftSchema>;
export type ListAssignmentsInput = z.infer<typeof listAssignmentsSchema>;
export type MarkUnavailableInput = z.infer<typeof markUnavailableSchema>;
export type ClockInInput = z.infer<typeof clockInSchema>;
export type ClockOutInput = z.infer<typeof clockOutSchema>;
export type LaborCostReportInput = z.infer<typeof laborCostReportSchema>;
