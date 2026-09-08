export interface IDataProtector {
	protect(plaintext: string): string;
	unprotect(protectedValue: string): string;
	isProtected(value: string): boolean;
}
