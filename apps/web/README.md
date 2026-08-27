# Shoppalyzer GEO web

Aplikacja jest odseparowanym modułem gotowym do późniejszej konsolidacji z
istniejącą stroną Shoppalyzer. Lewa nawigacja rozdziela model GEO od modułu
analiz sprzedażowych, dzięki czemu ich wyniki nie są mieszane.

## Działający przepływ

1. Użytkownik podaje publiczny link do konkretnej oferty Allegro albo uruchamia
   zweryfikowany przykład demonstracyjny.
2. Endpoint `/api/analyze` waliduje domenę, pełne `offer_id` i rozmiar
   odpowiedzi. Najpierw próbuje pobrać stronę bezpośrednio, a po blokadzie `403`
   może uruchomić kontrolowany fallback Firecrawl.
3. Firecrawl pobiera wyłącznie surowy HTML bez ekstrakcji LLM. Parametry
   śledzące są usuwane przed wysłaniem adresu, a wynik nadal przechodzi ten sam
   parser i ograniczenia bezpieczeństwa.
4. Interfejs pokazuje GEO Score, jego składowe i rekomendacje oddzielnie od
   zgodności Allegro.
5. Fakty produktu mają stan `source_backed`; użytkownik jawnie zaznacza fakty,
   których wolno użyć w nowym opisie.
6. Generator tworzy wyłącznie bloki odtwarzalne z zatwierdzonych faktów i
   pokazuje wynik walidacji.

## Granice wersji demonstracyjnej

- GEO Score nie prognozuje sprzedaży ani pozycji.
- Odczyt publicznej strony może zostać ograniczony przez Allegro. Firecrawl jest
  opcjonalnym fallbackiem, a nie źródłem tożsamości katalogowej.
- Połączenie Katalogu Allegro i konta sprzedawcy wymaga OAuth; token nie jest
  częścią kodu ani wdrożenia demonstracyjnego.
- Reguły semantyczne Allegro nadal wymagają przeglądu człowieka.
- Moduł `Analizy` jest miejscem integracji istniejącego modelu, nie jego kopią.

## Uruchomienie

Z katalogu głównego repozytorium:

```bash
npm run web:dev
npm run web:build
npm run web:lint
```

## Firecrawl lokalnie

Skopiuj `apps/web/.env.example` do ignorowanego `apps/web/.env.local` i wpisz
klucz wyłącznie w lokalnym pliku:

```dotenv
FIRECRAWL_API_KEY=...
FIRECRAWL_PROXY_MODE=basic
```

Klucz jest odczytywany tylko w route handlerze i nigdy nie trafia do kodu
klienckiego. Domyślny tryb `basic` ogranicza koszt. `auto` lub `enhanced` należy
włączyć świadomie, ponieważ mogą zużywać więcej kredytów. Odpowiedzi są
cache'owane przez 6 godzin, a Firecrawl uruchamia się dopiero po `403` albo po
błędzie połączenia, jeżeli klucz jest skonfigurowany.

W docelowej integracji Supabase obecny odczyt zmiennej środowiskowej zostanie
zastąpiony serwerowym dostawcą sekretu. Klucz nie powinien znaleźć się w zwykłej
tabeli, odpowiedzi API ani zmiennej `NEXT_PUBLIC_*`.
