# Generates the demo voiceover with Kokoro (open-source neural TTS) and mixes it onto the video.
#   pip install kokoro-onnx soundfile
#   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx
#   curl -LO https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin
#   python3 demo/voiceover.py [voice]     # default am_michael; try af_heart, am_puck, bf_emma
# Reads demo/out/snip-demo.mp4, writes demo/out/snip-demo-voiced.mp4
import sys, subprocess, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
voice = sys.argv[1] if len(sys.argv) > 1 else "am_michael"
# (start, end, spoken text) — numbers spelled out so they're read naturally
LINES = [
 (0.4, 5.6, "This is two years of my bank account. Twelve hundred and seventy-two payments."),
 (5.8, 10.6, "Somewhere in here are subscriptions I forgot I was paying for."),
 (10.8, 14.8, "Finding them by hand? Not happening."),
 (15.4, 19.6, "So I built snip. Drop in a statement export..."),
 (19.8, 24.6, "and it prints every subscription on a receipt. In under a second."),
 (25.0, 30.4, "Thirty-two hundred dollars a year. That's a hundred and eighty-two hours of work at my wage."),
 (30.8, 39.6, "And it catches what I'd never notice. Two price hikes, and a double charge."),
 (40.0, 45.6, "Three video apps, and two AI chatbots? Time to cut a few."),
 (46.0, 52.6, "Invest that instead, and it's almost thirty-nine thousand dollars in twenty-five years."),
 (53.0, 59.6, "And I get a receipt worth sharing."),
 (60.2, 66.6, "snip runs entirely in your browser. Nothing gets uploaded. Try it with your own statement. Link below."),
]
out = []
for i, (s, e, text) in enumerate(LINES):
    speed = 1.05
    for _ in range(4):
        audio, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
        dur = len(audio) / sr
        if dur <= (e - s) + 0.3: break
        speed = round(speed * dur / (e - s - 0.1), 2)
    sf.write(f"demo/out/vo_{i:02d}.wav", audio, sr)
    out.append({"i": i, "start": s, "end": e, "dur": round(dur, 2), "speed": speed})
    print(i, s, e, round(dur, 2), speed)

out[-1]["start"] = 59.9  # longest line starts as the end card fades in
inputs, filt = [], []
for n, l in enumerate(out):
    inputs += ["-i", f"demo/out/vo_{l['i']:02d}.wav"]
    ms = int(l["start"] * 1000)
    filt.append(f"[{n+1}:a]adelay={ms}|{ms},aresample=48000[a{n}]")
filt.append("".join(f"[a{n}]" for n in range(len(out)))
            + f"amix=inputs={len(out)}:normalize=0,highpass=f=70,acompressor=threshold=-18dB:ratio=3:attack=5:release=120,loudnorm=I=-16:TP=-1.5:LRA=7[vo]")
subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", "demo/out/snip-demo.mp4", *inputs, "-filter_complex", ";".join(filt),
                "-map", "0:v", "-map", "[vo]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest",
                "-movflags", "+faststart", "demo/out/snip-demo-voiced.mp4"], check=True)
print("wrote demo/out/snip-demo-voiced.mp4")
