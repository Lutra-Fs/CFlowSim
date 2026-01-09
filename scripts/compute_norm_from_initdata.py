#!/usr/bin/env python3
import argparse
import json
import math
from pathlib import Path


def iter_samples(paths):
    for path in paths:
        data = json.loads(path.read_text())
        for batch in data:
            for row in batch:
                for cell in row:
                    yield cell


def compute_stats(paths, channels=5):
    counts = [0] * channels
    sums = [0.0] * channels
    sums_sq = [0.0] * channels
    for cell in iter_samples(paths):
        for idx in range(channels):
            value = float(cell[idx])
            counts[idx] += 1
            sums[idx] += value
            sums_sq[idx] += value * value
    means = [
        (sums[i] / counts[i]) if counts[i] else 0.0 for i in range(channels)
    ]
    variances = [
        max(sums_sq[i] / counts[i] - means[i] * means[i], 0.0)
        if counts[i]
        else 0.0
        for i in range(channels)
    ]
    stds = [math.sqrt(v) for v in variances]
    return counts, means, stds


def combined_std(mean_a, std_a, mean_b, std_b):
    mean = (mean_a + mean_b) / 2
    var = (std_a * std_a + std_b * std_b) / 2
    var += ((mean_a * mean_a + mean_b * mean_b) / 2) - mean * mean
    return mean, math.sqrt(max(var, 0.0))


def build_meta(density_sd, velocity_sd, force_sd, force_alpha=1.0):
    return {
        "version": 1,
        "channels": {"density": 0, "velocity": [1, 2], "force": [3, 4]},
        "normalization": {
            "densitySd": density_sd,
            "velocitySd": velocity_sd,
            "forceSd": [force_sd, force_sd],
            "forceScaleAlpha": force_alpha,
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Compute normalization stats from initData JSON files."
    )
    parser.add_argument(
        "--init-data-root",
        default="public/initData",
        help="Root directory containing initData JSON files.",
    )
    parser.add_argument(
        "--output",
        default="public/model/bno_small_001.meta.json",
        help="Output path for model meta JSON.",
    )
    args = parser.parse_args()

    root = Path(args.init_data_root)
    paths = [p for p in root.rglob("*.json") if p.name != "index.json"]
    if not paths:
        raise SystemExit(f"No initData JSON files found under {root}")

    _, means, stds = compute_stats(paths, channels=5)
    _, velocity_sd = combined_std(means[1], stds[1], means[2], stds[2])
    _, force_sd = combined_std(means[3], stds[3], means[4], stds[4])

    meta = build_meta(stds[0], velocity_sd, force_sd)
    output = Path(args.output)
    output.write_text(json.dumps(meta, indent=2) + "\n")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
