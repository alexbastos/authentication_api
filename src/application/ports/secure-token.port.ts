export interface ISecureTokenService {
	generate(bytes?: number): string;
	digest(value: string): string;
	verifyPkceS256(verifier: string, challenge: string): boolean;
}
