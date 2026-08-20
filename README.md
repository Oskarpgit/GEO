# shoppalyzer_geo

Moduł widoczności w AI dla sprzedawców e-commerce. Audyt sprawdzający, czy asystenci AI wskazują produkt sprzedawcy, i co konkretnie zmienić, żeby zaczęły.

**Status:** faza brainstormingu, przed spisaniem specyfikacji. Zero kodu produktowego. Architektura świadomie niezależna od Shoppalyzera.

## Zacznij tutaj

**[HANDOFF-widocznosc-ai.md](HANDOFF-widocznosc-ai.md)** zawiera wszystko: skąd wziął się pomysł, ustalenia z researchu z podziałem na potwierdzone i sprzeczne, twarde ograniczenia prawne i dostępowe po stronie Allegro, dziennik decyzji wraz z odrzuconymi kierunkami, architekturę, katalog rekomendacji, model kosztowy, pytania otwarte oraz instrukcję odtworzenia sesji na innym urządzeniu.

Jedno pytanie blokuje przejście do specyfikacji i nie da się go rozstrzygnąć researchem. Opisane w sekcji 10.1 handoffu. Przeczytaj je przed jakąkolwiek pracą nad tym projektem.

## Zawartość

```
HANDOFF-widocznosc-ai.md    pełny handoff, 13 sekcji
build_onepager.py           skład one-pagera dla partnerów (reportlab)
debrief-partnerzy-*.pdf     one-pager, wersje
podglad-v2-brand.png        podgląd bieżącej wersji
assets/fonts/               Geist i Sora, SIL OFL 1.1
```

## Przebudowa one-pagera

```bash
python3 -m venv /tmp/pdfvenv && /tmp/pdfvenv/bin/pip install reportlab
python3 -c "pass" && /tmp/pdfvenv/bin/python3 build_onepager.py
```

Fonty są w repo, więc build nie wymaga sieci. Paleta i logo pochodzą z `shoppalyzer-landing/src/index.css` i `public/shoppalyzer-mark.svg` w repo landingu, wartości wypisane w sekcji 11 handoffu.

## Konwencje

Bez długich pauz w treści dokumentów, półpauzy w zakresach liczbowych są w porządku. Teksty przechodzą przez zasady anti-ai-writing.
