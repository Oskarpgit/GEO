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
- ekstrakcję faktów ze ścieżką do pola źródłowego oraz jawny etap ich akceptacji;
- deterministyczny generator opisów, w którym każdy blok jest odtwarzalny z zatwierdzonych `claimIds`;
- walidację pochodzenia treści i zasad Allegro po wygenerowaniu;
- klasyfikację eksperymentów opisu przed/po z wykrywaniem zmian ceny, dostawy, tytułu, parametrów, zdjęć i jakości sprzedawcy.
- bezpiecznego klienta `GET /sale/product-offers/{offerId}` i `GET /sale/products/{productId}`;
- adapter tożsamości Katalogu Allegro z pochodzeniem na poziomie pola, wykrywaniem konfliktów i blokadą zgadywania z tytułu.
- działającą aplikację webową `apps/web` z modułami `GEO / Analizy`, audytem oferty, rekomendacjami oraz zatwierdzaniem faktów przed generowaniem opisu.

## Uruchomienie

Wymagany jest Node.js 24 lub nowszy.

```bash
npm install
npm run typecheck
npm test
npm run eval:build -- <ścieżka-do-lokalnego-run-firecrawl>
npm run eval:llm-pilot
npm run model:calibrate
npm run model:evaluate-generator
npm run web:dev
npm run web:build
npm run web:lint
```

## Struktura

```text
src/
  domain/       kontrakty i stany
  experiments/  kontrola porównań opisu przed/po
  generation/   fakty, zatwierdzanie, kandydat i walidacja pochodzenia
  identity/     dopasowanie produktu i oferty
  integrations/ klienci i adaptery zewnętrznych źródeł danych
  measurement/  metryki widoczności LLM
  parser/       ekstrakcja publicznej strony Allegro
  rules/        wersjonowane reguły i silnik walidacji
  scoring/      cechy, GEO Score, rekomendacje i kalibracja
apps/web/       aplikacja webowa Shoppalyzer GEO i API analizy
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
- Fakt odczytany z oferty nie trafia do generatora przed jawnym zatwierdzeniem.
- Fakt z Katalogu Allegro również pozostaje `source_backed`; integracja nie zatwierdza go automatycznie.
- Dane Katalogu Allegro mogą być używane tylko w ofertach Allegro.
- Publiczny link jest najpierw pobierany bezpośrednio. Po blokadzie `403` aplikacja
  może użyć opcjonalnego, serwerowego fallbacku Firecrawl do pobrania surowego
  HTML; produkcyjna tożsamość katalogowa nadal wymaga OAuth sprzedawcy.
- Kandydat deterministyczny z poprawnym pochodzeniem nadal wymaga ręcznego przeglądu reguł semantycznych.

## Materiały koncepcyjne

[HANDOFF-widocznosc-ai.md](HANDOFF-widocznosc-ai.md) zachowuje historię researchu, decyzji i ograniczeń. Kierunek Allegro-first oraz aktualne kontrakty mają pierwszeństwo przed wcześniejszym założeniem, że ścieżką główną będzie własny sklep.

Repo zawiera również generator i pliki wcześniejszego one-pagera partnerskiego. Nie są one częścią runtime produktu.
