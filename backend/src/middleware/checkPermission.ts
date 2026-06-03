// ============================================================================
// Permission Middleware — Verifica permisos granulares sobre documentos
// Resuelve el permiso efectivo: dueño > admin global > individual > grupo > membresía
// ============================================================================

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Niveles jerárquicos (de menor a mayor)
const LEVEL_HIERARCHY: Record<string, number> = {
    none: 0,
    download: 1,
    read: 2,
    write: 3,
    admin: 4,
};

export type PermissionLevelName = 'none' | 'download' | 'read' | 'write' | 'admin';
export type PermissionOriginName = 'owner' | 'role_admin' | 'direct' | 'group' | 'membership' | 'none';

export interface EffectivePermissionDetails {
    permission: PermissionLevelName;
    origin: PermissionOriginName;
    sourceUserId?: string | null;
    sourceGroupId?: string | null;
}

// Extiende Request para adjuntar el permiso efectivo
declare global {
    namespace Express {
        interface Request {
            effectivePermission?: PermissionLevelName;
        }
    }
}

/**
 * Calcula el nivel de permiso efectivo que un usuario tiene sobre un documento.
 *
 * Prioridad:
 *   1. Dueño del documento → admin
 *   2. Admin global (role === 'admin') → admin
 *   3. Permiso individual (document_permissions con userId)
 *   4. Permiso heredado de grupo (document_permissions con groupId
 *      donde el usuario sea miembro del grupo)
 *   5. Membresía al grupo (si el documento pertenece al grupo del usuario) → read
 *   6. Sin permiso → none
 *
 * Si hay múltiples permisos (individual + grupo), toma el mayor.
 * Los permisos expirados (expiresAt < ahora) se ignoran.
 */
export async function getEffectivePermission(
    userId: string,
    documentId: string,
): Promise<PermissionLevelName> {
    return (await getEffectivePermissionDetails(userId, documentId)).permission;
}

export async function getEffectivePermissionDetails(
    userId: string,
    documentId: string,
): Promise<EffectivePermissionDetails> {
    // 1. Obtener documento con su groupId
    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { ownerId: true, groupId: true, firmId: true },
    });

    if (!doc) return { permission: 'none', origin: 'none' };

    // 2. Verificar si es admin global
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, firmId: true },
    });

    if (doc.firmId && (!user?.firmId || doc.firmId !== user.firmId)) {
        return { permission: 'none', origin: 'none' };
    }

    if (doc.ownerId === userId) {
        return { permission: 'admin', origin: 'owner', sourceUserId: userId };
    }

    if (user?.role === 'admin') {
        return { permission: 'admin', origin: 'role_admin', sourceUserId: userId };
    }

    // 3. Obtener los grupos del usuario
    const userGroups = await prisma.groupMember.findMany({
        where: { userId },
        select: { groupId: true },
    });
    const groupIds = userGroups.map(g => g.groupId);

    // 4. Buscar todos los permisos relevantes (individuales + grupo)
    const orConditions: any[] = [{ userId }];
    if (groupIds.length > 0) {
        orConditions.push({ groupId: { in: groupIds } });
    }

    const now = new Date();

    const permissions = await prisma.documentPermission.findMany({
        where: {
            documentId,
            OR: orConditions,
            // Excluir expirados: expiresAt es null (sin expiración) o > ahora
            AND: {
                OR: [
                    { expiresAt: null },
                    { expiresAt: { gt: now } },
                ],
            },
        },
        select: { permissionLevel: true, userId: true, groupId: true },
    });

    // Si hay permisos explícitos, verificar si alguno es 'none' (denegación explícita)
    if (permissions.length > 0) {
        // Verificar si hay denegación explícita (permiso 'none')
        const hasExplicitDenial = permissions.some(p => p.permissionLevel === 'none');
        if (hasExplicitDenial) {
            // Solo denegar si TODOS los permisos son 'none'
            const allDenied = permissions.every(p => p.permissionLevel === 'none');
            if (allDenied) return { permission: 'none', origin: 'direct', sourceUserId: userId };
        }

        // 5. Tomar el nivel más alto (excluyendo 'none')
        let maxLevel = 0;
        let bestOrigin: PermissionOriginName = 'none';
        let sourceUserId: string | null = null;
        let sourceGroupId: string | null = null;
        for (const perm of permissions) {
            if (perm.permissionLevel === 'none') continue;
            const level = LEVEL_HIERARCHY[perm.permissionLevel] ?? 0;
            if (level > maxLevel) {
                maxLevel = level;
                bestOrigin = perm.userId ? 'direct' : 'group';
                sourceUserId = perm.userId;
                sourceGroupId = perm.groupId;
            }
        }

        if (maxLevel > 0) {
            const entry = Object.entries(LEVEL_HIERARCHY).find(([, v]) => v === maxLevel);
            return {
                permission: (entry?.[0] as PermissionLevelName) ?? 'none',
                origin: bestOrigin,
                sourceUserId,
                sourceGroupId,
            };
        }
    }

    // 6. Si no hay permisos explícitos pero el usuario es miembro del grupo del documento
    //    → otorgar permiso de lectura por defecto (acceso por membresía)
    if (doc.groupId && groupIds.includes(doc.groupId)) {
        return { permission: 'read', origin: 'membership', sourceGroupId: doc.groupId };
    }

    return { permission: 'none', origin: 'none' };
}

/**
 * Compara si un nivel cumple con el mínimo requerido.
 */
export function hasMinLevel(
    current: PermissionLevelName,
    required: PermissionLevelName,
): boolean {
    return (LEVEL_HIERARCHY[current] ?? 0) >= (LEVEL_HIERARCHY[required] ?? 0);
}

/**
 * Middleware factory: verifica que el usuario tenga al menos el nivel requerido
 * sobre el documento identificado por req.params[paramName] (por defecto `id`).
 *
 * Uso:
 *   router.get('/:id', requirePermission('read'), handler);
 *   router.patch('/:id', requirePermission('write'), handler);
 *   router.post('/sync/:documentId', requirePermission('write', 'documentId'), handler);
 */
export function requirePermission(
    minLevel: PermissionLevelName,
    paramName: string = 'id',
) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'No autenticado' });
                return;
            }

            const raw = req.params[paramName as keyof typeof req.params];
            const documentId = Array.isArray(raw) ? raw[0] : raw;
            if (!documentId || typeof documentId !== 'string') {
                res.status(400).json({ error: 'ID de documento requerido' });
                return;
            }

            const effectiveLevel = await getEffectivePermission(req.user.id, documentId);
            req.effectivePermission = effectiveLevel;

            if (!hasMinLevel(effectiveLevel, minLevel)) {
                res.status(403).json({
                    error: 'No tienes permisos suficientes para esta acción',
                    required: minLevel,
                    current: effectiveLevel,
                });
                return;
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}
