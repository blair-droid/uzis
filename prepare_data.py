#!/usr/bin/env python3
"""
prepare_data.py – načte datový souhrn NR-04-33 z NZIP/ÚZIS a vygeneruje
data/data.json pro statickou webovou prezentaci.

Použití:
    # 1) Stáhne nejnovější XLSX a zpracuje:
    python prepare_data.py --download

    # 2) Použije lokální soubor:
    python prepare_data.py data/source.xlsx

Zdroj dat:
    Národní zdravotnický informační portál (NZIP) – ÚZIS ČR
    https://www.nzip.cz/data/2215-zdravotnicke-prostredky-poukaz-uhradova-skupina-datovy-souhrn
    Licence: CC BY 4.0
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

import pandas as pd

# --- Konfigurace ---------------------------------------------------------------
XLSX_URL = (
    "https://www.nzip.cz/data/nrhzs/datove-souhrny/"
    "Datovy-souhrn-NR-04-33-zdravotnicke-prostredky-poukaz-uhradova-skupina-2025-01.xlsx"
)
DEFAULT_LOCAL_PATH = Path("data/source.xlsx")
OUTPUT_JSON_PATH = Path("data/data.json")
YEARS = [2020, 2021, 2022, 2023, 2024]

# Číselník typů zdravotnických prostředků (zkrácený dvojmístný kód úhradové skupiny)
# Zdroj: zákon č. 48/1997 Sb., příloha 3, oddíl C, tabulka č. 1 (ve znění od 1. 1. 2019).
TYP_ZP_CODEBOOK: dict[str, dict[str, str]] = {
    "01": {
        "short": "Krycí prostředky",
        "full": "ZP krycí (obvazy, gázy, krytí ran)",
        "examples": "sterilní gázy, krytí na chronické rány, hydrokoloidní krytí, krytí pro vlhké hojení",
    },
    "02": {
        "short": "Inkontinence",
        "full": "ZP pro inkontinentní pacienty",
        "examples": "plenkové kalhotky, podložky, vložky pro inkontinenci",
    },
    "03": {
        "short": "Dýchání a výživa",
        "full": "ZP respirační, inhalační a pro aplikaci enterální výživy",
        "examples": "inhalátory, kyslíkové koncentrátory, sondy pro enterální výživu",
    },
    "04": {
        "short": "Stomie",
        "full": "ZP pro pacienty se stomií",
        "examples": "stomické sáčky, podložky, ochranné krémy",
    },
    "05": {
        "short": "Diabetes",
        "full": "ZP pro pacienty s diabetem",
        "examples": "glukometry, testovací proužky, jehly, inzulínové pumpy, senzory CGM",
    },
    "06": {
        "short": "Kompresivní terapie",
        "full": "ZP pro kompresivní terapii",
        "examples": "kompresivní punčochy, bandáže, návleky",
    },
    "07": {
        "short": "Ortopedie a protetika",
        "full": "ZP ortopedicko-protetické a ortopedická obuv",
        "examples": "protézy končetin, ortézy, ortopedické vložky, ortopedická obuv",
    },
    "08": {
        "short": "Mobilita",
        "full": "ZP pro pacienty s poruchou mobility",
        "examples": "invalidní vozíky, chodítka, berle",
    },
    "09": {
        "short": "Zrak",
        "full": "ZP pro pacienty s poruchou zraku",
        "examples": "brýle, brýlové čočky, pomůcky pro slabozraké",
    },
    "10": {
        "short": "Sluch",
        "full": "ZP pro pacienty s poruchou sluchu",
        "examples": "sluchadla, kochleární implantáty (komponenty)",
    },
    "11": {
        "short": "Hlas a řeč",
        "full": "ZP pro pacienty s poruchou hlasu a řeči",
        "examples": "hlasivky, komunikační pomůcky",
    },
}


# --- Logika -------------------------------------------------------------------
def download_xlsx(destination: Path) -> None:
    """Stáhne XLSX z NZIP do zadané cesty."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    print(f"Stahuji {XLSX_URL} …")
    with urllib.request.urlopen(XLSX_URL) as resp, open(destination, "wb") as f:
        f.write(resp.read())
    print(f"  uloženo do {destination} ({destination.stat().st_size / 1024:.1f} kB)")


def read_typ_sheet(xlsx_path: Path) -> pd.DataFrame:
    """Načte list 'Typ ZP' a vrátí čistou tabulku 11 typů × 16 sloupců."""
    raw = pd.read_excel(xlsx_path, sheet_name="Typ ZP", header=None)
    # V XLSX šabloně ÚZIS začínají datové řádky od indexu 11.
    cleaned = raw.iloc[11:22].copy()
    cleaned.columns = [
        "typ",
        *[f"pat{y}" for y in YEARS],
        *[f"bal{y}" for y in YEARS],
        *[f"uhr{y}" for y in YEARS],
    ]
    for col in cleaned.columns[1:]:
        cleaned[col] = pd.to_numeric(cleaned[col], errors="coerce")
    return cleaned


