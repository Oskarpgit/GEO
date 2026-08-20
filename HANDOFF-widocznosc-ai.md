# Handoff: moduł widoczności w AI (GEO) dla sprzedawców e-commerce

**Data:** 2026-08-07
**Status:** faza brainstormingu, przed spisaniem specyfikacji. Zero kodu produktowego.
**Katalog roboczy:** `geo-module/` w `~/Code_projects/Claude/shoppalyzer`
**Relacja do Shoppalyzera:** świadomie **niezależna architektura**, zero sprzężenia kodu. Ta sama obietnica (więcej sprzedaży), inna dźwignia.
**Pamięć trwała:** `~/.claude/projects/-Users-wojciechrudnicki-Code-projects-Claude-shoppalyzer/memory/geo-ai-visibility-module.md`

Dokument opisuje: skąd wziął się pomysł, co ustalił research, jakie ograniczenia prawne i dostępowe są twarde, jakie decyzje podjęliśmy i co odrzuciliśmy, jak wygląda architektura, oraz co blokuje przejście do specyfikacji.

---

## 0. Najważniejsze na start (TL;DR)

1. **Jedno pytanie blokuje spisanie specyfikacji i nie da się go rozstrzygnąć researchem.** Brzmi: *co ChatGPT pokazuje dla polskich zapytań zakupowych, i w jakiej formie?* Cztery z pięciu możliwych wyników zmieniają produkt. Odpowiedź wymaga półgodzinnego testu ręcznego (sekcja 10.1).
2. **Ścieżka główna to własny sklep, nie Allegro.** Odwróciliśmy to w trakcie sesji. Powód: sprzedawca na Allegro kontroluje pięć pól, a właściciel sklepu kontroluje feed, schema, robots i strukturę strony. Sufit wartości jest kilkukrotnie wyższy na sklepie. Allegro zostaje jako drugi pakiet reguł i jako otwieracz rozmowy.
3. **Powierzchnią mierzoną jest zwykły ChatGPT, nie aplikacja Allegro w ChatGPT.** Aplikacja wymaga ręcznego podłączenia i ręcznego wywołania przy każdym pytaniu, a danych o adopcji nie ma żadnych. „Żadne narzędzie tego nie mierzy" prawdopodobnie znaczy „nie ma tam jeszcze kogo mierzyć".
4. **Wersja 1 nie wymaga dostępu do API Allegro ani osobowości prawnej.** Działa na publicznych stronach ofert i na stronie sklepu.
5. **Kształt produktu: audyt na żądanie**, plus cykliczne powtórzenie i porównanie przed/po. Nie ciągły monitoring. Ten drugi zjada marżę i tego ICP nie interesuje.
6. **Koszty stałe 150-310 zł/mies., próg opłacalności 2-4 klientów** przy 249 zł/mies. Ponad 90% kosztu jest wspólne dla wszystkich klientów, bo pomiar jest przypisany pytaniu i kategorii, nie klientowi.
7. **Najgroźniejszy możliwy błąd tego systemu:** zlanie stanu „nie zmierzyliśmy" ze stanem „nie jesteś widoczny". To musi być architektonicznie rozdzielone.

---

## 1. Skąd się to wzięło

Wątek na grupie facebookowej „Zjednoczeni Sprzedawcy", post Wojtka Sali (2026-08-07), 19 komentarzy. Pytanie: czy klienci trafiają do was przez ChatGPT lub inne asystenty AI, i czy ktoś coś z tym robi.

Co powiedzieli sprzedawcy (parafrazy, screeny w historii sesji):

- **Krystian Egzey**, prowadzi agencję performance: „ponad 30% ruchu z ai". Nie lubi słowa GEO, bo „zbytnio się od SEO nie różni" i jest rozsiewane przez agencje do dorzucania marży. Mechanika według niego: Gemini czerpie z Google, ChatGPT z Binga, więc wpuść crawlery i patrz w logach, gdzie chodzą. Zapytany o dedykowane narzędzia do pomiaru widoczności w GPT: **„zero dedykowanych narzędzi i zero zewnętrznej roboty"**.
- **Tomasz Wilk:** „rozbudowaliśmy już opisy pod AI".
- **Ireneusz Hunek:** „na sklepie mam kilka zamówień z GPT".
- **Marcin Kowalczyk:** teza sceptyka, jeśli masz organiczne SEO to AI cię widzi, jeśli nie masz to zerowa szansa.
- **Przemysław Flieger:** „zastanawiać to się można było dwa lata temu".
- **Po Prostu Adi:** trend mocno wzrostowy.

Dwa wnioski, które przetrwały całą sesję:

- Nikt w wątku nie potrafił wskazać żadnego narzędzia. Luka jest pomiarowa, nie treściowa.
- **Cała twarda treść w tym wątku dotyczy własnych sklepów, nie ofert Allegro.** Allegro było nadbudówką dołożoną przez model, bo to lane Shoppalyzera. To jest źródło pierwszej z odwróconych decyzji.

---

## 2. Ustalenia z researchu

Podział na potwierdzone i niepewne jest tu istotny, bo na tym rynku krąży dużo sprzecznych liczb.

### 2.1 Potwierdzone, użyteczne

