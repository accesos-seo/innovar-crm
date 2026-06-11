export type UserRole = 'admin' | 'super_admin' | 'comercial' | 'diseno' | 'produccion' | 'administradora' | 'gerente';

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
  whatsapp_phone?: string | null;
  is_active?: boolean;
  notification_preferences?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}
