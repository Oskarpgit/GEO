# Shoppalyzer GEO

System audytu ofert Allegro i pomiaru widoczności konkretnego `offer_id` w odpowiedziach modeli językowych.

## Kierunek produktu

Pierwszy rynek to `allegro.pl`. Korpus startowy obejmuje 20 ofert z 12 kategorii, w tym elektronikę, RTV/AGD, konsole, smartwatche i aparaty. Główna interwencja dotyczy opisu oferty. Cena, dostawa, promocja, zdjęcia, parametry i jakość sprzedawcy są zapisywane jako zmienne kontrolne.

Sprzedaż nie jest etykietą jakości GEO. System mierzy pojawienie, pozycję, link do konkretnej oferty, poprawność tożsamości i stabilność wyniku między powtórzeniami.

## Stan implementacji

Wersja `0.1.0` zawiera:

- typy domenowe dla snapshotów ofert, dowodów, reguł i prób pomiarowych;
- parser publicznej strony oferty Allegro;
- wersjonowany rejestr reguł tytułu, opisu i parametrów;
- deterministyczny walidator oddzielający `failed`, `needs_review` i `not_evaluated`;
- dopasowanie tożsamości po GTIN, `product_id`, marce, modelu i liczbie sztuk;
- metryki widoczności konkretnego `offer_id`, które pomijają nieudane próby;
- testy na fixture Philips EP2334/10 oraz na zapisanym wyniku Firecrawl.
- wersjonowany korpus 20 zróżnicowanych ofert, z profilami opisów, wynikami reguł i hashami dowodów źródłowych.
- pilot widoczności retrievalu LLM dla 20 ofert, który osobno mierzy domenę, produkt i konkretny `offer_id`.
- wyjaśnialny `GEO Score v0.1` (0–100), który oddziela jakość treści od walidacji Allegro i faktycznej widoczności;
- deterministyczne rekomendacje bez dopisywania niepotwierdzonych cech produktu;
- kalibrację obserwacyjną na 43 dopasowanych parach ofert, bez uczenia wag na zbyt małej próbce.

## Uruchomienie

Wymagany jest Node.js 24 lub nowszy.

```bash
npm install
npm run typecheck
npm test
npm run eval:build -- <ścieżka-do-lokalnego-run-firecrawl>
npm run eval:llm-pilot
npm run model:calibrate
```

## Struktura

```text
src/
  domain/       kontrakty i stany
  identity/     dopasowanie produktu i oferty
  measurement/  metryki widoczności LLM
  parser/       ekstrakcja publicznej strony Allegro
  rules/        wersjonowane reguły i silnik walidacji
  scoring/      cechy, GEO Score, rekomendacje i kalibracja
test/
  fixtures/     małe, zanonimizowane dokumenty testowe
data/evals/     wersjonowane przypadki i raporty bez pełnych opisów konkurencji
HANDOFF-widocznosc-ai.md
```

## Ważne zasady

- Nieudana próba pomiarowa nie jest brakiem widoczności.
- Strona produktu nie jest linkiem do konkretnej oferty.
- Sprzeczny GTIN oznacza brak dopasowania.
- Wielopak nie jest tym samym wariantem co jedna sztuka.
- Reguła wymagająca oceny semantycznej nie może otrzymać automatycznie `passed`.
- Kandydat opisu z błędem `blocker` albo `error` nie jest gotowy do użycia.
- Treści konkurencyjnych ofert służą do wykrywania cech i luk, nigdy do kopiowania.
- `GEO Score` nie jest prognozą pozycji ani dowodem wpływu przyczynowego opisu.
- Wynik zgodności Allegro nie jest dodawany do `GEO Score`; oba wyniki są raportowane osobno.

## Materiały koncepcyjne

[HANDOFF-widocznosc-ai.md](HANDOFF-widocznosc-ai.md) zachowuje historię researchu, decyzji i ograniczeń. Kierunek Allegro-first oraz aktualne kontrakty mają pierwszeństwo przed wcześniejszym założeniem, że ścieżką główną będzie własny sklep.

Repo zawiera również generator i pliki wcześniejszego one-pagera partnerskiego. Nie są one częścią runtime produktu.
