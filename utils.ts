import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import type { Browser, Page } from "playwright";
import type { LimitFunction } from "./limiter";
import { ICLIArguments } from './scrape_pdf';

export type UrlSet = Set<string>;
export type ProcessQueue = Record<string, Promise<void>>;

// https://github.com/microsoft/playwright/blob/591e4ea9763bb1a81ecf289cc497292917f506ee/packages/playwright-core/src/server/page.ts#L414
type Media = undefined | null | "screen" | "print";
type ColorScheme = undefined | null | "light" | "dark" | "no-preference"

export const OUTPUT_DIR = "./output";

// Human-like random delay function
const randomDelay = (min: number = 1000, max: number = 3000): number => {
    return Math.floor(Math.random() * (max - min)) + min;
}

// User agents pool for rotation
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
];

const visitPage = async (rootUrl: string, browser: Browser, url: string, verbose: boolean, dryRun: boolean, withHeader: boolean, media: string, colorScheme: string, retryCount: number = 0) => {
    // Progressive stealth based on retry count
    const stealthLevel = Math.min(retryCount, 2); // 0=normal, 1=enhanced, 2=maximum
    
    // Create new context with progressive stealth measures
    const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
    const baseContext = {
        userAgent: userAgent,
        viewport: { width: 1366 + Math.floor(Math.random() * 200), height: 768 + Math.floor(Math.random() * 200) },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'DNT': '1',
            'Connection': 'keep-alive'
        }
    };
    
    // Enhanced stealth for higher retry counts
    if (stealthLevel >= 1) {
        Object.assign(baseContext.extraHTTPHeaders, {
            'X-Forwarded-For': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
            'X-Real-IP': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        });
    }
    
    const context = await browser.newContext(baseContext);

    const page = await context.newPage();

    // Additional stealth measures to avoid bot detection
    await page.addInitScript(() => {
        // Remove webdriver property
        delete (navigator as any).webdriver;
        
        // Override the plugins property to make it seem normal
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5]
        });
        
        // Override the languages property
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en', 'es']
        });
        
        // Mock chrome runtime
        Object.defineProperty(window, 'chrome', {
            get: () => ({
                runtime: {},
                loadTimes: () => ({}),
                csi: () => ({}),
                app: {}
            })
        });
        
        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => (
            parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission } as any) :
            originalQuery(parameters)
        );
    });

    // Random delay before navigation
    await page.waitForTimeout(randomDelay(500, 1500));

    // Try multiple loading strategies for better reliability
    try {
        // First try domcontentloaded (recommended for scraping) with increased timeout
        await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 // 60 seconds
        });
        
        // Simulate human behavior with random mouse movements
        await page.mouse.move(Math.random() * 200, Math.random() * 200);
        
        // Random scroll to simulate reading behavior
        await page.evaluate(() => {
            window.scrollBy(0, Math.random() * 300);
        });
        
        // Wait for content to actually load and check for placeholder text
        await page.waitForTimeout(randomDelay(2000, 4000));
        
        // Check if we're getting placeholder content or other bot detection indicators
        const bodyText = await page.textContent('body');
        const isBotDetected = bodyText && (
            bodyText.includes('word word word') || 
            bodyText.includes('Access denied') ||
            bodyText.includes('Please enable JavaScript') ||
            bodyText.includes('Checking your browser') ||
            bodyText.includes('Just a moment') ||
            bodyText.length < 500 // Suspiciously short content
        );
        
        if (isBotDetected && retryCount < 2) {
            const attemptNumber = retryCount + 1;
            console.log(chalk.yellow(`🤖 Bot detection detected for ${url} - Auto-bypass attempt ${attemptNumber}/2...`));
            
            // Apply progressive bypass strategies
            if (retryCount === 0) {
                // First attempt: Enhanced stealth with human simulation
                await page.reload({ waitUntil: 'networkidle' });
                await page.waitForTimeout(randomDelay(3000, 5000));
                
                // Simulate human-like interactions
                await page.mouse.move(200 + Math.random() * 100, 300 + Math.random() * 100);
                await page.mouse.click(200 + Math.random() * 100, 300 + Math.random() * 100);
                await page.keyboard.press('Tab');
                await page.waitForTimeout(randomDelay(1000, 2000));
                
                // Natural scrolling pattern
                await page.evaluate(() => {
                    const scrollSteps = [100, 200, 150, 0];
                    scrollSteps.forEach((scroll, i) => {
                        setTimeout(() => window.scrollTo(0, scroll), i * 500);
                    });
                });
                
                await page.waitForTimeout(3000);
            } else {
                // Second attempt: More aggressive anti-detection
                await page.waitForTimeout(randomDelay(5000, 8000));
                
                // Multiple reload attempts with randomized behavior
                for (let i = 0; i < 2; i++) {
                    await page.reload({ waitUntil: 'domcontentloaded' });
                    await page.waitForTimeout(randomDelay(2000, 4000));
                    
                    // Randomized human-like behavior
                    await page.mouse.move(Math.random() * 800, Math.random() * 600);
                    await page.evaluate(() => {
                        // Simulate reading behavior with pauses
                        const scrollY = Math.random() * 500;
                        window.scrollBy(0, scrollY);
                        setTimeout(() => window.scrollBy(0, -scrollY * 0.3), 1500);
                    });
                    await page.waitForTimeout(randomDelay(2000, 4000));
                }
            }
            
            // Check if bypass worked
            const newBodyText = await page.textContent('body');
            const stillDetected = newBodyText && (
                newBodyText.includes('word word word') || 
                newBodyText.includes('Access denied') ||
                newBodyText.includes('Please enable JavaScript') ||
                newBodyText.includes('Checking your browser') ||
                newBodyText.includes('Just a moment') ||
                newBodyText.length < 500
            );
            
            if (stillDetected) {
                console.log(chalk.yellow(`🔄 Auto-bypass ${attemptNumber} failed, trying enhanced stealth...`));
                await page.close();
                await context.close();
                return await visitPage(rootUrl, browser, url, verbose, dryRun, withHeader, media, colorScheme, retryCount + 1);
            } else {
                console.log(chalk.green(`✅ Auto-bypass successful for ${url}`));
            }
        } else if (isBotDetected && retryCount >= 2) {
            console.log(chalk.red(`⚠️ Strong bot protection detected for ${url}. Content may be limited.`));
        }
    } catch (e) {
        console.log(chalk.yellow(`First attempt (domcontentloaded) failed for ${url}, trying fallback...`));
        try {
            // Fallback: Try with 'load' strategy
            await page.goto(url, { 
                waitUntil: 'load', 
                timeout: 90000 // 90 seconds for fallback
            });
            
            // Still simulate human behavior on fallback
            await page.mouse.move(Math.random() * 200, Math.random() * 200);
            await page.waitForTimeout(randomDelay(1000, 2000));
        } catch (fallbackError) {
            console.log(chalk.red(`Error navigating to ${url}:\nFirst attempt: ${e}\nFallback attempt: ${fallbackError}`));
            await page.close();
            await context.close();
            return [];
        }
    }

    const newUrls = await getCleanUrlsFromPage(rootUrl, page);

    if (!dryRun) {
        await savePdfFile(page, url, verbose, withHeader, media, colorScheme);
    }

    await page.close();
    await context.close();

    // Remove duplicates
    return new Set(newUrls).keys();
}

