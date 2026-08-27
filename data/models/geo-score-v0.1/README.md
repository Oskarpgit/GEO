# Kalibracja GEO Score v0.1

## Zakres

Raport `calibration.json` powstał z 40 testów LLM i bezpiecznych profili ofert.
Obejmuje 18 obserwacji, dla których znaleziono co najmniej jedną aktywną ofertę
kontrolną dokładnie tego samego produktu, oraz 43 dopasowane kontrole.

Porównanie odbywa się wewnątrz obserwacji:

```text
cecha oferty wskazanej przez LLM - średnia cechy dopasowanych kontroli
```

Dzięki temu obserwacja z czterema kontrolami nie ma czterokrotnie większego
wpływu niż obserwacja z jedną kontrolą.

## Najważniejszy wynik

Żadna pojedyncza prosta cecha strukturalna nie odróżnia obecnie stabilnie ofert
wskazywanych przez LLM:

- liczba parametrów była identyczna w 16 z 18 obserwacji;
- większa liczba słów wystąpiła po stronie wskazanej oferty tylko w 8 z 18
  obserwacji, a mediana różnicy była ujemna;
- dodatnia różnica liczby faktów liczbowych pojawiła się w 9 z 18 obserwacji;
- sygnały FAQ nie miały dodatniej różnicy w żadnej obserwacji;
- nagłówki, akapity, listy i obrazy miały mieszane kierunki różnic.

Wniosek: nie wolno trenować wag na tej próbce ani przedstawiać tych cech jako
przyczyny widoczności. `GEO Score v0.1` pozostaje audytowalnym modelem regułowym,
a raport kalibracyjny służy do kontrolowania hipotez i projektowania kolejnych
eksperymentów.

## Jak interpretować wynik

- `meanPairedDelta` — średnia różnica po uśrednieniu kontroli w obserwacji;
- `medianPairedDelta` — mediana tych różnic, mniej wrażliwa na skrajne opisy;
- `positiveDeltaShare` — udział obserwacji, w których wskazana oferta miała
  większą wartość cechy;
- `weightsFittedFromThisSample: false` — bieżąca punktacja nie została
  dopasowana do wyników tych 18 obserwacji;
- `causalClaimAllowed: false` — raport nie pozwala stwierdzić wpływu opisu.

## Kolejny wymagany eksperyment

Należy zebrać pomiary przed/po dla ofert sprzedawców pilotażowych. W każdej
parze zmieniamy wyłącznie opis, a cena, dostawa, promocja, zdjęcia, parametry i
status sprzedawcy pozostają stałe albo unieważniają eksperyment. Dopiero stabilny
wynik na nowych produktach może posłużyć do aktualizacji wag.
