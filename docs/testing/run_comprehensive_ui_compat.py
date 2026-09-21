import json
import os
import sys
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:5173"
EMAIL = "rootline.seed@example.com"
PASSWORD = "seed-password-123"

VIEWPORTS = [
    {"category": "Desktop", "name": "Desktop_1920x1080", "width": 1920, "height": 1080},
    {"category": "Desktop", "name": "Desktop_1440x900",  "width": 1440, "height": 900},
    {"category": "Desktop", "name": "Desktop_1366x768",  "width": 1366, "height": 768},
    {"category": "Tablet",  "name": "Tablet_1024x768",   "width": 1024, "height": 768},
    {"category": "Tablet",  "name": "Tablet_768x1024",   "width": 768,  "height": 1024},
    {"category": "Mobile",  "name": "Mobile_430x932",    "width": 430,  "height": 932},
    {"category": "Mobile",  "name": "Mobile_390x844",    "width": 390,  "height": 844},
    {"category": "Mobile",  "name": "Mobile_375x667",    "width": 375,  "height": 667},
]

SCREENSHOT_DIR = "docs/testing/ui_compat_screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def audit_layout(page):
    """Audits page for horizontal scrolling, clipping, and text overflow."""
    return page.evaluate("""() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const docEl = document.documentElement;
        const body = document.body;

        // Check horizontal overflow
        const docScrollW = docEl.scrollWidth;
        const docClientW = docEl.clientWidth;
        const bodyScrollW = body.scrollWidth;
        const hasHorizScroll = (docScrollW > docClientW + 3) || (bodyScrollW > docClientW + 3);

        // Find elements that overflow horizontally
        const clippedElements = [];
        const allInteractive = document.querySelectorAll('button, a, input, select, textarea, [role="button"], form, table, .card');
        allInteractive.forEach(el => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.right > vw + 4) {
                clippedElements.push({
                    tag: el.tagName,
                    text: (el.textContent || el.placeholder || el.value || '').trim().slice(0, 35),
                    right: Math.round(r.right),
                    overflowPx: Math.round(r.right - vw)
                });
            }
        });

        // Check text overflow
        const textOverflow = [];
        document.querySelectorAll('h1, h2, h3, p, span, label').forEach(el => {
            if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 4) {
                const txt = el.textContent?.trim().slice(0, 40);
                if (txt && !textOverflow.some(item => item.text === txt)) {
                    textOverflow.push({
                        tag: el.tagName,
                        text: txt,
                        scrollW: el.scrollWidth,
                        clientW: el.clientWidth
                    });
                }
            }
        });

        return {
            viewport: { width: vw, height: vh },
            hasHorizScroll,
            docScrollW,
            docClientW,
            clippedCount: clippedElements.length,
            clippedElements: clippedElements.slice(0, 10),
            textOverflowCount: textOverflow.length,
            textOverflow: textOverflow.slice(0, 10)
        };
    }""")

def login_user(page):
    page.goto(f"{BASE_URL}/login")
    page.wait_for_load_state("networkidle")
    page.fill('input[type="email"]', EMAIL)
    page.fill('input[type="password"]', PASSWORD)
    page.click('button[type="submit"]')
    page.wait_for_function("() => window.location.pathname.includes('/dashboard')", timeout=10000)
    page.wait_for_load_state("networkidle")
    time.sleep(0.5)

