import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';

export const GET: RequestHandler = async ({ params }) => {
  try {
    const organizacionId = parseInt(params.id);

    if (!organizacionId || isNaN(organizacionId)) {
      return json({ success: false, error: 'ID de organización inválido' }, { status: 400 });
    }

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
        o.RazonSocial,
        o.RFC,
        r.Codigo as regimen_codigo,
        r.Descripcion as regimen_descripcion
      FROM configuracion_organizacion co
      INNER JOIN Organizaciones o ON co.organizacion_id = o.Id
      LEFT JOIN Regimen r ON co.regimen_fiscal = r.ID_Regimen
      WHERE co.organizacion_id = ?
    `;

    const configResult = await db.query(configQuery, [organizacionId]);

    // Obtener configuración de cobranza
    const cobranzaQuery = `
      SELECT
        DiasGracia,
        EscalamientoDias,
        EnvioAutomaticoRecordatorios,
        DiasRecordatorioPrevio
      FROM ConfiguracionCobranza
      WHERE OrganizacionId = ?
    `;

    const cobranzaResult = await db.query(cobranzaQuery, [organizacionId]);

    let configuracion = null;
    let configCobranza = null;

    if (configResult.length > 0) {
      const config = configResult[0];
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
        fechaActualizacion: config.fecha_actualizacion
      };
    }

    if (cobranzaResult.length > 0) {
      const cobranza = cobranzaResult[0];
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
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const organizacionId = parseInt(params.id);
    const data = await request.json();

    if (!organizacionId || isNaN(organizacionId)) {
      return json({ success: false, error: 'ID de organización inválido' }, { status: 400 });
    }

    // Verificar si ya existe configuración
    const existeQuery = `
      SELECT id FROM configuracion_organizacion WHERE organizacion_id = ?
    `;
    const existeResult = await db.query(existeQuery, [organizacionId]);

    const ahora = new Date();

    // Primero actualizar la tabla Organizaciones si se proporcionan los datos
    if (data.razonSocial || data.rfc || data.emailCorporativo || data.nombreComercial) {
      const updateOrgQuery = `
        UPDATE Organizaciones SET
          RazonSocial = COALESCE(?, RazonSocial),
          RFC = COALESCE(?, RFC),
          CorreoElectronico = COALESCE(?, CorreoElectronico),
          Nombre = COALESCE(?, Nombre),
          UpdatedAt = ?
        WHERE Id = ?
      `;

      await db.query(updateOrgQuery, [
        data.razonSocial || null,
        data.rfc || null,
        data.emailCorporativo || null,
        data.nombreComercial || null,
        ahora,
        organizacionId
      ]);
    }

    if (existeResult.length > 0) {
      // Actualizar configuración existente
      const updateQuery = `
        UPDATE configuracion_organizacion SET
          nombre_comercial = ?,
          email_corporativo = ?,
          telefono = ?,
          calle = ?,
          numero_exterior = ?,
          numero_interior = ?,
          colonia = ?,
          ciudad = ?,
          estado = ?,
          codigo_postal = ?,
          pais = ?,
          regimen_fiscal = ?,
          activa = ?,
          fecha_actualizacion = ?
        WHERE organizacion_id = ?
      `;

      await db.query(updateQuery, [
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
      ]);
    } else {
      // Crear nueva configuración
      const insertQuery = `
        INSERT INTO configuracion_organizacion (
          organizacion_id, nombre_comercial, email_corporativo, telefono,
          calle, numero_exterior, numero_interior, colonia, ciudad, estado,
          codigo_postal, pais, regimen_fiscal, activa, fecha_creacion, fecha_actualizacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await db.query(insertQuery, [
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
      ]);
    }

    // Actualizar o crear configuración de cobranza si se proporciona
    if (data.configCobranza) {
      const cobranzaExisteQuery = `
        SELECT Id FROM ConfiguracionCobranza WHERE OrganizacionId = ?
      `;
      const cobranzaExisteResult = await db.query(cobranzaExisteQuery, [organizacionId]);

      const escalonamientoJson = JSON.stringify(data.configCobranza.escalonamiento || {
        primer_recordatorio: 7,
        segundo_recordatorio: 15,
        gestion_telefonica: 30,
        proceso_legal: 90
      });

      if (cobranzaExisteResult.length > 0) {
        // Actualizar configuración de cobranza existente
        const updateCobranzaQuery = `
          UPDATE ConfiguracionCobranza SET
            DiasGracia = ?,
            EscalamientoDias = ?,
            EnvioAutomaticoRecordatorios = ?,
            DiasRecordatorioPrevio = ?
          WHERE OrganizacionId = ?
        `;

        await db.query(updateCobranzaQuery, [
          data.configCobranza.diasGracia || 3,
          escalonamientoJson,
          data.configCobranza.envioAutomaticoRecordatorios || false,
          data.configCobranza.diasRecordatorioPrevio || 3,
          organizacionId
        ]);
      } else {
        // Crear nueva configuración de cobranza
        const insertCobranzaQuery = `
          INSERT INTO ConfiguracionCobranza (
            OrganizacionId, DiasGracia, EscalamientoDias,
            EnvioAutomaticoRecordatorios, DiasRecordatorioPrevio
          ) VALUES (?, ?, ?, ?, ?)
        `;

        await db.query(insertCobranzaQuery, [
          organizacionId,
          data.configCobranza.diasGracia || 3,
          escalonamientoJson,
          data.configCobranza.envioAutomaticoRecordatorios || false,
          data.configCobranza.diasRecordatorioPrevio || 3
        ]);
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
      error: 'Error interno del servidor',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 });
  }
};