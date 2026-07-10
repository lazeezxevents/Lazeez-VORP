/**
 * Permissions registry for the Lazeez VORP system.
 * All permission slugs MUST be unique and follow the 'module.action' format.
 */

export const PERMISSIONS = {
    GENERAL: {
        VIEW_DASHBOARD: "dashboard.view",
    },
    VENDORS: {
        VIEW: "vendors.view",
        MANAGE: "vendors.manage", // Create, Edit, Delete
    },
    ISSUES: {
        VIEW: "issues.view",
        MANAGE: "issues.manage",
    },
    MOUS: {
        VIEW: "mous.view",
        MANAGE: "mous.manage",
        APPROVE: "mous.approve",
    },
    SETTINGS: {
        ACCESS: "settings.access",
    },
} as const;

export type PermissionSlug = typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS[keyof typeof PERMISSIONS]];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS).flatMap(module => Object.values(module));
