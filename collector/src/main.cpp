#include <iostream>
#include <fstream>
#include <chrono>
#include <thread>
#include <csignal>
#include "mibtop/monitor.h"

bool running = true;

void handle_signal(int signal) {
    if (signal == SIGINT || signal == SIGTERM) {
        running = false;
    }
}

int main(int argc, char* argv[]) {
    int cycleTime = 1; // default: 1 second sampling
    std::string logPath = "/data/local/tmp/mibtop_log.txt";

    if (argc > 1) {
        cycleTime = std::stoi(argv[1]);
    }
    if (argc > 2) {
        logPath = argv[2];
    }

    std::signal(SIGINT, handle_signal);
    std::signal(SIGTERM, handle_signal);

    std::ofstream logFile(logPath, std::ios::out | std::ios::app);
    if (!logFile.is_open()) {
        std::cerr << "Failed to open log file: " << logPath << "\n";
        return 1;
    }

    while (running) {
        logFile << "### Timestamp: " << currentTimeString() << "\n";
        log_cpu_usage(logFile);
        log_per_process_cpu(logFile);
        logFile.flush();
        std::this_thread::sleep_for(std::chrono::seconds(cycleTime));
    }

    logFile.close();
    return 0;
}
