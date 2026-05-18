export type UserRole = 'admin' | 'comercial' | 'diseno' | 'produccion';

export interface UserPermissions {
  canViewFinances: boolean;
  canEditCatalog: boolean;
  canManageUsers: boolean;
  canCreateProjects: boolean;
  canDeleteRecords: boolean;
  canViewAudit: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at?: string;
}
