# Updated version of log2json.py to store all /proc/stat CPU fields per timestamp
import sys
import json
import re
from datetime import datetime

def parse_cpu_line(line):
    parts = line.strip().split()
    label = parts[0]  # e.g. 'cpu' or 'cpu0'
    values = list(map(int, parts[1:11]))  # user to guest_nice
    keys = [
        "user", "nice", "system", "idle", "iowait",
        "irq", "softirq", "steal", "guest", "guest_nice"
    ]
    return label, dict(zip(keys, values))

def parse_process_line(line):
    match = re.match(r"Process (\d+): \d+ \((.+?)\)", line)
    if not match:
        return None
    parts = line.strip().split()
    pid = int(parts[1].strip(":"))
    name = match.group(2)
    try:
        utime = int(parts[13])
        stime = int(parts[14])
    except (IndexError, ValueError):
        utime = stime = 0
    return pid, name, utime + stime

def main():
    if len(sys.argv) < 2:
        print("Usage: python log2json.py <logfile> [output_prefix]")
        sys.exit(1)

    logfile = sys.argv[1]
    output_prefix = sys.argv[2] if len(sys.argv) > 2 else "output"

    cpu_total = []
    cpu_cores = {}
    cpu_processes = {}

    with open(logfile, 'r') as f:
        timestamp = None
        for line in f:
            if line.startswith("### Timestamp:"):
                timestamp_str = line.replace("### Timestamp:", "").strip()
                try:
                    timestamp = datetime.strptime(timestamp_str, "%a %b %d %H:%M:%S %Y").isoformat()
                except ValueError:
                    timestamp = None
            elif line.startswith("cpu ") and timestamp:
                label, values = parse_cpu_line(line)
                values["time"] = timestamp
                cpu_total.append(values)
            elif line.startswith("cpu") and timestamp:  # cpu0, cpu1, ...
                label, values = parse_cpu_line(line)
                values["time"] = timestamp
                cpu_cores.setdefault(label, []).append(values)
            elif line.startswith("Process ") and timestamp:
                parsed = parse_process_line(line)
                if parsed:
                    pid, name, usage = parsed
                    key = f"{name} ({pid})"
                    cpu_processes.setdefault(key, []).append({
                        "time": timestamp,
                        "usage_sum_utime_stime": usage
                    })

    with open(f"{output_prefix}_cpu_total.json", "w") as f:
        json.dump({"cpu_total": cpu_total}, f, indent=2)

    with open(f"{output_prefix}_cpu_cores.json", "w") as f:
        json.dump(cpu_cores, f, indent=2)

    with open(f"{output_prefix}_cpu_processes.json", "w") as f:
        json.dump(cpu_processes, f, indent=2)

    with open(f"{output_prefix}_combined.json", "w") as f:
        json.dump({
            "cpu_total": cpu_total,
            "cpu_cores": cpu_cores,
            "cpu_processes": cpu_processes
        }, f, indent=2)

    print(f"Generated: {output_prefix}_cpu_total.json, _cpu_cores.json, _cpu_processes.json, _combined.json")

if __name__ == "__main__":
    main()
