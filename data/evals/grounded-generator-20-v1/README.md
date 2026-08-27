# Grounded generator 20 v1

Test wykorzystuje 20 zapisanych przypadków z 12 kategorii. Nie pobiera stron,
nie wywołuje LLM i nie zużywa kredytów zewnętrznych.

W trybie ewaluacyjnym wszystkie fakty pochodzące z bezpiecznych pól fixture są
oznaczane jako zatwierdzone. Jest to wyłącznie test techniczny. W produkcie
zatwierdzenie musi wykonać użytkownik albo osobny proces weryfikacji.

Raport nie przechowuje kandydatów opisów, wartości parametrów ani treści
konkurencji. Zawiera wyłącznie liczniki, stany, identyfikatory reguł oraz wynik
GEO kandydata.

## Kryteria

- brak marki lub modelu blokuje generowanie;
- każdy wygenerowany blok musi mieć poprawne pochodzenie;
- kandydat z błędem Allegro nie jest gotowy do ręcznego przeglądu;
- `needs_review` nie jest automatycznie zamieniane na `passed`;
- wynik `readyForUse` wymaga pełnego przejścia walidacji, nie tylko utworzenia tekstu.

## Wynik

| Stan | Liczba |
|---|---:|
| Wszystkie przypadki | 20 |
| Wygenerowany kandydat | 8 |
| Generowanie zablokowane | 12 |
| Poprawne pochodzenie wszystkich bloków | 8/8 |
| Gotowe do ręcznego przeglądu | 1 |
| Gotowe do użycia bez przeglądu | 0 |

Dwanaście przypadków zostało zablokowanych z powodu braku potwierdzonej marki
lub modelu w danych strukturalnych. System celowo nie zgaduje tych wartości z
tytułu. W siedmiu z ośmiu wygenerowanych przypadków walidację zatrzymała reguła
`ALG-PARAM-002`, ponieważ brakowało co najmniej jednego z wymaganych sygnałów
tożsamości: marki, modelu, kodu producenta albo GTIN.

## Wniosek produktowy

Najważniejszą zależnością przed szerokim generowaniem nie jest kolejny szablon
tekstu, lecz wiarygodne wzbogacanie tożsamości produktu. Dane powinny pochodzić
z Katalogu Allegro, konta sprzedawcy albo innego zatwierdzonego źródła. Tytuł
może być wskazówką do ręcznego potwierdzenia, ale nie automatycznym źródłem
faktu.

Wysoki `candidateGeoScore` nie oznacza gotowości. GEO Score, pochodzenie faktów,
zgodność Allegro i przegląd semantyczny pozostają osobnymi bramkami.
