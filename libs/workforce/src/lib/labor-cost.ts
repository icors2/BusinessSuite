export interface LaborEntry {
  employeeId: string;
  workOrderId: string | null;
  department: string | null;
  durationMinutes: number;
}

export interface LaborCostGroup {
  totalCost: number;
  totalMinutes: number;
}

export interface LaborCostRollUp {
  byWorkOrder: Array<{ workOrderId: string } & LaborCostGroup>;
  byDepartment: Array<{ department: string } & LaborCostGroup>;
}

export function rollUpLaborCost(
  entries: LaborEntry[],
  rateByEmployee: Record<string, number>,
): LaborCostRollUp {
  const woMap = new Map<string, LaborCostGroup>();
  const deptMap = new Map<string, LaborCostGroup>();

  for (const entry of entries) {
    const rate = rateByEmployee[entry.employeeId] ?? 0;
    const hours = entry.durationMinutes / 60;
    const cost = hours * rate;

    if (entry.workOrderId) {
      const current = woMap.get(entry.workOrderId) ?? {
        totalCost: 0,
        totalMinutes: 0,
      };
      woMap.set(entry.workOrderId, {
        totalCost: current.totalCost + cost,
        totalMinutes: current.totalMinutes + entry.durationMinutes,
      });
    }

    const department = entry.department ?? 'Unassigned';
    const deptCurrent = deptMap.get(department) ?? {
      totalCost: 0,
      totalMinutes: 0,
    };
    deptMap.set(department, {
      totalCost: deptCurrent.totalCost + cost,
      totalMinutes: deptCurrent.totalMinutes + entry.durationMinutes,
    });
  }

  return {
    byWorkOrder: [...woMap.entries()].map(([workOrderId, totals]) => ({
      workOrderId,
      ...totals,
    })),
    byDepartment: [...deptMap.entries()].map(([department, totals]) => ({
      department,
      ...totals,
    })),
  };
}
