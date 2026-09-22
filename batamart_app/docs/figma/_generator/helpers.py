# -*- coding: utf-8 -*-
"""Generates a Figma-importable SVG of the BataMart Flutter app's real screens."""
import base64, io, json, os, re
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = r"C:\Users\USER\Desktop\bata-marketplace\batamart_app\assets\images"
ICONS = json.load(open(os.path.join(HERE, "icons.json"), encoding="utf-8"))

# ── AppPalette.light + AppColors ──────────────────────────────────────────
PAGE="#F6F4F1"; CARD="#FFFFFF"; INK="#131311"; INK2="#6E6A63"; INKM="#9A958C"
HAIR="#E4E0D9"; HAIRS="#C9C3B8"; ACCENT="#1E90FF"; SLAB="#131311"; SLABFG="#F6F4F1"
SUCCESS="#16A34A"; WARNING="#F59E0B"; DANGER="#EF4444"; STAR="#F59E0B"; ROSE="#EA6178"

# ── Type faces (AppTypography) ────────────────────────────────────────────
DISPLAY="Archivo"; BODY="Inter"; SERIF="Instrument Serif"; MONO="JetBrains Mono"

W, H = 390, 844          # logical phone frame
out, defs = [], []
_uid = [0]
def uid(p="u"):
    _uid[0] += 1
    return "%s%d" % (p, _uid[0])

def esc(s):
    return (str(s).replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
            .replace('"',"&quot;"))

def add(s): out.append(s)

# ── primitives ────────────────────────────────────────────────────────────
def R(x, y, w, h, fill=None, stroke=None, sw=1, rx=0, opacity=None, name=None):
    a = 'x="%g" y="%g" width="%g" height="%g"' % (x, y, w, h)
    if rx: a += ' rx="%g"' % rx
    a += ' fill="%s"' % (fill if fill else "none")
    if stroke: a += ' stroke="%s" stroke-width="%g"' % (stroke, sw)
    if opacity is not None: a += ' opacity="%g"' % opacity
    if name: a += ' id="%s"' % esc(name)
    return "<rect %s/>" % a

def CIRC(cx, cy, r, fill=None, stroke=None, sw=1, opacity=None):
    a = 'cx="%g" cy="%g" r="%g" fill="%s"' % (cx, cy, r, fill if fill else "none")
    if stroke: a += ' stroke="%s" stroke-width="%g"' % (stroke, sw)
    if opacity is not None: a += ' opacity="%g"' % opacity
    return "<circle %s/>" % a

def LINE(x1, y1, x2, y2, stroke=HAIR, sw=1):
    return '<line x1="%g" y1="%g" x2="%g" y2="%g" stroke="%s" stroke-width="%g"/>' % (
        x1, y1, x2, y2, stroke, sw)

def T(s, x, y, font=BODY, size=14, weight=400, fill=INK, ls=None,
      anchor="start", italic=False, opacity=None):
    """Text with an explicit baseline y."""
    a = 'x="%g" y="%g" font-family="%s" font-size="%g" font-weight="%d" fill="%s"' % (
        x, y, font, size, weight, fill)
    if ls: a += ' letter-spacing="%g"' % ls
    if anchor != "start": a += ' text-anchor="%s"' % anchor
    if italic: a += ' font-style="italic"'
    if opacity is not None: a += ' opacity="%g"' % opacity
    return "<text %s>%s</text>" % (a, esc(s))

# AppTypography helpers ----------------------------------------------------
def disp(s, x, y, size=20, fill=INK, weight=700, anchor="start", opacity=None):
    return T(s, x, y, DISPLAY, size, weight, fill, ls=size*-0.035, anchor=anchor, opacity=opacity)

def fig(s, x, y, size=20, fill=INK, weight=700, anchor="start"):
    return T(s, x, y, DISPLAY, size, weight, fill, ls=size*-0.03, anchor=anchor)

def ser(s, x, y, size=20, fill=INK, anchor="start", opacity=None):
    return T(s, x, y, SERIF, size, 400, fill, ls=size*-0.015, anchor=anchor,
             italic=True, opacity=opacity)

def lab(s, x, y, size=11, fill=INKM, weight=500, anchor="start", opacity=None):
    return T(str(s).upper(), x, y, MONO, size, weight, fill, ls=size*0.16,
             anchor=anchor, opacity=opacity)

def body(s, x, y, size=14, fill=INK, weight=400, anchor="start", opacity=None):
    return T(s, x, y, BODY, size, weight, fill, anchor=anchor, opacity=opacity)

