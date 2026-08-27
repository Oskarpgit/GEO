# Shoppalyzer GEO — stan projektu, działanie modelu i dalsze kroki

Stan na: **27 sierpnia 2026**  
Rynek docelowy: **sprzedawcy Allegro.pl**  
Aktualna wersja fundamentu: **0.1.0**

## 1. Streszczenie

Repozytorium zawiera działający fundament produktu do audytu GEO ofert Allegro,
kontroli zgodności opisu, pomiaru widoczności konkretnej oferty w wynikach LLM
oraz bezpiecznego tworzenia nowego opisu z zatwierdzonych faktów.

Aktualna aplikacja działa lokalnie pod adresem:

```text
http://localhost:3000/#geo
```

Najważniejsze zastrzeżenie: obecna wersja nie jest wytrenowanym własnym modelem
językowym i nie obiecuje pozycji w ChatGPT lub Gemini. Jest audytowalnym
systemem regułowym, warstwą pomiarową oraz deterministycznym generatorem opisów.
Wagi nie zostały dopasowane do zbyt małej próbki, a wynik sprzedaży nie jest
traktowany jako etykieta jakości GEO.

## 2. Co zostało zrobione

### 2.1. Rdzeń domenowy i bezpieczeństwo danych

- Zdefiniowano kontrakty snapshotów ofert, dowodów, reguł, prób LLM i wyników.
- Dodano wersjonowanie reguł, GEO Score, generatora i przepływu przeglądu.
- Oddzielono wynik GEO od walidacji Allegro i faktycznej widoczności w LLM.
- Nieudane pomiary, timeouty i blokady nie są liczone jako brak widoczności.
- Strona produktu Allegro nie jest traktowana jako link do konkretnej oferty.
- Sprzeczny GTIN, inny wariant lub inna liczba sztuk blokują dopasowanie.
- Pełne opisy konkurencji i surowy HTML nie są zapisywane w repozytorium.

### 2.2. Pobieranie i analiza ofert Allegro

- Powstał parser publicznej strony oferty Allegro.
- Parser odczytuje m.in. `offer_id`, `product_id`, tytuł, opis, parametry,
  identyfikatory produktu, zdjęcia i dane pomocnicze.
- Endpoint webowy akceptuje wyłącznie adres HTTPS w domenie `allegro.pl`,
  ponownie sprawdza adres po przekierowaniu i ogranicza rozmiar odpowiedzi.
- Publiczna analiza nie używa Firecrawl.
- Zaimplementowano klienta i adapter danych Katalogu Allegro, ale produkcyjne
  użycie wymaga jeszcze OAuth konta sprzedawcy.

### 2.3. Reguły Allegro

- Powstał wersjonowany rejestr reguł dla tytułu, opisu, parametrów i GTIN.
- Walidator rozróżnia `passed`, `failed`, `needs_review` i `not_evaluated`.
- Reguła semantyczna nie może zostać automatycznie oznaczona jako zaliczona.
- Błąd klasy `blocker` lub `error` blokuje gotowość wygenerowanego opisu.
- Dane z Katalogu Allegro pozostają faktami źródłowymi i nie są automatycznie
  zatwierdzane do publikacji.

### 2.4. Korpusy i testy badawcze

- Przygotowano korpus 20 zróżnicowanych produktów w 12 kategoriach, m.in.
  telefony, laptopy, tablety, słuchawki, telewizory, odkurzacze, ekspresy,
  konsole, smartwatche i aparaty.
- Ekstrakcja techniczna zadziałała dla 20/20 przypadków; pełne wejście GEO było
  dostępne dla 19/20.
- Pilot retrievalu LLM wykazał powierzchnię Allegro w 18/20 prób, ale nie wykrył
  konkretnego badanego `offer_id` w żadnej z 20 prób.
- Kalibracja obejmuje 40 pomiarów LLM, 18 obserwacji z kontrolami i 43 dopasowane
  pary kontrolne.
- Żadna pojedyncza prosta cecha opisu nie wykazała stabilnej przewagi, dlatego
  wagi GEO nie zostały nauczone na tej próbce.
- Ewaluacja generatora obejmuje 20 przypadków: 8 kandydatów zostało
  wygenerowanych, wszystkie 8 zachowało poprawne pochodzenie faktów, a 12
  przypadków celowo zablokowano z powodu braków tożsamości produktu.
- Aktualny zestaw automatyczny obejmuje 60 testów rdzenia.

### 2.5. Aplikacja webowa

