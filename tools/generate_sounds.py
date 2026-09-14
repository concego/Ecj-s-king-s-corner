"""Generate the small procedural sound set used by ECJ King's Corner.

Only Python's standard library is used. The output is mono, 44.1 kHz,
16-bit PCM WAV, with short fades to avoid clicks and harsh edges.
"""

from __future__ import annotations

import math
import random
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 44_100
OUT = Path(__file__).resolve().parents[1] / "assets" / "sounds"


def envelope(position: float, duration: float, attack: float = 0.008, release: float = 0.04) -> float:
    if position < attack:
        return position / attack
    if position > duration - release:
        return max(0.0, (duration - position) / release)
    return 1.0


def tone(frequency: float, duration: float, volume: float = 0.22, waveform: str = "sine") -> list[float]:
    count = max(1, int(SAMPLE_RATE * duration))
    samples: list[float] = []
    for index in range(count):
        time = index / SAMPLE_RATE
        phase = 2 * math.pi * frequency * time
        if waveform == "triangle":
            value = 2 * abs(2 * ((frequency * time) % 1) - 1) - 1
        elif waveform == "square":
            value = 1.0 if math.sin(phase) >= 0 else -1.0
        else:
            value = math.sin(phase)
        samples.append(value * volume * envelope(time, duration))
    return samples


def noise(duration: float, volume: float = 0.12, seed: int = 1) -> list[float]:
    rng = random.Random(seed)
    count = max(1, int(SAMPLE_RATE * duration))
    return [rng.uniform(-1, 1) * volume * envelope(index / SAMPLE_RATE, duration, 0.002, 0.03) for index in range(count)]


def mix(*tracks: list[float]) -> list[float]:
    length = max((len(track) for track in tracks), default=0)
    output = [0.0] * length
    for track in tracks:
        for index, value in enumerate(track):
            output[index] += value
    peak = max((abs(value) for value in output), default=1.0)
    if peak > 0.92:
        output = [value * 0.92 / peak for value in output]
    return output


def sequence(notes: list[tuple[float, float, float]], gap: float = 0.006) -> list[float]:
    result: list[float] = []
    for frequency, duration, volume in notes:
        result.extend(tone(frequency, duration, volume))
        result.extend([0.0] * int(SAMPLE_RATE * gap))
    return result


def save(name: str, samples: list[float]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.wav"
    pcm = b"".join(struct.pack("<h", max(-32768, min(32767, int(sample * 32767)))) for sample in samples)
    with wave.open(str(path), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(SAMPLE_RATE)
        file.writeframes(pcm)


def generate() -> None:
    save("card-select", sequence([(660, 0.075, 0.17)]))
    save("card-draw", mix(noise(0.22, 0.075, 10), sequence([(280, 0.06, 0.11), (390, 0.12, 0.10)])))
    save("card-play", sequence([(440, 0.07, 0.14), (554, 0.11, 0.13)]))
    save("card-cancel", sequence([(440, 0.06, 0.13), (330, 0.09, 0.12)]))
    save("stack-move", sequence([(330, 0.06, 0.12), (440, 0.07, 0.13), (554, 0.1, 0.14)]))
    save("confirm", sequence([(523, 0.08, 0.14), (659, 0.12, 0.15)]))
    save("cancel", sequence([(392, 0.08, 0.13), (294, 0.12, 0.12)]))
    save("menu-focus", tone(520, 0.045, 0.10, "triangle"))
    save("menu-open", sequence([(392, 0.06, 0.11), (523, 0.1, 0.13)]))
    save("menu-back", sequence([(523, 0.06, 0.11), (392, 0.1, 0.12)]))
    save("error", mix(tone(150, 0.18, 0.12, "triangle"), noise(0.18, 0.025, 20)))
    save("victory", sequence([(523, 0.10, 0.13), (659, 0.10, 0.14), (784, 0.16, 0.16), (1047, 0.22, 0.14)], gap=0.012))


if __name__ == "__main__":
    generate()
    print(f"Generated sounds in {OUT}")