| Ustalenie | Źródło | Konsekwencja |
|---|---|---|
| **83% produktów w karuzelach ChatGPT pochodzi z organicznego Google Shopping**, 60% z top 10. Analiza 5000+ karuzeli, 43 000 produktów | Search Engine Land, Tom Wells, III 2026 | Dźwignią jest feed w Merchant Center, nie treść na stronie. To fundament katalogu reguł dla sklepu |
| **ChatGPT Shopping Research ma 64% trafności**, czyli ponad 1/3 rekomendacji zawiera błędy: martwe linki, wycofane modele, niekompletne dane. Na pytaniach wielowarunkowych 52% wobec 37% dla zwykłego ChatGPT Search | benchmark własny OpenAI | Najlepszy argument sprzedażowy w całym temacie, podany przez samo OpenAI. Uzasadnia audyt jakości danych |
| **Własna strona marki to tylko 5-10% źródeł**, po które sięga AI. W części kategorii ponad 65% to wydawcy, treści użytkowników i afiliacja. Shopping Research przedkłada Reddita i recenzje zewnętrzne nad treści marki | McKinsey | Osłabia generowanie treści jako filar. Ślad zewnętrzny (opinie, porównywarki) trzeba raportować, choć nie da się go naprawić edycją pola |
| **Ponad 40 narzędzi AI visibility na rynku** (Profound, Peec, Otterly, AthenaHQ, Scrunch, RankScale; w PL Senuto, ZipTie, aivisible), ceny 20-300 USD/mies. **Wszystkie mierzą marki, żadne poziomu produktu** | przeglądy rynku, V 2026 | To jest realny moat, w odróżnieniu od appki Allegro |
| **Brak publicznych API do wzmianek.** Narzędzia jeżdżą Puppeteerem/Playwrightem po interfejsach i łapią limity. Wyjście z API to nie wyjście z aplikacji | analizy metodyki (Canonry i in.) | Pomiar przez API byłby fałszywy. Karuzela produktowa to funkcja chatgpt.com, nie endpoint |
| **Program feedów produktowych OpenAI obejmuje tylko USA, UK i Kanadę.** Dla Polski droga to Bing Merchant Center plus GMC | dokumentacja OpenAI Commerce, Lengow | Konkretna wiedza lokalna, której nikt w PL nie pakietuje |
| **Aplikacja Allegro w ChatGPT działa od 12.05.2026.** Filtruje miliony ofert, zwraca karty produktowe. Jedyne zdanie o rankingu: „trafność, popularność ofert, benefity Allegro Smart!" | komunikat prasowy Allegro | Zero dokumentacji rankingu, zero kryteriów kwalifikacji |
| **Aplikacja wymaga ręcznego podłączenia i ręcznego dodania kontekstu przy każdym zapytaniu.** Zero danych o adopcji | test praktyczny android.com.pl | Powód degradacji tej powierzchni z klina do dodatku |
| Aplikacja rozumuje po atrybutach (test: filtrowanie po stosunku ceny do jakości i naprawialności) i **potrafi odesłać kupującego poza Allegro** | test bezprawnik.pl | Wspiera tezę, że kompletność atrybutów decyduje |

### 2.2 Sprzeczne, nie budować na tym obietnicy

- **Konwersja z ruchu AI.** Similarweb: 11,4%, najlepszy kanał. Ale najbardziej rygorystyczne badanie (Kaiser & Schulze, 973 sklepy, 20 mld USD obrotu, kontrola efektów witryny): przejścia z ChatGPT konwertowały **gorzej** niż większość kanałów tradycyjnych. Visibility Labs (94 sklepy): +31% CVR ale -14,3% AOV, czyli netto +10,3% na sesję.
- **Wielkość kanału.** Contentsquare: ruch z AI +632% rok do roku, ale nadal **0,2% wszystkich sesji**. CTR z aplikacji AI spadł w 2025 blisko trzykrotnie (0,8% do 0,27%). Deklaracja Krystiana o 30% jest skrajnym odstępstwem, możliwym do pogodzenia tylko przez „ciemne przejścia" (kupujący dowiaduje się z ChatGPT, wchodzi bezpośrednio).
- **Wniosek dla narracji:** kanał jest mały, wysokointencyjny, szybko rosnący. Sprzedajemy ustawienie się zawczasu, i mówimy to wprost. Ta uczciwość jest jednocześnie najskuteczniejszym argumentem wobec sceptyków w stylu Krystiana.

### 2.3 Kontekst szerszy (raport Tidio „AI in E-Commerce in 2026", 22 s., ~70 źródeł)

Materiał marketingowy pod Lyro, dane niemal wyłącznie amerykańskie, **zero o Polsce i zero o marketplace'ach**. Użyteczny jako kierunkowe potwierdzenie tezy o feedach („AI surfaces are likely to increasingly rely on feeds, not crawled pages", „brak danych oznacza, że AI poleci konkurenta, nie ma odwrotu na drugą stronę wyników") i jako źródło liczb do raportów. Nie jest dowodem w sprawie Allegro. Lista atrybutów z sekcji 4 raportu weszła wprost do katalogu reguł: GTIN, MPN, marka, model, warianty, aktualna cena i stan, bogate opisy.

Protokoły agentowe (MCP, ACP, UCP, AP2, TAP, WebMCP) są w raporcie opisane szeroko. Dla nas dziś nieistotne, poza jednym: **aplikacje w ChatGPT stoją na MCP**, co otwiera możliwość pomiaru przez bezpośrednie wywołanie endpointu zamiast przez przeglądarkę (sekcja 10.1, pytanie 4).

---

## 3. Twarde ograniczenia

### 3.1 Dostęp do Allegro REST API

| Co | Warunek | Status dla nas |
|---|---|---|
| **Sandbox** (`allegro.pl.allegrosandbox.pl`) | żadnych | dostępne natychmiast, pełny rozwój i testy zapisu ofert bez bycia sprzedawcą |
| **Rejestracja aplikacji na produkcji** | aktywne konto + 2FA | wymóg firmy **nieudokumentowany**. Stary regulamin, art. 3.2: wyłącznie „aktywne Konto w ramach Allegro". Do sprawdzenia empirycznie w 10 minut |
| **`client_credentials`**: kategorie, parametry kategorii, katalog produktów | rejestracja aplikacji | darmowo, bez weryfikacji. Potrzebne walidatorowi |
| **OAuth do ofert klienta** (`allegro:api:sale:offers:read/write`) | zgoda klienta + zgoda Allegro z art. 4.2 przez formularz | do wersji 2 |
| **`GET /offers/listing`** | weryfikacja aplikacji | **od 15.03.2021, nadal obowiązuje.** Nowe aplikacje dostają 403 `VerificationRequired`. Wniosek ręczny, kryteria niepublikowane, na GitHubie Allegro sterta zgłoszeń z etykietą `brak_odpowiedzi`. Traktować jako opcję, nigdy jako założenie nośne |

### 3.2 Regulamin REST API, zmiany od 23.09.2025

Przeczytany dokument zmian, nie pełny regulamin. Pełna wersja, którą udało się pobrać, jest sprzed tej daty (inna numeracja).

