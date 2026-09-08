export interface IWebhookUrlValidator {
	assertAllowed(url: string): Promise<void>;
}
