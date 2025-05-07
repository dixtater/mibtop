//
// Created by Berci on 05/05/2025.
//

#ifndef MIBTOP_MONITOR_H
#define MIBTOP_MONITOR_H

#include <fstream>

void log_cpu_usage(std::ofstream& logFile);
void log_per_process_cpu(std::ofstream& logFile);
std::string currentTimeString();

#endif // MIBTOP_MONITOR_H
