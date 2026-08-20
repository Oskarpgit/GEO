#!/usr/bin/env python3
"""One-pager debrief for partners, styled to the Shoppalyzer brand.

Palette and type come from shoppalyzer-landing/src/index.css and
shoppalyzer-landing/public/shoppalyzer-mark.svg. Fonts are vendored in
assets/fonts so the build does not depend on the network.

    <venv>/bin/python3 build_onepager.py
"""
import os

from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

OUT = "debrief-partnerzy-widocznosc-ai.pdf"
FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "fonts")

pdfmetrics.registerFont(TTFont("Sans", f"{FONTS}/Geist-Regular.ttf"))
pdfmetrics.registerFont(TTFont("Sans-Semi", f"{FONTS}/Geist-SemiBold.ttf"))
pdfmetrics.registerFont(TTFont("Sans-Bold", f"{FONTS}/Geist-Bold.ttf"))
pdfmetrics.registerFont(TTFont("Display", f"{FONTS}/Sora-Bold.ttf"))

# Brand tokens, resolved from the landing page CSS variables.
NAVY = HexColor("#1E4D72")        # --primary
INK = HexColor("#0D263B")         # --foreground
MUTED = HexColor("#5C6D7A")       # --muted-foreground
AMBER = HexColor("#E8843A")       # --accent-brand
PAGE = HexColor("#FAFAF7")        # --background
CARD = HexColor("#FFFFFF")        # --surface
BORDER = HexColor("#E5E2DC")      # --border
SOFT = HexColor("#EFF5FB")        # --primary-soft
HAIR = HexColor("#EFEDE8")
RADIUS = 2.6 * mm                 # --radius 10px

W, H = A4
ML = 15 * mm
CW = W - 2 * ML

c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle("Widocznosc w AI dla sprzedawcow e-commerce")

c.setFillColor(PAGE)
c.rect(0, 0, W, H, stroke=0, fill=1)

y = H - 15 * mm


def wrap(text, font, size, width):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if pdfmetrics.stringWidth(trial, font, size) <= width:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def logo(x, y_base, scale=1.0):
    """Shoppalyzer mark plus wordmark, traced from shoppalyzer-mark.svg."""
    s = scale
    c.saveState()
    c.setLineCap(1)
    c.setLineJoin(1)
    cx, cy, r = x + 3.4 * s * mm, y_base + 2.2 * s * mm, 3.2 * s * mm
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.85 * s * mm)
    c.circle(cx, cy, r, stroke=1, fill=0)
    p = c.beginPath()
    pts = [(-1.75, -0.75), (-0.95, 0.05), (-0.1, -0.35), (0.7, 1.1), (1.5, 0.55)]
    p.moveTo(cx + pts[0][0] * s * mm, cy + pts[0][1] * s * mm)
    for px, py in pts[1:]:
        p.lineTo(cx + px * s * mm, cy + py * s * mm)
    c.setLineWidth(0.38 * s * mm)
    c.drawPath(p, stroke=1, fill=0)
    c.setFillColor(AMBER)
    c.circle(cx + 1.5 * s * mm, cy + 0.55 * s * mm, 0.45 * s * mm, stroke=0, fill=1)
    c.setStrokeColor(NAVY)
    c.setLineWidth(0.85 * s * mm)
    c.line(cx + 2.3 * s * mm, cy - 2.3 * s * mm, cx + 4.4 * s * mm, cy - 4.4 * s * mm)
    c.setFont("Sans-Bold", 13 * s)
    c.setFillColor(NAVY)
    to = c.beginText(x + 9.6 * s * mm, y_base)
    to.setCharSpace(-0.3)          # matches letter-spacing -0.6 on the SVG wordmark
    to.textOut("Shoppalyzer")
    c.drawText(to)
    c.restoreState()


def heading(text, size=10.4, gap_before=6.2, gap_after=5.0):
    global y
    y -= gap_before * mm
    c.setFont("Display", size)
    c.setFillColor(INK)
    c.drawString(ML, y, text)
    y -= gap_after * mm


def body(text, size=9.0, leading=4.5, color=INK, width=None):
    global y
    c.setFont("Sans", size)
    c.setFillColor(color)
    for line in wrap(text, "Sans", size, width or CW):
        c.drawString(ML, y, line)
        y -= leading * mm


