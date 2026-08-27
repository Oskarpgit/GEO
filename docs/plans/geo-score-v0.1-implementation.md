# Plan wdrożenia GEO Score v0.1

Data rozpoczęcia: 2026-08-27  
Rynek: `allegro.pl`  
Główna interwencja: opis oferty

## 1. Cel tej fazy

Celem jest zbudowanie pierwszego, wyjaśnialnego silnika oceny gotowości opisu
oferty do odnajdywania i rozumienia przez LLM. Wynik ma wspierać sprzedawcę w
poprawianiu treści, ale nie może obiecywać pozycji ani udawać, że sam opis jest
przyczyną obecności oferty w odpowiedzi modelu.

Silnik utrzymuje trzy osobne warstwy:

1. `GEO Score` — jakość informacji, struktury i jednoznaczności treści;
2. walidację Allegro — zgodność z wersjonowanymi regułami platformy;
3. pomiar widoczności — faktyczne pojawienia konkretnego `offer_id` w LLM.

Nie tworzymy jednego zbiorczego wyniku mieszającego te warstwy.

## 2. Stan danych i ograniczenia

Korpus zawiera 40 odpowiedzi LLM: 20 ChatGPT i 20 Gemini. Zebrano 43 poprawnie
dopasowane oferty kontrolne dla 18 obserwacji z co najmniej jedną kontrolą.
Różnice prostych cech opisów są obecnie niespójne, dlatego materiał nie
uzasadnia uczenia wag statystycznych ani wniosków przyczynowych.

Wersja `v0.1` będzie zatem modelem regułowym:

- deterministycznym i możliwym do odtworzenia;
- pokazującym punkty za każde kryterium;
- przechowującym osobno kompletność wejścia i siłę dowodów;
- kalibrowanym obserwacyjnie, ale nie dopasowywanym do małej próbki;
- gotowym na wymianę wag po kontrolowanych eksperymentach przed/po.

## 3. Zakres implementacji

### 3.1. Kontrakt wejścia

Silnik przyjmuje tytuł, opis, parametry, zdjęcia, tożsamość produktu oraz
opcjonalny profil struktury opisu. Brak pola nie jest zaliczany jako wynik
pozytywny i obniża pewność analizy.

### 3.2. Ekstrakcja cech

Wyliczamy między innymi:

- długość i liczbę słów;
- liczbę nagłówków, akapitów i elementów list;
- liczbę faktów liczbowych i gęstość faktów;
- sygnały FAQ;
- kompletność marki, modelu, kodu producenta i GTIN;
- obecność marki i modelu w tytule oraz opisie;
- średnią długość zdania i nadmierne powtórzenia;
- frazy promocyjne oraz dane kontaktowe;
- pokrycie pięciu rodzin intencji: zastosowanie, kompatybilność i ograniczenia,
  obsługa, dane techniczne oraz zawartość zestawu.

### 3.3. GEO Score

Wynik mieści się w zakresie 0–100 i składa się z pięciu jawnych komponentów:

| Komponent | Maksimum |
|---|---:|
| Jednoznaczność produktu | 25 |
| Struktura i odpowiedzi | 25 |
| Fakty i specyficzność | 25 |
| Jakość języka | 15 |
| Pokrycie intencji | 10 |

Każde kryterium zwraca wynik, maksimum, status oraz wartość zaobserwowaną.
Pewność analizy jest osobnym polem i nie podnosi wyniku GEO.

### 3.4. Rekomendacje

Rekomendacje są deterministyczne, mają priorytet, pole oferty, stan obecny,
wartość docelową, oczekiwany rodzaj efektu i ograniczenie bezpieczeństwa.
Nie generują nowych cech produktu. Brakujący fakt należy pozyskać lub
potwierdzić, a nie wymyślić.

### 3.5. Kalibracja korpusu

Skrypt kalibracyjny porówna zwycięzcę z uśrednionymi kontrolami w obrębie tej
samej obserwacji. Dzięki temu obserwacja z czterema kontrolami nie waży cztery
razy więcej niż obserwacja z jedną kontrolą. Raport zapisze liczebność,
średnią i medianę różnic oraz udział dodatnich różnic dla każdej cechy.

## 4. Kryteria akceptacji

1. Ten sam input zawsze daje identyczny wynik.
2. Każdy komponent sumuje się dokładnie do wyniku 0–100.
3. Słaby opis otrzymuje niższy wynik niż kompletny opis tego samego produktu.
4. Brak marki lub modelu tworzy rekomendację i obniża pewność analizy.
5. Wynik GEO i walidacja Allegro pozostają osobnymi obiektami.
6. Raport kalibracji nie zawiera pełnych opisów konkurencji.
7. Typecheck i wszystkie testy przechodzą.
8. Repozytorium nie zawiera kluczy, cookies ani surowych plików `.evidence`.

## 5. Następne fazy po v0.1

1. Ekstrakcja atomowych, zweryfikowanych twierdzeń produktu.
2. Generator opisu używający wyłącznie zatwierdzonych twierdzeń.
3. Walidacja każdego zdania kandydata względem źródła i reguł Allegro.
4. Nowy zbiór produktów, niewykorzystany przy tworzeniu punktacji.
5. Kontrolowane eksperymenty przed/po z niezmienioną ceną, dostawą, zdjęciami i
   parametrami.
6. Dopiero po uzyskaniu stabilnego sygnału — uczenie wag lub model rankingowy.
7. Po stabilizacji silnika — aplikacja internetowa Shoppalyzer GEO.

## 6. Warunek zatrzymania kosztowego

Ta faza działa lokalnie i nie wywołuje Firecrawl ani płatnych API. Codex nie ma
dostępu do licznika planu użytkownika. Jeżeli interfejs pokaże 10% pozostałego
limitu, użytkownik może wysłać `STOP`; praca zostanie zakończona po zapisaniu
spójnego checkpointu i wyniku testów.