def run_all_tests():
    overall_results = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "viewports_tested": len(VIEWPORTS),
        "results": {},
        "summary": {
            "total_checks": 0,
            "passed_checks": 0,
            "failed_checks": 0,
            "issues": []
        }
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for vp in VIEWPORTS:
            vp_name = vp["name"]
            width = vp["width"]
            height = vp["height"]
            cat = vp["category"]
            print(f"\n==================================================")
            print(f"Testing Viewport: {vp_name} ({width}x{height}) [{cat}]")
            print(f"==================================================")

            context = browser.new_context(viewport={"width": width, "height": height})
            page = context.new_page()

            vp_data = {
                "category": cat,
                "width": width,
                "height": height,
                "pages": {},
                "modals": {},
                "interactions": {},
                "navigation": {}
            }

            # ----------------------------------------------------
            # 1. Login Page (Unauthenticated)
            # ----------------------------------------------------
            print("  - Testing Login page...")
            page.goto(f"{BASE_URL}/login")
            page.wait_for_load_state("networkidle")
            time.sleep(0.3)
            audit_login = audit_layout(page)
            screenshot_login = f"{SCREENSHOT_DIR}/{vp_name}_login.png"
            page.screenshot(path=screenshot_login)
            vp_data["pages"]["login"] = {
                "audit": audit_login,
                "screenshot": screenshot_login,
                "status": "FAIL" if audit_login["hasHorizScroll"] or audit_login["clippedCount"] > 0 else "PASS"
            }

            # ----------------------------------------------------
            # 2. Register Page (Unauthenticated)
            # ----------------------------------------------------
            print("  - Testing Register page...")
            page.goto(f"{BASE_URL}/register")
            page.wait_for_load_state("networkidle")
            time.sleep(0.3)
            audit_register = audit_layout(page)
            screenshot_register = f"{SCREENSHOT_DIR}/{vp_name}_register.png"
            page.screenshot(path=screenshot_register)
            vp_data["pages"]["register"] = {
                "audit": audit_register,
                "screenshot": screenshot_register,
                "status": "FAIL" if audit_register["hasHorizScroll"] or audit_register["clippedCount"] > 0 else "PASS"
            }

            # ----------------------------------------------------
            # Authenticate Session
            # ----------------------------------------------------
            login_user(page)

            # ----------------------------------------------------
            # 3. Navigation & AppHeader Check
            # ----------------------------------------------------
            print("  - Testing Navigation Header...")
            nav_info = page.evaluate("""() => {
                const nav = document.querySelector('header nav');
                const links = Array.from(document.querySelectorAll('header nav a')).map(a => a.textContent.trim());
                const header = document.querySelector('header');
                const profileBtn = document.querySelector('header button[aria-label="User profile menu"]');
                const isNavVisible = nav ? window.getComputedStyle(nav).display !== 'none' : false;
                const hamburger = document.querySelector('header button[aria-label*="menu" i], header button svg.lucide-menu');

                return {
                    isNavVisible,
                    navLinksCount: links.length,
                    navLinks: links,
                    hasProfileBtn: !!profileBtn,
                    hasHamburgerMenu: !!hamburger,
                    headerWidth: header ? header.clientWidth : null,
                    headerScrollW: header ? header.scrollWidth : null
                };
            }""")
            vp_data["navigation"] = nav_info
            if not nav_info["isNavVisible"] and not nav_info["hasHamburgerMenu"]:
                vp_data["navigation"]["issue"] = "Navigation links hidden on mobile with no replacement hamburger menu"
                print(f"    [WARN] Navigation links hidden on mobile and no hamburger menu exists!")

            # ----------------------------------------------------
            # 4. Dashboard Page
            # ----------------------------------------------------
            print("  - Testing Dashboard page...")
            page.goto(f"{BASE_URL}/dashboard")
            page.wait_for_load_state("networkidle")
            time.sleep(0.4)
            audit_dashboard = audit_layout(page)
            screenshot_dashboard = f"{SCREENSHOT_DIR}/{vp_name}_dashboard.png"
            page.screenshot(path=screenshot_dashboard)
            vp_data["pages"]["dashboard"] = {
                "audit": audit_dashboard,
                "screenshot": screenshot_dashboard,
                "status": "FAIL" if audit_dashboard["hasHorizScroll"] or audit_dashboard["clippedCount"] > 0 else "PASS"
            }

            # ----------------------------------------------------
            # 5. People List Page
            # ----------------------------------------------------
            print("  - Testing People List page...")
            page.goto(f"{BASE_URL}/people")
            page.wait_for_load_state("networkidle")
            time.sleep(0.4)
            audit_people = audit_layout(page)
            screenshot_people = f"{SCREENSHOT_DIR}/{vp_name}_people.png"
            page.screenshot(path=screenshot_people)
            vp_data["pages"]["people"] = {
                "audit": audit_people,
                "screenshot": screenshot_people,
                "status": "FAIL" if audit_people["hasHorizScroll"] or audit_people["clippedCount"] > 0 else "PASS"
            }

            # ----------------------------------------------------
            # 6. Person Form Page (/people/new)
            # ----------------------------------------------------
            print("  - Testing Person Form page (/people/new)...")
            page.goto(f"{BASE_URL}/people/new")
            page.wait_for_load_state("networkidle")
            time.sleep(0.4)
            audit_form = audit_layout(page)
            # Inspect 2-column date input widths on mobile
            date_grid_info = page.evaluate("""() => {
                const dateInputs = document.querySelectorAll('input[type="date"]');
                return Array.from(dateInputs).map(inp => ({
                    placeholder: inp.placeholder || inp.name || 'date',
                    width: inp.clientWidth,
                    parentWidth: inp.parentElement?.clientWidth
                }));
            }""")
            screenshot_form = f"{SCREENSHOT_DIR}/{vp_name}_person_form.png"
            page.screenshot(path=screenshot_form)
            vp_data["pages"]["person_form"] = {
                "audit": audit_form,
                "date_grid_info": date_grid_info,
                "screenshot": screenshot_form,
                "status": "FAIL" if audit_form["hasHorizScroll"] or audit_form["clippedCount"] > 0 else "PASS"
            }

            # ----------------------------------------------------
            # 7. Modals
            # ----------------------------------------------------
            # A. Share Modal (from Dashboard)
            print("  - Testing Share Tree Modal...")
            page.goto(f"{BASE_URL}/dashboard")
            page.wait_for_load_state("networkidle")
            share_btn = page.query_selector('button:has-text("Share tree")')
            if share_btn:
                share_btn.click()
                time.sleep(0.3)
                modal_audit = page.evaluate("""() => {
                    const modal = document.querySelector('.fixed.inset-0');
                    const dialog = modal?.querySelector('.bg-white');
                    if (!dialog) return null;
                    const r = dialog.getBoundingClientRect();
                    const vh = window.innerHeight;
                    const vw = window.innerWidth;
                    return {
                        dialogWidth: Math.round(r.width),
                        dialogHeight: Math.round(r.height),
                        overflowX: r.width > vw,
                        overflowY: r.height > vh,
                        isClippedTopBottom: r.top < 0 || r.bottom > vh
                    };
                }""")
                screenshot_share = f"{SCREENSHOT_DIR}/{vp_name}_modal_share.png"
                page.screenshot(path=screenshot_share)
                vp_data["modals"]["share_modal"] = {
                    "audit": modal_audit,
                    "screenshot": screenshot_share,
                    "status": "FAIL" if modal_audit and (modal_audit["overflowX"] or modal_audit["overflowY"]) else "PASS"
                }
                # Close modal
                close_btn = page.query_selector('.fixed.inset-0 button:has-text("Done")')
                if close_btn:
                    close_btn.click()
                    time.sleep(0.2)

            # B. Profile Modal (from Header)
            print("  - Testing User Profile Modal...")
            prof_avatar = page.query_selector('header button[aria-label="User profile menu"]')
            if prof_avatar:
                prof_avatar.click()
                time.sleep(0.2)
                prof_item = page.query_selector('button:has-text("User Profile")')
                if prof_item:
                    prof_item.click()
                    time.sleep(0.3)
                    prof_modal_audit = page.evaluate("""() => {
                        const modal = document.querySelector('.fixed.inset-0');
                        const dialog = modal?.querySelector('.bg-white');
                        if (!dialog) return null;
                        const r = dialog.getBoundingClientRect();
                        return {
                            dialogWidth: Math.round(r.width),
                            dialogHeight: Math.round(r.height),
                            overflowX: r.width > window.innerWidth,
                            overflowY: r.height > window.innerHeight
                        };
                    }""")
                    screenshot_profile = f"{SCREENSHOT_DIR}/{vp_name}_modal_profile.png"
                    page.screenshot(path=screenshot_profile)
                    vp_data["modals"]["profile_modal"] = {
                        "audit": prof_modal_audit,
                        "screenshot": screenshot_profile,
                        "status": "FAIL" if prof_modal_audit and (prof_modal_audit["overflowX"] or prof_modal_audit["overflowY"]) else "PASS"
                    }
                    # Close by clicking backdrop
                    page.mouse.click(10, 10)
                    time.sleep(0.2)

            # C. Reset Password Modal (from Header)
            print("  - Testing Reset Password Modal...")
            prof_avatar = page.query_selector('header button[aria-label="User profile menu"]')
            if prof_avatar:
                prof_avatar.click()
                time.sleep(0.2)
                reset_item = page.query_selector('button:has-text("Reset Password")')
                if reset_item:
                    reset_item.click()
                    time.sleep(0.3)
                    reset_modal_audit = page.evaluate("""() => {
                        const modal = document.querySelector('.fixed.inset-0');
                        const dialog = modal?.querySelector('.bg-white');
                        if (!dialog) return null;
                        const r = dialog.getBoundingClientRect();
                        return {
                            dialogWidth: Math.round(r.width),
                            dialogHeight: Math.round(r.height),
                            overflowX: r.width > window.innerWidth,
                            overflowY: r.height > window.innerHeight
                        };
                    }""")
                    screenshot_reset = f"{SCREENSHOT_DIR}/{vp_name}_modal_reset_password.png"
                    page.screenshot(path=screenshot_reset)
                    vp_data["modals"]["reset_password_modal"] = {
                        "audit": reset_modal_audit,
                        "screenshot": screenshot_reset,
                        "status": "FAIL" if reset_modal_audit and (reset_modal_audit["overflowX"] or reset_modal_audit["overflowY"]) else "PASS"
                    }
                    page.mouse.click(10, 10)
                    time.sleep(0.2)

            # ----------------------------------------------------
            # 8. Tree View & Tree Interactions
            # ----------------------------------------------------
            print("  - Testing Tree View & Canvas Interactions...")
            page.goto(f"{BASE_URL}/tree")
            page.wait_for_load_state("networkidle")
            time.sleep(0.8)

            audit_tree = audit_layout(page)
            screenshot_tree = f"{SCREENSHOT_DIR}/{vp_name}_tree_initial.png"
            page.screenshot(path=screenshot_tree)

            # Measure layout of Inspector Aside vs Canvas
            tree_layout_eval = page.evaluate("""() => {
                const aside = document.querySelector('aside');
                const main = document.querySelector('main');
                const toolbar = document.querySelector('main > div:first-child');
                const canvas = document.querySelector('main > div:nth-child(2)');
                return {
                    asideWidth: aside ? aside.clientWidth : 0,
                    asideHeight: aside ? aside.clientHeight : 0,
                    toolbarHeight: toolbar ? toolbar.clientHeight : 0,
                    isAsideStacked: aside && main ? aside.getBoundingClientRect().bottom <= main.getBoundingClientRect().top + 5 : false,
                    canvasHeight: canvas ? canvas.clientHeight : 0
                };
            }""")

            # Interaction A: Zoom in and Zoom out
            zoom_test = {"zoom_in_clicked": False, "zoom_out_clicked": False, "zoom_levels": []}
            zoom_text_el = page.query_selector('button[title="Zoom in"]')
            if zoom_text_el:
                # Capture current zoom
                z0 = page.evaluate("() => document.querySelector('button[title=\"Zoom in\"]')?.parentElement?.textContent?.trim()")
                zoom_test["zoom_levels"].append(z0)

                # Click Zoom In
                page.click('button[title="Zoom in"]')
                time.sleep(0.3)
                z1 = page.evaluate("() => document.querySelector('button[title=\"Zoom in\"]')?.parentElement?.textContent?.trim()")
                zoom_test["zoom_levels"].append(z1)
                zoom_test["zoom_in_clicked"] = (z1 != z0)

                # Click Zoom Out
                page.click('button[title="Zoom out"]')
                time.sleep(0.3)
                z2 = page.evaluate("() => document.querySelector('button[title=\"Zoom in\"]')?.parentElement?.textContent?.trim()")
                zoom_test["zoom_levels"].append(z2)
                zoom_test["zoom_out_clicked"] = (z2 != z1)

            # Interaction B: Pan / Drag the Canvas
            pan_test = {"panned": False}
            canvas_el = page.query_selector('.cursor-grab, .cursor-grabbing')
            if canvas_el:
                box = canvas_el.bounding_box()
                if box:
                    start_x = box["x"] + box["width"] / 2
                    start_y = box["y"] + box["height"] / 2
                    page.mouse.move(start_x, start_y)
                    page.mouse.down()
                    page.mouse.move(start_x + 80, start_y + 80, steps=5)
                    page.mouse.up()
                    time.sleep(0.3)
                    pan_test["panned"] = True

            # Interaction C: Node Selection & Inspector
            node_selected = False
            first_card = page.query_selector('[data-person-id], .group\\/card, button:has(span.font-medium)')
            # Click on a person card inside tree canvas
            cards = page.query_selector_all('main div[style*="left:"] > div')
            if cards and len(cards) > 0:
                cards[0].click()
                time.sleep(0.4)
                node_selected = True
                screenshot_tree_selected = f"{SCREENSHOT_DIR}/{vp_name}_tree_node_selected.png"
                page.screenshot(path=screenshot_tree_selected)
                vp_data["interactions"]["screenshot_node_selected"] = screenshot_tree_selected

                # Trigger QuickAdd Modal from inspector
                add_parent_btn = page.query_selector('button:has-text("Add parent")')
                if add_parent_btn:
                    add_parent_btn.click()
                    time.sleep(0.3)
                    quickadd_audit = page.evaluate("""() => {
                        const modal = document.querySelector('.fixed.inset-0 form');
                        if (!modal) return null;
                        const r = modal.getBoundingClientRect();
                        return {
                            width: Math.round(r.width),
                            height: Math.round(r.height),
                            overflowX: r.width > window.innerWidth,
                            overflowY: r.height > window.innerHeight
                        };
                    }""")
                    screenshot_quickadd = f"{SCREENSHOT_DIR}/{vp_name}_modal_quickadd.png"
                    page.screenshot(path=screenshot_quickadd)
                    vp_data["modals"]["quickadd_modal"] = {
                        "audit": quickadd_audit,
                        "screenshot": screenshot_quickadd,
                        "status": "FAIL" if quickadd_audit and (quickadd_audit["overflowX"] or quickadd_audit["overflowY"]) else "PASS"
                    }
                    # Close modal
                    cancel_btn = page.query_selector('.fixed.inset-0 button:has-text("Cancel")')
                    if cancel_btn:
                        cancel_btn.click()
                        time.sleep(0.2)

            vp_data["pages"]["tree"] = {
                "audit": audit_tree,
                "tree_layout": tree_layout_eval,
                "screenshot": screenshot_tree,
                "status": "FAIL" if audit_tree["hasHorizScroll"] or audit_tree["clippedCount"] > 0 else "PASS"
            }
            vp_data["interactions"]["zoom"] = zoom_test
            vp_data["interactions"]["pan"] = pan_test
            vp_data["interactions"]["node_selected"] = node_selected

            # ----------------------------------------------------
            # 9. AI Dialog Check
            # ----------------------------------------------------
            ai_dialog_exists = page.evaluate("""() => {
                const aiBtn = Array.from(document.querySelectorAll('button, a')).find(el =>
                    /\\b(ai|insights|copilot|assistant)\\b/i.test(el.textContent)
                );
                return !!aiBtn;
            }""")
            vp_data["ai_dialog"] = {
                "present": ai_dialog_exists,
                "note": "Feature absent from UI implementation" if not ai_dialog_exists else "Present"
            }

            # Overall VP Status
            has_fails = any(
                p.get("status") == "FAIL" for p in vp_data["pages"].values()
            ) or any(
                m.get("status") == "FAIL" for m in vp_data["modals"].values()
            ) or (vp_data["navigation"].get("issue") is not None)

            vp_data["overall_status"] = "FAIL" if has_fails else "PASS"
            overall_results["results"][vp_name] = vp_data

            print(f"[{vp_name}] Overall Status: {vp_data['overall_status']}")
            print(f"  Login: {vp_data['pages']['login']['status']} | Reg: {vp_data['pages']['register']['status']} | Dash: {vp_data['pages']['dashboard']['status']} | Tree: {vp_data['pages']['tree']['status']}")
            if vp_data["navigation"].get("issue"):
                print(f"  Navigation Issue: {vp_data['navigation']['issue']}")

            context.close()

        browser.close()

    # Summarize issues
    results_path = "docs/testing/ui_compat_results.json"
    with open(results_path, "w") as f:
        json.dump(overall_results, f, indent=2)

    print(f"\nCompleted all {len(VIEWPORTS)} viewports! Results written to {results_path}")

if __name__ == "__main__":
    run_all_tests()