- Powstał responsywny interfejs zgodny wizualnie z kierunkiem Shoppalyzera.
- Lewa nawigacja rozdziela moduły `GEO` i `Analizy`.
- Użytkownik może wkleić publiczny link do oferty Allegro albo uruchomić
  zweryfikowany przykład demonstracyjny.
- Interfejs pokazuje GEO Score, części składowe, rekomendacje i walidację Allegro.
- Przed tworzeniem opisu użytkownik musi jawnie zatwierdzić fakty produktu.
- Wynik pokazuje pochodzenie, status walidacji i gotowość do ręcznego przeglądu.
- Build, lint, widok desktopowy, widok mobilny i pełny przepływ demonstracyjny
  zostały zweryfikowane lokalnie.

## 3. Jak działa model

### 3.1. Przepływ danych

```text
link do oferty Allegro
  -> bezpieczne pobranie publicznej strony
  -> parser i snapshot dowodu
  -> normalizacja danych oferty
  -> ekstrakcja cech GEO
  -> GEO Score 0–100
  -> osobna walidacja zasad Allegro
  -> rekomendacje zmian
  -> ekstrakcja atomowych faktów (claims)
  -> jawna akceptacja lub odrzucenie każdego faktu
  -> deterministyczny kandydat opisu
  -> kontrola pochodzenia i ponowna walidacja
  -> ręczny przegląd przed użyciem
```

### 3.2. GEO Score v0.1

Punktacja składa się z pięciu niezależnych części:

| Część | Maksimum | Co sprawdza |
|---|---:|---|
| Jednoznaczność produktu | 25 | marka, model, GTIN/kod producenta, obecność identyfikacji w tytule i opisie |
| Struktura i odpowiedzi | 25 | długość, nagłówki, akapity, listy i różne typy bloków |
| Fakty i specyficzność | 25 | parametry, fakty liczbowe, gęstość informacji, identyfikatory i zdjęcia |
| Jakość języka | 15 | długość zdań, powtórzenia i puste frazy promocyjne |
| Pokrycie intencji | 10 | zastosowanie, ograniczenia, obsługa, dane techniczne i zawartość zestawu |
| **Razem** | **100** | |

Wynik zawiera również:

- `confidence` zależne od kompletności wejścia, obecnie w zakresie 0,35–0,80;
- poziom dowodu `limited_observational`;
- zawsze `causalClaimAllowed: false`;
- wersję modelu `geo-score-0.1.0`;
- komplet wyników kryteriów i konkretne rekomendacje.

GEO Score nie jest prognozą pozycji, wyniku sprzedaży ani gwarancją pojawienia
się oferty w odpowiedzi LLM. Jest kontrolowaną oceną jakości i dostępności
informacji, którą można później kalibrować na lepszych eksperymentach.

### 3.3. Walidacja Allegro pozostaje osobna

Model nie miesza zgodności Allegro z GEO Score. Dzięki temu wysoki wynik GEO nie
ukryje błędu regulaminowego, a poprawność formalna nie będzie przedstawiana jako
dowód widoczności w LLM.

Walidator zwraca osobny wynik oraz informację, czy bieżące dane są wystarczające
do rozpoczęcia generowania. Brak potwierdzonej marki, modelu, parametrów lub
poprawnego GTIN może zablokować proces.

### 3.4. Generator opisów

Generator w wersji `grounded-description-0.1.0` jest deterministyczny:

1. Wyciąga atomowe fakty z bezpiecznych pól oferty.
2. Każdy fakt zachowuje identyfikator oraz ścieżkę do źródła.
3. Użytkownik zatwierdza lub odrzuca fakty.
4. Generator używa wyłącznie faktów ze statusem `approved`.
5. Marka i model są obowiązkowe; system nie zgaduje ich z tytułu.
6. Pola takie jak cena, dostawa, promocja i stan magazynowy nie trafiają do
   opisu produktu.
7. Każdy blok tekstu przechowuje listę użytych `claimIds`.
8. Walidator sprawdza, czy tekst można odtworzyć z zatwierdzonych faktów.

Obecny generator nie używa LLM. To celowa warstwa bezpieczeństwa i baza do
późniejszego podłączenia modelu językowego, który nadal będzie musiał działać w
granicach zatwierdzonych faktów.

## 4. Jak uruchomić projekt lokalnie

### 4.1. Wymagania

- Windows, macOS lub Linux;
- Node.js 24;
- npm;
- lokalna kopia repozytorium `Oskarpgit/GEO` z gałęzi `main`.