- **Art. 3.3:** Spółka może obwarować dodatkowymi wymaganiami klucze o zakresach: odczyt danych o ofertach, zarządzanie ofertami, odczyt zamówień, zarządzanie zamówieniami, odczyt opłat. **Czyli dokładnie te, których potrzebują a2 i d.**
- **Art. 3.4:** autoryzacja wymaga łącznie OAuth, braku przechowywania składowych logowania, **technicznej jednoznacznej identyfikacji oprogramowania** (obowiązkowy własny User-Agent, termin minął 30.06.2026, requesty bez niego są odrzucane), wskazania tylko niezbędnych scope'ów, akceptacji regulaminu. Oraz: **„Odpowiedź Spółki w sprawie rozpatrzenia wniosku nie wymaga uzasadnienia."**
- **Art. 3.7:** przy weryfikacji brane jest pod uwagę kryterium **minimalnej liczby użytkowników aplikacji**. Problem jajka i kury dla nowego produktu. Szczegóły w art. 3.2, którego nie mamy.
- **Art. 3.8:** klucz można odebrać między innymi gdy oprogramowanie jest „wykorzystywane niezgodnie z przeznaczeniem" albo gdy Użytkownik podejmuje „inne działania na szkodę lub naruszające interes Spółki". Allegro ma też prawo **poinformować sprzedających korzystających z Twojego oprogramowania** o nałożonych sankcjach.
- **Art. 3.11, kara 50 000 zł:** dotyczy **wyłącznie udostępnienia Klucza REST API podmiotom trzecim** i naruszenia art. 3.10. Naliczana kumulatywnie, plus możliwe odszkodowanie ponad tę kwotę. **To nie jest ogólna kara za wykorzystywanie treści z ofert**, jak podają nagłówki prasowe i materiały na YouTube. Ryzyko sprowadza się do higieny klucza.
- **Art. 4.1.b (wersja sprzed 23.09.2025, sekcja niezmieniana w dokumencie zmian):** zakazane jest „wykorzystywanie do prezentowania danych statystycznych dotyczących **wyników sprzedaży konkretnych Użytkowników** bez zawarcia odpowiedniej umowy z Allegro.pl". **To kształtuje sposób formułowania rekomendacji** (sekcja 7).
- **Art. 4.1.c:** zakaz prezentowania Ofert z Allegro w „serwisach konkurencyjnych". Czy narzędzie analityczne nim jest, to pytanie do prawnika.
- **Art. 4.2:** rozpowszechnianie oprogramowania używanego przez innych Użytkowników wymaga zgody Allegro przez formularz.
- **Art. 4.3:** obowiązek podania użytkownikom rzetelnej informacji o zasadach korzystania i polityce bezpieczeństwa danych. **Polityka prywatności jest wymagana**, także od osoby fizycznej.

**Do zrobienia przed zaprojektowaniem konkurencyjnej części rekomendacji: przegląd prawny pełnego, aktualnego regulaminu.**

### 3.3 Brak osobowości prawnej

Do pierwszej trakcji nie planujemy podmiotu. Nie blokuje wersji 1. Realnie dotyka jednego: **przetwarzanie danych sprzedawców jako osoba fizyczna oznacza odpowiedzialność osobistą i nieograniczoną.** Argument, żeby założyć podmiot przed pierwszym klientem podłączającym OAuth, nie przed pierwszym audytem publicznej strony. Do pierwszych płatnych pilotaży istnieje działalność nierejestrowana, pytanie do księgowej.

### 3.4 Ryzyko operacyjne po stronie OpenAI

Automatyzacja zalogowanego konta ChatGPT jest w ścisłej lekturze regulaminu OpenAI wątpliwa. Cała kategoria narzędzi (Peec, Otterly) działa tak samo. Konsekwencja to utrata konta i koszt odtworzenia, nie kara. Trzeba to wliczyć w mnożnik ponowień, nie udawać, że nie istnieje.

---

## 4. Dziennik decyzji

### 4.1 Podjęte

| Decyzja | Uzasadnienie |
|---|---|
| Architektura **niezależna** od Shoppalyzera | Decyzja użytkownika, „wszystkie chwyty dozwolone". Techniki (scraping, pula Firecrawla) są znane, kod osobny |
| **Audyt na żądanie**, plus cykliczne powtórzenie i porównanie przed/po. Bez ciągłego monitoringu | Koszt ciągłego monitoringu skaluje się liniowo z bazą klientów i zjada marżę. To ICP nie zapłaci za panel, do którego zajrzy dwa razy. Model Surferowy pasuje |
| Zakres **a1 (pomiar, wąsko) + a2 (audyt gotowości) + b (rekomendacje) + c (gotowe wartości)**. **d (publikacja) do wersji 2** | Publikacja wnosi wygodę, nie wartość, a kosztuje najwięcej. Bariera zaufania (prawo zapisu do żywych ofert) jest większa niż bariera techniczna |
| Rekomendacje jako **strukturalne zmiany pól**, nigdy proza | Z jednej struktury generuje się raport, plik do importu i później wywołanie API. Gdyby wychodziła proza, dodanie d wymagałoby przepisania silnika |
| **Zwykły ChatGPT (S1) jako powierzchnia główna**, aplikacja Allegro (S2) jako dodatek | Tam są kupujący i nie muszą nic włączać. S2 wymaga ręcznego podłączenia i wywołania, adopcja nieznana |
| **Własny sklep jako ścieżka główna**, Allegro jako drugi pakiet reguł | Sufit wartości. Sklep: feed, schema, robots, struktura. Allegro: pięć pól |
| **Hybryda pomiaru:** wejście (obecność w Google Shopping) jako silnik produkcyjny, wyjście (sesje w ChatGPT) jako kalibracja | Wartość wymaga prawdy, koszt wymaga poszlaki. Hybryda daje jedno i drugie. Konto ChatGPT staje się przyrządem kalibracyjnym, nie linią produkcyjną |
| **Wersja 1 bez żadnego dostępu do API Allegro** | Dostęp jest uznaniowy, odmowa nie wymaga uzasadnienia, klucz można odebrać. Rdzeń wartości nie może na tym stać |
| **Trzy kategorie zmierzone porządnie** zamiast trzydziestu po łebkach. Odświeżanie miesięczne | Koszt pomiaru jest wspólny per kategoria. Głębokość daje lepszy stosunek wartości do kosztu |
| Produkt pozycjonowany jako **narzędzie jakości danych**, nie wyciągarka danych konkurencji | Ten sam kod, inna rama. Pierwsza jest zgodna z interesem Allegro (art. 3.8), druga stoi po przeciwnej stronie |

