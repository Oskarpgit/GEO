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

## Następny etap

Dla pierwszej aktywnej oferty Allegro w każdym pozytywnym teście należy:

1. potwierdzić tożsamość produktu i aktywność oferty,
2. znaleźć 3–4 aktywne oferty dokładnie tego samego produktu,
3. pobrać kompletne strony zwycięzcy i kontroli,
4. wyliczyć cechy opisu oraz czynniki kontrolne,
5. zapisać dowody i hashe, bez kopiowania pełnych opisów konkurencji do repozytorium.

