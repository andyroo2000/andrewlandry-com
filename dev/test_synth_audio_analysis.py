"""Check frequency separation and timestamp alignment using known signals."""
import unittest

import numpy as np

from synth_audio_analysis import FPS, SAMPLE_RATE, measure_frames, normalize_features


class AudioAnalysisTests(unittest.TestCase):
    def tone(self, frequency):
        time = np.arange(SAMPLE_RATE * 2) / SAMPLE_RATE
        wave = (np.sin(2 * np.pi * frequency * time) * 0.5).astype(np.float32)
        return np.stack((wave, -wave), axis=1)

    def test_stereo_bass_cannot_cancel_itself(self):
        measured = measure_frames(self.tone(100))[FPS:-FPS]
        level, bass, mid, high, _ = np.mean(measured, axis=0)
        self.assertGreater(level, 0.3)
        self.assertGreater(bass, mid * 20)
        self.assertGreater(bass, high * 100)

    def test_high_tone_belongs_in_treble(self):
        measured = measure_frames(self.tone(4000))[FPS:-FPS]
        _, bass, mid, high, _ = np.mean(measured, axis=0)
        self.assertGreater(high, 0.3)
        self.assertGreater(high, bass * 100)
        self.assertGreater(high, mid * 20)

    def test_silence_and_tone_use_source_timestamps(self):
        audio = self.tone(100)
        audio[:SAMPLE_RATE] = 0
        features = normalize_features(measure_frames(audio))
        self.assertEqual(len(features), FPS * 2 + 1)
        self.assertEqual(features.dtype, np.uint8)
        self.assertEqual(int(features[:18].max()), 0)
        self.assertGreater(int(features[22:35, 1].min()), 240)

    def test_deep_bass_rejects_higher_synth_fundamentals(self):
        for frequency in (50, 70):
            features = normalize_features(measure_frames(self.tone(frequency)))
            self.assertGreater(int(features[FPS:-FPS, 4].min()), 240)
        for frequency in (120, 160, 400, 4000):
            features = normalize_features(measure_frames(self.tone(frequency)))
            self.assertLess(int(features[FPS:-FPS, 4].max()), 25)

    def test_quiet_deep_bass_survives_without_amplifying_leakage(self):
        features = normalize_features(measure_frames(self.tone(50) * 0.02))
        self.assertGreater(int(features[FPS:-FPS, 4].min()), 240)


if __name__ == "__main__":
    unittest.main()