### 4.2 Odrzucone, i dlaczego

| Odrzucone | Powód |
|---|---|
| Generowanie treści pod LLM jako **filar** produktu | Towar. Tomasz Wilk zrobił to sam darmowym GPT. Zostaje jako funkcja pomocnicza, wartość dodaje wyłącznie **walidator ograniczeń** |
| Pomiar przez **API modelu** zamiast przez interfejs | Karuzela produktowa to funkcja chatgpt.com, nie endpoint API. Mierzenie API produkuje liczby, których żaden klient nigdy nie zobaczy |
| **Osobne proxy rezydencjalne** w wersji 1 | Nadmiar. Platforma przeglądarkowa daje własny transfer. Dokładamy tylko gdy pomiar pokaże blokady albo złą geolokalizację |
| **Kilka kont ChatGPT** na start | Przeszacowanie. 200 pytań × 10 powtórzeń miesięcznie to ~67 wiadomości dziennie, jedno konto Plus to udźwignie |
| **Ciągły monitoring** jako model produktu | Patrz 4.1. Można dołożyć później jako droższy plan |
| **Aplikacja Allegro jako klin** produktu | Wymaga ręcznego podłączenia i wywołania, brak danych o adopcji. „Nikt tego nie mierzy" znaczy prawdopodobnie „nie ma tam kogo mierzyć" |
| Pole **`expected_impact`** w rekomendacji | Nie umiemy policzyć wpływu, każda liczba byłaby wymyślona. Zastąpione twardym `evidence` |
| Obietnica **wzrostu sprzedaży** | Dowody sprzeczne (sekcja 2.2). Mówimy o widoczności i jakości danych |

### 4.3 Korekty w trakcie sesji, żeby nie powtarzać tej drogi

1. Pierwotnie **Allegro jako ścieżka główna**. Odwrócone po analizie przestrzeni działania sprzedawcy i po ponownym przeczytaniu wątku FB, w którym cała twarda treść dotyczy sklepów.
2. Pierwotnie **appka Allegro jako klin**. Zdegradowana po ustaleniu, że wymaga ręcznego wywołania i nie ma danych o adopcji.
3. Pierwotnie **koszty stałe 340-760 zł/mies.** Skorygowane do 150-310 zł po weryfikacji cen i po usunięciu proxy oraz dodatkowych kont.
4. Pierwotnie powtórzona z prasy **ogólna kara 50 000 zł za wykorzystywanie treści z ofert.** Tekst regulaminu wiąże ją wyłącznie z udostępnieniem klucza.
5. Pierwotnie **`/offers/listing` jako tani proxy** i najciekawszy element. Zdegradowane do opcji po odkryciu wymogu weryfikacji.
6. Pierwotnie słowo **„monitoring"**, zaczerpnięte z rynku 40+ narzędzi subskrypcyjnych. Przeformułowane na audyt na żądanie po słusznym zakwestionowaniu przez użytkownika.

---

## 5. Zasada nadrzędna

Ustalona przez użytkownika: **maksymalna wartość dla odbiorcy narzędzia (sprzedawcy, który płaci) przy dobrej optymalizacji kosztów.**

Dwa czytania słowa „kupujący" zbiegają się: asystenci nagradzają dokładne i kompletne dane produktowe, więc optymalizowanie pod końcowego konsumenta jest tym, co czyni sprzedawcę widocznym. Nie ma tu napięcia. To jest też najbezpieczniejsza pozycja wobec art. 4.1.b.

Wniosek, który z tej zasady wynika i warto go trzymać: **największą wartością jest uczciwy wynik negatywny.** „Nie jesteś widoczny i oto dlaczego" jest warte więcej niż ładny wskaźnik. A „to nie jest Twoja bitwa, oto która jest" jest najwartościowszą rzeczą, jaką możemy powiedzieć, choć nie sprzeda abonamentu.

---

## 6. Architektura

### 6.1 Dwie pętle, rozłączone celowo

```
PĘTLA A  ·  w tle, wspólna dla wszystkich klientów        drogie, kruche, odcinalne
════════════════════════════════════════════════════════════════════════════════

   Katalog pytań              Harmonogram pomiarów
   per kategoria,      ───▶   pytanie × powierzchnia   ───▶   Adaptery powierzchni
   wersjonowany               × powtórzenie                   ├─ ChatGPT
                                                              │  Playwright, profil
                                                              │  zalogowany, obrazki off
                                                              └─ Google Shopping
                                                                 tani pomiar wejścia
                                                                        │
                                            Magazyn dowodów   ◀─────────┘
                                            tylko dopisywanie
                                            surowa odpowiedź, zrzut, data,
                                            wersja promptu, wersja adaptera
                                                     │
                                            Indeks widoczności
                                            per pytanie: kto się pokazał,
                                            na której pozycji, w jakiej formie
                                                     │
                                                     │  tani odczyt
════════════════════════════════════════════════════ │ ══════════════════════════
PĘTLA B  ·  na żądanie, per klient                   │    tanie, natychmiastowe
                                                     │
   wklejony link                                     │
        │                                            ▼
        ▼                                   Rozstrzyganie tożsamości
   Pobranie strony ──▶ Ekstraktor ─────┬──▶ zwraca dopasowanie ALBO brak
                       produktu        │              │
                                       ▼              │
                              Audyt gotowości         │
                              pakiet: Allegro         │
                              pakiet: własny sklep    │
                                       │              │
                                       └──────┬───────┘
                                              ▼
                              Silnik rekomendacji
                              strukturalne zmiany pól
                                              │
                                              ▼
                              Generator wartości pól
                                              │
                                              ▼
                              Walidator ograniczeń ──── odrzucone 3× ────┐
                              limity, słowniki, regulaminy              │
                                              │ przeszło                │
                                              ▼                         ▼
                              Raport  +  porównanie przed/po  ◀─────────┘
                                         (bez proponowanej wartości,
                                          ale ustalenie zostaje)
```

