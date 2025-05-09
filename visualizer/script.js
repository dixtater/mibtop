async function loadData() {
  const response = await fetch("output_combined.json");
  return await response.json();
}

function createLineChart(ctx, datasets, labels) {
  return new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      responsive: true,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Time",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "% CPU Usage",
          },
          min: 0,
          max: 100,
        },
      },
    },
  });
}

function getColor(index) {
  const colors = [
    "blue",
    "red",
    "green",
    "purple",
    "orange",
    "teal",
    "magenta",
    "brown",
    "cyan",
    "lime",
  ];
  return colors[index % colors.length];
}

function computeCpuPercent(data) {
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const prev = data[i - 1];
    const curr = data[i];

    const activePrev = prev.user + prev.nice + prev.system + prev.irq + prev.softirq + prev.steal;
    const activeCurr = curr.user + curr.nice + curr.system + curr.irq + curr.softirq + curr.steal;
    const deltaActive = activeCurr - activePrev;

    const totalPrev = activePrev + prev.idle + prev.iowait;
    const totalCurr = activeCurr + curr.idle + curr.iowait;
    const deltaTotal = totalCurr - totalPrev;

    const percent = deltaTotal > 0 ? (deltaActive / deltaTotal) * 100 : 0;
    result.push(percent);
  }
  return result;
}

function getNormalizedTimestamps(data) {
  return data.slice(1).map((d) => d.time);
}

function renderCPUChart(cpuTotal, cpuCores) {
  const ctx = document.getElementById("totalCpuChart").getContext("2d");
  const labels = getNormalizedTimestamps(cpuTotal);
  const datasets = [
    {
      label: "Total CPU",
      data: computeCpuPercent(cpuTotal),
      fill: false,
      borderColor: getColor(0),
      tension: 0.1,
    },
  ];

  Object.keys(cpuCores).forEach((core, i) => {
    datasets.push({
      label: core,
      data: computeCpuPercent(cpuCores[core]),
      fill: false,
      borderColor: getColor(i + 1),
      tension: 0.1,
    });
  });

  createLineChart(ctx, datasets, labels);
}

function computeProcessPercent(procData, cpuTotal) {
  const result = [];
  for (let i = 1; i < procData.length; i++) {
    const deltaProc = procData[i].usage_sum_utime_stime - procData[i - 1].usage_sum_utime_stime;
    const prev = cpuTotal[i - 1];
    const curr = cpuTotal[i];
    const activePrev = prev.user + prev.nice + prev.system + prev.irq + prev.softirq + prev.steal;
    const activeCurr = curr.user + curr.nice + curr.system + curr.irq + curr.softirq + curr.steal;
    const idlePrev = prev.idle + prev.iowait;
    const idleCurr = curr.idle + curr.iowait;
    const deltaTotal = (activeCurr + idleCurr) - (activePrev + idlePrev);
    result.push(deltaTotal > 0 ? (deltaProc / deltaTotal) * 100 : 0);
  }
  return result;
}

function renderProcessSelector(processData, cpuTotal) {
  const ctx = document.getElementById("processChart").getContext("2d");
  const selector = document.getElementById("processSelector");

  const labelSet = new Set();
  Object.values(processData).forEach((arr) =>
    arr.forEach((d) => labelSet.add(d.time))
  );
  const labels = [...labelSet].sort();

  const sortedProcessNames = Object.entries(processData)
    .filter(([_, records]) => records.length >= 2)
    .map(([name, records]) => {
      const first = records[0].usage_sum_utime_stime;
      const last = records[records.length - 1].usage_sum_utime_stime;
      return { name, delta: last - first };
    })
    .sort((a, b) => b.delta - a.delta)
    .map(proc => proc.name);

  sortedProcessNames.forEach((name, index) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    selector.appendChild(option);
  });

  const topProcesses = sortedProcessNames.slice(0, 10);
  Array.from(selector.options).forEach(option => {
    if (topProcesses.includes(option.value)) {
      option.selected = true;
    }
  });

  const chart = createLineChart(ctx, [], labels);

  setTimeout(() => {
    console.log("Dispatching initial chart update for:", topProcesses);
    const event = new Event("change");
    selector.dispatchEvent(event);
  }, 100);

  selector.addEventListener("change", () => {
    const selected = Array.from(selector.selectedOptions).map((opt) => opt.value);
    chart.data.datasets = selected.map((name, i) => {
      const usage = processData[name].map((d) => d.usage_sum_utime_stime);
      const norm = computeProcessPercent(processData[name], cpuTotal);
      return {
        label: name,
        data: norm,
        fill: false,
        borderColor: getColor(i),
        tension: 0.1,
      };
    });
    chart.data.labels = labels.slice(1);
    chart.update();
  });
}

function renderProcessGroupPie(processData, cpuTotal) {
  const ctx = document.getElementById("processPieChart").getContext("2d");
  
  const processGroupMap = {
    kernel: [
      /^k/,
      /^irq\//,
      /^rcu/,
      /msm/,
      /watchdog/,
      /writeback/,
      /bioset/,
      /blockd/,
      /sched/,
      /kgsl/,
      /thermal/,
      /kworker/,
      /jbd2/,
      /ext4/
    ],
    android_system: [
      /^system_server$/, /^zygote/, /^logd$/, /^servicemanager$/, /^hwservicemanager$/, /^vndservicemanager$/,
      /^surfaceflinger$/, /^audioserver$/, /^cameraserver$/, /^mediaserver$/, /^inputflinger$/, /^wificond$/, /^lmkd$/
    ],
    vendor_services: [
      /^vendor\./, /^hwcomposer$/, /^thermalserviced$/, /^power_hal$/, /^gatekeeperd$/, /adsprpcd/, /qseecomd/
    ],
    networking: [
      /^netd$/, /^dnsmasq$/, /^ip6tables$/, /^iptables$/, /^wpa_supplicant$/, /wcnss_filter/, /wpa_supplicant/
    ],
    user_apps: [
      /^u0_a/, /^com\./, /^org\./, /^eu\./, /termux/, /android/,
      /gallery/, /contacts/, /settings/, /youtube/, /launcher/
    ],
    unknown: [/.*/]
  };
  
  
  
  console.log("🧠 Group map in use:", processGroupMap);
  

function classify(name) {
  const cleaned = name.replace(/\s+\(\d+\)$/, ""); // Strip " (PID)"
  for (const group in processGroupMap) {
    if (processGroupMap[group].some(regex => regex.test(cleaned))) {
      console.log(`✅ ${cleaned} → ${group}`);
      return group;
    }
  }
  console.warn(`❌ ${cleaned} → unknown`);
  return "unknown";
}

  const groupUsage = {};

  Object.entries(processData).forEach(([name, records]) => {
    if (records.length < 2) return;
	console.log("✅ Classifying:", name);
    const group = classify(name);
    const usage = computeProcessPercent(records, cpuTotal);
    const avg = usage.reduce((a, b) => a + b, 0) / usage.length;
    groupUsage[group] = (groupUsage[group] || 0) + avg;
  });

  new Chart(ctx, {
    type: "pie",
    data: {
      labels: Object.keys(groupUsage),
      datasets: [{
        data: Object.values(groupUsage),
        backgroundColor: Object.keys(groupUsage).map((_, i) => getColor(i))
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Average CPU Usage by Process Group"
        }
      }
    }
  });
}

loadData().then((data) => {
  renderCPUChart(data.cpu_total, data.cpu_cores);
  renderProcessSelector(data.cpu_processes, data.cpu_total);
  renderProcessGroupPie(data.cpu_processes, data.cpu_total);
});
