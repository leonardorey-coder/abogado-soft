// Corrige los tipos de Express 5 para que req.params sean siempre string.
// En Express, los route params (:id, :documentId, etc.) nunca son arrays.
// Express 5 amplió el tipo a string | string[], lo cual rompe la compatibilidad
// con Prisma y otras librerías que esperan string puro.

declare module 'express-serve-static-core' {
    interface ParamsDictionary {
        [key: string]: string;
    }
}

export { };
