import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function canEdit(roles: string[]): boolean {
  return roles.some((role) => role === 'Admin' || role === 'Manager');
}