### 4.2. Pierwsze uruchomienie

W PowerShell przejdź do katalogu repozytorium:

```powershell
cd "C:\ścieżka\do\GEO"
npm install
npm --prefix apps/web install
npm run web:dev
```

Następnie otwórz:

```text
http://localhost:3000/#geo
```

Serwer działa tak długo, jak działa terminal z poleceniem `npm run web:dev`.
Zatrzymanie następuje po naciśnięciu `Ctrl+C`.

### 4.3. Kontrola jakości przed zmianami lub wdrożeniem

```powershell
npm run typecheck
npm test
npm run web:build
npm run web:lint
```

Każde z czterech poleceń powinno zakończyć się bez błędu.

## 5. Stan wdrożenia na Vercel

### 5.1. Werdykt

**Projekt będzie można uruchomić na Vercelu, ale obecna konfiguracja nie jest
jeszcze gotowa do wdrożenia bez zmian.**

Aplikacja używa Vinext 1.0 beta i Vite, lecz profil builda jest obecnie
przygotowany dla OpenAI Sites/Cloudflare Workers. Oficjalna dokumentacja Vinext
przewiduje Vercel przez plugin Nitro. Vercel obsługuje Vite, ale w przypadku
frameworka lub pluginu SSR wymaga adaptera zgodnego z Vercel Functions/Build
Output API.

Lokalny `vinext check`, uruchomiony w `apps/web`, wykazał **93% zgodności**:

- App Router, strona, layout i route handler są obsługiwane;
- `next/server` jest obsługiwany;
- jedyne ostrzeżenie dotyczy `next/font/google`, który w Vinext ładuje fonty z
  CDN zamiast osadzać je podczas builda;
- nie znaleziono błędów blokujących w samej strukturze aplikacji.

### 5.2. Dlaczego bieżącego projektu nie należy jeszcze importować „w ciemno”

1. `vite.config.ts` używa `@openai/sites-vite-plugin` i
   `@cloudflare/vite-plugin`, a nie adaptera Nitro dla Vercela.
2. API w `apps/web` importuje kod z głównego katalogu `src`. Ustawienie Root
   Directory na samo `apps/web` domyślnie odetnie te pliki.
3. Zależności są rozdzielone między główny `package.json` i `apps/web/package.json`,
   ale repo nie jest jeszcze formalnym npm workspace.
4. Rdzeń używa `node:crypto` oraz parsera HTML. Dla Vercela bezpieczniej
   uruchamiać endpoint jako Node.js Function, a nie wymuszać Edge Runtime.
5. Vercel musi otrzymać właściwą komendę builda oraz katalog wynikowy `.output`.
6. Publiczny endpoint analizujący Allegro wymaga limitowania ruchu przed
   publicznym udostępnieniem, aby uniknąć nadużyć i niekontrolowanych kosztów.

### 5.3. Zalecana ścieżka Vercel — samodzielna aplikacja

To jest szybka ścieżka do osobnego wdrożenia bieżącego modułu:

1. Utworzyć osobny profil Vite dla Vercela, np.
   `apps/web/vite.vercel.config.ts`.
2. Dodać zależność deweloperską `nitro` w `apps/web`.
3. W profilu Vercela użyć `vinext()` oraz `nitro()` i nie ładować pluginów
   Sites/Cloudflare.
4. Dodać skrypt `build:vercel`, który uruchamia Vite z profilem Vercela.
5. Usunąć `export const runtime = "edge"` z endpointu analizy albo jawnie
   przełączyć go na Node.js, a następnie ponownie przejść testy.
6. Uporządkować instalację jako npm workspace lub przenieść rdzeń do
   `packages/geo-core` z własnym `package.json`.
7. W Vercelu wskazać katalog główny repozytorium, aby build widział `src` i
   `apps/web`. Alternatywnie włączyć opcję dołączania źródeł spoza Root
   Directory, ale formalny workspace będzie rozwiązaniem stabilniejszym.
8. Ustawić build na `vite build` przez skrypt projektu, a katalog wynikowy na
   `apps/web/.output` (dla builda uruchamianego z głównego katalogu repo).
9. Ustawić Node.js 24.
10. Najpierw wdrożyć Preview, sprawdzić tryb demo i dopiero potem rzeczywisty
    link Allegro.

Przykładowy docelowy profil — do wdrożenia i zweryfikowania w osobnym etapie:

