# LLM Discovery 20 v1 — run 2026-08-20

## Zakres

- 20 neutralnych intencji zakupowych wykonanych w świeżych rozmowach ChatGPT.
- Te same 20 intencji wykonanych w świeżych rozmowach Gemini.
- Wyszukiwanie dotyczyło aktualnych, bezpośrednich ofert sprzedawców Allegro.
- Zapisano pełny tekst odpowiedzi, URL rozmowy i wszystkie linki odpowiedzi.

## Wyniki techniczne

| Silnik | Ukończone testy | Unikalne linki w odpowiedziach | Bezpośrednie linki ofert Allegro | Testy bez bezpośredniej oferty |
|---|---:|---:|---:|---:|
| ChatGPT | 20/20 | 92 | 67 | 3 |
| Gemini | 20/20 | 90 | 88 | 1 |
| Razem | 40/40 | 182 | 155 | 4 |

## Walidacja ofert i opisów

Etap porównawczy wznowiono i zakończono 2026-08-24. Dla pierwszej aktywnej,
bezpośredniej oferty z każdej odpowiedzi LLM pobrano pełną stronę Allegro,
wyliczono profil opisu i szukano aktywnych ofert kontrolnych dokładnie tego
samego produktu. Dopasowanie kontroli wymagało zgodności `product_id`, GTIN albo
spójnych sygnałów marki i modelu.

| Silnik | Przetworzone | Pełne (3–4 kontrole) | Częściowe | Negatywne | Błędy | Zweryfikowane kontrole |
|---|---:|---:|---:|---:|---:|---:|
| ChatGPT | 20/20 | 4 | 12 | 4 | 0 | 23 |
| Gemini | 20/20 | 3 | 15 | 2 | 0 | 20 |
| Razem | 40/40 | 7 | 27 | 6 | 0 | 43 |

Status `częściowy` nie oznacza błędu testu. Oznacza, że znaleziono i
przeanalizowano aktywną ofertę wskazaną przez LLM, ale po wyszukiwaniu tytułu,
GTIN, kodu producenta oraz marki i modelu nie udało się potwierdzić co najmniej
trzech aktywnych kontroli o tej samej tożsamości. Takich ofert nie zastępowano
podobnymi wariantami, ponieważ zanieczyściłoby to dane uczące.

Po globalnej deduplikacji ChatGPT wskazał 66 unikalnych ofert, a Gemini 87. Tylko 2 bezpośrednie oferty pojawiły się w obu silnikach:

- Philips LatteGo 5500 EP5547/90, oferta `15664591213`.
- Sony ZV-E10 II 16–50 mm, oferta `18462785436`.

## Pierwsze wnioski

1. Widoczność oferty jest silnie zależna od silnika LLM. Wspólny zbiór ofert ChatGPT i Gemini jest bardzo mały.
2. Gemini częściej spełniał wymóg bezpośrednich linków do ofert. ChatGPT częściej zwracał listingi, karty kategorii albo źródła zewnętrzne.
3. Wyniki negatywne pozostają w zbiorze. Są potrzebne do uczenia detektora braku widoczności oraz oceny niezawodności odpowiedzi.
4. Sama obecność w odpowiedzi nie dowodzi wpływu opisu na widoczność. Kolejny etap porównuje pełną treść wskazanej oferty z 3–4 ofertami kontrolnymi tego samego produktu.

## Pliki

- `chatgpt/DISC-01.json` … `chatgpt/DISC-20.json` — surowe wyniki ChatGPT.
- `gemini/DISC-01.json` … `gemini/DISC-20.json` — surowe wyniki Gemini.
- `summary.json` — klasyfikacja i metryki każdego testu.
- `../../prompts.json` — zamrożony zestaw promptów.
- `../../PROTOCOL.md` — protokół badania.

## Zrealizowany etap porównawczy

Dla pierwszej aktywnej oferty Allegro w każdym pozytywnym teście wykonano:

1. potwierdzenie tożsamości produktu i aktywności oferty,
2. wyszukiwanie 3–4 aktywnych ofert dokładnie tego samego produktu,
3. pobranie kompletnych stron zwycięzcy i znalezionych kontroli,
4. wyliczenie cech opisu oraz czynników kontrolnych,
5. zapis bezpiecznych profili i hashy bez kopiowania pełnych opisów konkurencji
   do repozytorium.

Pełne HTML pozostają lokalnie w ignorowanym katalogu `.evidence/`. Wersjonowany
plik `offer-comparisons.json` jest bezpiecznym wejściem do dalszych analiz i
budowy modelu rekomendującego poprawki opisów GEO.