def strike(s, x, y, size=12, fill=INKM):
    return ('<text x="%g" y="%g" font-family="%s" font-size="%g" fill="%s" '
            'text-decoration="line-through">%s</text>' % (x, y, BODY, size, fill, esc(s)))

# ── icons (real lucide geometry, stroked at lucide's 2/24 ratio) ──────────
def ICON(name, x, y, size=20, color=INK, opacity=None):
    node = ICONS.get(name)
    if not node:
        return R(x, y, size, size, stroke=color, sw=1)
    k = size / 24.0
    inner = []
    for tag, attrs in node:
        a = " ".join('%s="%s"' % (kk, esc(vv)) for kk, vv in attrs.items())
        inner.append("<%s %s/>" % (tag, a))
    op = ' opacity="%g"' % opacity if opacity is not None else ""
    return ('<g transform="translate(%g,%g) scale(%g)" fill="none" stroke="%s" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%s>%s</g>'
            % (x, y, k, color, op, "".join(inner)))

# ── gradients & clips ─────────────────────────────────────────────────────
def grad(stops, x1=0, y1=0, x2=0, y2=1):
    gid = uid("g")
    s = "".join('<stop offset="%g" stop-color="%s" stop-opacity="%g"/>' % (o, c, a)
                for o, c, a in stops)
    defs.append('<linearGradient id="%s" x1="%g" y1="%g" x2="%g" y2="%g">%s</linearGradient>'
                % (gid, x1, y1, x2, y2, s))
    return "url(#%s)" % gid

def clip(x, y, w, h, rx=0):
    cid = uid("c")
    defs.append('<clipPath id="%s">%s</clipPath>' % (cid, R(x, y, w, h, rx=rx)))
    return cid

# ── photographs from the app's own asset bundle ───────────────────────────
_imgcache = {}
def IMG(fname, x, y, w, h, rx=0, fy=0.5, quality=62, name=None):
    key = (fname, round(w), round(h), fy)
    if key not in _imgcache:
        im = Image.open(os.path.join(ASSETS, fname)).convert("RGB")
        tw, th = w * 1.7, h * 1.7
        scale = max(tw / im.width, th / im.height)
        nw, nh = max(1, int(im.width * scale)), max(1, int(im.height * scale))
        im = im.resize((nw, nh), Image.LANCZOS)
        left = int((nw - tw) / 2)
        top = int(max(0, min(nh - th, (nh - th) * fy)))
        im = im.crop((left, top, left + int(tw), top + int(th)))
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality, optimize=True)
        _imgcache[key] = base64.b64encode(buf.getvalue()).decode()
    cid = clip(x, y, w, h, rx) if rx else None
    a = 'x="%g" y="%g" width="%g" height="%g" preserveAspectRatio="xMidYMid slice"' % (x, y, w, h)
    if cid: a += ' clip-path="url(#%s)"' % cid
    if name: a += ' id="%s"' % esc(name)
    return '<image %s xlink:href="data:image/jpeg;base64,%s"/>' % (a, _imgcache[key])

def PH(x, y, w, h, rx=0, tone=None):
    """Neutral placeholder where the real app shows a seller's own photo."""
    return R(x, y, w, h, fill=tone or "#EAE6DF", rx=rx)

def G(name, *children):
    return '<g id="%s">%s</g>' % (esc(name), "".join(c for c in children if c))

FRAME_CLIP = None
def frame(title, fx, fy, content, w=W, h=H, bg=PAGE):
    """One artboard: caption, page ground, clipped content."""
    body_ = "".join(c for c in content if c)
    cid = clip(0, 0, w, h)
    add('<g id="%s">' % esc(title))
    add(T(title.upper(), fx, fy - 18, MONO, 12, 500, "#8A857C", ls=12*0.16))
    add('<g transform="translate(%g,%g)">' % (fx, fy))
    add(R(0, 0, w, h, fill=bg))
    add('<g clip-path="url(#%s)">%s</g>' % (cid, body_))
    add(R(0, 0, w, h, stroke="#D8D3CA", sw=1))
    add("</g></g>")

# ── baseline helpers (approximate the Flutter line boxes) ─────────────────
def blb(top, size): return top + size * 1.02      # Inter body, height 1.5
def bll(top, size): return top + size * 0.98      # mono label, height 1.3
def bld(top, size): return top + size * 0.84      # Archivo display, height 1.04

def naira(n):
    return "₦" + format(int(n), ",d")