def bullet(head, text, size=9.0):
    global y
    lead = 4.5 * mm
    dot_x, text_x = ML + 1.3 * mm, ML + 5.2 * mm
    c.setFillColor(AMBER)
    c.circle(dot_x, y + 1.1 * mm, 0.75 * mm, stroke=0, fill=1)
    c.setFont("Sans-Semi", size)
    c.setFillColor(INK)
    c.drawString(text_x, y, head)
    hw = pdfmetrics.stringWidth(head + " ", "Sans-Semi", size)
    c.setFont("Sans", size)
    c.setFillColor(MUTED)
    first = wrap(text, "Sans", size, CW - (text_x - ML) - hw)
    if first:
        c.drawString(text_x + hw, y, first[0])
    y -= lead
    rest = " ".join(first[1:]) if len(first) > 1 else ""
    for line in wrap(rest, "Sans", size, CW - (text_x - ML)) if rest else []:
        c.drawString(text_x, y, line)
        y -= lead


def stat_cards(items):
    global y
    gap = 3 * mm
    cw = (CW - gap * (len(items) - 1)) / len(items)
    body_lines = max(len(wrap(cap, "Sans", 7.5, cw - 9 * mm)) for _, cap in items)
    h = 11 * mm + body_lines * 3.4 * mm
    top = y
    for i, (big, cap) in enumerate(items):
        x = ML + i * (cw + gap)
        c.setFillColor(CARD)
        c.setStrokeColor(BORDER)
        c.setLineWidth(0.5)
        c.roundRect(x, top - h, cw, h, RADIUS, stroke=1, fill=1)
        c.setFont("Display", 16)
        c.setFillColor(NAVY)
        c.drawString(x + 4.5 * mm, top - 8.2 * mm, big)
        c.setFont("Sans", 7.5)
        c.setFillColor(MUTED)
        yy = top - 13.2 * mm
        for line in wrap(cap, "Sans", 7.5, cw - 9 * mm):
            c.drawString(x + 4.5 * mm, yy, line)
            yy -= 3.4 * mm
    y = top - h


def promise(text):
    global y
    y -= 1.5 * mm
    lines = wrap(text, "Sans-Semi", 10.2, CW - 14 * mm)
    h = 9.6 * mm + len(lines) * 5.3 * mm
    top = y
    c.setFillColor(NAVY)
    c.roundRect(ML, top - h, CW, h, RADIUS, stroke=0, fill=1)
    c.setFillColor(AMBER)
    c.rect(ML + 6 * mm, top - 6.0 * mm, 12 * mm, 0.7 * mm, stroke=0, fill=1)
    c.setFont("Sans-Semi", 10.2)
    c.setFillColor(white)
    yy = top - 11.6 * mm
    for line in lines:
        c.drawString(ML + 6 * mm, yy, line)
        yy -= 5.3 * mm
    y = top - h


def cost_card(rows, note):
    global y
    note_lines = wrap(note, "Sans", 8.3, CW - 12 * mm)
    h = 6.6 * mm + len(rows) * 5.0 * mm + len(note_lines) * 4.0 * mm + 1.0 * mm
    top = y + 3.5 * mm
    c.setFillColor(CARD)
    c.setStrokeColor(BORDER)
    c.setLineWidth(0.5)
    c.roundRect(ML, top - h, CW, h, RADIUS, stroke=1, fill=1)
    yy = top - 6.6 * mm
    for i, (label, value) in enumerate(rows):
        c.setFont("Sans", 8.5)
        c.setFillColor(MUTED)
        c.drawString(ML + 6 * mm, yy, label)
        c.setFont("Sans-Bold", 8.5)
        c.setFillColor(INK)
        c.drawRightString(ML + CW - 6 * mm, yy, value)
        if i < len(rows) - 1:
            c.setStrokeColor(HAIR)
            c.setLineWidth(0.4)
            c.line(ML + 6 * mm, yy - 1.9 * mm, ML + CW - 6 * mm, yy - 1.9 * mm)
        yy -= 5.0 * mm
    yy -= 0.4 * mm
    c.setFont("Sans", 8.3)
    c.setFillColor(NAVY)
    for line in note_lines:
        c.drawString(ML + 6 * mm, yy, line)
        yy -= 4.0 * mm
    y = top - h


# ---------------------------------------------------------------- content
logo(ML, y - 1.5 * mm, scale=1.0)
c.setFont("Sans", 7.6)
c.setFillColor(MUTED)
c.drawRightString(ML + CW, y - 1.5 * mm, "Debrief dla partnerów  ·  7 sierpnia 2026  ·  nowy kierunek produktowy")
y -= 12.5 * mm

c.setFont("Display", 18)
c.setFillColor(INK)
c.drawString(ML, y, "Widoczność w AI dla sprzedawców e-commerce")
y -= 7.0 * mm

body(
    "Kupujący coraz częściej pyta asystenta AI zamiast wyszukiwarki. Sprzedawca nie ma dziś jak sprawdzić, "
    "czy asystent wskazuje jego produkt, ani na własnym sklepie, ani na Allegro. Chcemy to zmierzyć "
    "i pokazać, co zmienić.",
    size=9.4, leading=4.7, color=MUTED,
)

