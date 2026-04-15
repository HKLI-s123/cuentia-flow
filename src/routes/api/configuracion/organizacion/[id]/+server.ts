import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db';
import { validateOrganizationAccess } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
  try {
    const organizacionId = parseInt(event.params.id);

    if (!organizacionId || isNaN(organizacionId)) {
      return json({ success: false, error: 'ID de organización inválido' }, { status: 400 });
    }

    // Validar acceso a la organización
    const auth = await validateOrganizationAccess(event, organizacionId);
    if (!auth.valid) return auth.error!;

    const pool = await getConnection();

    // Obtener configuración de la organización
    const configQuery = `
      SELECT
        co.id,
        co.organizacion_id,
        co.nombre_comercial,
        co.email_corporativo,
        co.telefono,
        co.calle,
        co.numero_exterior,
        co.numero_interior,
        co.colonia,
        co.ciudad,
        co.estado,
        co.codigo_postal,
        co.pais,
        co.regimen_fiscal,
        co.activa,
        co.fecha_creacion,
        co.fecha_actualizacion,
        co.csd_cer_hash,
        co.csd_key_hash,
        COALESCE(co.facturapi_key, o.apikeyfacturaapi) as facturapi_key,
        o.RazonSocial,
        o.RFC,
        r.Codigo as regimen_codigo,
        r.Descripcion as regimen_descripcion
      FROM configuracion_organizacion co
      INNER JOIN Organizaciones o ON co.organizacion_id = o.Id
      LEFT JOIN Regimen r ON co.regimen_fiscal = r.ID_Regimen
      WHERE co.organizacion_id = $1
    `;

    const configResult = await pool.query(configQuery, [organizacionId]);

    // Obtener configuración de cobranza
    const cobranzaQuery = `
      SELECT
        DiasGracia,
        EscalamientoDias,
        EnvioAutomaticoRecordatorios,
        DiasRecordatorioPrevio
      FROM ConfiguracionCobranza
      WHERE OrganizacionId = $1
    `;

    const cobranzaResult = await pool.query(cobranzaQuery, [organizacionId]);

    let configuracion = null;
    let configCobranza = null;

    if (configResult.rows.length > 0) {
      const config = configResult.rows[0];
      configuracion = {
        id: config.id,
        organizacionId: config.organizacion_id,
        razonSocial: config.RazonSocial,
        rfc: config.RFC,
        nombreComercial: config.nombre_comercial,
        emailCorporativo: config.email_corporativo,
        telefono: config.telefono,
        direccion: {
          calle: config.calle,
          numeroExterior: config.numero_exterior,
          numeroInterior: config.numero_interior,
          colonia: config.colonia,
          ciudad: config.ciudad,
          estado: config.estado,
          codigoPostal: config.codigo_postal,
          pais: config.pais || 'México'
        },
        datosFiscales: {
          regimenFiscal: config.regimen_fiscal,
          regimenCodigo: config.regimen_codigo,
          regimenDescripcion: config.regimen_descripcion
        },
        activa: config.activa,
        fechaCreacion: config.fecha_creacion,
        fechaActualizacion: config.fecha_actualizacion,
        tieneCertificados: !!(config.csd_cer_hash && config.csd_key_hash),
        tieneApiKeyFacturapi: !!config.facturapi_key
      };
    }

    if (cobranzaResult.rows.length > 0) {
      const cobranza = cobranzaResult.rows[0];
      let escalonamiento = {};

      // Parsear escalamiento si existe
      if (cobranza.EscalamientoDias) {
        try {
          escalonamiento = JSON.parse(cobranza.EscalamientoDias);
        } catch (e) {
          console.error('Error parseando escalamiento:', e);
          escalonamiento = {
            primer_recordatorio: 7,
            segundo_recordatorio: 15,
            gestion_telefonica: 30,
            proceso_legal: 90
          };
        }
      } else {
        escalonamiento = {
          primer_recordatorio: 7,
          segundo_recordatorio: 15,
          gestion_telefonica: 30,
          proceso_legal: 90
        };
      }

      configCobranza = {
        diasGracia: cobranza.DiasGracia || 3,
        escalonamiento,
        envioAutomaticoRecordatorios: cobranza.EnvioAutomaticoRecordatorios || false,
        diasRecordatorioPrevio: cobranza.DiasRecordatorioPrevio || 3,
        horariosEnvio: {
          horaInicio: '09:00',
          horaFin: '18:00',
          diasSemana: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes']
        }
      };
    }

    return json({
      success: true,
      configuracion,
      configCobranza,
      exists: configuracion !== null
    });

  } catch (error) {
    console.error('Error obteniendo configuración de organización:', error);
    return json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
};

