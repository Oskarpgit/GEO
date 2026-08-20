# LLM Discovery 20 v1

## Cel

Najpierw odkryć oferty wskazywane przez ChatGPT i Gemini, a następnie porównać pełną treść widocznej oferty z 3–4 niewidocznymi ofertami dokładnie tego samego produktu.

## Przebieg pojedynczego testu

1. Uruchom świeżą rozmowę bez historii i pamięci poprzedniego testu.
2. Włącz wyszukiwanie WWW modelu.
3. Wyślij zapytanie bez nazwy oczekiwanego produktu i bez `offer_id`.
4. Zapisz pełną odpowiedź, kolejność rekomendacji, cytowania i wszystkie URL-e.
5. Rozpoznaj każdy URL jako: konkretna oferta, karta produktu, listing, domena zewnętrzna albo błędny link.
6. Pierwsza poprawna, aktywna oferta Allegro jest kandydatem „widocznym”. Brak takiej oferty jest prawidłowym wynikiem negatywnym.
7. Dla produktu zwycięskiej oferty pobierz 3–4 inne aktywne oferty z tej samej karty produktu.
8. Sprawdź alternatywne `offer_id` w osobnym, neutralnym zapytaniu kontrolnym. Nie podawaj modelowi treści opisów.
9. Firecrawl pobiera pełne strony zwycięzcy i ofert kontrolnych.
10. Parser zapisuje tytuł, parametry, pełny opis w lokalnym magazynie dowodów, zdjęcia, cenę, dostawę, sprzedawcę i identyfikatory.
11. Repozytorium zapisuje hashe dowodów oraz macierz cech opisów, bez kopiowania pełnych opisów konkurencji.

## Zmienne porównawcze

- Widoczność: model, pozycja, cytowanie, bezpośredni URL, zgodny `offer_id`.
- Tożsamość: `product_id`, GTIN, marka, model, kod producenta, wariant i liczba sztuk.
- Opis: długość, kompletność odpowiedzi na intencję, fakty i liczby, pokrycie zastosowań, sekcje, FAQ, język korzyści, powtórzenia, spójność z parametrami.
- Czynniki kontrolne: cena całkowita, dostawa, Smart, sprzedawca, liczba zdjęć, opinie i dostępność.

## Interpretacja

Jest to badanie obserwacyjne. Różnice opisów tworzą hipotezy GEO, ale nie dowodzą przyczynowości. Dowód wpływu opisu wymaga późniejszego testu A/B tej samej oferty przed i po zmianie, po ponownym zindeksowaniu przez modele.

