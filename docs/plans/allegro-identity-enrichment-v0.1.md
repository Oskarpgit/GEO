# Allegro identity enrichment v0.1

Stan: zaimplementowane i zweryfikowane lokalnie  
Data przeglądu dokumentacji: 2026-08-27

## Cel

Generator opisu nie może zgadywać marki, modelu, kodu producenta ani GTIN z
tytułu. Warstwa integracyjna pobiera szczegóły własnej oferty sprzedawcy oraz
powiązanego produktu z Katalogu Allegro, a następnie przekazuje każde pole wraz
z dokładną ścieżką, identyfikatorem snapshotu i hashem dowodu.

## Oficjalne źródła kontraktu

- `GET /sale/product-offers/{offerId}` — szczegóły oferty sprzedawcy i
  `productSet[].product`;
- `GET /sale/products/{productId}?language=pl-PL` — szczegóły powiązanego
  produktu z Katalogu;
- poradnik „Wystawianie oferty produktu” — rozdzielenie parametrów produktu i
  oferty oraz informacja, że sam GTIN nie zawsze identyfikuje produkt
  jednoznacznie;
- FAQ Allegro REST API — parametry oznaczone przez
  `options.identifiesProduct` muszą pozostać zgodne z Katalogiem;
- FAQ Allegro REST API — dane pobrane z Katalogu mogą być używane wyłącznie w
  serwisie Allegro.

Źródła:

- https://developer.allegro.pl/tutorials/jak-jednym-requestem-wystawic-oferte-powiazana-z-produktem-D7Kj9gw4xFA
- https://developer.allegro.pl/tutorials/jak-zarzadzac-ofertami-7GzB2L37ase
- https://developer.allegro.pl/documentation
- https://developer.allegro.pl/faq

## Przepływ

1. Klient pobiera własną ofertę przy użyciu tokena OAuth sprzedawcy.
2. Z pierwszego i jedynego elementu `productSet` odczytuje `product.id`.
3. Pobiera odpowiadający produkt z Katalogu w języku `pl-PL`.
4. Adapter porównuje markę, model, kod producenta i GTIN z obu odpowiedzi.
5. Sprzeczność identyfikatora produktu lub wartości pola blokuje proces.
6. Brak marki albo modelu daje wynik `partial`; tytuł nie uzupełnia braków.
7. Poprawne pola trafiają do ekstraktora faktów jako `source_backed` i nadal
   wymagają jawnej decyzji `approved` lub `rejected`.

## Granice bezpieczeństwa

- Token OAuth istnieje tylko w pamięci klienta i nie jest częścią wyniku.
- Treść odpowiedzi błędu Allegro nie jest kopiowana do wyjątku ani logów.
- Hash dowodu powstaje z surowego body odpowiedzi, lecz surowe body nie jest
  automatycznie zapisywane w repozytorium.
- Zestawy wieloproduktowe są blokowane do czasu osobnego generatora zestawów.
- Katalog nie zatwierdza automatycznie claimów i nie omija przeglądu człowieka.
- Dane Katalogu są przeznaczone wyłącznie do ofert Allegro.

## Warunek podłączenia konta

Do wywołania produkcyjnego potrzebny będzie OAuth sprzedawcy z dostępem do
zasobów ofert. Wersja v0.1 dostarcza klienta, adapter i testy na odpowiedziach
mockowanych; nie zapisuje i nie wymaga prawdziwego tokena w repozytorium.