# ══ shared chrome ═════════════════════════════════════════════════════════
def statusbar(dark=False):
    c = "#FFFFFF" if dark else INK
    p = [T("9:41", 30, 30, BODY, 15, 600, c)]
    for i in range(4):                                     # cellular
        p.append(R(316 + i * 5, 22 - i * 2.6, 3, 8 + i * 2.6, fill=c, rx=1))
    p.append('<path d="M341 24 a7 7 0 0 1 10 0" stroke="%s" stroke-width="2" fill="none" '
             'stroke-linecap="round"/>' % c)
    p.append('<path d="M344 27.5 a3 3 0 0 1 4 0" stroke="%s" stroke-width="2" fill="none" '
             'stroke-linecap="round"/>' % c)
    p.append(CIRC(346, 30.5, 1.1, fill=c))
    p.append(R(357, 18, 21, 11, stroke=c, sw=1, rx=3, opacity=0.5))
    p.append(R(359, 20, 15, 7, fill=c, rx=1.5))
    p.append(R(379, 21.5, 1.6, 4, fill=c, opacity=0.5))
    return G("status-bar", *p)

def appbar(title, back=False, actions=("search", "bell"), bell_dot=True):
    p = [T(title, 56 if back else 16, 81.5, DISPLAY, 18, 600, INK, ls=18*-0.035)]
    if back:
        p.append(ICON("arrow-left", 16, 65, 20, INK))
    xs = [316, 360]
    for i, a in enumerate(actions or ()):
        cx = xs[i]
        p.append(ICON(a if a != "bell" else "bell", cx - 10, 65, 20, INK))
        if a == "bell" and bell_dot:
            p.append(CIRC(cx + 7, 66, 3.5, fill=DANGER))
    return G("app-bar", *p)

NAV = [("house", "Home"), ("tag", "Deals"), ("shopping-cart", "Cart"),
       ("package", "Orders"), ("user", "Profile")]

def bottomnav(active=0, cart=0):
    top = 750
    p = [R(0, top, W, 94, fill=CARD), LINE(0, top, W, top, HAIR)]
    cw = W / 5.0
    for i, (ic, label) in enumerate(NAV):
        cx = cw * i + cw / 2
        on = (i == active)
        col = INK if on else INKM
        if on:
            p.append(R(cx - 17, top + 5.5, 34, 2, fill=INK))
        p.append(ICON(ic, cx - 10.5, top + 16.5, 21, col))
        p.append(lab(label, cx, top + 50, 9, col, anchor="middle"))
        if ic == "shopping-cart" and cart:
            p.append(CIRC(cx + 10, top + 15, 7.5, fill=DANGER))
            p.append(lab(str(cart), cx + 10, top + 18, 8, "#FFFFFF", anchor="middle"))
    p.append(R(W/2 - 67, 826, 134, 5, fill=INK, rx=2.5, opacity=0.85))   # home indicator
    return G("bottom-nav", *p)

def fab():
    return G("fab-sell",
             R(318, 678, 56, 56, fill="#D3E4FF", rx=16),
             ICON("plus", 334, 694, 24, "#001C38"))

# ── repeated objects ──────────────────────────────────────────────────────
def feed_section(x, y, eyebrow, title, accent=None, see_all=False, tsize=21):
    """FeedSection: mono eyebrow, display title + italic-serif accent."""
    p = [lab(eyebrow, x, bll(y, 10), 10, INKM)]
    ty = y + 13 + 6
    p.append(disp(title, x, bld(ty, tsize), tsize, INK))
    if accent:
        p.append(ser(" " + accent, x + len(title) * tsize * 0.52, bld(ty, tsize), tsize, INK))
    if see_all:
        p.append(lab("See all", 390 - 16 - 14 - 4 - 46, bld(ty, tsize) - 3, 10, ACCENT))
        p.append(ICON("arrow-right", 390 - 16 - 13, bld(ty, tsize) - 13, 13, ACCENT))
    return G("section-" + re.sub(r"[^a-z]+", "-", title.lower()), *p), y + 13 + 6 + tsize * 1.04 + 16

def rating_row(x, y, rating, count, place=None):
    p = [ICON("star", x, y - 8, 11, STAR), lab("%.1f" % rating, x + 14, y, 9, INK2)]
    xx = x + 14 + 20
    if count is not None:
        p.append(lab("(%d)" % count, xx, y, 9, INKM)); xx += 8 + len(str(count)) * 7
    if place:
        p.append(R(xx + 4, y - 8, 1, 9, fill=HAIR))
        p.append(lab(place, xx + 12, y, 9, INKM))
    return "".join(p)

