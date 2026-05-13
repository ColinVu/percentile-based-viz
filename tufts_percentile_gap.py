#!/usr/bin/env python3
"""Mean absolute percentile gap vs Tufts across numeric columns in colleges.xlsx."""

from pathlib import Path

import pandas as pd

XLSX = Path(__file__).resolve().parent / "colleges.xlsx"
OUT_XLSX = Path(__file__).resolve().parent / "tufts_percentile_gap.xlsx"
TUFTS = "Tufts University"


def main() -> list[dict]:
    df = pd.read_excel(XLSX)
    name = df["College"].astype(str).str.strip()
    num = df.select_dtypes(include="number")
    pct = num.rank(pct=True).mul(100)

    tufts = name == TUFTS
    if not tufts.any():
        raise SystemExit(f"College not found: {TUFTS!r}")
    t = pct.loc[tufts].iloc[0]

    out: list[dict] = []
    for i in pct.index:
        if bool(tufts.loc[i]):
            continue
        diff = (t - pct.loc[i]).abs().mean()
        out.append({"college": name.loc[i], "avg_percentile_diff": float(diff)})
    out.sort(key=lambda r: r["avg_percentile_diff"])
    return out


if __name__ == "__main__":
    pd.DataFrame(main()).to_excel(OUT_XLSX, index=False)