const IGNORE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".svg", ".css", ".js", ".ico", ".xml", ".json", ".txt", ".md", ".pdf", ".zip"];
const getCleanUrlsFromPage = async (rootUrl: string, page: Page) => {
    const allHrefElements = await page.locator('[href]').all();
    const hrefs: string[] = [];
    await Promise.all(
        allHrefElements.map(async locator => {
            const href = await locator.getAttribute('href');
            href && hrefs.push(href.split('#')[0]);
        })
    );

    // Clean up URLs with inconsistent slashes
    // TODO: Refactor URL parsing and filtering to more easily handle file extensions, external URLs, etc.
    const baseUrl = new URL(rootUrl).origin;
    return hrefs.reduce((acc: string[], href) => {
        let url: string;
        if (href.startsWith("/")) {
            url = new URL(href.trim(), baseUrl).href
        } else if (href.startsWith("http")) {
            url = href.trim();
        } else {
            return acc;
        }

        // Remove empty URLs
        if (url === "" || url === "/") {
            return acc;
        }

        // Remove URLs that aren't HTML pages
        if (IGNORE_EXTENSIONS.includes(path.extname(url))) {
            return acc;
        }
        // const validExtensions = [".html", ".htm"];
        // for (const extension of validExtensions) {
        //     if (!url.endsWith(extension)) {
        //         console.log(`Ignoring URL because it's an invalid extension: ${url}`);
        //         return false;
        //     }
        // }

        // Only include URLs that are on the same domain
        if (!url.startsWith("http") || url.startsWith(rootUrl)) {
            acc.push(url);
        }
        return acc;
    }, []);
}