def product_tile(x, y, w, img, name, price, old=None, off=None, rating=None,
                 count=None, place=None, delivery=None, left=None, fy=0.5, sold=False):
    """ProductCard: 4:5 photo, no border, metadata beneath."""
    ih = w * 5 / 4.0
    p = [R(x, y, w, ih, fill=PAGE), IMG(img, x, y, w, ih, fy=fy)]
    if sold:
        p.append(R(x, y, w, ih, fill=SLAB, opacity=0.55))
        p.append(lab("Sold out", x + w/2, y + ih/2 + 4, 11, SLABFG, anchor="middle"))
    if off:
        lw = 12 + len(str(off)) * 7.5
        p.append(R(x + 8, y + 8, lw, 17, fill=SLAB))
        p.append(lab("-%d%%" % off, x + 14, y + 20.5, 9, SLABFG))
    ty = y + ih + 12
    words, lines, cur = name.split(" "), [], ""
    for wd in words:
        t = (cur + " " + wd).strip()
        if len(t) * 6.4 > w and cur:
            lines.append(cur); cur = wd
        else:
            cur = t
    lines.append(cur); lines = lines[:2]
    for i, ln in enumerate(lines):
        p.append(body(ln + ("…" if i == 1 and len(lines) < len(words) else ""),
                      x, blb(ty + i * 19, 14), 14, INK, 500))
    ty += len(lines) * 19 + 8
    p.append(fig(price, x, bld(ty, 16), 16, INK))
    if old:
        p.append(strike(old, x + len(price) * 9.4 + 8, bld(ty, 16), 12))
    ty += 16 * 1.05 + 8
    if rating is not None or place:
        pl = place
        if pl:
            room = int((w - 34 - (len(str(count)) * 7 + 10 if count else 0)) / 7.2)
            if len(pl) > room:
                pl = pl[:max(3, room - 1)].rstrip() + "…"
        p.append(rating_row(x, ty + 9, rating if rating else 0, count, pl))
        ty += 13
    if delivery or left:
        ty += 4
        xx = x
        if delivery:
            p.append(ICON("truck", xx, ty + 1, 10, INKM))
            p.append(lab(delivery, xx + 13, ty + 9, 9, INKM))
            xx += 13 + len(delivery) * 7 + 12
            p.append(R(xx - 6, ty + 1, 1, 9, fill=HAIR))
        if left:
            p.append(lab(("Only %d left" % left) if left <= 5 else ("%d left" % left),
                         xx, ty + 9, 9, DANGER if left <= 5 else INKM))
    return G("product-card", *p)

def primary_button(x, y, w, label, icon=None, h=46):
    p = [R(x, y, w, h, fill=INK, rx=2)]
    tw = len(label) * 8.0
    sx = x + (w - tw - (22 if icon else 0)) / 2
    if icon:
        p.append(ICON(icon, sx, y + h/2 - 8, 16, CARD)); sx += 26
    p.append(lab(label, sx, y + h/2 + 4, 11, CARD))
    return G("btn-primary", *p)

def secondary_button(x, y, w, label, h=46):
    return G("btn-secondary",
             R(x, y, w, h, fill=CARD, stroke=HAIR, rx=2),
             lab(label, x + w/2, y + h/2 + 4, 11, INK, anchor="middle"))

def panel(x, y, w, h, fill=CARD):
    return R(x, y, w, h, fill=fill, stroke=HAIR, rx=2)

def status_chip(x, y, status, w=None):
    col = {"PENDING": WARNING, "PROCESSING": ACCENT, "ON_THE_WAY": ACCENT,
           "RIDER_ASSIGNED": ACCENT, "DELIVERED": SUCCESS, "COMPLETED": SUCCESS,
           "CANCELLED": INKM, "DISPUTED": DANGER}.get(status, INKM)
    txt = status.replace("_", " ")
    w = w or (len(txt) * 7.6 + 16)
    return G("status-chip",
             R(x, y, w, 22, fill=col, opacity=0.10, rx=2),
             R(x, y, w, 22, stroke=col, sw=1, rx=2, opacity=0.30),
             lab(txt, x + 8, y + 15, 10, col))

def textfield(x, y, w, label, value, icon=None, muted=True, h=50, suffix=None):
    p = [lab(label, x, bll(y, 10), 10, INK2)]
    ty = y + 13 + 8
    p.append(R(x, ty, w, h, fill=CARD, stroke=HAIR, rx=2))
    tx = x + 16
    if icon:
        p.append(ICON(icon, tx, ty + h/2 - 9, 18, INKM)); tx += 28
    p.append(body(value, tx, ty + h/2 + 5, 15, INKM if muted else INK))
    if suffix:
        p.append(ICON(suffix, x + w - 34, ty + h/2 - 9, 18, INK2))
    return G("field-" + re.sub(r"[^a-z]+", "-", label.lower()), *p), ty + h