**Sens rozłączenia:** gdyby dziś padły wszystkie adaptery, pętla B nadal wydaje raport. Zubożony o kontekst konkurencyjny, ale prawdziwy. Cała kruchość siedzi w jednym miejscu i da się ją odciąć bez zabijania produktu.

### 6.2 Komponenty i granice

- **Katalog pytań.** Wejście: kategoria plus słownik atrybutów. Wyjście: wersjonowany zestaw pytań. Nie wie nic o klientach. Generowany modelem, kurowany ręcznie.
- **Harmonogram pomiarów.** Kolejkuje trójki (pytanie, powierzchnia, powtórzenie), pilnuje współbieżności, ponowień, wygaszania. Zapisuje **nieudane próby**, bo bez tego nie odróżnisz braku pomiaru od braku widoczności.
- **Adapter powierzchni.** Jeden interfejs `run(pytanie, locale) → obserwacja`. Wymienny. Testowany na zapisanych fixture'ach, **nigdy na żywej powierzchni w CI**. Pierwszy: zwykły ChatGPT. Drugi: Google Shopping jako pomiar wejścia.
- **Magazyn dowodów.** Tylko dopisywanie, nigdy modyfikacja. Warstwa, która pozwala obronić liczbę przed klientem i która kumuluje się w czasie jako aktywo.
- **Indeks widoczności.** Wyliczany z obserwacji, nigdy edytowany ręcznie. Czyta **wyłącznie udane** obserwacje.
- **Ekstraktor produktu.** Dwa parsery: strona oferty Allegro, generyczna karta produktu (najpierw JSON-LD `Product`, potem heurystyki).
- **Rozstrzyganie tożsamości.** Sygnały: EAN dokładnie, marka plus model po normalizacji, pokrycie tokenów tytułu, domena sprzedawcy. Zwraca dopasowanie z pewnością, poniżej progu **jawny brak dopasowania**. Fałszywe trafienie zatruwa każdą liczbę w dół strumienia.
- **Audyt gotowości.** Każda reguła to czysta funkcja `(produkt, kontekst) → ustalenie albo nic`. Deterministyczna, testowana tabelarycznie w obie strony. Pakiet dla sklepu dociąga dodatkowo `robots.txt`, obecność JSON-LD, obecność feedu, poprawność GTIN.
- **Silnik rekomendacji.** Wejście: ustalenia plus kontekst z indeksu. Wyjście: uszeregowana lista strukturalnych zmian pól. Kontekst konkurencyjny to **wyłącznie atrybuty ofert**, nigdy niczyje wyniki sprzedaży.
- **Generator wartości.** Wypełnia `proposed_value`. Dostaje ograniczenia platformy, słownik parametrów kategorii, zbiór atrybutów z pokazywanych ofert.
- **Walidator ograniczeń.** **Osobna jednostka, nie helper w generatorze.** Długości, znaki zabronione, dozwolone wartości słownikowe, polityka platformy. To jest różnica między produktem a darmowym czatem, więc ma własne testy własnościowe.
- **Przebieg audytu.** Utrwalony snapshot. Dwa przebiegi dają porównanie przed/po.
- **Adaptery publikujące.** Wersja 2. Konsumują zwalidowaną listę zmian. Interfejs definiowany teraz, implementacja później.

### 6.3 Model danych, szkic

`categories` · `prompts` (wersjonowane) · `prompt_sets` · `observations` (append-only, referencja do zrzutu w storage) · `appearances` (znormalizowane wiersze z obserwacji) · `visibility_index` (agregat) · `products` · `audit_runs` · `findings` · `recommendations` · `customers` · `connections` (później, tokeny OAuth)

### 6.4 Tryby awarii

**Zasada nadrzędna: „nie zmierzyliśmy" musi być odrębnym stanem od „nie jesteś widoczny".** Zlanie ich w jedno zero produkuje fałszywą diagnozę wyglądającą dokładnie jak prawdziwa. To najgroźniejszy błąd, jaki ten system może popełnić.

| Awaria | Zachowanie |
|---|---|
| Adapter padł | Obserwacja oznaczona jako nieudana, indeks jej nie widzi, raport mówi „nie zmierzono" |
| Za mało powtórzeń | Liczba wstrzymana, oznaczona jako niewystarczająca próbka |
| Tożsamość niepewna | Brak wyniku, zdanie „nie potrafimy jednoznacznie dopasować Twojej oferty" |
| Walidator odrzucił 3× | Ustalenie zostaje, proponowanej wartości nie ma |
| Kategoria niezmierzona | Audyt gotowości wychodzi natychmiast, pomiar do kolejki |

---

## 7. Katalog rekomendacji

### 7.1 Własny sklep, blokady

Dopóki któraś stoi, reszta nie ma znaczenia.

| Ustalenie | Działanie |
|---|---|
| Produkt nie istnieje w Google Merchant Center | Konto GMC, wystawienie feedu. Rura, przez którą idzie 83% karuzeli |
| Brak GTIN albo błędna suma kontrolna | GTIN od producenta. Wymyślony EAN jest gorszy od braku |
| Brak `brand` i `mpn` | Uzupełnić, bez tego produkt nie sklei się z katalogiem |
| `robots.txt` blokuje `OAI-SearchBot` | Odblokować. To crawler odpowiadający za cytowanie, inny niż `GPTBot` (dane treningowe). Dwie różne decyzje, raportowane osobno |
| Cena lub dostępność w feedzie rozjeżdża się ze stroną | Naprawić synchronizację. Nieaktualne dane powodują pominięcie produktu |
| Brak w Bing Merchant Center | Dla Polski jedyna droga do ChatGPT |

### 7.2 Własny sklep, brak dopasowania

| Ustalenie | Działanie |
|---|---|
| Brak atrybutów wielowariantowych (`size`, `color`, `item_group_id`) | Uzupełnić. Trafność ChatGPT na pytaniach wielowarunkowych to 52%, czyli tam rozstrzygają atrybuty |
| Zła `google_product_category` lub `product_type` | Poprawić, błędna kategoria kieruje produkt do złych zapytań pochodnych |
| Atrybut obecny u pokazywanych ofert, u Ciebie nieobecny | Uzupełnić konkretne pole. Tu wchodzi kontekst z indeksu widoczności |

### 7.3 Własny sklep, czytelność maszynowa

