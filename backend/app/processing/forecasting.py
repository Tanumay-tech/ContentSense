"""Restrained trend forecasting: Holt's linear method with a damped trend.

    level_t = a * y_t + (1 - a) * (level_{t-1} + phi * trend_{t-1})
    trend_t = b * (level_t - level_{t-1}) + (1 - b) * phi * trend_{t-1}
    yhat_{t+h} = level_t + (phi + phi^2 + ... + phi^h) * trend_t

* alpha/beta are chosen by grid search on one-step-ahead squared error.
* phi (damping) < 1 flattens the projection over time, which keeps estimates
  conservative.
* An approximate 80% interval widens with the horizon.
* A hold-out back-test (last N weeks) reports MAPE so users can judge accuracy.
* Series shorter than FORECAST_MIN_WEEKS are refused rather than guessed.
"""
from __future__ import annotations

import numpy as np

from app import config

Z80 = 1.2816


def _holt(y: np.ndarray, a: float, b: float, phi: float) -> tuple[float, float, np.ndarray]:
    level, trend = y[0], y[1] - y[0]
    fitted = np.empty_like(y)
    fitted[0] = y[0]
    for t in range(1, len(y)):
        pred = level + phi * trend
        fitted[t] = pred
        new_level = a * y[t] + (1 - a) * pred
        trend = b * (new_level - level) + (1 - b) * phi * trend
        level = new_level
    return level, trend, fitted


def _fit(y: np.ndarray, phi: float) -> tuple[float, float, float, float, np.ndarray]:
    best = None
    for a in np.arange(0.1, 1.0, 0.1):
        for b in np.arange(0.05, 0.55, 0.05):
            level, trend, fitted = _holt(y, a, b, phi)
            sse = float(np.sum((y[1:] - fitted[1:]) ** 2))
            if best is None or sse < best[0]:
                best = (sse, a, b, level, trend, fitted)
    _, a, b, level, trend, fitted = best
    return a, b, level, trend, fitted


def _project(level: float, trend: float, phi: float, h: int) -> np.ndarray:
    damp = np.cumsum([phi ** i for i in range(1, h + 1)])
    return level + damp * trend


def forecast_series(dates: list[str], values: list[float], horizon: int | None = None) -> dict:
    horizon = horizon or config.FORECAST_HORIZON_WEEKS
    y = np.asarray(values, dtype=float)
    n = len(y)
    if n < config.FORECAST_MIN_WEEKS:
        return {
            "available": False,
            "reason": "Insufficient history for reliable forecasting.",
            "detail": f"{n} weeks of data available; at least {config.FORECAST_MIN_WEEKS} weeks are required.",
            "history_weeks": n,
        }
    phi = config.FORECAST_DAMPING
    a, b, level, trend, fitted = _fit(y, phi)
    resid = y[1:] - fitted[1:]
    sigma = float(np.std(resid, ddof=1)) if len(resid) > 2 else 0.0
    point = np.clip(_project(level, trend, phi, horizon), 0, 100)
    widths = Z80 * sigma * np.sqrt(np.arange(1, horizon + 1))

    # back-test on hold-out
    hold = config.FORECAST_HOLDOUT_WEEKS
    backtest = None
    if n - hold >= config.FORECAST_MIN_WEEKS - hold and n > hold + 10:
        ta, tb, tl, tt, _ = _fit(y[:-hold], phi)
        pred = np.clip(_project(tl, tt, phi, hold), 0, 100)
        actual = y[-hold:]
        mape = float(np.mean(np.abs((actual - pred) / np.maximum(actual, 1e-6))) * 100)
        backtest = {"weeks": hold, "mape_pct": round(mape, 1),
                    "points": [{"date": dates[n - hold + i], "actual": round(float(actual[i]), 2),
                                "predicted": round(float(pred[i]), 2)} for i in range(hold)]}

    last_date = np.datetime64(dates[-1])
    fdates = [str(last_date + np.timedelta64(7 * (i + 1), "D")) for i in range(horizon)]
    current = float(np.mean(y[-config.MARKET_RECENT_WEEKS:]))
    end = float(point[-1])
    change = (end - current) / current * 100 if current else 0.0
    if change > 5:
        direction = "Projected upward"
    elif change < -5:
        direction = "Projected downward"
    else:
        direction = "Projected flat"

    reliability = "n/a"
    if backtest:
        m = backtest["mape_pct"]
        reliability = "Higher" if m < 10 else "Moderate" if m < 20 else "Lower"

    return {
        "available": True,
        "method": "Holt's linear trend with damping (double exponential smoothing)",
        "params": {"alpha": round(float(a), 2), "beta": round(float(b), 2), "phi": phi},
        "horizon_weeks": horizon,
        "history_weeks": n,
        "points": [{"date": fdates[i], "forecast": round(float(point[i]), 2),
                    "lower": round(float(max(0, point[i] - widths[i])), 2),
                    "upper": round(float(min(100, point[i] + widths[i])), 2)} for i in range(horizon)],
        "expected_change_pct": round(change, 1),
        "direction": direction,
        "backtest": backtest,
        "reliability": reliability,
        "disclaimer": "Forecast based on historical pattern only. It is an estimate, not a guaranteed outcome; "
                      "external events can change market interest at any time.",
    }
