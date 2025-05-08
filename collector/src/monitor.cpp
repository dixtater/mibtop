#include "mibtop/monitor.h"
#include <fstream>
#include <sstream>
#include <string>
#include <regex>
#include <dirent.h>
#include <ctime>
#include <iomanip>

std::string currentTimeString() {
    auto now = std::time(nullptr);
    std::ostringstream oss;
    oss << std::put_time(std::localtime(&now), "%a %b %e %T %Y");
    return oss.str();
}

void log_cpu_usage(std::ofstream& logFile) {
    std::ifstream statFile("/proc/stat");
    if (!statFile.is_open()) {
        logFile << "Failed to open /proc/stat\n";
        return;
    }

    std::string line;
    while (std::getline(statFile, line)) {
        if (line.compare(0, 3, "cpu") == 0) {
            logFile << line << "\n";
        } else {
            break;
        }
    }
}

void log_per_process_cpu(std::ofstream& logFile) {
    const std::string procPath = "/proc";
    DIR* dir = opendir(procPath.c_str());
    if (!dir) {
        logFile << "Failed to open /proc directory\n";
        return;
    }

    dirent* entry;
    std::regex pidRegex("^[0-9]+$");
    int count = 0;

    while ((entry = readdir(dir)) != nullptr) {
        std::string dirName(entry->d_name);

        if (!std::regex_match(dirName, pidRegex)) {
            continue;
        }

        std::string statPath = procPath + "/" + dirName + "/stat";
        std::ifstream statFile(statPath);
        if (!statFile.is_open()) {
            logFile << "Could not open " << statPath << "\n";
            continue;
        }

        std::string statLine;
        std::getline(statFile, statLine);

        // Debugging output for each process
        logFile << "Process " << dirName << ": " << statLine << "\n";

        ++count;
    }

    logFile << "Processes scanned: " << count << "\n";
    closedir(dir);
}