const savePdfFile = async (page: Page, url: string, verbose: boolean, withHeader: boolean, media: string, colorScheme: string) => {
    const lastSlashIndex = nthIndexOf(url, "/", 3);

    let pageTitle = await page.title()
    pageTitle = pageTitle.replace(/[^a-zA-Z0-9_]/g, "_");
    pageTitle = pageTitle.replace(/_{2,}/g, "_");

    let safeUrl = url.slice(lastSlashIndex + 1);
    safeUrl = safeUrl.replace(/[^a-zA-Z0-9_]/g, "_");
    safeUrl = safeUrl.replace(/_{2,}/g, "_");

    const fileName = `${pageTitle}_${safeUrl}.pdf`;

    // Extract domain from URL and create domain-specific folder
    const urlObj = new URL(url);
    const hostnameParts = urlObj.hostname.replace('www.', '').split('.');
    // Get the main domain name (second-to-last part for most domains)
    const domain = hostnameParts.length >= 2 ? hostnameParts[hostnameParts.length - 2] : hostnameParts[0];
    const domainDir = `${OUTPUT_DIR}/${domain}`;
    
    // Create domain directory if it doesn't exist
    try {
        await fs.stat(domainDir);
    } catch (err) {
        await fs.mkdir(domainDir, { recursive: true });
    }

    const pdfPath = `${domainDir}/${fileName}`;

    // https://playwright.dev/docs/api/class-page#page-emulate-media
    await page.emulateMedia({ media: media as Media, colorScheme: colorScheme as ColorScheme });

    // TODO: Headers are kinda broken, figure out CSS and page margin
    const headerTemplate = `
    <span style="font-size: 10px" class="date"></span>
    <span style="font-size: 10px"> | </span>
    <span style="font-size: 10px" class="title"></span>
    `
    const footerTemplate = `
    <span style="font-size: 10px" class="url"></span>
    <span style="font-size: 10px"> | </span>
    <span style="font-size: 10px" class="pageNumber"></span>
    <span style="font-size: 10px">/</span>
    <span style="font-size: 10px" class="totalPages"></span>
    `

    // https://playwright.dev/docs/api/class-page#page-pdf
    try {
        await page.pdf({ path: `${pdfPath}`, displayHeaderFooter: withHeader, headerTemplate, footerTemplate});
        if(verbose) {
            console.log(chalk.cyan(`PDF: ${pdfPath}`));
        }
    } catch (e) {
        console.log(chalk.red(`Error saving PDF: ${pdfPath}\n${e}`));
    }
}

const nthIndexOf = (string: string, char: string, nth: number, fromIndex: number = 0): number => {
    let indexChar = string.indexOf(char, fromIndex);
    if (indexChar === -1) {
        return -1;
    } else if (nth === 1) {
        return indexChar;
    } else {
        return nthIndexOf(string, char, nth - 1, indexChar + 1);
    }
}

export const processUrl = async (
    browser: Browser,
    rootUrl: string,
    url: string,
    visitedUrls: UrlSet,
    processQueue: ProcessQueue,
    args: Omit<ICLIArguments, 'rootUrl'>,
    limit: LimitFunction,
) => {
    if (visitedUrls.has(url)) {
        return;
    }
    if (args.verbose) {
        console.log(chalk.green(`URL: ${url}`), chalk.cyan(`(visited: ${visitedUrls.size}, remaining: ${Object.keys(processQueue).length})`));
    } else {
        console.log(chalk.green(`URL: ${url}`));
    }
    visitedUrls.add(url);
    const newUrls = await visitPage(rootUrl, browser, url, args.verbose, args.dryRun, args.withHeader, args.media, args.colorScheme);
    for (const nextUrl of newUrls) {
        if (!visitedUrls.has(nextUrl)) {
            processQueue[nextUrl] = limit(() => processUrl(browser, rootUrl, nextUrl, visitedUrls, processQueue, args, limit));
        }
    };
    
    delete processQueue[url];
};
