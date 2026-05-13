#!/usr/bin/env python3
"""Per-column percentiles for Georgia Tech vs Berklee (colleges.xlsx)."""

from pathlib import Path

import pandas as pd

XLSX = Path(__file__).resolve().parent / "colleges.xlsx"
OUT_XLSX = Path(__file__).resolve().parent / "georgia_tech_berklee_percentiles.xlsx"
GT = "Georgia Institute of Technology-Main Campus"
BERKLEE = "Berklee College of Music"


def main() -> pd.DataFrame:
    df = pd.read_excel(XLSX)
    name = df["College"].astype(str).str.strip()
    gt = name == GT
    bk = name == BERKLEE
    if not gt.any():
        raise SystemExit(f"College not found: {GT!r}")
    if not bk.any():
        raise SystemExit(f"College not found: {BERKLEE!r}")

    metric_cols = [c for c in df.columns if c != "College"]
    pct = df[metric_cols].rank(pct=True).mul(100)
    g = pct.loc[gt].iloc[0]
    b = pct.loc[bk].iloc[0]
    diff = (g - b).abs()

    out = pd.DataFrame(
        {
            "column": metric_cols,
            "georgia_tech_percentile": g.values,
            "berklee_percentile": b.values,
            "abs_percentile_diff": diff.values,
        }
    )
    return out.sort_values("abs_percentile_diff", ascending=False).reset_index(drop=True)


if __name__ == "__main__":
    main().to_excel(OUT_XLSX, index=False)
