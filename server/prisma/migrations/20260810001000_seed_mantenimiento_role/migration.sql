INSERT INTO "Permission" ("module", "action", "createdAt")
SELECT module, action, CURRENT_TIMESTAMP
FROM (
  VALUES
    ('MANTENIMIENTO', 'VER'),
    ('MANTENIMIENTO', 'CREAR'),
    ('MANTENIMIENTO', 'EDITAR'),
    ('MANTENIMIENTO', 'ELIMINAR'),
    ('REPORTES', 'VER'),
    ('REPORTES', 'CREAR'),
    ('REPORTES', 'EDITAR'),
    ('REPORTES', 'ELIMINAR')
) AS seed(module, action)
ON CONFLICT ("module", "action") DO NOTHING;

INSERT INTO "Role" ("name", "description", "createdAt", "updatedAt")
VALUES ('MANTENIMIENTO', 'MANTENIMIENTO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO UPDATE
SET "description" = EXCLUDED."description",
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role_row."id", permission_row."id"
FROM "Role" role_row
CROSS JOIN "Permission" permission_row
WHERE role_row."name" = 'MANTENIMIENTO'
  AND (
    permission_row."module" = 'MANTENIMIENTO'
    OR permission_row."module" = 'REPORTES'
  )
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

INSERT INTO "User" ("firstName", "lastName", "email", "passwordHash", "status", "roleId", "createdAt", "updatedAt")
SELECT
  'Juan',
  'Perez',
  'mantenimiento@parkplaza.com',
  '$2b$10$6XcIz2asVTj0mnvGJDykd.e2AO/6/x06Z5Thqn8Z.IXTrbflKAPEG',
  'ACTIVO',
  role_row."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Role" role_row
WHERE role_row."name" = 'MANTENIMIENTO'
ON CONFLICT ("email") DO UPDATE
SET "roleId" = EXCLUDED."roleId",
    "status" = 'ACTIVO',
    "updatedAt" = CURRENT_TIMESTAMP;
