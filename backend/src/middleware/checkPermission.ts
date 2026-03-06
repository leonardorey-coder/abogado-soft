// ============================================================================
// Permission Middleware — Verifica permisos granulares sobre documentos
// Resuelve el permiso efectivo: dueño > admin global > individual > grupo
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
 *   5. Sin permiso → none
 *
 * Si hay múltiples permisos (individual + grupo), toma el mayor.
 * Los permisos expirados (expiresAt < ahora) se ignoran.
 */
export async function getEffectivePermission(
    userId: string,
    documentId: string,
): Promise<PermissionLevelName> {
    // 1. Verificar si es dueño
    const doc = await prisma.document.findUnique({
        where: { id: documentId },
        select: { ownerId: true },
    });

    if (!doc) return 'none';
    if (doc.ownerId === userId) return 'admin';

    // 2. Verificar si es admin global
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });

    if (user?.role === 'admin') return 'admin';

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
        select: { permissionLevel: true },
    });

    if (permissions.length === 0) return 'none';

    // 5. Tomar el nivel más alto
    let maxLevel = 0;
    for (const perm of permissions) {
        const level = LEVEL_HIERARCHY[perm.permissionLevel] ?? 0;
        if (level > maxLevel) maxLevel = level;
    }

    const entry = Object.entries(LEVEL_HIERARCHY).find(([, v]) => v === maxLevel);
    return (entry?.[0] as PermissionLevelName) ?? 'none';
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
 * sobre el documento identificado por req.params.id.
 *
 * Uso:
 *   router.get('/:id', requirePermission('read'), handler);
 *   router.patch('/:id', requirePermission('write'), handler);
 */
export function requirePermission(minLevel: PermissionLevelName) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            if (!req.user) {
                res.status(401).json({ error: 'No autenticado' });
                return;
            }

            const documentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            if (!documentId) {
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
