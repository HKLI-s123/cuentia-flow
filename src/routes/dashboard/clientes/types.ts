// ========================================
// INTERFACES Y TIPOS
// ========================================

export interface Regimen {
	ID_Regimen: number;
	Codigo: string;
	Descripcion: string;
}

export interface Pais {
	ID: number;
	NombrePais: string;
}

export interface Estado {
	ID: number;
	ClaveEstado: string;
	NombreEstado: string;
	PaisID: number;
}

export interface Agente {
	value: number;
	text: string;
}

export type Cliente = {
	id: number;
	agente: string;
	cliente: string;
	razonSocial: string;
	rfc: string;
	condiciones: string;
	cuentasMXN: number;
	cuentasUSD: number;
};

export interface ClienteFormData {
	nombreComercial: string;
	razonSocial: string;
	rfc: string;
	regimen: string;
	condicionesPago: string;
	correoPrincipal: string;
	paisSeleccionado: number | null;
	estadoSeleccionado: number | null;
	codigoPais: string;
	telefono: string;
	calle: string;
	numExterior: string;
	numInterior: string;
	codigoPostal: string;
	colonia: string;
	ciudad: string;
	agenteSeleccionado: number | null;
	cuentasMXN: number | null;
	cuentasUSD: number | null;
}

export interface ClienteAPI {
	Id: number;
	NombreComercial: string | null;
	RazonSocial: string | null;
	RFC: string | null;
	RegimenFiscal: string | null;
	RegimenFiscalId?: number | null;
	CondicionesPago: string | null;
	CorreoPrincipal: string | null;
	Pais: string | null;
	PaisId?: number | null;
	CodigoPais: string | null;
	Telefono: string | null;
	Estado: string | null;
	EstadoId?: number | null;
	Calle: string | null;
	NumeroExterior: string | null;
	NumeroInterior: string | null;
	CodigoPostal: string | null;
	Colonia: string | null;
	Ciudad: string | null;
	AgenteDeCobranza: string | null;
	CuentasMXN?: string;
	CuentasUSD?: string;
}

export interface ValidationErrors {
	[key: string]: string;
}