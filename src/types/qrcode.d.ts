declare module 'qrcode' {
	export function toDataURL(
		text: string,
		options?: {
			errorCorrectionLevel?: 'low' | 'medium' | 'quartile' | 'high';
			type?: string;
			quality?: number;
			margin?: number;
			width?: number;
			color?: {
				dark?: string;
				light?: string;
			};
		}
	): Promise<string>;

	export function toCanvas(
		canvas: HTMLCanvasElement,
		text: string,
		options?: any
	): Promise<void>;

	export function toString(
		text: string,
		options?: any
	): Promise<string>;
}