def read_subgroup_sheet(xlsx_path: Path) -> pd.DataFrame:
    """Načte list zkrácených úhradových skupin XX.XX (70 řádků)."""
    raw = pd.read_excel(xlsx_path, sheet_name="Úhr. sk. – zkrácená XX.XX", header=None)
    cleaned = raw.iloc[11:].copy().dropna(subset=[0])
    cleaned.columns = [
        "kod", "typ",
        *[f"pat{y}" for y in YEARS],
        *[f"bal{y}" for y in YEARS],
        *[f"uhr{y}" for y in YEARS],
    ]
    for col in cleaned.columns[2:]:
        cleaned[col] = pd.to_numeric(cleaned[col], errors="coerce")
    return cleaned


def build_payload(typ_df: pd.DataFrame, sub_df: pd.DataFrame) -> dict:
    """Sestaví výsledný slovník pro export do JSON."""
    kategorie = []
    for _, row in typ_df.iterrows():
        typ = str(int(row["typ"])).zfill(2)
        meta = TYP_ZP_CODEBOOK.get(typ, {"short": f"Typ {typ}", "full": f"Typ {typ}", "examples": ""})
        kategorie.append({
            "kod": typ,
            "nazev": meta["short"],
            "plny_nazev": meta["full"],
            "priklady": meta["examples"],
            "pacienti": [int(row[f"pat{y}"]) if pd.notna(row[f"pat{y}"]) else 0 for y in YEARS],
            "baleni":   [float(row[f"bal{y}"]) if pd.notna(row[f"bal{y}"]) else 0.0 for y in YEARS],
            "uhrada_kc":[float(row[f"uhr{y}"]) if pd.notna(row[f"uhr{y}"]) else 0.0 for y in YEARS],
        })

    sub = {}
    for _, row in sub_df.iterrows():
        typ = str(row["typ"]).zfill(2) if not pd.isna(row["typ"]) else "??"
        sub.setdefault(typ, []).append({
            "kod": str(row["kod"]),
            "pacienti_2024": int(row["pat2024"]) if pd.notna(row["pat2024"]) else 0,
            "uhrada_2020":   float(row["uhr2020"]) if pd.notna(row["uhr2020"]) else 0.0,
            "uhrada_2024":   float(row["uhr2024"]) if pd.notna(row["uhr2024"]) else 0.0,
        })

    totals_baleni = [sum(c["baleni"][i] for c in kategorie) for i in range(len(YEARS))]
    totals_uhrada = [sum(c["uhrada_kc"][i] for c in kategorie) for i in range(len(YEARS))]

    return {
        "metadata": {
            "nazev_datasetu": "Zdravotnické prostředky na poukaz dle úhradové skupiny (datový souhrn)",
            "id_souboru": "NR-04-33",
            "verze_souhrnu": "2025-01.01",
            "zdroj": "Národní registr hrazených zdravotních služeb (NRHZS)",
            "spravce": "Ústav zdravotnických informací a statistiky ČR (ÚZIS ČR)",
            "url_nzip": "https://www.nzip.cz/data/2215-zdravotnicke-prostredky-poukaz-uhradova-skupina-datovy-souhrn",
            "url_xlsx": XLSX_URL,
            "licence": "CC BY 4.0",
            "roky": YEARS,
            "datum_zpracovani_zdroje": "27.11.2025",
            "pravni_zaklad": "zákon č. 48/1997 Sb., příloha 3, oddíl C, tabulka č. 1",
        },
        "kategorie": kategorie,
        "totals": {
            "baleni": totals_baleni,
            "uhrada_kc": totals_uhrada,
        },
        "subkategorie": sub,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("xlsx", nargs="?", type=Path, default=DEFAULT_LOCAL_PATH,
                        help="cesta k XLSX (default: data/source.xlsx)")
    parser.add_argument("--download", action="store_true",
                        help="před zpracováním stáhnout aktuální XLSX z NZIP")
    parser.add_argument("--output", type=Path, default=OUTPUT_JSON_PATH,
                        help="cesta k výstupnímu JSON (default: data/data.json)")
    args = parser.parse_args()

    if args.download:
        download_xlsx(args.xlsx)

    if not args.xlsx.exists():
        print(f"CHYBA: soubor {args.xlsx} nenalezen. Spusť s --download.", file=sys.stderr)
        return 1

    typ_df = read_typ_sheet(args.xlsx)
    sub_df = read_subgroup_sheet(args.xlsx)
    payload = build_payload(typ_df, sub_df)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    total_2024 = payload["totals"]["uhrada_kc"][-1] / 1e9
    total_2020 = payload["totals"]["uhrada_kc"][0] / 1e9
    growth = (total_2024 / total_2020 - 1) * 100
    print(f"✓ {args.output} ({args.output.stat().st_size / 1024:.1f} kB)")
    print(f"  Celková úhrada 2020: {total_2020:.2f} mld Kč")
    print(f"  Celková úhrada 2024: {total_2024:.2f} mld Kč  (+{growth:.1f} %)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
