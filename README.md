# Zdravotnické prostředky na poukaz · ČR 2020–2024

Statická webová analýza objemu zdravotnických prostředků hrazených z veřejného zdravotního pojištění v České republice za posledních pět let, založená na otevřených datech [Národního registru hrazených zdravotních služeb (NRHZS)](https://www.uzis.cz/index.php?pg=registry-sber-dat--narodni-registr-hrazenych-zdravotnich-sluzeb), zveřejněných Ústavem zdravotnických informací a statistiky ČR (ÚZIS) na portálu [NZIS Open / NZIP](https://www.nzip.cz/o-nzis-open).

**Demo:** [_po nasazení na GitHub Pages doplň odkaz, např._ `https://<uživatel>.github.io/<repo>/`](https://github.com/blair-droid/uzis)

## Co stránka obsahuje

1. **Stručný deskriptivní popis datové sady** – co je v NRHZS, jaká je granularita, časové pokrytí, licence, metodika.
2. **Tři vizualizace** s interpretacemi cílenými na laickou veřejnost:
   - **Graf 1 – Vývoj úhrad 2020–2024** (stohovaný sloupcový graf po kategoriích).
   - **Graf 2 – Úhrada na pacienta vs. celková úhrada** (bublinkový graf v roce 2024).
   - **Graf 3 – Procentuální nárůst úhrad** mezi rokem 2020 a 2024 (vodorovné sloupce).
3. **Limity dat** a metodická poznámka pro kontext.

Vše je v češtině. Stránka je responzivní, načítá se v jedné chvíli (cca 16 kB JSON + 9 kB CSS + 8 kB JS + Chart.js CDN).

## Použitá datová sada

| | |
|---|---|
| **Název** | Zdravotnické prostředky na poukaz dle úhradové skupiny (datový souhrn) |
| **Identifikátor** | NR-04-33, verze 2025-01.01 |
| **Zdroj** | NRHZS / ÚZIS ČR, publikováno na [nzip.cz/data/2215](https://www.nzip.cz/data/2215-zdravotnicke-prostredky-poukaz-uhradova-skupina-datovy-souhrn) |
| **Časové pokrytí** | 1. 1. 2020 – 31. 12. 2024 (5 uzavřených let) |
| **Územní pokrytí** | celá ČR, agregát ze všech 7 zdravotních pojišťoven |
| **Granularita** | úhradová skupina × rok, ve 4 úrovních (XX, XX.XX, XX.XX.XX, XX.XX.XX.XX) |
| **Formát** | XLSX, ~ 160 kB |
| **Licence** | CC BY 4.0 |
| **Periodicita** | 1× ročně |

Citace zdroje:  
> Vysoudil M., Jarkovský J., Klika P., Klimeš D., Mužík J., Komenda M., Dušek L. *Zdravotnické prostředky na poukaz dle úhradové skupiny.* Národní zdravotnický informační portál [online]. Praha: MZ ČR a ÚZIS ČR, 2024. ISSN 2695-0340.

Pro analýzu **na úrovni jednotlivých poskytovatelů (IČZ)** lze stejný registr číst přes mnohem větší (~ 180 MB) CSV sadu [NR-04-31](https://www.nzip.cz/data/2217-zdravotnicke-prostredky-kod-mesic-icz-otevrena-data).

## Struktura repozitáře

```
.
├── index.html          # stránka (HTML)
├── styles.css          # design (editorial, CSS proměnné)
├── script.js           # Chart.js 4 vykreslování
├── prepare_data.py     # ETL: XLSX → data.json
├── requirements.txt    # pandas + openpyxl
├── data/
│   ├── source.xlsx     # originální XLSX z NZIP (CC BY 4.0)
│   └── data.json       # zpracovaná, malá verze pro front-end
├── .nojekyll           # vypíná Jekyll na GitHub Pages
└── README.md
```

## Reprodukce / refresh dat

Datový souhrn ÚZIS aktualizuje 1× ročně. Pro vygenerování `data/data.json` z přiloženého XLSX:

```bash
pip install -r requirements.txt
python prepare_data.py data/source.xlsx
```

Pro stažení **aktuální** verze přímo z NZIP (vyžaduje funkční síť):

```bash
python prepare_data.py --download
```

Skript načítá list **„Typ ZP“** (11 typů úhradových skupin) jako hlavní zdroj a list **„Úhr. sk. – zkrácená XX.XX“** pro případné drill-downy. Výstupem je jediný `data/data.json` (~ 16 kB).

## Lokální náhled

GitHub Pages obslouží stránku staticky. Pro lokální vývoj:

```bash
python -m http.server 8000
# pak otevři http://localhost:8000
```

(Otevření `index.html` přímo přes `file://` nebude fungovat – prohlížeč zablokuje `fetch('data/data.json')`.)

## Nasazení na GitHub Pages

1. Push do `main` (nebo libovolné větve).
2. V GitHub → **Settings → Pages → Source: Deploy from a branch → main / root**.
3. Odkaz `https://<uživatel>.github.io/<repo>/` bude funkční do několika minut.

Soubor `.nojekyll` v rootu zaručí, že GitHub nebude zbytečně procházet stránku přes Jekyll.

## Použité technologie

- HTML 5 / CSS 3 (žádný build, žádné frameworky).
- [Chart.js 4](https://www.chartjs.org) přes CDN pro grafy.
- [Newsreader](https://fonts.google.com/specimen/Newsreader) (display) + [Public Sans](https://fonts.google.com/specimen/Public+Sans) (body) + [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (technické popisky) přes Google Fonts.
- Python 3 + [pandas](https://pandas.pydata.org/) + [openpyxl](https://openpyxl.readthedocs.io/) pro přípravu dat.

## Licence

- **Data:** © ÚZIS ČR, licence [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.cs). Při použití uvádějte citaci podle [stránky datasetu](https://www.nzip.cz/data/2215-zdravotnicke-prostredky-poukaz-uhradova-skupina-datovy-souhrn).
- **Kód a vizuální zpracování:** MIT.