export const POST: RequestHandler = async (event) => {
  try {
    const organizacionId = parseInt(event.params.id);
    const data = await event.request.json();

    if (!organizacionId || isNaN(organizacionId)) {
      return json({ success: false, error: 'ID de organización inválido' }, { status: 400 });
    }

    // Validar acceso a la organización
    const auth = await validateOrganizationAccess(event, organizacionId);
    if (!auth.valid) return auth.error!;

    const pool = await getConnection();

    // Verificar si ya existe configuración
    const existeResult = await pool.query(
      'SELECT id FROM configuracion_organizacion WHERE organizacion_id = $1',
      [organizacionId]
    );

    const ahora = new Date();

    // Primero actualizar la tabla Organizaciones si se proporcionan los datos
    if (data.razonSocial || data.rfc || data.emailCorporativo || data.nombreComercial) {
      await pool.query(
        `UPDATE Organizaciones SET
          RazonSocial = COALESCE($1, RazonSocial),
          RFC = COALESCE($2, RFC),
          CorreoElectronico = COALESCE($3, CorreoElectronico),
          Nombre = COALESCE($4, Nombre),
          UpdatedAt = $5
        WHERE Id = $6`,
        [
          data.razonSocial || null,
          data.rfc || null,
          data.emailCorporativo || null,
          data.nombreComercial || null,
          ahora,
          organizacionId
        ]
      );
    }

    if (existeResult.rows.length > 0) {
      // Actualizar configuración existente
      await pool.query(
        `UPDATE configuracion_organizacion SET
          nombre_comercial = $1,
          email_corporativo = $2,
          telefono = $3,
          calle = $4,
          numero_exterior = $5,
          numero_interior = $6,
          colonia = $7,
          ciudad = $8,
          estado = $9,
          codigo_postal = $10,
          pais = $11,
          regimen_fiscal = $12,
          activa = $13,
          fecha_actualizacion = $14
        WHERE organizacion_id = $15`,
        [
          data.nombreComercial || null,
          data.emailCorporativo || null,
          data.telefono || null,
          data.direccion?.calle || null,
          data.direccion?.numeroExterior || null,
          data.direccion?.numeroInterior || null,
          data.direccion?.colonia || null,
          data.direccion?.ciudad || null,
          data.direccion?.estado || null,
          data.direccion?.codigoPostal || null,
          data.direccion?.pais || 'México',
          data.datosFiscales?.regimenFiscal || null,
          data.activa !== undefined ? data.activa : true,
          ahora,
          organizacionId
        ]
      );
    } else {
      // Crear nueva configuración
      await pool.query(
        `INSERT INTO configuracion_organizacion (
          organizacion_id, nombre_comercial, email_corporativo, telefono,
          calle, numero_exterior, numero_interior, colonia, ciudad, estado,
          codigo_postal, pais, regimen_fiscal, activa, fecha_creacion, fecha_actualizacion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          organizacionId,
          data.nombreComercial || null,
          data.emailCorporativo || null,
          data.telefono || null,
          data.direccion?.calle || null,
          data.direccion?.numeroExterior || null,
          data.direccion?.numeroInterior || null,
          data.direccion?.colonia || null,
          data.direccion?.ciudad || null,
          data.direccion?.estado || null,
          data.direccion?.codigoPostal || null,
          data.direccion?.pais || 'México',
          data.datosFiscales?.regimenFiscal || null,
          data.activa !== undefined ? data.activa : true,
          ahora,
          ahora
        ]
      );
    }

    // Actualizar o crear configuración de cobranza si se proporciona
    if (data.configCobranza) {
      const cobranzaExisteResult = await pool.query(
        'SELECT Id FROM ConfiguracionCobranza WHERE OrganizacionId = $1',
        [organizacionId]
      );

      const escalonamientoJson = JSON.stringify(data.configCobranza.escalonamiento || {
        primer_recordatorio: 7,
        segundo_recordatorio: 15,
        gestion_telefonica: 30,
        proceso_legal: 90
      });

      if (cobranzaExisteResult.rows.length > 0) {
        await pool.query(
          `UPDATE ConfiguracionCobranza SET
            DiasGracia = $1,
            EscalamientoDias = $2,
            EnvioAutomaticoRecordatorios = $3,
            DiasRecordatorioPrevio = $4
          WHERE OrganizacionId = $5`,
          [
            data.configCobranza.diasGracia || 3,
            escalonamientoJson,
            data.configCobranza.envioAutomaticoRecordatorios || false,
            data.configCobranza.diasRecordatorioPrevio || 3,
            organizacionId
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO ConfiguracionCobranza (
            OrganizacionId, DiasGracia, EscalamientoDias,
            EnvioAutomaticoRecordatorios, DiasRecordatorioPrevio
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            organizacionId,
            data.configCobranza.diasGracia || 3,
            escalonamientoJson,
            data.configCobranza.envioAutomaticoRecordatorios || false,
            data.configCobranza.diasRecordatorioPrevio || 3
          ]
        );
      }
    }

    return json({
      success: true,
      message: 'Configuración guardada exitosamente'
    });

  } catch (error) {
    console.error('Error guardando configuración de organización:', error);
    return json({
      success: false,
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
};