ALTER TABLE auditoria_intentos_registro RENAME COLUMN "Id" TO id;
ALTER TABLE auditoria_intentos_registro RENAME COLUMN "Mensaje" TO mensaje;
ALTER TABLE auditoria_intentos_registro RENAME COLUMN "RFC" TO rfc;
ALTER TABLE auditoria_intentos_registro RENAME COLUMN "Timestamp" TO "timestamp";
ALTER TABLE auditoria_intentos_registro RENAME COLUMN "Tipo" TO tipo;
ALTER TABLE auditoria_intentos_registro RENAME COLUMN "UsuarioId" TO usuarioid;

SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name != lower(column_name) ORDER BY table_name;
