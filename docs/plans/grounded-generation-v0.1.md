# Plan: uziemione generowanie opisów v0.1

Data rozpoczęcia: 2026-08-27  
Zakres: oferty `allegro.pl`

## Cel

Zbudować przepływ od danych oferty do kandydata opisu, w którym każde zdanie
ma jawne źródło. Generator nie może dopisywać cech, korzyści ani ograniczeń,
których nie ma w zatwierdzonych faktach.

## Przepływ

```text
tożsamość + parametry oferty
  -> fakty ze ścieżką źródłową
  -> akceptacja albo odrzucenie faktów
  -> wersjonowane szablony
  -> kandydat opisu z claimIds przy każdym bloku
  -> odtworzenie tekstu z claimIds
  -> walidacja reguł Allegro
  -> ręczny przegląd semantyczny
```

## Zasady bezpieczeństwa

1. Ekstrakcja nie oznacza automatycznej akceptacji faktu.
2. Generator używa wyłącznie faktów ze statusem `approved`.
3. Odrzucony albo nieznany `claimId` blokuje kandydata.
4. Tekst bloku musi być dokładnie odtwarzalny z szablonu i wskazanych faktów.
5. Cena, dostawa, promocja, gwarancja i dane sprzedawcy nie trafiają do opisu.
6. Kandydat z błędem Allegro `blocker` lub `error` nie jest gotowy do użycia.
7. Reguły semantyczne pozostają `needs_review`; automat nie zatwierdza ich za człowieka.
8. Konkurencyjne opisy nie są źródłem zdań ani szablonów.

## Kryteria akceptacji

- identyczne dane dają identyczne identyfikatory faktów i kandydata;
- brak zatwierdzonej marki lub modelu blokuje generowanie;
- każda treść faktograficzna ma co najmniej jeden `claimId`;
- ręczna zmiana tekstu bloku bez zmiany faktów jest wykrywana;
- fakt `rejected` nie może znaleźć się w kandydacie;
- walidacja Allegro działa na wyrenderowanym kandydacie;
- wynik rozdziela `readyForHumanReview` od `readyForUse`;
- test eksperymentu przed/po jest kontrolowany tylko wtedy, gdy zmienił się opis,
  a istotne zmienne handlowe pozostały bez zmian.

## Eksperyment przed/po

Porównanie zostaje oznaczone jako:

- `valid_controlled` — zmienił się opis, pozostałe kontrolowane pola są stabilne;
- `observational` — opis się zmienił, ale zmieniła się również cena, dostawa,
  zdjęcia, parametry, tytuł albo metryki sprzedawcy;
- `invalid` — inna oferta/produkt, brak zmiany opisu albo brakuje danych bazowych.

Wynik eksperymentu nie mówi jeszcze o wzroście widoczności. Określa jedynie,
czy późniejszą różnicę metryk wolno interpretować jako kontrolowany test opisu.
