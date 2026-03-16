import json, sys

filepath = sys.argv[1]
label = sys.argv[2] if len(sys.argv) > 2 else "RESULTS"

with open(filepath) as f:
    text = f.read()

start = text.index("{\n")
data = json.loads(text[start:])
stats = data["stats"]

dur = stats["duration"] / 60000
passed = stats["expected"]
failed = stats["unexpected"]
flaky = stats["flaky"]
skipped = stats["skipped"]

print(f"{label}:")
print(f"  Duration: {dur:.1f} min")
print(f"  Passed: {passed}")
print(f"  Failed: {failed}")
print(f"  Flaky: {flaky}")
print(f"  Skipped: {skipped}")
print()

def walk(suites, file=""):
    for suite in suites:
        f = suite.get("file", file)
        for t in suite.get("specs", []):
            for test in t.get("tests", []):
                status = test["status"]
                if status in ("unexpected", "flaky"):
                    print(f"  {status.upper():12s} {f}:{t['line']} - {t['title']}")
        walk(suite.get("suites", []), f)

walk(data["suites"])
