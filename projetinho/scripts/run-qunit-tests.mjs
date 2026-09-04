import puppeteer from "puppeteer";

const BASE = "http://localhost:8080";
const SUITES = [
	{ name: "Unitários", url: `${BASE}/test/unit/unitTests.qunit.html` },
	{ name: "Integração (OPA)", url: `${BASE}/test/integration/opaTests.qunit.html` }
];

async function runSuite(page, suite) {
	const errors = [];

	page.on("pageerror", (err) => errors.push(`PAGE ERROR: ${err.message}`));
	page.on("console", (msg) => {
		if (msg.type() === "error") {
			errors.push(`CONSOLE: ${msg.text()}`);
		}
	});

	await page.goto(suite.url, { waitUntil: "networkidle0", timeout: 120000 });

	await page.waitForFunction(() => {
		const el = document.querySelector("#qunit-testresult");
		return window.QUnit && el && /passed|failed/.test(el.textContent);
	}, { timeout: 120000 });

	const result = await page.evaluate(() => {
		const summary = document.querySelector("#qunit-testresult")?.textContent?.trim() || "";
		const failedTests = Array.from(document.querySelectorAll("#qunit-tests > li.failed")).map((li) => {
			const name = li.querySelector(".test-name")?.textContent?.trim() || "sem nome";
			const message = li.querySelector(".test-message")?.textContent?.trim() || "";
			return `${name}${message ? ` — ${message}` : ""}`;
		});
		const passedTests = Array.from(document.querySelectorAll("#qunit-tests > li.pass")).map((li) => {
			return li.querySelector(".test-name")?.textContent?.trim() || "sem nome";
		});
		const match = summary.match(/(\d+)\s+tests?\s+completed\s+in.*?,\s+with\s+(\d+)\s+failed/i)
			|| summary.match(/(\d+)\s+tests?\s+completed.*?(\d+)\s+failed/i);
		const total = match ? Number(match[1]) : passedTests.length + failedTests.length;
		const failed = match ? Number(match[2]) : failedTests.length;

		return { summary, total, failed, failedTests, passedTests };
	});

	return { ...suite, ...result, errors };
}

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();

let exitCode = 0;
const reports = [];

for (const suite of SUITES) {
	try {
		const report = await runSuite(page, suite);
		reports.push(report);
		if (report.failed > 0) {
			exitCode = 1;
		}
	} catch (err) {
		reports.push({ ...suite, error: err.message, total: 0, failed: 1, failedTests: [err.message], passedTests: [] });
		exitCode = 1;
	}
}

await browser.close();

for (const report of reports) {
	console.log(`\n=== ${report.name} ===`);
	if (report.error) {
		console.log(`ERRO: ${report.error}`);
		continue;
	}
	console.log(report.summary || "Sem resumo");
	console.log(`Total: ${report.total} | Falhas: ${report.failed} | Sucesso: ${report.total - report.failed}`);
	if (report.failedTests.length) {
		console.log("Falharam:");
		report.failedTests.forEach((t) => console.log(`  - ${t}`));
	}
	if (report.errors?.length) {
		console.log("Erros de página/console:");
		report.errors.slice(0, 5).forEach((e) => console.log(`  - ${e}`));
	}
}

process.exit(exitCode);
