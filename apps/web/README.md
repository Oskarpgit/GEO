# Shoppalyzer GEO web

Aplikacja jest odseparowanym modułem gotowym do późniejszej konsolidacji z
istniejącą stroną Shoppalyzer. Lewa nawigacja rozdziela model GEO od modułu
analiz sprzedażowych, dzięki czemu ich wyniki nie są mieszane.

## Działający przepływ

1. Użytkownik podaje publiczny link do konkretnej oferty Allegro albo uruchamia
   zweryfikowany przykład demonstracyjny.
2. Endpoint `/api/analyze` waliduje domenę i rozmiar odpowiedzi, następnie
   korzysta z parsera oraz rdzenia modelu znajdującego się w `src/`.
3. Interfejs pokazuje GEO Score, jego składowe i rekomendacje oddzielnie od
   zgodności Allegro.
4. Fakty produktu mają stan `source_backed`; użytkownik jawnie zaznacza fakty,
   których wolno użyć w nowym opisie.
5. Generator tworzy wyłącznie bloki odtwarzalne z zatwierdzonych faktów i
   pokazuje wynik walidacji.

## Granice wersji demonstracyjnej

- GEO Score nie prognozuje sprzedaży ani pozycji.
- Odczyt publicznej strony może zostać ograniczony przez Allegro.
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
