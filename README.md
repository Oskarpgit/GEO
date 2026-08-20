# Shoppalyzer GEO

System audytu ofert Allegro i pomiaru widoczności konkretnego `offer_id` w odpowiedziach modeli językowych.

## Kierunek produktu

Pierwszy rynek to `allegro.pl`, a pierwsza kategoria pilotażowa to automatyczne ekspresy do kawy. Główna interwencja dotyczy opisu oferty. Cena, dostawa, promocja, zdjęcia, parametry i jakość sprzedawcy są zapisywane jako zmienne kontrolne.

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

## Uruchomienie

Wymagany jest Node.js 24 lub nowszy.

```bash
npm install
npm run typecheck
npm test
```

## Struktura

```text
src/
  domain/       kontrakty i stany
  identity/     dopasowanie produktu i oferty
  measurement/  metryki widoczności LLM
  parser/       ekstrakcja publicznej strony Allegro
  rules/        wersjonowane reguły i silnik walidacji
test/
  fixtures/     małe, zanonimizowane dokumenty testowe
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

## Materiały koncepcyjne

[HANDOFF-widocznosc-ai.md](HANDOFF-widocznosc-ai.md) zachowuje historię researchu, decyzji i ograniczeń. Kierunek Allegro-first oraz aktualne kontrakty mają pierwszeństwo przed wcześniejszym założeniem, że ścieżką główną będzie własny sklep.

Repo zawiera również generator i pliki wcześniejszego one-pagera partnerskiego. Nie są one częścią runtime produktu.

