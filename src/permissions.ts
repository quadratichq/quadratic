import { Permission, PermissionSchema } from './api/types';
const { OWNER, EDITOR, VIEWER } = PermissionSchema.enum;

export const isOwner = (permission: Permission) => permission === OWNER;
export const isEditorOrAbove = (permission: Permission) => permission === EDITOR || isOwner(permission);
export const isViewerOrAbove = (permission: Permission) => permission === VIEWER || isEditorOrAbove(permission);