y -= 2.5 * mm
stat_cards([
    ("83%", "produktów w karuzelach ChatGPT pochodzi z feedu Google Shopping, nie z treści na stronie"),
    ("64%", "trafności rekomendacji produktowych wg benchmarku OpenAI: co trzecia zawiera błąd"),
    ("0 z 40+", "narzędzi widoczności w AI mierzy poziom produktu, wszystkie mierzą marki"),
])

heading("Co robimy, w trzech krokach")
bullet("Mierzymy.", "Zadajemy asystentowi polskie pytania zakupowe z kategorii, po kilka razy każde, i zapisujemy co pokazał, na której pozycji i czyje.")
bullet("Diagnozujemy oba kanały.", "Sklep: feed, GTIN-y, dane strukturalne, dostęp crawlerów AI, struktura strony. Allegro: tytuł, parametry kategorii, EAN, opis.")
bullet("Dajemy gotowe poprawki.", "Wartości pól do wklejenia, sprawdzone pod limity i regulaminy platform. Publikacja przez API w drugim etapie.")

promise("Pokazujemy, czy asystenci AI wskazują Twój produkt, i mówimy, w którym kanale masz co poprawić.")

heading("Czym się różnimy od 40 istniejących narzędzi")
bullet("Mierzymy pojedynczy produkt.", "„Pojawiliśmy się w 40 odpowiedziach” nie mówi, którego z 400 produktów AI pomija. Asystent poleca konkretny produkt, więc tam trzeba patrzeć.")
bullet("Dwa kanały w jednym raporcie.", "Nikt nie powie sprzedawcy: na Allegro poprawisz cztery pola i to wszystko, a na sklepie masz niekompletny feed, który blokuje Cię u źródła.")
bullet("Zapisujemy dowód każdego pomiaru.", "Surowa odpowiedź, zrzut, data, liczba powtórzeń. Odpowiedzi AI są losowe, więc bez dowodu i metodyki liczby nie da się obronić przed klientem.")

heading("Ile to kosztuje")
cost_card([
    ("Koszty stałe miesięcznie: Railway, Supabase, przeglądarka, konto ChatGPT, LLM", "150–310 zł"),
    ("Pomiar katalogu 200 pytań raz w miesiącu, dzielony przez wszystkich klientów", "120–480 zł"),
    ("Audyt jednego produktu: diagnoza, rekomendacje, gotowa treść", "0,20–0,50 zł"),
    ("Klient z 20 produktami w kategorii już pokrytej pomiarem", "4–10 zł / mies."),
    ("Pierwszy klient w nowej kategorii, jednorazowo za zmierzenie jej pytań", "12–145 zł"),
    ("Próg opłacalności przy abonamencie 249 zł / mies.", "2–4 klientów"),
], "Ponad 90% kosztu jest wspólne. Pomiar przypisujemy pytaniu i kategorii, nie klientowi, więc koszt rośnie "
   "z liczbą kategorii, a nie z liczbą klientów.")

heading("Ryzyko i czego nie obiecujemy")
bullet("Nie obiecujemy wzrostu sprzedaży.", "Dowody na konwersję z ruchu AI są sprzeczne: badanie na 973 sklepach pokazuje wynik gorszy od kanałów tradycyjnych. Ruch z AI rośnie o 632% rocznie, ale to nadal ok. 0,2% sesji.")
bullet("Jedno założenie wciąż niesprawdzone.", "Nie wiemy jeszcze, co ChatGPT pokazuje dla polskich zapytań zakupowych. Cztery z pięciu możliwych wyników zmieniają produkt.")

heading("Najbliższy krok")
body(
    "Pierwsza wersja nie wymaga dostępu do API Allegro ani osobowości prawnej, bo działa na publicznych stronach "
    "ofert i na feedzie sklepu. Najbliższy krok to półgodzinny test: 15 polskich pytań zakupowych w trzech "
    "kategoriach, po trzy powtórzenia, i spis tego, co faktycznie się pokazuje. Wynik ustawia kolejność prac.",
    color=MUTED,
)

c.setStrokeColor(BORDER)
c.setLineWidth(0.5)
c.line(ML, 14.5 * mm, ML + CW, 14.5 * mm)
c.setFont("Sans", 6.4)
c.setFillColor(MUTED)
c.drawString(ML, 11 * mm, "Źródła: Search Engine Land (III 2026, 5 000+ karuzeli) · benchmark OpenAI Shopping Research · Contentsquare 2026 · Kaiser & Schulze (973 sklepy) · Tidio 2026")
c.drawString(ML, 8 * mm, "Dokument wewnętrzny. Koszty podane w widełkach, koszt sesji pomiarowej do potwierdzenia w teście.")

c.showPage()
c.save()
print(f"written: {OUT}")