| Ustalenie | Działanie |
|---|---|
| Brak JSON-LD `Product` z `offers`, `price`, `availability`, `gtin13`, `brand` | Gotowy blok do skopiowania |
| JSON-LD kłamie wobec widocznej strony | Zsynchronizować. Sprzeczne dane są gorsze niż brak |
| Fakty dopiero w drugiej połowie strony | Blok „w skrócie" nad treścią marketingową. 44% cytowań pochodzi z pierwszych 30% strony |
| Specyfikacja wyłącznie na obrazkach | Tabela HTML |
| Dane produktu renderowane tylko po stronie klienta | SSR faktów produktowych |
| Brak FAQ na pytania warunkowe z katalogu | Blok FAQ z realnymi pytaniami |

### 7.4 Allegro

| Ustalenie | Działanie |
|---|---|
| Tytuł bez atrybutów używanych w pytaniach | Proponowany tytuł w 75 znakach, sprawdzony pod regulamin |
| Niewypełnione parametry kategorii | Wartości ze słownika kategorii (`client_credentials`) |
| Brak EAN | Uzupełnić, bez tego oferta nie skleja się z katalogiem produktów |
| Opis bez wyciągalnej tabeli parametrów | Przebudowany opis z blokiem faktów na początku |
| Zła kategoria | Wskazanie właściwej |

### 7.5 Ustalenie, przy którym model „gotowej poprawki" się łamie

Ślad zewnętrzny: brak opinii, brak obecności w porównywarkach, brak wzmianek. McKinsey: własna strona to 5-10% źródeł, ponad 65% to wydawcy, UGC i afiliacja. **Możemy to zdiagnozować, ale to praca PR-owa, nie edycja pola.** Raportujemy jako lukę z rekomendacją i mówimy wprost, że tego nie da się załatwić zmianą danych.

### 7.6 Kształt rekordu rekomendacji

```json
{
  "id": "shop.feed.missing_variant_attr",
  "tier": "brak_dopasowania",
  "field": "feed.size",
  "current_value": null,
  "proposed_value": "9-18 kg",
  "rationale": "Zakres wagowy pojawia się w 9 z 12 mierzonych pytań dla tej kategorii. Wszystkie 5 ofert pokazanych przez asystenta ma go w danych. Twoja nie ma.",
  "evidence": {
    "prompts_with_attr": 9,
    "prompts_total": 12,
    "shown_offers_with_attr": 5,
    "shown_offers_total": 5,
    "observation_ids": ["obs_8f2a", "obs_91c4"]
  },
  "effort": "niski",
  "channel": "shop"
}
```

Trzy tiery do szeregowania: `blokada`, `brak_dopasowania`, `czytelnosc`. Bez wymyślonego wskaźnika wpływu. Uzasadnienie mówi, **czym różnisz się od pokazywanych ofert**, i ani słowa o tym, ile ktokolwiek sprzedaje.

### 7.7 Co da się sprawdzić bez uprawnień

Prawie cały katalog. Strona sklepu i strona oferty Allegro to pobranie HTML. `robots.txt` to pobranie pliku. Słownik parametrów kategorii przez `client_credentials`, darmowo. Dwa wyjątki: **obecność w GMC** sprawdzamy pośrednio przez szukanie produktu w organicznym Google Shopping (ten sam adapter, który mierzy wejście), a **sam feed** czytamy tylko gdy klient podaje URL.

---

## 8. User journey

1. **Wejście bez rejestracji.** Wklejony link do oferty Allegro albo karty produktu w sklepie.
2. **Potwierdzenie produktu.** Wyciągnięte: nazwa, marka, EAN, kategoria, atrybuty, cena. „To ten produkt?"
3. **Pytania, które mierzymy.** Lista dla kategorii, do odhaczenia i dopisania własnych. Sprzedawca zna język swoich klientów lepiej.
4. **Wynik pomiaru w sekundach**, bo pomiar jest już zrobiony i przypisany pytaniu. Przy każdej liczbie data, liczba powtórzeń, zrzut. Jeśli kategoria niezmierzona: mówimy to wprost, wrzucamy do kolejki, dajemy punkt 5.
5. **Audyt gotowości natychmiast.** Nie wymaga pomiaru, więc działa zawsze.
6. **Raport z dwiema odpowiedziami** („gdzie stoisz", „co Cię blokuje") plus **werdykt międzykanałowy**: w którym kanale ma większą dźwignię. Po to przyszedł.
7. **Gotowe wartości do wklejenia** plus przycisk „zastosowałem" stawiający znacznik z datą.
8. **Powtórka po kilku tygodniach** na tych samych pytaniach, z porównaniem przed i po.

Płatne wchodzi tam, gdzie chce więcej niż jeden produkt, historię i powtarzalność. Pierwszy audyt jednego produktu darmowy, to cały kanał akwizycji.

---

## 9. Model kosztowy

### 9.1 Koszty stałe

| Warstwa | Koszt / mies. |
|---|---|
| Railway (już opłacane, 5 USD) | 20 zł |
| Supabase (darmowy wystarcza) | 0 zł |
| Przeglądarka: własny Playwright na VPS albo Browserbase Developer 20 USD | 0-80 zł |
| Proxy | 0 zł, wycięte z wersji 1 |
| ChatGPT Plus ×1 | 90 zł |
| LLM API (generowanie treści) | 40-120 zł |
| Firecrawl do pobierania stron | już opłacane, kredyty do pilnowania |
| Domena (już posiadana) | 0 zł |
| **Razem** | **150-310 zł** |

Jeśli pomiar da się zrobić przez endpoint MCP zamiast przez przeglądarkę, pozycje „przeglądarka" i „ChatGPT" znikają, a koszty stałe spadają do **60-140 zł/mies.**

Godziny przeglądarki są nieistotne (1000 sesji po 30 s to ~8,3 h, plan za 20 USD daje 100 h). Ograniczeniem jest transfer, dlatego **blokujemy obrazki**, co ścina go z ~4 MB do ~1 MB na sesję.

### 9.2 Koszty jednostkowe

