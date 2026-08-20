# Allegro GEO foundation v0.1

## Zakres

Pierwszy pionowy wycinek obejmuje publiczną ofertę Allegro, deterministyczną walidację zasad oraz pomiar widoczności konkretnego `offer_id` w odpowiedziach LLM. Kategoria pilotażowa: automatyczne ekspresy do kawy.

## Przepływ

```text
publiczna strona oferty
  -> parser i snapshot dowodu
  -> dopasowanie produktu/oferty
  -> reguły Allegro
  -> atomowe fakty produktu
  -> kandydat opisu
  -> ponowna walidacja
  -> eksperyment przed/po
  -> metryki widoczności oferty
```

## Granice pierwszej wersji

- Brak automatycznej publikacji na Allegro.
- Brak wnioskowania o wynikach sprzedaży konkurencji.
- Brak trenowania własnego modelu bazowego.
- Brak automatycznego zaliczania oceny semantycznej jako `passed`.
- Brak obietnicy pozycji; `expected_effect` pozostaje hipotezą.

## Kryteria odbioru fundamentu

- Parser odczytuje `offer_id`, `product_id`, GTIN, tytuł, parametry, opis, sprzedawcę, cenę i liczbę porównywanych ofert z zapisanej strony Philips EP2334/10.
- Sprzeczny GTIN oraz inna liczba sztuk blokują dopasowanie.
- Timeout, blokada i błąd parsera są wyłączone z mianownika widoczności.
- Link do strony produktu nie jest liczony jako link do oferty.
- Reguły mają identyfikator, poziom, źródło i wersję.
- Typecheck i wszystkie testy przechodzą przed przekazaniem zmian.