```ts
import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vinext(), nitro()],
});
```

W środowisku CI Vercela Nitro wykrywa platformę automatycznie. Przy lokalnym
teście builda należy ustawić `NITRO_PRESET=vercel` zgodnie z dokumentacją
Vinext.

### 5.4. Zalecana ścieżka docelowa — konsolidacja z Shoppalyzerem

Jeżeli istniejąca strona Shoppalyzer działa już jako natywna aplikacja Next.js
na Vercelu, bezpieczniejszym rozwiązaniem długoterminowym będzie:

1. Wydzielić `src` jako niezależny pakiet `packages/geo-core`.
2. Przenieść komponent interfejsu GEO do istniejącej aplikacji Shoppalyzer.
3. Przenieść endpoint `/api/analyze` do tej samej aplikacji.
4. Zachować `GEO` i `Analizy` jako osobne moduły w lewej nawigacji.
5. Współdzielić logowanie, konto, bazę danych, płatności i historię analiz.
6. Nie przenosić konfiguracji Sites/Cloudflare do natywnego builda Next.js.

Ta ścieżka zmniejsza liczbę osobnych wdrożeń i najlepiej odpowiada docelowemu
produktowi opisanemu przez właściciela projektu.

### 5.5. Oficjalne materiały wdrożeniowe