| Jednostka | Koszt |
|---|---|
| 1 sesja pomiarowa | 0,02-0,08 zł |
| 1 pytanie zmierzone (10 powtórzeń, retry ×3) | 0,6-2,4 zł |
| Katalog 200 pytań / mies. (**dzielony przez wszystkich klientów**) | 120-480 zł |
| 1 audyt produktu | 0,20-0,50 zł |
| Klient z 20 produktami w pokrytej kategorii | 4-10 zł / mies. |
| Pierwszy klient w nowej kategorii, jednorazowo | 12-145 zł |

**Próg opłacalności: 2-4 klientów** przy 249 zł/mies. Cena jest placeholderem, nie była liczona pod wartość ani pod konkurencję.

### 9.3 Założenia do korekty

Cztery mnożą się przez siebie i to jedyne pokrętło, które może wymknąć się z ręki: **10 powtórzeń na pytanie, 200 pytań w katalogu, retry ×3, odświeżanie miesięczne.** Przy odświeżaniu tygodniowym i retry ×12 koszt pomiaru rośnie do 2000+ zł/mies.

Pozostałe: sesja 60 s, transfer 1 MB przy zablokowanych obrazkach, 20 produktów na klienta, model LLM klasy średniej, kurs 4 zł/USD.

**Główna niepewność:** czy automatyzacja zalogowanego ChatGPT działa i z jaką skutecznością. Przy 20% zamiast 80% mnożnik ponowień rośnie z ×3 do ×12.

---

## 10. Co blokuje i co dalej

### 10.1 Pytanie blokujące

> **Co ChatGPT pokazuje dla polskich zapytań zakupowych, i w jakiej formie?**

Rozstrzyga jednostkę pomiaru, a od niej zależy kto jest klientem i co sprzedajemy.

| Wynik | Konsekwencja |
|---|---|
| **A.** Karta produktowa z konkretną ofertą | Najlepiej. Pozycjonowanie na poziomie oferty realne, produkt jak zaprojektowany |
| **B.** Link do konkretnej strony oferty, bez karty | Nadal poziom oferty. Rekomendacje celują w treść strony |
| **C.** Sama wzmianka „sprawdź na Allegro" albo link do kategorii | Źle. Nie ma czego pozycjonować na poziomie oferty, produkt przesuwa się na sklep |
| **D.** Allegro nie pojawia się wcale, są Ceneo, sklepy własne, Amazon.pl | Handlowo najciekawsze. Sprzedawcy allegrowi strukturalnie niewidoczni, odpowiedzią jest sklep i feed |
| **E.** Za każdym razem coś innego, bez wzorca | Pomiar słaby, produkt opiera się na audycie gotowości |

**Jak odpowiedzieć:** 15 zakupowych zapytań po polsku w trzech kategoriach, zalogowany chatgpt.com, polskie IP, każde powtórzone trzy razy. Notować: co się pojawia (Allegro, Ceneo, sklepy własne, Amazon.pl, strony marek), w jakiej formie, na których pozycjach, która konkretna oferta. Około 30 minut pracy ręcznej, zero kodu.

**Proponowane kategorie (do potwierdzenia przez użytkownika):** foteliki samochodowe dla dzieci, ekspresy do kawy, roboty sprzątające. Kryterium: zakup wysokiego zaangażowania, atrybuty rozstrzygają, sprzedawcy dostępni w grupie na FB.

### 10.2 Pozostałe pytania otwarte

1. **Trzy kategorie do testu.** Czeka na decyzję użytkownika.
2. **Czy konto niesprzedawcy wystarczy do rejestracji aplikacji na produkcji.** 10 minut, empirycznie.
3. **Czy aplikacje w ChatGPT działają na darmowym planie.** Jeśli tak, znika 90 zł/mies.
4. **Czy endpoint MCP aplikacji Allegro jest osiągalny bezpośrednio.** Jeśli tak, pomiar przestaje wymagać przeglądarki i konta.
5. **Art. 3.2 aktualnego regulaminu i kryterium minimalnej liczby użytkowników.** Nie mamy tekstu.
6. **Przegląd prawny pełnego regulaminu REST API** przed zaprojektowaniem konkurencyjnej części rekomendacji.
7. **Cena.** 249 zł to placeholder.
8. **Nazwa produktu i domena.** Subdomena Shoppalyzera albo osobna marka. Architektura jest niezależna, ale to decyzja pozycjonująca.

### 10.3 Kolejność prac po odpowiedzi na 10.1

1. Sekcja 4 designu (testy), potem specyfikacja do `docs/superpowers/specs/`.
2. Rdzeń pętli B na jednej powierzchni: pobranie, ekstraktor, pakiet reguł dla sklepu, raport. Bez pomiaru.
3. Pakiet reguł dla Allegro.
4. Adapter pomiaru wejścia (Google Shopping), bo tani i stabilny.
5. Adapter pomiaru wyjścia (ChatGPT) jako kalibracja, wąsko.
6. Silnik rekomendacji, generator, walidator.
7. Wersja 2: publikacja przez API Allegro, feed dla sklepu, appka Allegro jako druga powierzchnia.

---

## 11. Artefakty w repo

```
geo-module/
├── HANDOFF-widocznosc-ai.md              ten dokument
├── build_onepager.py                     skład one-pagera dla partnerów (reportlab)
├── debrief-partnerzy-widocznosc-ai.pdf   bieżąca wersja
├── debrief-partnerzy-widocznosc-ai-v2-brand.pdf
├── podglad-v2-brand.png
└── assets/fonts/                         Geist Regular/SemiBold/Bold, Sora Bold
```

**Branding one-pagera** pochodzi ze źródeł landingu, nie ze zgadywania:
`shoppalyzer-landing/src/index.css` (zmienne CSS) i `shoppalyzer-landing/public/shoppalyzer-mark.svg` (logo).
Navy `#1E4D72`, ink `#0D263B`, muted `#5C6D7A`, amber `#E8843A`, tło `#FAFAF7`, karta `#FFFFFF`, obwódka `#E5E2DC`, primary-soft `#EFF5FB`, promień 10 px (`--radius`). Nagłówki Sora Bold, tekst Geist.

**Przebudowa PDF-a:**

```bash
python3 -m venv /tmp/pdfvenv && /tmp/pdfvenv/bin/pip install reportlab pymupdf
cd geo-module && /tmp/pdfvenv/bin/python3 build_onepager.py
```

