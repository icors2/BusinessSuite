import {
  AdminService,
  createUserSchema,
  deactivateUserSchema,
  listUsersSchema,
  resetPasswordSchema,
  updateUserRolesSchema,
} from 'admin';
import {
  createEmployeeSchema,
  listEmployeesSchema,
  updateEmployeeSchema,
} from 'workforce';
import { adminProcedure, router } from '../trpc';

export function createAdminRouter(adminService: AdminService) {
  return router({
    listRoles: adminProcedure.query(() => adminService.listRoles()),

    listUsers: adminProcedure
      .input(listUsersSchema)
      .query(({ input }) => adminService.listUsers(input)),

    createUser: adminProcedure
      .input(createUserSchema)
      .mutation(({ ctx, input }) =>
        adminService.createUser(input, ctx.user?.userId),
      ),

    updateUserRoles: adminProcedure
      .input(updateUserRolesSchema)
      .mutation(({ ctx, input }) =>
        adminService.updateUserRoles(input, ctx.user?.userId),
      ),

    deactivateUser: adminProcedure
      .input(deactivateUserSchema)
      .mutation(({ ctx, input }) =>
        adminService.deactivateUser(input, ctx.user?.userId),
      ),

    resetPassword: adminProcedure
      .input(resetPasswordSchema)
      .mutation(({ ctx, input }) =>
        adminService.resetPassword(input, ctx.user?.userId),
      ),

    listEmployees: adminProcedure
      .input(listEmployeesSchema)
      .query(({ input }) => adminService.listEmployees(input)),

    createEmployee: adminProcedure
      .input(createEmployeeSchema)
      .mutation(({ ctx, input }) =>
        adminService.createEmployee(input, ctx.user?.userId),
      ),

    updateEmployee: adminProcedure
      .input(updateEmployeeSchema)
      .mutation(({ ctx, input }) =>
        adminService.updateEmployee(input, ctx.user?.userId),
      ),
  });
}
