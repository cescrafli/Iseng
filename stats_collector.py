import time
import json
import psutil
import sys
import threading
from collections import deque
import math

class AnomalyDetector:
    def __init__(self, window_size=60):
        self.cpu_history = deque(maxlen=window_size)
        self.mem_history = deque(maxlen=window_size)
        self.window_size = window_size

    def _calculate_stats(self, data):
        if len(data) < 10: # Need some baseline
            return None, None
        
        mean = sum(data) / len(data)
        variance = sum([((x - mean) ** 2) for x in data]) / len(data)
        std_dev = math.sqrt(variance)
        return mean, std_dev

    def check(self, cpu, mem):
        anomalies = []
        
        # Check CPU
        c_mean, c_std = self._calculate_stats(self.cpu_history)
        if c_mean is not None and c_std > 0.5: # Filter out low variance noise
            z_score = (cpu - c_mean) / c_std
            if z_score > 3:
                anomalies.append({"type": "CPU", "severity": "CRITICAL", "message": f"CPU Spike detected! (Z-Score: {z_score:.1f})"})
            elif z_score > 2:
                anomalies.append({"type": "CPU", "severity": "WARNING", "message": f"High CPU usage deviation. (Z-Score: {z_score:.1f})"})
        
        # Check Memory
        m_mean, m_std = self._calculate_stats(self.mem_history)
        if m_mean is not None and m_std > 0.5:
            z_score = (mem - m_mean) / m_std
            if z_score > 3:
                anomalies.append({"type": "MEMORY", "severity": "CRITICAL", "message": f"Memory Surge detected! (Z-Score: {z_score:.1f})"})
            elif z_score > 2:
                anomalies.append({"type": "MEMORY", "severity": "WARNING", "message": f"Unusual Memory pattern. (Z-Score: {z_score:.1f})"})

        # Update history
        self.cpu_history.append(cpu)
        self.mem_history.append(mem)

        return anomalies

# Global detector instance
detector = AnomalyDetector()

def get_sys_stats(last_net, last_time):
    cpu = psutil.cpu_percent(interval=None)
    mem = psutil.virtual_memory().percent
    
    current_net = psutil.net_io_counters()
    current_time = time.time()
    
    time_diff = current_time - last_time
    if time_diff == 0: time_diff = 1
    
    sent_per_sec = (current_net.bytes_sent - last_net.bytes_sent) / time_diff / 1024
    recv_per_sec = (current_net.bytes_recv - last_net.bytes_recv) / time_diff / 1024
    
    # Check for anomalies
    anomalies = detector.check(cpu, mem)

    return {
        "cpu": cpu,
        "memory": mem,
        "network_in": round(recv_per_sec, 1),
        "network_out": round(sent_per_sec, 1),
        "anomalies": anomalies 
    }, current_net, current_time

def get_processes():
    # Get top 20 processes by CPU
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 'memory_percent']):
        try:
            procs.append(p.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    # Sort by CPU desc
    procs.sort(key=lambda x: x['cpu_percent'], reverse=True)
    return procs[:20]

def get_disk_info():
    partitions = []
    for part in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append({
                "device": part.device,
                "mountpoint": part.mountpoint,
                "fstype": part.fstype,
                "total": usage.total,
                "used": usage.used,
                "free": usage.free,
                "percent": usage.percent
            })
        except PermissionError:
            continue
    return partitions

def main():
    # Initial read
    psutil.cpu_percent()
    last_net = psutil.net_io_counters()
    last_time = time.time()
    
    tick = 0
    
    while True:
        try:
            # 1. System Stats (Every 1s)
            stats, last_net, last_time = get_sys_stats(last_net, last_time)
            print(f"STATS:{json.dumps(stats)}")
            
            # 2. Processes (Every 3s)
            if tick % 3 == 0:
                procs = get_processes()
                print(f"PROCS:{json.dumps(procs)}")
            
            # 3. Disk Info (Every 10s)
            if tick % 10 == 0:
                disks = get_disk_info()
                print(f"DISK:{json.dumps(disks)}")

            sys.stdout.flush()
            
            tick += 1
            time.sleep(1)
            
        except Exception as e:
            # sys.stderr.write(f"Error: {e}\n")
            pass

if __name__ == "__main__":
    main()
