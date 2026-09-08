import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const target = path.join(directory, entry.name);
			if (entry.isDirectory()) return sourceFiles(target);
			return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")
				? [target]
				: [];
		}),
	);
	return nested.flat();
}

async function forbiddenImports(
	layer: "domain" | "application",
	forbidden: RegExp[],
) {
	const root = path.resolve(process.cwd(), "src", layer);
	const files = await sourceFiles(root);
	const violations: string[] = [];
	for (const file of files) {
		const source = await readFile(file, "utf8");
		const declarations = source.matchAll(
			/\b(?:import|export)\s+(?:type\s+)?(?:[^;]*?\sfrom\s+)?["']([^"']+)["']/g,
		);
		for (const declaration of declarations) {
			const specifier = declaration[1];
			if (forbidden.some((pattern) => pattern.test(specifier))) {
				violations.push(`${path.relative(process.cwd(), file)}: ${specifier}`);
			}
		}
	}
	return violations;
}

describe("Clean Architecture dependency rule", () => {
	it("keeps domain independent from application and outer layers", async () => {
		await expect(
			forbiddenImports("domain", [
				/application(?:\/|$)/,
				/adapters(?:\/|$)/,
				/infrastructure(?:\/|$)/,
				/^(?:fastify|@prisma|ioredis|@aws-sdk)/,
			]),
		).resolves.toEqual([]);
	});

	it("keeps application independent from adapters and infrastructure", async () => {
		await expect(
			forbiddenImports("application", [
				/adapters(?:\/|$)/,
				/infrastructure(?:\/|$)/,
				/^(?:fastify|@prisma|ioredis|@aws-sdk)/,
			]),
		).resolves.toEqual([]);
	});

	it("keeps HTTP controllers from reaching repositories directly", async () => {
		const controllers = await sourceFiles(
			path.resolve(process.cwd(), "src/adapters/http/controllers"),
		);
		const violations: string[] = [];
		for (const file of controllers) {
			const source = await readFile(file, "utf8");
			if (/domain\/repositories\//.test(source)) {
				violations.push(path.relative(process.cwd(), file));
			}
		}
		expect(violations).toEqual([]);
	});
});
