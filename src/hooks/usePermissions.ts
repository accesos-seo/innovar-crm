import { useAuthStore } from '@/store/authStore';
import { UserRole, UserPermissions } from '@/types/auth';

export function usePermissions() {
  const { profile } = useAuthStore();
  const role = profile?.role || 'comercial'; // Rol por defecto si no hay perfil

  const permissions: Record<UserRole, UserPermissions> = {
    admin: {
      canViewFinances: true,
      canEditCatalog: true,
      canManageUsers: true,
      canCreateProjects: true,
      canDeleteRecords: true,
      canViewAudit: true,
    },
    produccion: {
      canViewFinances: true,
      canEditCatalog: false,
      canManageUsers: false,
      canCreateProjects: true,
      canDeleteRecords: false,
      canViewAudit: false,
    },
    diseno: {
      canViewFinances: false,
      canEditCatalog: true,
      canManageUsers: false,
      canCreateProjects: true,
      canDeleteRecords: false,
      canViewAudit: false,
    },
    comercial: {
      canViewFinances: false,
      canEditCatalog: false,
      canManageUsers: false,
      canCreateProjects: true,
      canDeleteRecords: false,
      canViewAudit: false,
    },
  };

  return {
    role,
    ...permissions[role as UserRole],
    isAdmin: role === 'admin',
  };
}
