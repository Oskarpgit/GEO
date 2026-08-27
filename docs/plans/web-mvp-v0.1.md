# Web MVP v0.1

Stan: zaimplementowane i zweryfikowane lokalnie  
Rynek: allegro.pl

## Cel

Udostępnić działający model GEO w interfejsie spójnym z Shoppalyzerem, bez
łączenia wyniku GEO z istniejącym modelem analiz sprzedażowych.

## Zakres

- responsywny układ z lewym przełącznikiem `GEO / Analizy`;
- formularz publicznego linku do oferty Allegro;
- bezpieczna walidacja adresu, przekierowania i rozmiaru dokumentu;
- wykorzystanie istniejącego parsera, audytu, GEO Score i rekomendacji;
- jawna akceptacja claimów przed generowaniem;
- pokazanie stanu pochodzenia i walidacji wygenerowanego opisu;
- zweryfikowany tryb demonstracyjny niezależny od dostępności Allegro;
- prywatne wdrożenie Sites bez kluczy API.

## Architektura integracji

`apps/web` jest osobnym modułem wdrożeniowym, ale importuje rdzeń bezpośrednio
z katalogu `src`. Nie powiela modelu. Podczas docelowej konsolidacji warstwa UI
może zostać przeniesiona do istniejącej aplikacji Shoppalyzer, zachowując API i
kontrakty rdzenia.

## Kryteria ukończenia

- build aplikacji kończy się bez błędu;
- lint aplikacji kończy się bez błędu;
- wszystkie testy rdzenia pozostają zielone;
- przykład przechodzi pełną ścieżkę: analiza → wybór faktów → opis;
- widok wejściowy działa na desktopie i telefonie;
- żaden token, klucz ani surowe dane konkurencji nie trafiają do repozytorium.
