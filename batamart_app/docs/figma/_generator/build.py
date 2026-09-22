# -*- coding: utf-8 -*-
"""Screens + canvas assembly. Run this file; it imports the helpers from gen.py."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from helpers import *  # noqa

CATS = [("Fashion", "cat-fashion.webp"), ("Electronics", "cat-electronics.webp"),
        ("Food & Groceries", "cat-groceries.webp"), ("Beauty & Health", "cat-beauty.webp"),
        ("Computing", "cat-computing.webp"), ("Home & Kitchen", "cat-home.webp"),
        ("Sports & Fitness", "cat-sports.webp"), ("Books & Stationery", "cat-books.webp"),
        ("Kids & Baby", "cat-kids.webp"), ("Vehicles & Transport", "cat-vehicles.webp"),
        ("Tickets & Events", "cat-events.webp"), ("Arts & Crafts", "cat-arts.webp")]

HOT = [dict(img="cat-fashion.webp", name="Nike Air Force 1 size 42", price=naira(34500),
            old=naira(44000), off=22, rating=4.8, count=26, place="Hostel B", left=2),
       dict(img="cat-computing.webp", name="HP EliteBook 840 core i5", price=naira(185000),
            old=naira(220000), off=16, rating=4.9, count=12, place="Science Vlg", delivery="2 days"),
       dict(img="cat-beauty.webp", name="Shea moisture starter kit", price=naira(7800),
            off=30, rating=4.6, count=41, place="Amaku"),
       dict(img="cat-groceries.webp", name="Jollof rice and chicken", price=naira(2500),
            rating=4.7, count=88, place="Ifite", delivery="Same day")]

MORE = [dict(img="cat-home.webp", name="Rechargeable standing fan", price=naira(18500),
             off=12, rating=4.4, count=9, place="Hostel D"),
        dict(img="cat-books.webp", name="Organic chemistry textbook", price=naira(4200),
             rating=4.9, count=33, place="Ifite", left=1),
        dict(img="cat-sports.webp", name="Adjustable dumbbell set", price=naira(27000),
             off=18, rating=4.5, count=7, place="Amaku"),
        dict(img="cat-electronics.webp", name="JBL Flip 5 bluetooth speaker", price=naira(41000),
             off=25, rating=4.7, count=52, place="Hostel B", sold=True)]


# == 01 - Login ==========================================================
def screen_login():
    p = []
    hero = 321
    p.append(IMG("auth-hero.webp", 0, 0, W, hero, fy=0.42))
    p.append(R(0, 0, W, hero, fill=grad([(0, "#000000", 0.20), (0.42, "#000000", 0.08),
                                         (1, "#000000", 0.90)])))
    p.append(statusbar(dark=True))
    p.append(CIRC(34, 79, 18, fill="#000000", opacity=0.35))
    p.append(ICON("arrow-left", 25, 70, 18, "#FFFFFF"))
    p.append(lab("Account", 24, 210, 10, "#FFFFFF", opacity=0.65))
    p.append(disp("Welcome", 24, 248, 34, "#FFFFFF"))
    p.append(ser(" back.", 24 + 7 * 18.6, 248, 34, "#FFFFFF"))
    p.append(body("Log in to pick up where you left off.", 24, 279, 14, "#FFFFFF", opacity=0.78))
    p.append(R(0, hero - 18, W, H - hero + 18, fill=PAGE, rx=3))
    y = hero - 18 + 24
    f, y = textfield(24, y, 342, "Email", "you@unizik.edu.ng", icon="mail")
    p.append(f)
    y += 12
    f, y = textfield(24, y, 342, "Password", "•" * 10, icon="lock",
                     muted=False, suffix="eye-off")
    p.append(f)
    y += 4
    p.append(lab("Forgot password?", 366, y + 20, 10, ACCENT, anchor="end"))
    y += 34
    p.append(primary_button(24, y, 342, "Log in"))
    y += 46 + 24
    p.append(LINE(24, y + 6, 128, y + 6, HAIR))
    p.append(lab("Or continue with", 195, y + 10, 10, INKM, anchor="middle"))
    p.append(LINE(262, y + 6, 366, y + 6, HAIR))
    y += 32
    for i, (mark, name) in enumerate([("G", "Google"), ("f", "Facebook")]):
        bx = 24 + i * 177
        p.append(R(bx, y, 165, 52, fill=CARD, stroke=HAIR, rx=2))
        p.append(disp(mark, bx + 46, y + 32, 17, INK))
        p.append(lab(name, bx + 64, y + 31, 10, INK))
    y += 52 + 26
    p.append(body("Do not have an account? ", 120, y + 14, 14, INK2))
    p.append(body("Sign up", 274, y + 14, 14, ACCENT, 600))
    p.append(R(W / 2 - 67, 826, 134, 5, fill=INK, rx=2.5, opacity=0.85))
    return p


# == 02 - Home (top of feed) =============================================
def screen_home_top():
    p = [statusbar(), appbar("Home")]
    y = 119
    p.append(R(16, y, 358, 48, fill=PAGE, stroke=HAIR, rx=2))
    p.append(ICON("search", 28, y + 12, 24, INK2))
    p.append(body("Search products, sellers...", 60, y + 30, 14, INK2))
    y += 64
    promises = [("promise-listing.webp", "tag", "Sellers keep more", "Listing is", "free.",
                 ["Put up as many items as you like. You are",
                  "only charged when a sale actually completes."]),
                ("promise-escrow.webp", "shield-check", "Buyer protection", "Escrow on",
                 "every order.", None)]
    for i, (fn, ic, kick, t1, t2, note) in enumerate(promises):
        cx = 34 + i * 322
        p.append(IMG(fn, cx, y, 310, 186, rx=2, fy=0.45))
        p.append(R(cx, y, 310, 186, rx=2,
                   fill=grad([(0, "#131311", 0.85), (1, "#131311", 0.25)], 0, 1, 1, 0)))
        p.append(ICON(ic, cx + 16, y + 52, 13, "#FFFFFF", opacity=0.7))
        p.append(lab(kick, cx + 35, y + 61, 9, "#FFFFFF", opacity=0.7))
        p.append(disp(t1, cx + 16, y + 96, 23, "#FFFFFF"))
        p.append(ser(" " + t2, cx + 16 + len(t1) * 12.4, y + 96, 23, "#FFFFFF"))
        if note:
            for j, ln in enumerate(note):
                p.append(body(ln, cx + 16, y + 122 + j * 18, 12, "#FFFFFF", opacity=0.72))
    y += 198
    dx = 173
    for i in range(4):
        w = 20 if i == 0 else 6
        p.append(R(dx, y, w, 3, fill=INK if i == 0 else HAIR))
        dx += w + 6
    y += 43
    sec, y = feed_section(16, y, "Shop by category", "Find it", "faster.")
    p.append(sec)
    for col in range(3):
        for row in range(2):
            label, fn = CATS[col * 2 + row]
            tx, ty = 16 + col * 144, y + row * 120
            p.append(IMG(fn, tx, ty, 132, 108, rx=2))
            p.append(R(tx, ty, 132, 108, rx=2,
                       fill=grad([(0, "#000000", 0), (0.45, "#000000", 0.10),
                                  (1, "#000000", 0.85)])))
            short = label if len(label) < 15 else label.split(" & ")[0]
            p.append(disp(short, tx + 10, ty + 99, 13, "#FFFFFF", 600))
    y += 232 + 40
    p.append(lab("Shop to a budget", 16, bll(y, 10), 10, INKM))
    p += [fab(), bottomnav(0, 3)]
    return p


# == 03 - Home (budget bands, campaign, hot deals) =======================
def screen_home_mid():
    p = [statusbar(), appbar("Home")]
    y = 119
    sec, y = feed_section(16, y, "Shop to a budget", "Everything", "under.")
    p.append(sec)
    for i, (amount, fn, tag) in enumerate([(10000, "cat-fashion.webp", "Fashion"),
                                           (20000, "cat-electronics.webp", "Tech"),
                                           (5000, "cat-groceries.webp", "Food")]):
        bx = 16 + i * 160
        p.append(IMG(fn, bx, y, 148, 132, rx=2, fy=0.4))
        p.append(R(bx, y, 148, 132, rx=2,
                   fill=grad([(0, "#000000", 0.10), (1, "#000000", 0.85)])))
        p.append(lab(tag, bx + 12, y + 104, 9, "#FFFFFF", opacity=0.7))
        p.append(disp("Under " + naira(amount), bx + 12, y + 123, 16, "#FFFFFF"))
    y += 172
    p.append(IMG("banner-market.webp", 16, y, 358, 148, rx=2))
    p.append(R(16, y, 358, 148, rx=2,
               fill=grad([(0, ROSE, 0.95), (1, ROSE, 0.55)], 0, 0, 1, 0)))
    p.append(lab("Campaign special", 32, y + 42, 10, "#FFFFFF", opacity=0.8))
    p.append(disp("Up to 30%", 32, y + 78, 27, "#FFFFFF"))
    p.append(ser(" off.", 32 + 9 * 14.6, y + 78, 27, "#FFFFFF"))
    p.append(R(32, y + 94, 116, 35, fill="#000000", opacity=0.85, rx=2))
    p.append(lab("Shop now", 48, y + 116, 10, "#FFFFFF"))
    y += 188
    p.append(LINE(16, y, 374, y, HAIR))
    for i, (ic, t) in enumerate([("shield-check", "Escrow protected"),
                                 ("bike", "Campus delivery"), ("star", "Rated sellers")]):
        cx = 16 + 119.3 * i + 59.6
        if i:
            p.append(R(16 + 119.3 * i, y + 18, 1, 22, fill=HAIR))
        p.append(ICON(ic, cx - 8, y + 12, 16, INKM))
        p.append(lab(t, cx, y + 42, 9, INK2, anchor="middle"))
    p.append(LINE(16, y + 58, 374, y + 58, HAIR))
    y += 98
    sec, y = feed_section(16, y, "Discounted now", "Hot", "deals.", see_all=True)
    p.append(sec)
    for i, d in enumerate(HOT[:3]):
        p.append(product_tile(16 + i * 166, y, 150, **d))
    p += [fab(), bottomnav(0, 3)]
    return p


# == 04 - Home (category spotlight + sell CTA) ===========================
def screen_home_end():
    p = []
    # the scrolled-past row is clipped to the body, so it never draws over the app bar
    tail = "".join(product_tile(16 + i * 166, -112, 150, **d) for i, d in enumerate(HOT[1:4]))
    p.append('<g clip-path="url(#%s)">%s</g>' % (clip(0, 103, W, 647), tail))
    p += [statusbar(), appbar("Home")]
    y = 186
    p.append(IMG("spot-electronics.webp", 16, y, 358, 260, rx=2))
    p.append(R(16, y, 358, 260, rx=2,
               fill=grad([(0, "#000000", 0.25), (0.3, "#000000", 0.05),
                          (1, "#000000", 0.95)])))
    p.append(lab("Best sellers in", 32, y + 150, 9, "#FFFFFF", opacity=0.7))
    p.append(disp("Electronics", 32, y + 184, 25, "#FFFFFF"))
    p.append(ICON("arrow-right", 32 + 11 * 13.4 + 10, y + 171, 17, "#FFFFFF"))
    cx, cy = 32, y + 198
    for subl in ["Phones & Tablets", "Laptops", "TVs & Monitors", "Audio", "Gaming"]:
        cw = len(subl) * 5.9 + 24
        if cx + cw > 358:
            cx, cy = 32, cy + 33
        p.append(R(cx, cy, cw, 27, fill="#FFFFFF", opacity=0.16))
        p.append(R(cx, cy, cw, 27, stroke="#FFFFFF", sw=1, opacity=0.3))
        p.append(body(subl, cx + 12, cy + 18, 11.5, "#FFFFFF"))
        cx += cw + 8
    y += 300
    p.append(IMG("sell-cta.webp", 16, y, 358, 240, rx=2, fy=0.4))
    p.append(R(16, y, 358, 240, rx=2,
               fill=grad([(0.15, "#131311", 0.10), (0.92, "#131311", 0.90)])))
    p.append(lab("Got something to sell?", 40, y + 150, 10, "#FFFFFF", opacity=0.65))
    p.append(disp("List it in", 40, y + 186, 27, "#FFFFFF"))
    p.append(ser(" two minutes.", 40 + 9 * 14.6, y + 186, 27, "#FFFFFF"))
    p.append(R(40, y + 202, 168, 41, fill="#FFFFFF"))
    p.append(lab("Start selling", 56, y + 226, 10, "#131311"))
    p.append(ICON("arrow-right", 176, y + 215, 14, "#131311"))
    p += [fab(), bottomnav(0, 3)]
    return p


# == 05 - Deals ==========================================================
def screen_deals():
    p = [statusbar(), appbar("Deals")]
    rail = [("All", None)] + CATS[:1] + [CATS[1]] + CATS[2:7]
    rail = [("All", None), ("Electronics", "cat-electronics.webp"),
            ("Computing", "cat-computing.webp"), ("Fashion", "cat-fashion.webp"),
            ("Home & Kitchen", "cat-home.webp"), ("Food & Groceries", "cat-groceries.webp"),
            ("Beauty & Health", "cat-beauty.webp"), ("Sports & Fitness", "cat-sports.webp")]
    p.append(R(0, 103, 96, 647, fill=PAGE))
    p.append(LINE(96, 103, 96, 750, HAIR))
    ry = 103
    for i, (label, fn) in enumerate(rail):
        lines = label.split(" & ") if " & " in label else [label]
        hgt = 12 + 40 + 6 + len(lines) * 13 + 12
        on = (i == 1)
        if on:
            p.append(R(0, ry, 96, hgt, fill=CARD))
            p.append(R(0, ry, 2.5, hgt, fill=ACCENT))
        if fn:
            p.append(IMG(fn, 28, ry + 12, 40, 40, rx=2))
        else:
            p.append(R(28, ry + 12, 40, 40, stroke=HAIR, sw=1))
            p.append(ICON("layout-grid", 40, ry + 24, 16, INK))
        for j, ln in enumerate(lines):
            p.append(body(ln + ("" if j == len(lines) - 1 else " &"), 48,
                          ry + 58 + 10 + j * 13, 10.5,
                          INK if on else INK2, 600 if on else 400, anchor="middle"))
        ry += hgt
    # filter bar
    p.append(R(96, 103, 294, 34, fill=CARD))
    p.append(LINE(96, 137, 390, 137, HAIR))
    p.append(ICON("arrow-up-down", 108, 113, 14, INKM))
    p.append(body("Most popular", 128, 125, 12, INK))
    p.append(R(238, 111, 1, 18, fill=HAIR))
    p.append(ICON("sliders-horizontal", 252, 113, 14, INKM))
    p.append(body("Filters", 272, 125, 12, INK))
    p.append(R(316, 113, 14, 14, fill=ACCENT))
    p.append(lab("1", 323, 124, 9, "#FFFFFF", anchor="middle"))
    p.append(lab("Clear", 342, 125, 9, DANGER))
    # subcategory strip
    sx = 108
    for i, s in enumerate(["All", "Phones & Tablets", "Laptops"]):
        cw = len(s) * 8.4 + 20
        p.append(R(sx, 147, cw, 26, fill=INK if i == 0 else CARD,
                   stroke=None if i == 0 else HAIR, rx=2))
        p.append(lab(s, sx + 10, 164, 11, CARD if i == 0 else INK2))
        sx += cw + 8
    p.append(LINE(96, 177, 390, 177, HAIR))
    # results grid
    grid = HOT[1:] + MORE
    for i, d in enumerate(grid[:6]):
        gx = 108 + (i % 2) * 139
        gy = 189 + (i // 2) * 304
        p.append(product_tile(gx, gy, 131, **d))
    p.append(bottomnav(1, 3))
    return p


# == 06 - Product detail =================================================
def screen_product():
    p = []
    hero = 439
    p.append(IMG("cat-fashion.webp", 0, 0, W, hero, fy=0.45))
    p.append(R(0, 0, W, hero, fill=grad([(0, PAGE, 0), (0.78, PAGE, 0), (1, PAGE, 1)])))
    p.append(statusbar(dark=True))
    for i, (ic, cx) in enumerate([("arrow-left", 34), ("share-2", 306), ("flag", 356)]):
        p.append(CIRC(cx, 79, 18, fill="#000000", opacity=0.35))
        p.append(ICON(ic, cx - 9, 70, 18, "#FFFFFF"))
    p.append(R(310, 348, 56, 22, fill="#000000", opacity=0.45, rx=2))
    p.append(lab("1 / 4", 338, 363, 9, "#FFFFFF", anchor="middle"))
    y = 455
    for i in range(4):
        tx = 16 + i * 64
        p.append(IMG("cat-fashion.webp", tx, y, 56, 56, rx=2, fy=0.3 + i * 0.12))
        if i == 0:
            p.append(R(tx, y, 56, 56, stroke=INK, sw=1.5, rx=2))
    y += 68
    p.append(lab("Fashion / Men shoes", 16, bll(y, 9), 9, INKM))
    y += 20
    p.append(disp("Nike Air Force 1, size 42", 16, bld(y, 25), 25, INK))
    y += 32
    p.append(rating_row(16, y + 9, 4.8, 26))
    p.append(R(112, y + 1, 1, 11, fill=HAIR))
    p.append(lab("31 sold", 122, y + 9, 9, INK2))
    y += 26
    p.append(LINE(16, y, 374, y, HAIR))
    p.append(fig(naira(34500), 16, bld(y + 12, 31), 31, INK))
    p.append(strike(naira(44000), 158, bld(y + 12, 31), 14))
    p.append(R(300, y + 14, 74, 19, fill=DANGER))
    p.append(lab("Save 22%", 307, y + 27, 9, "#FFFFFF"))
    p.append(LINE(16, y + 56, 374, y + 56, HAIR))
    y += 60
    p.append(body("Only 3 left", 16, blb(y, 12), 12, WARNING, 600))
    y += 24
    p.append(body("Size", 16, blb(y, 14), 14, INK, 600))
    y += 22
    sx = 16
    for i, sz in enumerate(["41", "42", "43", "44"]):
        cw = 40
        p.append(R(sx, y, cw, 28, fill=INK if i == 1 else CARD,
                   stroke=None if i == 1 else HAIR, rx=2))
        p.append(lab(sz, sx + cw / 2, y + 18, 11, CARD if i == 1 else INK2, anchor="middle"))
        sx += cw + 8
    y += 40
    p.append(body("Quantity", 16, blb(y, 14), 14, INK, 600))
    y += 22
    for k, ic in enumerate(["minus", "plus"]):
        p.append(R(16 + k * 72, y, 32, 32, stroke=HAIR, sw=1, rx=2))
        p.append(ICON(ic, 24 + k * 72, y + 8, 16, INK))
    p.append(body("1", 68, y + 21, 14, INK, anchor="middle"))
    # sticky buy bar
    p.append(R(0, 736, W, 108, fill=CARD))
    p.append(LINE(0, 736, W, 736, HAIR))
    p.append(lab("Total", 16, 757, 9, INKM))
    p.append(fig(naira(34500), 16, 780, 20, INK))
    p.append(secondary_button(132, 750, 117, "Add to cart"))
    p.append(primary_button(257, 750, 117, "Buy now"))
    p.append(R(W / 2 - 67, 826, 134, 5, fill=INK, rx=2.5, opacity=0.85))
    return p


# == 07 - Cart ===========================================================
def screen_cart():
    p = [statusbar(), appbar("Cart")]
    y = 119
    groups = [("Chinaza Okeke", [("cat-fashion.webp", "Nike Air Force 1 size 42", 34500, 1),
                                ("cat-beauty.webp", "Shea moisture starter kit", 7800, 2)]),
              ("Emeka Stores", [("cat-groceries.webp", "Jollof rice and chicken", 2500, 1)])]
    for seller, items in groups:
        p.append(CIRC(28, y + 12, 12, fill=ACCENT))
        p.append(body(seller[0], 28, y + 17, 12, "#FFFFFF", 700, anchor="middle"))
        p.append(body(seller, 48, y + 17, 14, INK, 700))
        y += 32
        for fn, name, price, qty in items:
            p.append(IMG(fn, 16, y + 8, 56, 56, rx=2))
            p.append(body(name, 84, y + 30, 14, INK, 600))
            p.append(body(naira(price), 84, y + 50, 14, ACCENT, 700))
            bx = 286
            for k, ic in enumerate(["minus", "plus"]):
                p.append(R(bx + k * 52, y + 22, 28, 28, stroke=HAIR, sw=1, rx=2))
                p.append(ICON(ic, bx + k * 52 + 6, y + 28, 16, INK))
            p.append(body(str(qty), bx + 38, y + 41, 14, INK, anchor="middle"))
            y += 72
        y += 16
    y -= 8
    p.append(panel(16, y, 358, 76))
    p.append(ICON("map-pin", 32, y + 17, 14, INKM))
    p.append(lab("Delivering to", 52, y + 27, 10, INK2))
    p.append(lab("Change", 358, y + 27, 10, ACCENT, anchor="end"))
    p.append(body("Paul Hostel, Room 214, Ifite Gate", 32, y + 56, 14, INK, 500))
    y += 88
    p.append(panel(16, y, 358, 128))
    p.append(lab("Subtotal", 32, y + 27, 10, INK2))
    p.append(body(naira(52600), 358, y + 28, 14, INK, 500, anchor="end"))
    p.append(lab("Delivery fee", 32, y + 51, 10, INK2))
    p.append(body(naira(700), 358, y + 52, 14, INK, 500, anchor="end"))
    p.append(LINE(32, y + 68, 358, y + 68, HAIR))
    p.append(lab("Total · 4 items", 32, y + 108, 10, INK))
    p.append(fig(naira(53300), 358, y + 110, 26, INK, anchor="end"))
    y += 144
    p.append(primary_button(16, y, 358, "Secure checkout", icon="lock"))
    y += 54
    p.append(lab("Escrow protected · released on delivery", 195, y + 9, 9, INKM, anchor="middle"))
    p.append(bottomnav(2, 4))
    return p


# == 08 - Checkout =======================================================
def screen_checkout():
    p = [statusbar(), appbar("Checkout", back=True, actions=())]
    y = 119
    p.append(ICON("map-pin", 16, y, 18, INK))
    p.append(disp("Delivery address", 42, y + 14, 14, INK, 600))
    p.append(lab("Edit", 374, y + 13, 10, ACCENT, anchor="end"))
    p.append(body("Paul Hostel, Room 214", 16, y + 42, 14, INK, 500))
    p.append(body("Ifite Gate", 16, y + 62, 14, INK2))
    y += 88
    p.append(ICON("message-square", 16, y, 18, INK))
    p.append(disp("Order notes (optional)", 42, y + 14, 14, INK, 600))
    y += 32
    p.append(R(16, y, 358, 88, fill=CARD, stroke=HAIR, rx=2))
    p.append(body("Leave a note for the rider...", 32, y + 30, 15, INKM))
    p.append(lab("0/300", 358, y + 104, 9, INKM, anchor="end"))
    y += 108
    p.append(R(16, y, 20, 20, stroke=HAIRS, sw=1.5, rx=2))
    p.append(body("My delivery address is accessible by motorcycle.", 48, y + 15, 13, INK))
    y += 36
    p.append(panel(16, y, 358, 96))
    p.append(ICON("shield-check", 32, y + 16, 18, SUCCESS))
    p.append(lab("Escrow protection", 62, y + 28, 10, INK))
    for j, ln in enumerate(["Your payment is held safely and released to",
                            "the seller only when you confirm delivery."]):
        p.append(body(ln, 62, y + 52 + j * 18, 12, INK2))
    y += 120
    p.append(panel(16, y, 358, 150))
    p.append(lab("Order summary", 32, y + 27, 10, INK2))
    p.append(lab("Subtotal", 32, y + 55, 10, INK2))
    p.append(body(naira(52600), 358, y + 56, 14, INK, 500, anchor="end"))
    p.append(lab("Delivery fee", 32, y + 79, 10, INK2))
    p.append(body(naira(700), 358, y + 80, 14, INK, 500, anchor="end"))
    p.append(LINE(32, y + 96, 358, y + 96, HAIR))
    p.append(lab("Total", 32, y + 132, 10, INK))
    p.append(fig(naira(53300), 358, y + 134, 26, INK, anchor="end"))
    y += 174
    p.append(primary_button(16, y, 358, "Pay with Flutterwave", icon="lock"))
    y += 54
    p.append(lab("You will be returned here after payment", 195, y + 9, 9, INKM, anchor="middle"))
    p.append(R(W / 2 - 67, 826, 134, 5, fill=INK, rx=2.5, opacity=0.85))
    return p


# == 09 - Orders =========================================================
def screen_orders():
    p = [statusbar(), appbar("Orders")]
    sx = 16
    for i, t in enumerate(["All", "To Pay", "Processing", "On the way", "Delivered"]):
        cw = len(t) * 8.4 + 20
        p.append(R(sx, 111, cw, 28, fill=INK if i == 0 else CARD,
                   stroke=None if i == 0 else HAIR, rx=2))
        p.append(lab(t, sx + 10, 129, 11, CARD if i == 0 else INK2))
        sx += cw + 8
    y = 163
    orders = [("BM-40921", naira(53300), "ON_THE_WAY", "4 items", "Sep 12, 2026", None),
              ("BM-40877", naira(18500), "DELIVERED", "1 item", "Sep 8, 2026", "Review"),
              ("BM-40712", naira(7800), "COMPLETED", "2 items", "Aug 30, 2026", None)]
    for num, total, st, items, date, second in orders:
        h = 177
        p.append(panel(16, y, 358, h))
        p.append(lab("Order #" + num, 32, y + 27, 10, INKM))
        p.append(fig(total, 32, y + 58, 20, INK))
        p.append(status_chip(358 - (len(st.replace("_", " ")) * 7.6 + 16), y + 16, st))
        p.append(LINE(32, y + 78, 358, y + 78, HAIR))
        p.append(body(items, 32, y + 102, 12, INK2))
        p.append(lab(date, 358, y + 101, 9, INKM, anchor="end"))
        if second:
            p.append(secondary_button(32, y + 115, 163, second))
            p.append(primary_button(203, y + 115, 155, "View details"))
        else:
            p.append(primary_button(32, y + 115, 326, "View details"))
        y += h + 12
    p.append(bottomnav(3, 4))
    return p


# == 10 - Profile ========================================================
def screen_profile():
    p = [statusbar(), appbar("Profile")]
    y = 103
    p.append(R(0, y, W, 100, fill=CARD))
    p.append(LINE(0, y + 100, W, y + 100, HAIR))
    p.append(disp("Welcome, Chidozie", 16, y + 34, 20, INK, 700))
    p.append(R(268, y + 18, 72, 20, stroke=ACCENT, sw=1, rx=2, opacity=0.5))
    p.append(lab("Verified", 275, y + 32, 9, ACCENT))
    p.append(ICON("pencil", 350, y + 20, 16, INKM))
    p.append(body("martin@unizik.edu.ng", 16, y + 56, 13, ACCENT))
    p.append(ICON("map-pin", 16, y + 70, 13, INKM))
    p.append(body("Paul Hostel, Room 214, Ifite Gate", 35, y + 81, 12, INK2))
    y += 101
    p.append(R(0, y, W, 72, fill=CARD))
    p.append(ICON("repeat", 16, y + 26, 19, INK))
    p.append(disp("Seller mode", 48, y + 32, 14, INK, 600))
    p.append(body("Selling", 48, y + 52, 12, INK2))
    p.append(R(330, y + 26, 44, 24, fill=ACCENT, rx=12))
    p.append(CIRC(362, y + 38, 9, fill="#FFFFFF"))
    p.append(LINE(0, y + 72, W, y + 72, HAIR))
    y += 72
    groups = [("My account", [("wallet", "Wallet"), ("bell", "Notifications"),
                              ("gift", "Referrals"), ("scale", "Disputes")]),
              ("Selling", [("store", "My shop"), ("clipboard-list", "Sales"),
                           ("plus", "List a product")]),
              ("Discover", [("trending-up", "Most bought"), ("users", "Sellers")])]
    for heading, rows in groups:
        p.append(lab(heading, 16, y + 24 + 10, 11, INKM))
        y += 45
        p.append(R(0, y, W, 52 * len(rows), fill=CARD))
        for i, (ic, label) in enumerate(rows):
            ry = y + i * 52
            p.append(ICON(ic, 16, ry + 16, 19, INK))
            p.append(body(label, 48, ry + 31, 14, INK))
            p.append(ICON("chevron-right", 358, ry + 17, 18, INKM))
            if i:
                p.append(LINE(48, ry, W, ry, HAIR))
        y += 52 * len(rows)
    p.append(bottomnav(4, 3))
    return p


# == Style guide =========================================================
def style_guide(w=1950, h=960):
    p = [R(0, 0, w, h, fill=PAGE)]
    p.append(disp("Design system", 48, 78, 40, INK))
    p.append(ser(" tokens.", 48 + 13 * 20.8, 78, 40, INK))
    p.append(body("AppPalette.light, AppTypography, AppSpacing, AppRadii — as implemented in "
                  "batamart_app/lib/core/theme", 48, 108, 14, INK2))
    p.append(LINE(48, 132, w - 48, 132, HAIR))

    # ---- colour -------------------------------------------------------
    p.append(lab("Colour", 48, 168, 11, INKM))
    p.append(LINE(120, 164, 560, 164, HAIR))
    swatches = [("page", PAGE), ("card", CARD), ("ink", INK), ("inkSecondary", INK2),
                ("inkMuted", INKM), ("hairline", HAIR), ("hairlineStrong", HAIRS),
                ("accent", ACCENT), ("slab", SLAB), ("success", SUCCESS),
                ("warning", WARNING), ("danger", DANGER), ("campaignRose", ROSE)]
    for i, (name, hexv) in enumerate(swatches):
        sx = 48 + (i % 5) * 112
        sy = 194 + (i // 5) * 112
        p.append(R(sx, sy, 96, 60, fill=hexv, stroke=HAIR, sw=1, rx=2))
        p.append(lab(name, sx, sy + 76, 9, INK))
        p.append(lab(hexv, sx, sy + 92, 9, INKM))

    # ---- specimens ----------------------------------------------------
    p.append(lab("Product card", 48, 568, 11, INKM))
    p.append(LINE(160, 564, 560, 564, HAIR))
    p.append(product_tile(48, 594, 150, **HOT[0]))
    p.append(product_tile(214, 594, 150, **MORE[3]))
    p.append(lab("Order card", 400, 568, 11, INKM))
    p.append(panel(400, 594, 300, 160))
    p.append(lab("Order #BM-40921", 416, 622, 10, INKM))
    p.append(fig(naira(53300), 416, 652, 20, INK))
    p.append(status_chip(576, 610, "ON_THE_WAY"))
    p.append(LINE(416, 672, 684, 672, HAIR))
    p.append(body("4 items", 416, 696, 12, INK2))
    p.append(lab("Sep 12, 2026", 684, 695, 9, INKM, anchor="end"))
    p.append(primary_button(416, 708, 268, "View details"))

    # ---- type ---------------------------------------------------------
    p.append(lab("Type", 760, 168, 11, INKM))
    p.append(LINE(812, 164, 1180, 164, HAIR))
    specimens = [("Archivo 32 / display", lambda x, y: disp("Just dropped.", x, y, 32)),
                 ("Archivo 24 / headline", lambda x, y: disp("Hot deals this week", x, y, 24)),
                 ("Archivo 20 / title", lambda x, y: disp("Order summary", x, y, 20, weight=600)),
                 ("Instrument Serif 26 / editorial accent",
                  lambda x, y: ser("faster.", x, y, 26)),
                 ("Archivo 26 / figure, tabular", lambda x, y: fig(naira(53300), x, y, 26)),
                 ("Inter 14 / body", lambda x, y: body(
                     "Your money is held safely and only released", x, y, 14)),
                 ("Inter 12 / small", lambda x, y: body(
                     "once you confirm the item arrived.", x, y, 12, INK2)),
                 ("JetBrains Mono 11 / label", lambda x, y: lab(
                     "Escrow protected · on delivery", x, y, 11, INK))]
    ty = 206
    for note, draw in specimens:
        p.append(lab(note, 760, ty, 9, INKM))
        p.append(draw(760, ty + 40))
        ty += 76

    # ---- components ---------------------------------------------------
    p.append(lab("Components", 1300, 168, 11, INKM))
    p.append(LINE(1412, 164, w - 48, 164, HAIR))
    cy = 196
    p.append(primary_button(1300, cy, 230, "Secure checkout", icon="lock"))
    p.append(secondary_button(1550, cy, 230, "Add to cart"))
    cy += 64
    p.append(R(1300, cy, 230, 46, fill=HAIR, rx=2))
    p.append(lab("Log in", 1415, cy + 27, 11, INKM, anchor="middle"))
    p.append(lab("disabled state", 1550, cy + 27, 9, INKM))
    cy += 74
    p.append(lab("Status chip — hairline ring, never a solid pill", 1300, cy, 9, INKM))
    cy += 16
    for i, st in enumerate(["PENDING", "PROCESSING", "ON_THE_WAY", "DELIVERED", "DISPUTED"]):
        p.append(status_chip(1300 + i * 116, cy, st, w=108))
    cy += 50
    f, _ = textfield(1300, cy, 310, "Email", "you@unizik.edu.ng", icon="mail")
    p.append(f)
    p.append(lab("Label above the field, never a floating label", 1630, cy + 40, 9, INKM))
    cy += 110
    p.append(lab("Stat rail — hairline grid, tabular figures", 1300, cy, 9, INKM))
    cy += 16
    p.append(R(1300, cy, 480, 92, stroke=HAIR, sw=1))
    for i, (v, l) in enumerate([(naira(128400), "Wallet balance"), ("36", "Orders"),
                                ("4.8", "Rating")]):
        gx = 1300 + i * 160
        if i:
            p.append(R(gx, cy, 1, 92, fill=HAIR))
        p.append(fig(v, gx + 16, cy + 42, 24, INK))
        p.append(lab(l, gx + 16, cy + 68, 10, INKM))
    cy += 124
    p.append(lab("Slab — stays dark in both themes", 1300, cy, 9, INKM))
    cy += 16
    p.append(R(1300, cy, 480, 96, fill=SLAB))
    p.append(lab("Escrow", 1324, cy + 34, 10, SLABFG, opacity=0.6))
    p.append(disp("Money held until", 1324, cy + 66, 22, SLABFG))
    p.append(ser(" you confirm.", 1324 + 16 * 11.4, cy + 66, 22, SLABFG))
    cy += 124
    for i, ln in enumerate([
            "Radii — sharp by rule: sm / md / lg 2px, xl 3px, pill 999px",
            "Spacing — 4 · 8 · 12 · 16 · 24 · 32 · section 40 · gutter 16",
            "Icons — lucide, outline only, stroke 2/24, sizes 10–24",
            "Elevation — none. Structure comes from the 1px rule, not shadow."]):
        p.append(lab(ln, 1300, cy + i * 20, 9, INKM))
    return p


# == canvas ==============================================================
MARGIN, GAP = 120, 90
ROW = [("01 · Log in", screen_login), ("02 · Home — top of feed", screen_home_top),
       ("03 · Home — budget, campaign, deals", screen_home_mid),
       ("04 · Home — spotlight + sell CTA", screen_home_end),
       ("05 · Deals — browse", screen_deals)]
ROW2 = [("06 · Product detail", screen_product), ("07 · Cart", screen_cart),
        ("08 · Checkout", screen_checkout), ("09 · Orders", screen_orders),
        ("10 · Profile", screen_profile)]

CANVAS_W = MARGIN * 2 + 5 * W + 4 * GAP
ROW1_Y = 300
ROW2_Y = ROW1_Y + H + 150
SG_Y = ROW2_Y + H + 150
CANVAS_H = SG_Y + 960 + MARGIN

add(R(0, 0, CANVAS_W, CANVAS_H, fill="#EFECE7"))
add(disp("BataMart", MARGIN, 150, 56, INK))
add(ser(" mobile.", MARGIN + 9 * 30, 150, 56, INK))
add(body("Flutter app — every frame drawn from lib/features and lib/core/theme. "
         "390 × 844 pt. Light theme.", MARGIN, 186, 16, INK2))
add(lab("Buyer / seller flow", MARGIN, 232, 11, INKM))
add(LINE(MARGIN + 160, 228, CANVAS_W - MARGIN, 228, "#DAD5CC"))

for i, (title, fn) in enumerate(ROW):
    frame(title, MARGIN + i * (W + GAP), ROW1_Y, fn())
for i, (title, fn) in enumerate(ROW2):
    frame(title, MARGIN + i * (W + GAP), ROW2_Y, fn())

add(lab("Style guide", MARGIN, SG_Y - 18, 12, "#8A857C"))
add('<g transform="translate(%g,%g)">' % (MARGIN, SG_Y))
add("".join(style_guide(CANVAS_W - MARGIN * 2, 960)))
add(R(0, 0, CANVAS_W - MARGIN * 2, 960, stroke="#D8D3CA", sw=1))
add("</g>")

svg = ('<?xml version="1.0" encoding="UTF-8"?>\n'
       '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
       'width="%d" height="%d" viewBox="0 0 %d %d">\n<defs>%s</defs>\n%s\n</svg>\n'
       % (CANVAS_W, CANVAS_H, CANVAS_W, CANVAS_H, "".join(defs), "".join(out)))

dest = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "BataMart-Mobile.svg")
with open(dest, "w", encoding="utf-8") as fh:
    fh.write(svg)
print("wrote", dest, round(len(svg.encode("utf-8")) / 1024), "KB")
