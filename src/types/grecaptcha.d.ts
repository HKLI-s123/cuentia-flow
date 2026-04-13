/**
 * Tipos para Google reCAPTCHA v3
 */

declare global {
	interface Window {
		grecaptcha: {
			execute(siteKey: string, options: { action: string }): Promise<string>;
			render(
				containerId: string,
				options: {
					sitekey: string;
					callback?: (token: string) => void;
					'expired-callback'?: () => void;
					'error-callback'?: () => void;
				}
			): void;
			ready(callback: () => void): void;
		};
	}
}

export {};
