"""
Rootline UI Compatibility Test Script
Runs layout audits at each viewport size by controlling the browser window
and checking computed CSS overflow and layout issues using Playwright.

Viewports tested:
  Desktop:  1920x1080, 1440x900, 1366x768
  Tablet:   1024x768, 768x1024
  Mobile:   430x932, 390x844, 375x667
"""
from playwright.sync_api import sync_playwright
import json, time, os

BASE_URL = "http://localhost:5173"
EMAIL = "rootline.seed@example.com"
PASSWORD = "seed-password-123"

VIEWPORTS = [
    {"name": "Desktop-1920x1080",  "width": 1920, "height": 1080},
    {"name": "Desktop-1440x900",   "width": 1440, "height": 900},
    {"name": "Desktop-1366x768",   "width": 1366, "height": 768},
    {"name": "Tablet-1024x768",    "width": 1024, "height": 768},
    {"name": "Tablet-768x1024",    "width": 768,  "height": 1024},
    {"name": "Mobile-430x932",     "width": 430,  "height": 932},
    {"name": "Mobile-390x844",     "width": 390,  "height": 844},
    {"name": "Mobile-375x667",     "width": 375,  "height": 667},
]

PAGES = [
    {"name": "Login",       "path": "/login"},
    {"name": "Register",    "path": "/register"},
    {"name": "Dashboard",   "path": "/dashboard"},
    {"name": "People",      "path": "/people"},
    {"name": "Tree",        "path": "/tree"},
]

SCREENSHOT_DIR = "docs/testing/ui_compat_screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def check_overflow(page):
    """Returns True if page body has unexpected horizontal scroll."""
    return page.evaluate("""() => {
        const body = document.body;
        const html = document.documentElement;
        return {
            bodyScrollW: body.scrollWidth,
            bodyClientW: body.clientWidth,
            htmlScrollW: html.scrollWidth,
            htmlClientW: html.clientWidth,
            hasHorizOverflow: html.scrollWidth > html.clientWidth + 2
        };
    }""")

def check_clipped_elements(page):
    """Check if any focusable elements are outside the viewport."""
    return page.evaluate("""() => {
        const vw = window.innerWidth;
        const issues = [];
        const els = document.querySelectorAll('button, a, input, select, textarea, [role="button"]');
        els.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) {
                if (r.right > vw + 5) {
                    issues.push({
                        tag: el.tagName,
                        text: (el.textContent || el.placeholder || el.type || '').trim().slice(0, 40),
                        right: Math.round(r.right),
                        vw: vw
                    });
                }
            }
        });
        return issues;
    }""")

def nav_visible(page):
    """Check if nav links are visible (not hidden by CSS)."""
    return page.evaluate("""() => {
        const nav = document.querySelector('nav');
        if (!nav) return null;
        const style = window.getComputedStyle(nav);
        return { display: style.display, visibility: style.visibility };
    }""")

def check_text_overflow_elements(page):
    """Check if any visible text is wider than its container."""
    return page.evaluate("""() => {
        const issues = [];
        const els = document.querySelectorAll('p, h1, h2, h3, span, label, button');
        els.forEach(el => {
            if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
                const text = el.textContent?.trim().slice(0, 50);
                if (text) issues.push({ tag: el.tagName, text, scrollW: el.scrollWidth, clientW: el.clientWidth });
            }
        });
        return issues.slice(0, 10);
    }""")

results = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # First login to get session cookie
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.goto(f"{BASE_URL}/login")
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_url("**/dashboard", timeout=10000)
    cookies = context.cookies()
    context.close()

    for vp in VIEWPORTS:
        context = browser.new_context(
            viewport={"width": vp["width"], "height": vp["height"]}
        )
        context.add_cookies(cookies)
        page = context.new_page()

        vp_result = {
            "viewport": vp["name"],
            "width": vp["width"],
            "height": vp["height"],
            "pages": []
        }

        for pg_info in PAGES:
            page.set_viewport_size({"width": vp["width"], "height": vp["height"]})
            try:
                page.goto(f"{BASE_URL}{pg_info['path']}", timeout=15000)
                page.wait_for_load_state("networkidle", timeout=8000)
                time.sleep(0.5)

                overflow = check_overflow(page)
                clipped = check_clipped_elements(page)
                nav = nav_visible(page)
                text_overflow = check_text_overflow_elements(page)

                screenshot_name = f"{SCREENSHOT_DIR}/{vp['name']}_{pg_info['name']}.png"
                page.screenshot(path=screenshot_name, full_page=False)

                page_result = {
                    "page": pg_info["name"],
                    "url": pg_info["path"],
                    "overflow": overflow,
                    "clipped_elements": clipped,
                    "nav": nav,
                    "text_overflow_issues": text_overflow,
                    "screenshot": screenshot_name,
                    "status": "PASS" if not overflow.get("hasHorizOverflow") and not clipped else "FAIL"
                }
                vp_result["pages"].append(page_result)
                print(f"[{vp['name']}] {pg_info['name']}: {'PASS' if page_result['status']=='PASS' else 'FAIL'} | HorizOverflow={overflow.get('hasHorizOverflow')} | Clipped={len(clipped)}")

            except Exception as e:
                vp_result["pages"].append({
                    "page": pg_info["name"],
                    "url": pg_info["path"],
                    "error": str(e),
                    "status": "ERROR"
                })
                print(f"[{vp['name']}] {pg_info['name']}: ERROR - {e}")

        results.append(vp_result)
        context.close()

    browser.close()

with open("docs/testing/ui_compat_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\nSaved to docs/testing/ui_compat_results.json")
