import sys
import json
import re
from datetime import datetime

def parse_cpu_line(line):
    """Parses a 'cpu' or 'cpuN' line and returns usage."""
    parts = line.strip().split()
    if len(parts) < 8:
        return None, None
    label = parts[0]
    values = list(map(int, parts[1:8]))  # user, nice, system, idle, iowait, irq, softirq
    usage = sum(values[:3])  # user + nice + system
    return label, usage

def parse_process_line(line):
    """Parses a 'Process' line and returns PID, name, utime, stime."""
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
        print("Usage: python convert_log_to_json.py <logfile>")
        sys.exit(1)

    logfile = sys.argv[1]
    total_cpu = []
    per_core_cpu = {}
    per_process_cpu = {}

    with open(logfile, 'r') as f:
        timestamp = None
        for line in f:
            if line.startswith("### Timestamp:"):
                timestamp_str = line.replace("### Timestamp:", "").strip()
                timestamp = datetime.strptime(timestamp_str, "%a %b %d %H:%M:%S %Y").isoformat()
            elif line.startswith("cpu") and not line.startswith("cpu "):  # core lines
                label, usage = parse_cpu_line(line)
                if label and usage is not None and timestamp:
                    per_core_cpu.setdefault(label, []).append({
                        "time": timestamp,
                        "usage": usage
                    })
            elif line.startswith("cpu ") and timestamp:  # total CPU line
                label, usage = parse_cpu_line(line)
                if usage is not None:
                    total_cpu.append({"time": timestamp, "usage": usage})
            elif line.startswith("Process") and timestamp:
                parsed = parse_process_line(line)
                if parsed:
                    pid, name, usage = parsed
                    key = f"{name} ({pid})"
                    per_process_cpu.setdefault(key, []).append({
                        "time": timestamp,
                        "usage": usage
                    })

    with open("cpu_total.json", "w") as f:
        json.dump({"cpu_total": total_cpu}, f, indent=2)

    with open("cpu_cores.json", "w") as f:
        json.dump(per_core_cpu, f, indent=2)

    with open("cpu_processes.json", "w") as f:
        json.dump(per_process_cpu, f, indent=2)

    print("Generated: cpu_total.json, cpu_cores.json, cpu_processes.json")

if __name__ == "__main__":
    main()