Fonty są wendorowane w `assets/fonts/`, więc build nie zależy od sieci. Gdyby trzeba je odtworzyć: Google Fonts, `curl -A "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700"` zwraca URL-e do TTF (stary User-Agent wymusza TTF zamiast woff2).

**Preferencje redakcyjne użytkownika:** zero długich pauz (em dash) w treści, półpauzy w zakresach liczbowych są OK. Treść przepuszczona przez zasady anti-ai-writing: bez konstrukcji „X, nie Y" w nagłówkach, bez słów typu „kluczowy", bez nadawania wagi zamiast podania faktu, bez dopychania list do trójki.

---

## 12. Jak odtworzyć tę sesję w Codexie na innym urządzeniu

### 12.1 Co przenieść

1. Ten plik. Jest samowystarczalny.
2. Katalog `geo-module/` w całości (fonty i skrypt składu).
3. Plik pamięci `memory/geo-ai-visibility-module.md`, jeśli środowisko docelowe ma warstwę pamięci.
4. Dostęp do `shoppalyzer-landing/src/index.css` i `public/shoppalyzer-mark.svg`, jeśli PDF ma być dalej składany w brandingu.

### 12.2 Czego nie trzeba przenosić

Screenów z wątku FB (treść sparafrazowana w sekcji 1), raportu Tidio (ustalenia w sekcji 2.3), pobranych PDF-ów regulaminu Allegro (cytaty w sekcji 3.2). Wszystko istotne jest w tym dokumencie.

### 12.3 Prompt startowy

> Kontynuujemy projekt opisany w `geo-module/HANDOFF-widocznosc-ai.md`. Przeczytaj go w całości. To faza brainstormingu przed specyfikacją, ścieżką główną jest własny sklep, powierzchnią mierzoną zwykły ChatGPT. Nie proponuj ponownie rzeczy z sekcji 4.2 (odrzucone) i nie wracaj do kierunków z sekcji 4.3 (korekty). Zanim cokolwiek zaproponujesz, powiedz, czy pytanie blokujące z sekcji 10.1 zostało już rozstrzygnięte.

### 12.4 Założenia narzędziowe

- Sesja prowadzona była pod dyscypliną Superpowers (`brainstorming` → `writing-plans`), z twardą bramką: żadna implementacja przed zatwierdzeniem designu. W Codexie odpowiednikiem jest `~/Desktop/codex-starter-pack/` (AGENTS.md plus konfiguracja MCP).
- Skille użyte: `superpowers:brainstorming`, `document-skills:pdf`, `anthropic-skills:anti-ai-writing`.
- Do składu PDF-a wystarczy Python z `reportlab`; do podglądu `pymupdf`. Na macOS brak poppler-utils, więc `pdftotext` i `pdftoppm` nie były dostępne, stąd pymupdf.
- **Nie używać AI Diagram Maker.** Użytkownik odrzucił to narzędzie, diagramy rysujemy sami.
- Firecrawl jest limitowany kredytami, każde użycie po pytaniu użytkownika.

### 12.5 Stan zatwierdzenia designu

| Sekcja | Status |
|---|---|
| 1. Zakres i sekwencja | przedstawiona, przeszła trzy korekty, **niezatwierdzona formalnie** |
| 2. Komponenty | przedstawiona, czeka na potwierdzenie |
| 3. Przepływ i błędy | przedstawiona, czeka na potwierdzenie |
| 4. Testy | nieprzedstawiona |
| Specyfikacja | nienapisana, świadomie wstrzymana do rozstrzygnięcia 10.1 |

---

## 13. Źródła

**Allegro:** [komunikat o aplikacji w ChatGPT](https://media.allegro.pl/457629-allegro-uruchamia-apke-na-chatgpt-i-tworzy-nowy-standard-w-konwersacyjnym-e-commerceie) · [Developer Portal](https://developer.allegro.pl/documentation) · [Pierwsze kroki](https://developer.allegro.pl/tutorials/pierwsze-kroki-MRwYEoOq0im) · [Sandbox](https://developer.allegro.pl/news/nowe-srodowisko-testowe-allegro-sandbox-q018mGAA7sn) · [zmiany regulaminu 23.09.2025](https://developer.allegro.pl/news/23-wrzesnia-2025-zaktualizujemy-regulamin-rest-api-allegro-v8Zy4aVbYc7) · [`/offers/listing` tylko dla zweryfikowanych](https://developer.allegro.pl/news/get-offers-listing-tylko-dla-zweryfikowanych-aplikacji-GRax4oVgrs1) · [obowiązkowy User-Agent](https://github.com/allegro/allegro-api/issues/13126)

**Powierzchnie AI:** [SEL, 83% karuzeli z Google Shopping](https://searchengineland.com/new-finding-chatgpt-sources-83-of-its-carousel-products-from-google-shopping-via-shopping-query-fan-outs-470723) · [SEL, feedy jako strategia organiczna](https://searchengineland.com/product-feeds-organic-strategy-ai-search-473793) · [OpenAI Product Feed Spec](https://developers.openai.com/commerce/specs/spec) · [Lengow, dostępność rynkowa](https://www.lengow.com/get-to-know-more/chatgpt-product-feed/) · [Apps SDK / MCP w ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)

**Rynek narzędzi i metodyka:** [Alhena, dlaczego pomiar brand-level zawodzi](https://alhena.ai/blog/sku-level-ai-visibility-ecommerce/) · [Canonry, krytyka metodyki](https://canonry.ai/blog/ai-visibility-tools-are-lying) · [AiVisible, rynek PL](https://www.aivisible.pl/blog/narzedzia-do-monitorowania-widocznosci-ai-2026)

**Testy aplikacji Allegro:** [android.com.pl](https://android.com.pl/tech/912345-allegro-chatgpt-aplikacja-zakupy/) · [bezprawnik.pl](https://bezprawnik.pl/aplikacja-allegro-w-chatgpt/)

**Infrastruktura:** [Browserbase pricing](https://www.browserbase.com/pricing) · [ceny proxy rezydencjalnych per GB 2026](https://proxidize.com/blog/residential-proxy-pricing/)

**Raport:** Tidio, „AI in E-Commerce in 2026. The New Shopping Funnel", 22 s., ~70 źródeł.
