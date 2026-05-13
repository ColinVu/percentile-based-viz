#!/usr/bin/env python3
"""Pearson correlation of every column vs Expenditure Per Student in colleges.xlsx."""

from pathlib import Path

import numpy as np
import pandas as pd

XLSX = Path(__file__).resolve().parent / "colleges.xlsx"
OUT_XLSX = Path(__file__).resolve().parent / "colleges_expenditure_per_student_correlations.xlsx"
REF = "Expenditure Per Student"


def pearson_r(a: pd.Series, b: pd.Series) -> float:
    """Pairwise Pearson r; NaN if undefined (too few points, zero variance)."""
    m = a.notna() & b.notna()
    xa = a[m].to_numpy(dtype=float, copy=False)
    xb = b[m].to_numpy(dtype=float, copy=False)
    if xa.size < 2:
        return float("nan")
    if np.nanstd(xa) == 0 or np.nanstd(xb) == 0:
        return float("nan")
    return float(np.corrcoef(xa, xb)[0, 1])


def main() -> pd.DataFrame:
    df = pd.read_excel(XLSX)
    if REF not in df.columns:
        raise SystemExit(f"Missing reference column {REF!r}. Available: {list(df.columns)}")

    ref_series = pd.to_numeric(df[REF], errors="coerce")
    rows: list[tuple[str, float]] = []

    ref_vals = ref_series.dropna()
    ref_ok = len(ref_vals) >= 2 and np.isfinite(ref_vals.std()) and ref_vals.std() != 0

    for col in df.columns:
        if col == REF:
            rows.append((col, 1.0 if ref_ok else float("nan")))
            continue

        s = pd.to_numeric(df[col], errors="coerce")
        if s.notna().sum() < 2 or not ref_ok:
            rows.append((col, float("nan")))
            continue

        rows.append((col, pearson_r(s, ref_series)))

    out = pd.DataFrame(rows, columns=["column", "pearson_correlation"])
    out["_abs"] = out["pearson_correlation"].abs()
    out = out.sort_values(["_abs", "column"], ascending=[False, True]).drop(columns=["_abs"])
    return out


if __name__ == "__main__":
    main().to_excel(OUT_XLSX, index=False)