- [Vinext — wdrożenie przez Nitro, w tym Vercel](https://github.com/cloudflare/vinext)
- [Vercel — Vite](https://vercel.com/docs/frameworks/frontend/vite)
- [Vercel — konfiguracja monorepo](https://vercel.com/docs/monorepos)
- [Vercel — Root Directory i build](https://vercel.com/docs/builds/configure-a-build)
- [Vercel — obsługiwane wersje Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## 6. Czego jeszcze brakuje do wersji produkcyjnej

### Priorytet 0 — fundament produkcyjny

- [ ] Wydzielić `geo-core` jako stabilny pakiet współdzielony.
- [ ] Dodać i przetestować profil Vercel albo skonsolidować moduł z istniejącą
      aplikacją Shoppalyzer.
- [ ] Dodać OAuth Allegro dla kont sprzedawców.
- [ ] Podłączyć wiarygodną tożsamość produktu z Katalogu Allegro.
- [ ] Dodać bazę danych oraz wersjonowane migracje.
- [ ] Zapisywać historię audytów, snapshoty, decyzje o faktach i kandydatów.
- [ ] Dodać autoryzację użytkowników i rozdzielenie danych klientów.
- [ ] Dodać limity zapytań, kolejkę zadań, logi operacyjne i monitoring błędów.
- [ ] Wersjonować pełny ruleset Allegro wraz z datą i oficjalnym źródłem każdej
      reguły.

### Priorytet 1 — rzeczywiste pomiary GPT i Gemini

- [ ] Podłączyć oficjalne API modeli zamiast sesji przeglądarkowych.
- [ ] Zapisywać nazwę modelu, wersję promptu, datę, region, źródła i status próby.
- [ ] Dla każdego produktu wykonywać kilka powtórzeń, a nie pojedynczy pomiar.
- [ ] Rozdzielać widoczność domeny, produktu, sprzedawcy i konkretnego `offer_id`.
- [ ] Zapisywać oferty kontrolne dokładnie tego samego wariantu produktu.
- [ ] Nie zaliczać timeoutu, blokady lub błędu parsera jako wyniku negatywnego.

### Priorytet 2 — eksperymenty przed/po

- [ ] Pozyskać sprzedawców pilotażowych i zgodę na modyfikację opisów.
- [ ] Zmieniać wyłącznie opis; zmianę ceny, dostawy, promocji, parametrów, zdjęć
      lub jakości sprzedawcy traktować jako zakłócenie eksperymentu.
- [ ] Mierzyć widoczność przed zmianą i po zmianie przez wystarczająco długi czas.
- [ ] Aktualizować wagi dopiero po stabilnym wyniku na nowych produktach.
- [ ] Sprzedaż raportować jako późniejszy efekt biznesowy, a nie etykietę GEO.

### Priorytet 3 — produkt dla sprzedawców

- [ ] Konto i historia analiz.
- [ ] Porównanie bieżącego oraz proponowanego opisu.
- [ ] Edycja i ponowna walidacja kandydata.
- [ ] Eksport albo publikacja na Allegro dopiero po zatwierdzeniu użytkownika.
- [ ] Analiza wsadowa ofert.
- [ ] Panel postępu eksperymentów i widoczności w czasie.
- [ ] Integracja z płatnościami i limitami planów.

## 7. Proponowany model danych

Minimalna baza produkcyjna powinna rozdzielać:

- `users` i `organizations` — właściciele danych;
- `allegro_connections` — zaszyfrowane połączenia OAuth bez tokenów w logach;
- `offers` — stabilna tożsamość oferty i produktu;
- `offer_snapshots` — wersjonowane dane wejściowe i hash dowodu;
- `analysis_runs` — wynik GEO, Allegro i wersje reguł;
- `claims` oraz `claim_decisions` — fakty i decyzje użytkownika;
- `description_candidates` — kandydaci, użyte fakty i status walidacji;
- `llm_measurement_runs` — powtórzenia GPT/Gemini i status techniczny;
- `llm_appearances` — pozycje, linki i dopasowania tożsamości;
- `description_experiments` — pary przed/po oraz zmienne kontrolne.

Nie należy „uczyć” systemu bezpośrednio z każdej zapisanej analizy. Dane muszą
najpierw przejść kontrolę jakości, dopasowanie produktu i procedurę ewaluacji.

## 8. Co będzie potrzebne od właściciela projektu

W kolejnych etapach przydadzą się:

1. Dostęp do repozytorium i stosu technologicznego działającej strony
   Shoppalyzer, jeżeli wybierzemy konsolidację.
2. Aplikacja Allegro Developer oraz dane OAuth do testowego konta sprzedawcy.
3. Kilka własnych ofert pilotażowych, dla których można kontrolować opis.
4. Klucze API OpenAI i Google Gemini dopiero przy wdrażaniu automatycznych
   pomiarów produkcyjnych.
5. Firecrawl wyłącznie jako opcjonalne, kontrolowane źródło danych, gdy zwykłe
   pobranie strony lub oficjalne API nie wystarczy. Każde użycie powinno być
   wcześniej zatwierdzone ze względu na kredyty.

Kluczy i tokenów nie wolno umieszczać w repozytorium. Lokalne sekrety powinny
trafiać do ignorowanego pliku `.env.local`, a produkcyjne do ustawień środowiska
Vercela lub innej platformy.

## 9. Najbliższa zalecana kolejność prac

1. **Wydzielenie `geo-core`** — usuwa problem importów spoza aplikacji i
   przygotowuje konsolidację.
2. **Profil wdrożeniowy Vercel** — Nitro, Node.js runtime i Preview Deployment.
3. **Baza danych i historia analiz** — bez tego wyniki nie tworzą trwałej wiedzy.
4. **OAuth oraz Katalog Allegro** — wiarygodna tożsamość produktu przed
   generowaniem.
5. **Produkcja kandydatów z opcjonalnym LLM** — zawsze ograniczona do
   zatwierdzonych faktów.
6. **Powtarzane testy GPT/Gemini** — z pełną obserwowalnością i kontrolami.
7. **Pilotaż przed/po** — dopiero ten etap może dostarczyć dowodu wpływu
   optymalizacji opisu.
8. **Konsolidacja z działającym Shoppalyzerem** — wspólne konto, płatności i UI.

## 10. Kryteria gotowości pierwszej wersji publicznej

Wersja może zostać publicznie udostępniona, gdy:

- [ ] użytkownicy są uwierzytelniani, a dane klientów rozdzielone;
- [ ] analiza ma limity i ochronę przed nadużyciami;
- [ ] tożsamość produktu pochodzi z zaufanego źródła;
- [ ] każdy wygenerowany fakt ma pochodzenie i decyzję użytkownika;
- [ ] reguły Allegro mają wersję, źródło i datę przeglądu;
- [ ] testy, typecheck, build i lint przechodzą w CI;
- [ ] Vercel Preview przechodzi test trybu demo i prawdziwej oferty;
- [ ] błędy, timeouty i blokady są rejestrowane osobno od wyników GEO;
- [ ] interfejs nie obiecuje sprzedaży ani pozycji w LLM;
- [ ] istnieje procedura wycofania błędnego opisu lub wersji reguł.

---

Aktualny fundament jest wystarczający do dalszego rozwoju i demonstracji
lokalnej. Najważniejszym następnym krokiem technicznym jest wydzielenie rdzenia
oraz przygotowanie docelowego środowiska Vercel/Next.js, a najważniejszym
krokiem badawczym — kontrolowane eksperymenty przed/po na ofertach sprzedawców.
