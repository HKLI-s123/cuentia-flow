export type PlanLimits = {
	maxOrganizaciones: number;
	maxFacturasMes: number;
	maxClientes: number;
	whatsapp: boolean;
	agenteIA: boolean;
	complementoAutomatico: boolean;
	email: boolean;
	api: boolean;
	recurrencia: boolean;
};

export const PLAN_LIMITS: Record<string, PlanLimits> = {
	free: {
		maxOrganizaciones: 1,
		maxFacturasMes: 3,
		maxClientes: 5,
		whatsapp: false,
		agenteIA: false,
		complementoAutomatico: false,
		email: false,
		api: false,
		recurrencia: false
	},
	basico: {
		maxOrganizaciones: 1,
		maxFacturasMes: 50,
		maxClientes: 50,
		whatsapp: true,
		agenteIA: true,
		complementoAutomatico: true,
		email: true,
		api: false,
		recurrencia: true
	},
	pro: {
		maxOrganizaciones: 3,
		maxFacturasMes: 200,
		maxClientes: 200,
		whatsapp: true,
		agenteIA: true,
		complementoAutomatico: true,
		email: true,
		api: false,
		recurrencia: true
	},
	enterprise: {
		maxOrganizaciones: 999999,
		maxFacturasMes: 999999,
		maxClientes: 999999,
		whatsapp: true,
		agenteIA: true,
		complementoAutomatico: true,
		email: true,
		api: true,
		recurrencia: true
	}
};