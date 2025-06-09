export interface RoleConfig {
  isInternal: boolean;
  // Add other role-specific flags or metadata if needed in the future
}

export const rolesConfiguration: { [role: string]: RoleConfig } = {
  public: { isInternal: false },
  colaboradores: { isInternal: true },
  managers: { isInternal: true },
  franchising: { isInternal: true },
  admin_full_context: { isInternal: true },
  // Add other internal roles here if they follow the same pattern
  // e.g. new_internal_role: { isInternal: true },
};

// The old RoleContextMapping interface and constant can be removed or commented out
// if no longer used by any other part of the application.
// For now, we'll assume it's being fully replaced for the chat API.

/*
export interface RoleContextMapping {
  [role: string]: {
    files: string[];
    directories: string[];
  };
}

export const roleContextMapping: RoleContextMapping = {
  // ... old mapping ...
};
*/
